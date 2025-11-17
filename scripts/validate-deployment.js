#!/usr/bin/env node

/**
 * 部署验证脚本
 * 用于检查Vercel部署的关键配置是否正确
 */

const https = require('https');
const url = require('url');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️ ${message}`, 'blue');
}

// 验证URL格式
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// 发送HTTP请求
function makeRequest(requestUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(requestUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? require('https') : require('http');

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Bilibili-Subtitle-Validator/1.0',
        'Accept': 'application/json'
      }
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// 验证配置API
async function validateConfigApi(deploymentUrl) {
  logInfo('正在验证配置API...');

  try {
    const configUrl = `${deploymentUrl}/api/config`;
    const response = await makeRequest(configUrl);

    if (response.status === 200) {
      if (response.data && response.data.success) {
        logSuccess('配置API响应正常');

        // 检查环境变量配置
        const { environment, qwen, kimi, hasCookie } = response.data;

        if (environment) {
          logInfo(`环境: ${environment.isProduction ? '生产环境' : '开发环境'}`);
          logInfo(`部署URL: ${environment.deploymentUrl || '未知'}`);

          if (environment.allVarsConfigured) {
            logSuccess('所有必需的环境变量都已配置');
          } else {
            logWarning(`缺少环境变量: ${environment.missingVars.join(', ')}`);
          }
        }

        // 检查API Key配置
        if (qwen?.hasKey || kimi?.hasKey) {
          logSuccess('AI服务API Key已配置');
        } else {
          logWarning('AI服务API Key未配置，AI功能将无法使用');
        }

        // 检查Cookie配置
        if (hasCookie) {
          logSuccess('B站Cookie已配置，可以访问AI字幕');
        } else {
          logWarning('B站Cookie未配置，无法访问AI字幕');
        }

        return true;
      } else {
        logError('配置API返回数据格式异常');
        return false;
      }
    } else {
      logError(`配置API返回状态码: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`配置API验证失败: ${error.message}`);
    return false;
  }
}

// 验证处理API
async function validateProcessApi(deploymentUrl) {
  logInfo('正在验证处理API...');

  try {
    // 发送一个测试请求，验证API是否可访问
    const processUrl = `${deploymentUrl}/api/process`;
    const response = await makeRequest(processUrl); // GET请求会返回405，这是正常的

    if (response.status === 405 || response.status === 200) {
      logSuccess('处理API可访问');
      return true;
    } else {
      logError(`处理API返回异常状态码: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`处理API验证失败: ${error.message}`);
    return false;
  }
}

// 验证AI服务商连接
async function validateAIServices(deploymentUrl) {
  logInfo('正在验证AI服务商连接...');

  try {
    const configUrl = `${deploymentUrl}/api/config`;
    const response = await makeRequest(configUrl);

    if (response.status === 200 && response.data?.success) {
      const { provider, qwen, kimi } = response.data;

      logInfo(`当前AI服务商: ${provider === 'kimi' ? 'KIMI' : '通义千问'}`);

      if (provider === 'kimi' && kimi?.hasKey) {
        logSuccess('KIMI API Key已配置');
      } else if (provider === 'qwen' && qwen?.hasKey) {
        logSuccess('通义千问 API Key已配置');
      } else {
        logWarning('当前选择的AI服务商API Key未配置');
      }

      return true;
    } else {
      logError('无法获取AI服务配置信息');
      return false;
    }
  } catch (error) {
    logError(`AI服务验证失败: ${error.message}`);
    return false;
  }
}

// 主验证函数
async function validateDeployment(deploymentUrl) {
  logInfo(`开始验证部署: ${deploymentUrl}`);
  logInfo('='.repeat(50));

  const results = {
    configApi: false,
    processApi: false,
    aiServices: false
  };

  // 验证配置API
  results.configApi = await validateConfigApi(deploymentUrl);

  // 验证处理API
  results.processApi = await validateProcessApi(deploymentUrl);

  // 验证AI服务
  results.aiServices = await validateAIServices(deploymentUrl);

  logInfo('='.repeat(50));

  // 总结结果
  const allPassed = Object.values(results).every(result => result === true);

  if (allPassed) {
    logSuccess('🎉 部署验证通过！所有检查项都正常。');
    logInfo('您的B站字幕提取工具已准备就绪，可以正常使用了。');
  } else {
    logWarning('⚠️ 部署验证发现一些问题，请根据上面的提示进行修复。');
    logInfo('修复后请重新运行此脚本进行验证。');
  }

  // 提供后续建议
  logInfo('\n📋 后续建议:');
  if (deploymentUrl.includes('localhost')) {
    logInfo('1. 在生产环境部署前，请确保已正确配置环境变量');
    logInfo('2. 建议使用Vercel进行部署，并在项目设置中配置环境变量');
  } else {
    logInfo('1. 确保在Vercel控制台中设置了所有必需的环境变量');
    logInfo('2. 配置API Key以启用AI功能');
    logInfo('3. 可选：配置B站Cookie以访问AI字幕');
  }

  return allPassed;
}

// 命令行参数处理
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    logError('请提供部署URL作为参数');
    logInfo('使用方法: node validate-deployment.js <部署URL>');
    logInfo('示例: node validate-deployment.js https://your-app.vercel.app');
    process.exit(1);
  }

  const deploymentUrl = args[0].replace(/\/$/, ''); // 移除末尾的斜杠

  if (!isValidUrl(deploymentUrl)) {
    logError('提供的URL格式不正确');
    logInfo('请提供完整的HTTPS URL，例如：https://your-app.vercel.app');
    process.exit(1);
  }

  if (!deploymentUrl.startsWith('https://')) {
    logWarning('建议使用HTTPS URL以确保安全性');
  }

  try {
    const success = await validateDeployment(deploymentUrl);
    process.exit(success ? 0 : 1);
  } catch (error) {
    logError(`验证过程发生错误: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    logError(`程序执行失败: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { validateDeployment };
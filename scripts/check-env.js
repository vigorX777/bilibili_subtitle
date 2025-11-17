#!/usr/bin/env node

/**
 * 环境变量配置检查工具
 * 用于检查本地和生产环境的环境变量配置
 */

const fs = require('fs');
const path = require('path');

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

// 必需的环境变量
const REQUIRED_ENV_VARS = [
  'AI_PROVIDER',
  'QWEN_API_KEY',
  'KIMI_API_KEY',
  'QWEN_MODEL',
  'KIMI_MODEL',
  'BILIBILI_COOKIE'
];

// 推荐的环境变量
const RECOMMENDED_ENV_VARS = [
  'SYSTEM_PROMPT',
  'PROMPT_TEMPLATE',
  'QWEN_MAX_TOKENS'
];

// 检查本地环境变量文件
function checkLocalEnv() {
  logInfo('检查本地环境变量文件...');

  const envFiles = ['.env.local', '.env'];
  let foundEnvFile = null;
  let envContent = {};

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      foundEnvFile = envFile;
      const content = fs.readFileSync(envPath, 'utf-8');

      // 解析环境变量
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim();
          if (value) {
            envContent[key.trim()] = value;
          }
        }
      });
      break;
    }
  }

  if (foundEnvFile) {
    logSuccess(`找到环境文件: ${foundEnvFile}`);
    return envContent;
  } else {
    logWarning('未找到本地环境变量文件 (.env.local 或 .env)');
    return {};
  }
}

// 检查环境变量配置
function checkEnvVars(envVars, source = '本地') {
  logInfo(`检查${source}环境变量配置...`);

  let missingRequired = [];
  let configuredRequired = [];
  let configuredRecommended = [];

  // 检查必需的环境变量
  REQUIRED_ENV_VARS.forEach(varName => {
    if (envVars[varName] && envVars[varName].trim() !== '') {
      configuredRequired.push(varName);
    } else {
      missingRequired.push(varName);
    }
  });

  // 检查推荐的环境变量
  RECOMMENDED_ENV_VARS.forEach(varName => {
    if (envVars[varName] && envVars[varName].trim() !== '') {
      configuredRecommended.push(varName);
    }
  });

  // 输出结果
  if (configuredRequired.length > 0) {
    logSuccess(`已配置的必需环境变量 (${configuredRequired.length}/${REQUIRED_ENV_VARS.length}):`);
    configuredRequired.forEach(varName => {
      const isSensitive = varName.includes('API_KEY') || varName.includes('COOKIE');
      const displayValue = isSensitive
        ? `${envVars[varName].substring(0, 10)}...${envVars[varName].slice(-4)}`
        : envVars[varName];
      log(`  ${varName}: ${displayValue}`);
    });
  }

  if (missingRequired.length > 0) {
    logError(`缺少的必需环境变量 (${missingRequired.length}):`);
    missingRequired.forEach(varName => {
      log(`  - ${varName}`);
    });
  }

  if (configuredRecommended.length > 0) {
    logSuccess(`已配置的推荐环境变量 (${configuredRecommended.length}):`);
    configuredRecommended.forEach(varName => {
      log(`  ✓ ${varName}`);
    });
  }

  // 功能性检查
  const hasAIProvider = envVars.AI_PROVIDER === 'qwen' || envVars.AI_PROVIDER === 'kimi';
  const hasCurrentProviderKey = envVars.AI_PROVIDER === 'qwen'
    ? envVars.QWEN_API_KEY
    : envVars.KIMI_API_KEY;

  if (hasAIProvider && hasCurrentProviderKey) {
    logSuccess(`✅ AI服务已配置 (${envVars.AI_PROVIDER})`);
  } else {
    logError('❌ AI服务未正确配置');
  }

  if (envVars.BILIBILI_COOKIE) {
    logSuccess('✅ B站Cookie已配置，可以访问AI字幕');
  } else {
    logWarning('⚠️ B站Cookie未配置，无法访问AI字幕（但仍可使用普通CC字幕）');
  }

  return {
    allRequiredConfigured: missingRequired.length === 0,
    configuredCount: configuredRequired.length,
    totalRequired: REQUIRED_ENV_VARS.length
  };
}

// 生成环境变量模板
function generateEnvTemplate() {
  logInfo('生成环境变量模板...');

  const template = `# B站视频字幕提取工具环境变量配置
# 复制此文件为 .env.local 并填入您的实际配置

# ==================== AI服务配置 ====================

# 当前AI服务商（qwen | kimi）
AI_PROVIDER=kimi

# 阿里云通义千问API Key
QWEN_API_KEY=

# Moonshot KIMI API Key
KIMI_API_KEY=

# 通义千问模型（可选）
# 可选: qwen-turbo, qwen-plus, qwen-max, qwen-max-longcontext
QWEN_MODEL=qwen-plus

# KIMI模型（可选）
# 可选: kimi-k2-0905-preview, kimi-k2-0711-preview, kimi-k2-turbo-preview
KIMI_MODEL=kimi-k2-turbo-preview

# AI最大输出长度（可选）
QWEN_MAX_TOKENS=8000

# AI系统提示词（可选）
# SYSTEM_PROMPT=

# AI Prompt模板（可选）
# PROMPT_TEMPLATE=

# ==================== B站API配置 ====================

# B站Cookie（用于访问AI字幕）
BILIBILI_COOKIE=
`;

  const templatePath = path.join(process.cwd(), '.env.example');
  fs.writeFileSync(templatePath, template);
  logSuccess(`环境变量模板已生成: ${templatePath}`);
}

// 生成Vercel环境变量配置指南
function generateVercelGuide() {
  logInfo('生成Vercel配置指南...');

  const guide = `## Vercel环境变量配置指南

### 步骤1: 访问Vercel控制台
1. 打开 https://vercel.com/dashboard
2. 选择您的项目

### 步骤2: 进入环境变量设置
1. 点击项目页面的 "Settings" 标签
2. 在左侧菜单中选择 "Environment Variables"

### 步骤3: 添加环境变量
复制以下变量名和对应的值到Vercel控制台:

#### 必需的环境变量:
- AI_PROVIDER = kimi (或 qwen)
- QWEN_API_KEY = 您的通义千问API密钥
- KIMI_API_KEY = 您的KIMI API密钥
- QWEN_MODEL = qwen-plus
- KIMI_MODEL = kimi-k2-turbo-preview
- BILIBILI_COOKIE = 您的B站Cookie (可选)

#### 可选的环境变量:
- QWEN_MAX_TOKENS = 8000
- SYSTEM_PROMPT = 自定义AI系统提示词
- PROMPT_TEMPLATE = 自定义AI Prompt模板

### 步骤4: 保存并重新部署
1. 点击 "Save" 按钮保存环境变量
2. 返回项目页面，点击 "Redeploy" 重新部署项目

### 验证配置
部署完成后，访问您的应用，点击右上角的"配置API"按钮，
如果看到"生产环境配置指南"，说明配置成功。

### 获取API密钥
- 通义千问: https://dashscope.console.aliyun.com/apiKey
- KIMI: https://platform.moonshot.cn/console/api-keys

### 获取B站Cookie
1. 登录 bilibili.com
2. 按F12打开开发者工具
3. 切换到Application标签
4. 找到Cookies -> https://www.bilibili.com
5. 复制SESSDATA的值
`;

  const guidePath = path.join(process.cwd(), 'VERCEL_DEPLOYMENT.md');
  fs.writeFileSync(guidePath, guide);
  logSuccess(`Vercel配置指南已生成: ${guidePath}`);
}

// 主函数
async function main() {
  logInfo('开始检查环境变量配置...');
  logInfo('='.repeat(50));

  // 检查本地环境
  const localEnvVars = checkLocalEnv();

  if (Object.keys(localEnvVars).length > 0) {
    const localResult = checkEnvVars(localEnvVars, '本地');

    logInfo('='.repeat(50));

    // 生成建议
    if (localResult.allRequiredConfigured) {
      logSuccess('🎉 本地环境变量配置完整！');
      logInfo('您可以直接运行开发服务器: npm run dev');
    } else {
      logWarning('⚠️ 本地环境变量配置不完整');
      logInfo('请根据上面的提示补充缺失的环境变量');
    }
  } else {
    logWarning('未找到本地环境变量文件');
    logInfo('正在生成环境变量模板...');
    generateEnvTemplate();
  }

  // 生成Vercel配置指南
  generateVercelGuide();

  logInfo('='.repeat(50));
  logInfo('📋 后续步骤:');
  logInfo('1. 完善 .env.local 文件中的配置');
  logInfo('2. 查看 VERCEL_DEPLOYMENT.md 了解生产环境配置');
  logInfo('3. 部署到Vercel后，使用 npm run validate <URL> 验证部署');
  logInfo('4. 在应用中配置API Key和Cookie');

  logInfo('\n✅ 环境变量检查完成！');
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    logError(`程序执行失败: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { checkEnvVars, REQUIRED_ENV_VARS, RECOMMENDED_ENV_VARS };
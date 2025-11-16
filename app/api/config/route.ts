import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * 获取当前配置
 */
export async function GET() {
  try {
    // 从 process.env 读取环境变量（支持本地和生产环境）
    // 读取QWEN_API_KEY
    const qwenApiKey = process.env.QWEN_API_KEY || '';

    // 读取KIMI_API_KEY
    const kimiApiKey = process.env.KIMI_API_KEY || '';

    // 读取AI_PROVIDER
    const provider = process.env.AI_PROVIDER || 'qwen';

    // 读取QWEN_MODEL
    const qwenModel = process.env.QWEN_MODEL || 'qwen-plus';

    // 读取KIMI_MODEL
    const kimiModel = process.env.KIMI_MODEL || 'kimi-k2-0905-preview';

    // 读取BILIBILI_COOKIE
    const bilibiliCookie = process.env.BILIBILI_COOKIE || '';

    return NextResponse.json({
      success: true,
      provider,
      qwen: {
        apiKey: qwenApiKey,
        model: qwenModel,
        hasKey: qwenApiKey !== ''
      },
      kimi: {
        apiKey: kimiApiKey,
        model: kimiModel,
        hasKey: kimiApiKey !== ''
      },
      bilibiliCookie: bilibiliCookie,
      hasCookie: bilibiliCookie !== '',
      // 兼容旧版前端
      hasKey: provider === 'kimi' ? kimiApiKey !== '' : qwenApiKey !== '',
      apiKey: provider === 'kimi' ? kimiApiKey : qwenApiKey,
      keyPreview: (provider === 'kimi' ? kimiApiKey !== '' : qwenApiKey !== '') ? '已配置' : '未配置'
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

/**
 * 更新API Key配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, provider = 'qwen', model, bilibiliCookie } = body;

    // 检查是否是生产环境（Vercel）
    const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

    if (isProduction) {
      // 生产环境无法写入文件，提示用户手动配置
      return NextResponse.json(
        {
          error: '生产环境无法保存配置，请在 Vercel 项目 Settings > Environment Variables 中手动配置环境变量',
          details: {
            message: '请在 Vercel 控制台中配置以下环境变量：',
            variables: {
              AI_PROVIDER: provider,
              ...(provider === 'qwen'
                ? { QWEN_API_KEY: apiKey, QWEN_MODEL: model || 'qwen-plus' }
                : { KIMI_API_KEY: apiKey, KIMI_MODEL: model || 'kimi-k2-0905-preview' }
              ),
              ...(bilibiliCookie ? { BILIBILI_COOKIE: bilibiliCookie } : {})
            }
          }
        },
        { status: 400 }
      );
    }

    // 读取或创建.env.local文件（仅在开发环境）
    const envPath = join(process.cwd(), '.env.local');
    let envContent = '';

    try {
      envContent = await readFile(envPath, 'utf-8');
    } catch (readError) {
      // 文件不存在，创建基础模板
      envContent = `# 本地开发环境变量
# 如需使用AI功能，请配置您的通义千问API密钥
QWEN_API_KEY=

# 通义千问模型（可选）
QWEN_MODEL=qwen-plus

# AI系统提示词（可选，定义AI角色和风格）
# SYSTEM_PROMPT=

# AI Prompt模板（可选，定义具体任务指令）
# PROMPT_TEMPLATE=

# B站Cookie（用于访问AI字幕）
BILIBILI_COOKIE=
`;
    }

    // 如果提供了B站Cookie，更新它
    if (bilibiliCookie !== undefined) {
      if (envContent.includes('BILIBILI_COOKIE=')) {
        envContent = envContent.replace(
          /^BILIBILI_COOKIE=.*$/m,
          `BILIBILI_COOKIE=${bilibiliCookie}`
        );
      } else {
        envContent += `\nBILIBILI_COOKIE=${bilibiliCookie}`;
      }
    }

    // 如果没有提供API Key，只更新Cookie
    if (!apiKey) {
      await writeFile(envPath, envContent, 'utf-8');
      return NextResponse.json({
        success: true,
        message: 'Cookie配置成功，请刷新页面使配置生效'
      });
    }

    // 更新AI_PROVIDER
    if (envContent.includes('AI_PROVIDER=')) {
      envContent = envContent.replace(
        /^AI_PROVIDER=.*$/m,
        `AI_PROVIDER=${provider}`
      );
    } else {
      envContent = `AI_PROVIDER=${provider}\n${envContent}`;
    }

    if (provider === 'qwen') {
      // 替换或添加QWEN_API_KEY
      if (envContent.includes('QWEN_API_KEY=')) {
        envContent = envContent.replace(
          /^QWEN_API_KEY=.*$/m,
          `QWEN_API_KEY=${apiKey}`
        );
      } else {
        envContent = `QWEN_API_KEY=${apiKey}\n${envContent}`;
      }

      // 更新QWEN_MODEL（如果提供）
      if (model) {
        if (envContent.includes('QWEN_MODEL=')) {
          envContent = envContent.replace(
            /^QWEN_MODEL=.*$/m,
            `QWEN_MODEL=${model}`
          );
        } else {
          envContent = `QWEN_MODEL=${model}\n${envContent}`;
        }
      }
    } else if (provider === 'kimi') {
      // 替换或添加KIMI_API_KEY
      if (envContent.includes('KIMI_API_KEY=')) {
        envContent = envContent.replace(
          /^KIMI_API_KEY=.*$/m,
          `KIMI_API_KEY=${apiKey}`
        );
      } else {
        envContent = `KIMI_API_KEY=${apiKey}\n${envContent}`;
      }

      // 更新KIMI_MODEL（如果提供）
      if (model) {
        if (envContent.includes('KIMI_MODEL=')) {
          envContent = envContent.replace(
            /^KIMI_MODEL=.*$/m,
            `KIMI_MODEL=${model}`
          );
        } else {
          envContent = `KIMI_MODEL=${model}\n${envContent}`;
        }
      }
    }

    // 写入文件
    await writeFile(envPath, envContent, 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'API Key配置成功，请刷新页面使配置生效'
    });
  } catch (error) {
    console.error('配置保存失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '配置保存失败' },
      { status: 500 }
    );
  }
}

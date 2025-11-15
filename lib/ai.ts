/**
 * 阿里云通义千问API集成
 */

import axios from 'axios';

const QWEN_API_KEY = process.env.QWEN_API_KEY || '';
const QWEN_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-plus';
const QWEN_SYSTEM_PROMPT = process.env.QWEN_SYSTEM_PROMPT || '';

/**
 * AI处理提示词模板
 */
const PROMPT_TEMPLATE = `你是一个专业的学习笔记生成助手。请根据以下视频字幕内容，生成一份结构化的Markdown学习笔记。

要求：
1. 在开头生成一段150字左右的核心内容摘要（Summary）
2. 分析全文，划分出合乎逻辑的段落和主题，生成带有多级标题的Markdown大纲
3. 在结尾以无序列表的形式，提炼出3-5个最重要的关键知识点（Key Takeaways）
4. 使用清晰的Markdown格式，包括标题、列表、加粗等
5. 保持专业、简洁、易于理解

视频标题：{title}

字幕内容：
{subtitle}

请生成学习笔记：`;

/**
 * 调用通义千问API生成笔记
 */
export async function generateNotes(title: string, subtitle: string): Promise<string> {
  console.log('开始调用通义千问API...');
  console.log('API Key 配置状态:', QWEN_API_KEY ? `已配置(长度: ${QWEN_API_KEY.length})` : '未配置');
  console.log('使用模型:', QWEN_MODEL);
  console.log('System Prompt:', QWEN_SYSTEM_PROMPT || '使用默认Prompt');
  
  if (!QWEN_API_KEY) {
    throw new Error('未配置QWEN_API_KEY环境变量');
  }

  const prompt = PROMPT_TEMPLATE
    .replace('{title}', title)
    .replace('{subtitle}', subtitle);
  
  console.log('Prompt 长度:', prompt.length);
  
  // 构建消息数组
  const messages: Array<{role: string; content: string}> = [];
  
  // 如果有自定义system prompt，添加到消息列表
  if (QWEN_SYSTEM_PROMPT) {
    messages.push({
      role: 'system',
      content: QWEN_SYSTEM_PROMPT
    });
  }
  
  // 添加用户消息
  messages.push({
    role: 'user',
    content: prompt
  });

  try {
    console.log('发送请求到通义千问...');
    const response = await axios.post(
      QWEN_API_URL,
      {
        model: QWEN_MODEL,
        input: {
          messages
        },
        parameters: {
          result_format: 'message',
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.8
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${QWEN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('API返回状态:', response.status);
    console.log('API返回数据结构:', JSON.stringify(response.data).substring(0, 200));

    if (response.data.output?.choices?.[0]?.message?.content) {
      const content = response.data.output.choices[0].message.content;
      console.log('✓ AI笔记生成成功，长度:', content.length);
      return content;
    }

    throw new Error('AI返回内容格式异常');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('AI调用错误:', errorMsg);
      console.error('错误详情:', error.response?.data);
      throw new Error(`AI处理失败: ${errorMsg}`);
    }
    console.error('AI调用异常:', error);
    throw error;
  }
}

/**
 * 生成简单的笔记（备用方案，不使用AI）
 */
export function generateSimpleNotes(title: string, subtitle: string): string {
  const lines = subtitle.split('\n').filter(line => line.trim());
  const preview = lines.slice(0, 20).join('\n');
  
  return `# ${title}

## 📝 内容摘要

这是关于"${title}"的视频内容。以下是基于字幕的文本整理。

## 📖 字幕内容

${subtitle}

## 🔑 关键要点

- 详细内容请查看上方字幕文本
- 建议结合视频进行学习
- 可以根据需要整理自己的笔记

---

*注意：此笔记是基于字幕自动生成，建议人工审核和补充。*
`;
}

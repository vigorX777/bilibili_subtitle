/**
 * B站视频信息和字幕提取工具
 */

import axios from 'axios';

// 从环境变量读取Cookie
const BILIBILI_COOKIE = process.env.BILIBILI_COOKIE || '';

// 调试：检查Cookie是否已配置
if (BILIBILI_COOKIE) {
  console.log('✓ B站Cookie已配置，长度:', BILIBILI_COOKIE.length);
} else {
  console.log('⚠️ B站Cookie未配置，将无法访问AI字幕');
}

interface SubtitleItem {
  from: number;
  to: number;
  content: string;
}

interface SubtitleInfo {
  lan: string;
  lan_doc: string;
  subtitle_url: string;
}

/**
 * 从URL中提取BV号
 */
export function extractBVID(url: string): string | null {
  // 支持多种B站链接格式
  const patterns = [
    /bilibili\.com\/video\/(BV[\w]+)/,
    /b23\.tv\/([A-Za-z0-9]+)/,
    /BV[\w]+/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  return null;
}

/**
 * 获取视频信息
 */
export async function getVideoInfo(bvid: string) {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://www.bilibili.com'
    };
    
    // 如果有Cookie，添加到请求头
    if (BILIBILI_COOKIE) {
      headers['Cookie'] = BILIBILI_COOKIE;
    }
    
    const response = await axios.get(`https://api.bilibili.com/x/web-interface/view`, {
      params: { bvid },
      headers
    });

    if (response.data.code !== 0) {
      throw new Error(response.data.message || '获取视频信息失败');
    }

    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`请求失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 获取视频字幕列表（包括AI字幕）
 */
export async function getSubtitleList(bvid: string, cid: number): Promise<SubtitleInfo[]> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://www.bilibili.com'
    };
    
    // 如果有Cookie，添加到请求头（关键：获取AI字幕需要登录）
    if (BILIBILI_COOKIE) {
      headers['Cookie'] = BILIBILI_COOKIE;
    }
    
    // 先尝试v2 API
    const v2Response = await axios.get(`https://api.bilibili.com/x/player/v2`, {
      params: {
        bvid,
        cid
      },
      headers
    });

    if (v2Response.data.code !== 0) {
      throw new Error(v2Response.data.message || '获取字幕列表失败');
    }

    const subtitleData = v2Response.data.data?.subtitle;
    const subtitles = subtitleData?.subtitles || [];
    
    // 检查是否有AI字幕
    const aiSubtitle = subtitleData?.ai_subtitle;
    if (aiSubtitle?.subtitle_url) {
      // 将AI字幕添加到列表中（如果还没有）
      const hasAiSubtitle = subtitles.some((sub: SubtitleInfo) => 
        sub.subtitle_url === aiSubtitle.subtitle_url
      );
      
      if (!hasAiSubtitle) {
        subtitles.push({
          lan: aiSubtitle.lan || 'ai-zh',
          lan_doc: aiSubtitle.lan_doc || 'AI生成字幕',
          subtitle_url: aiSubtitle.subtitle_url
        });
      }
    }
    
    // 如果还是没有字幕，尝试player.so API
    if (subtitles.length === 0) {
      try {
        const soHeaders: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com'
        };
        
        if (BILIBILI_COOKIE) {
          soHeaders['Cookie'] = BILIBILI_COOKIE;
        }
        
        const soResponse = await axios.post(
          'https://api.bilibili.com/x/player.so',
          `cid=${cid}&aid=&bvid=${bvid}`,
          { headers: soHeaders }
        );
        
        // player.so 返回XML格式，需要解析
        const xmlData = soResponse.data;
        const subtitleMatch = xmlData.match(/<subtitle>([\s\S]*?)<\/subtitle>/);
        if (subtitleMatch) {
          const subtitleJson = JSON.parse(subtitleMatch[1] || '{}');
          if (subtitleJson.subtitles && Array.isArray(subtitleJson.subtitles)) {
            subtitles.push(...subtitleJson.subtitles);
          }
        }
      } catch (soError) {
        console.warn('player.so API调用失败:', soError);
      }
    }
    
    return subtitles;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`请求失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 下载并解析字幕内容
 */
export async function downloadSubtitle(subtitleUrl: string): Promise<string> {
  try {
    // 确保是完整的URL
    const fullUrl = subtitleUrl.startsWith('http') ? subtitleUrl : `https:${subtitleUrl}`;
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://www.bilibili.com'
    };
    
    if (BILIBILI_COOKIE) {
      headers['Cookie'] = BILIBILI_COOKIE;
    }
    
    const response = await axios.get(fullUrl, { headers });

    const subtitleData = response.data;
    const body = subtitleData.body as SubtitleItem[];
    
    // 将字幕数组合并成纯文本
    const text = body.map(item => item.content).join('\n');
    
    return text;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`下载字幕失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 提取视频字幕的完整流程
 */
export async function extractSubtitle(videoUrl: string): Promise<{
  title: string;
  subtitle: string;
}> {
  // 1. 提取BVID
  const bvid = extractBVID(videoUrl);
  if (!bvid) {
    throw new Error('无效的B站视频链接');
  }

  // 2. 获取视频信息
  const videoInfo = await getVideoInfo(bvid);
  const title = videoInfo.title;
  const cid = videoInfo.cid;

  if (!cid) {
    throw new Error('无法获取视频CID');
  }

  // 3. 获取字幕列表
  const subtitles = await getSubtitleList(bvid, cid);
  
  console.log('获取到的字幕列表:', subtitles);
  
  if (!subtitles || subtitles.length === 0) {
    throw new Error('该视频暂无字幕，处理功能将在未来版本支持');
  }

  // 4. 优先选择中文字幕（包括AI字幕）
  const chineseSubtitle = subtitles.find(sub => 
    sub.lan === 'zh-CN' || 
    sub.lan === 'zh-Hans' || 
    sub.lan === 'ai-zh' || 
    sub.lan_doc.includes('中') || 
    sub.lan_doc.includes('AI')
  ) || subtitles[0];

  // 5. 下载字幕
  const subtitleText = await downloadSubtitle(chineseSubtitle.subtitle_url);

  return {
    title,
    subtitle: subtitleText
  };
}

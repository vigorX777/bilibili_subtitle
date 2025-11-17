/**
 * 字幕提取调试工具
 * 用于详细分析特定视频的字幕提取过程
 */

import { extractBVID } from '../lib/bilibili';
import axios from 'axios';

interface DebugInfo {
  videoUrl: string;
  bvid: string;
  videoInfo?: {
    title: string;
    desc: string;
    cid: number;
  };
  v2Subtitles?: any[];
  soSubtitles?: any[];
  subtitleAnalysis?: Array<{
    index: number;
    type: string;
    url: string;
    content?: string;
    relevanceScore?: number;
    expectedKeywords: string[];
    unexpectedKeywords: string[];
    issues: string[];
  }>;
  errors: string[];
}

export async function debugSubtitleExtraction(videoUrl: string): Promise<DebugInfo> {
  console.log('=== DEBUG START ===');
  const debugInfo: DebugInfo = {
    videoUrl,
    bvid: '',
    errors: []
  };

  try {
    // 步骤1：提取BV号
    console.log('🎯 开始调试字幕提取:', videoUrl);
    let bvid;
    try {
      bvid = extractBVID(videoUrl);
      console.log('BV号提取成功:', bvid);
    } catch (error) {
      console.error('BV号提取失败:', error);
      throw new Error('无法从URL中提取BV号: ' + (error as Error).message);
    }

    debugInfo.bvid = bvid;
    console.log('提取到的BV号:', bvid);

    if (!bvid) {
      throw new Error('无法从URL中提取BV号');
    }

    // 步骤2：获取视频信息
    console.log('\n=== 1. 获取视频信息 ===');
    const videoInfo = await getVideoInfoDebug(bvid);
    debugInfo.videoInfo = videoInfo;
    console.log('视频标题:', videoInfo.title);
    console.log('视频描述:', videoInfo.desc?.substring(0, 200));
    console.log('CID:', videoInfo.cid);

    // 验证视频信息是否匹配期望内容
    const expectedKeywords = ['费曼', '学习', '心智', '模型'];
    const titleMatch = expectedKeywords.filter(kw => videoInfo.title.includes(kw));
    console.log('标题关键词匹配:', titleMatch);

    if (titleMatch.length === 0) {
      console.warn('⚠️ 标题中未找到期望关键词，可能获取了错误的视频信息');
    }

    // 步骤3：获取字幕列表（分别测试两个API）
    console.log('\n=== 2. v2 API字幕列表 ===');
    const v2Subtitles = await fetchV2APISubtitles(bvid, videoInfo.cid);
    debugInfo.v2Subtitles = v2Subtitles;
    console.log('v2 API找到', v2Subtitles.length, '个字幕');

    console.log('\n=== 3. player.so API字幕列表 ===');
    const soSubtitles = await fetchPlayerSoSubtitles(bvid, videoInfo.cid);
    debugInfo.soSubtitles = soSubtitles;
    console.log('player.so API找到', soSubtitles.length, '个字幕');

    // 步骤4：对比分析两个API的结果
    console.log('\n=== 4. API结果对比分析 ===');
    analyzeAPIDifferences(v2Subtitles, soSubtitles);

    // 步骤5：详细分析每个字幕
    console.log('\n=== 5. 字幕内容详细分析 ===');
    const subtitleAnalysis = await analyzeAllSubtitles(v2Subtitles, bvid, videoInfo);
    debugInfo.subtitleAnalysis = subtitleAnalysis;

    // 步骤6：总结发现
    console.log('\n=== 6. 总结发现 ===');
    summarizeFindings(debugInfo);

  } catch (error) {
    console.error('调试失败:', error);
    debugInfo.errors.push(error instanceof Error ? error.message : '未知错误');
  }

  return debugInfo;
}

async function getVideoInfoDebug(bvid: string) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://www.bilibili.com'
    };

    if (process.env.BILIBILI_COOKIE) {
      headers['Cookie'] = process.env.BILIBILI_COOKIE;
    }

    const response = await axios.get(`https://api.bilibili.com/x/web-interface/view`, {
      params: { bvid },
      headers,
      timeout: 10000
    });

    console.log('视频API响应状态:', response.status);
    console.log('视频API响应数据:', JSON.stringify(response.data, null, 2).substring(0, 500));

    if (response.data.code !== 0) {
      throw new Error(response.data.message || '获取视频信息失败');
    }

    const data = response.data.data;
    return {
      title: data.title || '',
      desc: data.desc || '',
      cid: data.cid || 0
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`视频API请求失败: ${error.message}`);
    }
    throw error;
  }
}

async function fetchV2APISubtitles(bvid: string, cid: number) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://www.bilibili.com'
    };

    if (process.env.BILIBILI_COOKIE) {
      headers['Cookie'] = process.env.BILIBILI_COOKIE;
    }

    const response = await axios.get(`https://api.bilibili.com/x/player/v2`, {
      params: { bvid, cid },
      headers,
      timeout: 10000
    });

    console.log('v2 API响应状态:', response.status);
    if (response.data.code !== 0) {
      console.log('v2 API错误:', response.data.message);
      return [];
    }

    const subtitleData = response.data.data?.subtitle;
    const subtitles = subtitleData?.subtitles || [];

    // 处理AI字幕
    const aiSubtitle = subtitleData?.ai_subtitle;
    if (aiSubtitle?.subtitle_url) {
      subtitles.push({
        lan: aiSubtitle.lan || 'ai-zh',
        lan_doc: aiSubtitle.lan_doc || 'AI生成字幕',
        subtitle_url: aiSubtitle.subtitle_url
      });
    }

    return subtitles;
  } catch (error) {
    console.error('v2 API请求失败:', error);
    return [];
  }
}

async function fetchPlayerSoSubtitles(bvid: string, cid: number) {
  try {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com'
    };

    if (process.env.BILIBILI_COOKIE) {
      headers['Cookie'] = process.env.BILIBILI_COOKIE;
    }

    const response = await axios.post(
      'https://api.bilibili.com/x/player.so',
      `cid=${cid}&aid=&bvid=${bvid}`,
      { headers, timeout: 10000 }
    );

    console.log('player.so API响应状态:', response.status);

    // 解析XML格式的响应
    const xmlData = response.data;
    const subtitleMatch = xmlData.match(/<subtitle>([\s\S]*?)<\/subtitle>/);

    if (subtitleMatch) {
      const subtitleJson = JSON.parse(subtitleMatch[1] || '{}');
      return subtitleJson.subtitles || [];
    }

    return [];
  } catch (error) {
    console.error('player.so API请求失败:', error);
    return [];
  }
}

function analyzeAPIDifferences(v2Subs: any[], soSubs: any[]) {
  console.log('\n=== API差异分析 ===');

  console.log('字幕数量对比:');
  console.log('  v2 API:', v2Subs.length, '个字幕');
  console.log('  player.so API:', soSubs.length, '个字幕');

  if (v2Subs.length !== soSubs.length) {
    console.warn('⚠️ 两个API返回的字幕数量不一致');
  }

  // 分析语言选项
  const v2Langs = new Set(v2Subs.map(sub => sub.lan));
  const soLangs = new Set(soSubs.map(sub => sub.lan));

  console.log('语言选项对比:');
  console.log('  v2 API语言:', [...v2Langs]);
  console.log('  player.so API语言:', [...soLangs]);

  const commonLangs = [...v2Langs].filter(l => soLangs.has(l));
  console.log('  共同语言:', commonLangs);

  if (commonLangs.length === 0) {
    console.warn('⚠️ 两个API没有共同的语言选项');
  }
}

async function analyzeAllSubtitles(subtitles: any[], bvid: string, videoInfo: any) {
  const analysis = [];

  console.log('\n开始分析每个字幕内容...');

  for (let i = 0; i < subtitles.length; i++) {
    const subtitle = subtitles[i];
    console.log(`\n--- 分析字幕 ${i + 1}/${subtitles.length} ---`);
    console.log('类型:', subtitle.lan_doc);
    console.log('语言:', subtitle.lan);
    console.log('URL:', subtitle.subtitle_url);

    const analysisItem = {
      index: i,
      type: subtitle.lan_doc,
      url: subtitle.subtitle_url,
      content: '',
      relevanceScore: 0,
      expectedKeywords: [],
      unexpectedKeywords: [],
      issues: []
    };

    try {
      // 下载字幕内容
      const content = await downloadSubtitleDebug(subtitle.subtitle_url, bvid);
      analysisItem.content = content.substring(0, 500); // 保存前500字用于分析

      console.log('字幕长度:', content.length);
      console.log('字幕预览:', content.substring(0, 200));

      // 分析内容相关性
      const expectedKeywords = ['费曼', '学习', '心智', '模型'];
      const foundExpected = expectedKeywords.filter(kw => content.includes(kw));
      analysisItem.expectedKeywords = foundExpected;

      // 检查异常关键词
      const unexpectedKeywords = ['某幻', '中国boy', 'PAYDAY3', '抢银行', '模拟器'];
      const foundUnexpected = unexpectedKeywords.filter(kw => content.includes(kw));
      analysisItem.unexpectedKeywords = foundUnexpected;

      // 计算相关性评分
      const relevanceScore = foundExpected.length / expectedKeywords.length;
      analysisItem.relevanceScore = relevanceScore;

      console.log('期望关键词匹配:', foundExpected);
      console.log('异常关键词:', foundUnexpected);
      console.log('相关性评分:', relevanceScore);

      if (foundUnexpected.length > 0) {
        console.log('🚨 发现异常关键词！');
        analysisItem.issues.push(`发现异常关键词: ${foundUnexpected.join(', ')}`);
      }

      if (relevanceScore < 0.5) {
        analysisItem.issues.push('相关性评分过低');
      }

    } catch (error) {
      console.log('下载失败:', error.message);
      analysisItem.issues.push(`下载失败: ${error.message}`);
    }

    analysis.push(analysisItem);
  }

  return analysis;
}

async function downloadSubtitleDebug(subtitleUrl: string, bvid: string) {
  try {
    const fullUrl = subtitleUrl.startsWith('http') ? subtitleUrl : `https:${subtitleUrl}`;

    const response = await axios.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': `https://www.bilibili.com/video/${bvid}`
      },
      timeout: 10000
    });

    console.log('字幕下载响应状态:', response.status);
    console.log('字幕数据类型:', typeof response.data);

    const data = response.data;

    if (!data || typeof data !== 'object') {
      throw new Error('字幕数据格式错误：不是对象');
    }

    if (!data.body || !Array.isArray(data.body)) {
      console.log('字幕数据结构异常:', JSON.stringify(data).substring(0, 200));
      throw new Error('字幕数据结构异常：缺少body字段或格式错误');
    }

    const body = data.body as Array<{from: number, to: number, content: string}>;
    console.log('字幕片段数量:', body.length);

    if (body.length === 0) {
      throw new Error('字幕内容为空');
    }

    console.log('第一条字幕:', body[0].content);
    console.log('最后一条字幕:', body[body.length - 1].content);

    // 合并所有字幕内容
    const text = body.map(item => item.content).join('\n');
    console.log('合并后字幕总长度:', text.length);

    return text;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('字幕下载网络错误:', error.message);
      if (error.response) {
        console.error('响应状态:', error.response.status);
        console.error('响应数据:', JSON.stringify(error.response.data).substring(0, 200));
      }
      throw new Error(`下载字幕失败: ${error.message}`);
    }
    throw error;
  }
}

function summarizeFindings(debugInfo: DebugInfo) {
  console.log('\n=== 调试总结 ===');

  if (debugInfo.errors.length > 0) {
    console.log('❌ 发现错误:', debugInfo.errors);
    return;
  }

  const analysis = debugInfo.subtitleAnalysis;
  if (!analysis || analysis.length === 0) {
    console.log('⚠️ 没有字幕分析数据');
    return;
  }

  // 统计结果
  const totalSubtitles = analysis.length;
  const highRelevanceSubtitles = analysis.filter(item =>
    item.relevanceScore && item.relevanceScore > 0.5
  ).length;

  const subWithUnexpectedKeywords = analysis.filter(item =>
    item.unexpectedKeywords && item.unexpectedKeywords.length > 0
  ).length;

  console.log('字幕分析统计:');
  console.log('  总字幕数:', totalSubtitles);
  console.log('  高相关性字幕:', highRelevanceSubtitles);
  console.log('  含异常关键词字幕:', subWithUnexpectedKeywords);

  if (subWithUnexpectedKeywords > 0) {
    console.log('🚨 发现严重问题：有字幕包含异常关键词');

    // 详细列出有问题的字幕
    analysis.forEach(item => {
      if (item.unexpectedKeywords && item.unexpectedKeywords.length > 0) {
        console.log(`  字幕${item.index} (${item.type}): 异常关键词 ${item.unexpectedKeywords.join(', ')}`);
      }
    });
  }

  if (highRelevanceSubtitles === 0) {
    console.log('⚠️ 警告：没有找到与期望内容相关的字幕');
  }

  // 给出建议
  if (subWithUnexpectedKeywords > 0 || highRelevanceSubtitles === 0) {
    console.log('\n💡 建议:');
    console.log('  1. 检查API响应是否正确');
    console.log('  2. 验证BV号是否对应正确视频');
    console.log('  3. 考虑增加更严格的数据验证');
    console.log('  4. 实现多API交叉验证机制');
  }
}

export async function runDebugForTestVideo() {
  console.log('🚀 开始调试测试视频...\n');
  const result = await debugSubtitleExtraction('https://www.bilibili.com/video/BV1bBCcBtEnA/');
  console.log('\n✅ 调试完成');
  return result;
}

// 如果是直接运行此脚本
if (require.main === module) {
  runDebugForTestVideo().catch(console.error);
}
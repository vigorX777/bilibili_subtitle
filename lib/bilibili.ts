/**
 * B站视频信息和字幕提取工具
 */

import axios from 'axios';
import { validateSubtitles } from './subtitle-validator';

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
  id?: number;
  id_str?: string;
  ai_status?: number;
  ai_type?: number;
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

    console.log('v2 API返回的subtitle对象:', JSON.stringify(subtitleData, null, 2));

    // 过滤掉 subtitle_url 为空的字幕项
    const validSubtitles = subtitles.filter((sub: SubtitleInfo) =>
      sub.subtitle_url && sub.subtitle_url.trim() !== ''
    );

    console.log(`过滤后有效字幕数量: ${validSubtitles.length}/${subtitles.length}`);

    // 检查是否有AI字幕
    const aiSubtitle = subtitleData?.ai_subtitle;
    if (aiSubtitle?.subtitle_url) {
      // 将AI字幕添加到列表中（如果还没有）
      const hasAiSubtitle = validSubtitles.some((sub: SubtitleInfo) =>
        sub.subtitle_url === aiSubtitle.subtitle_url
      );

      if (!hasAiSubtitle) {
        validSubtitles.push({
          lan: aiSubtitle.lan || 'ai-zh',
          lan_doc: aiSubtitle.lan_doc || 'AI生成字幕',
          subtitle_url: aiSubtitle.subtitle_url
        });
      }
    }

    // 使用过滤后的字幕列表
    subtitles.splice(0, subtitles.length, ...validSubtitles);
    
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
export async function downloadSubtitle(subtitleUrl: string, bvid: string, retryInfo?: { count: number; max: number }): Promise<string> {
  try {
    // 确保是完整的URL
    const fullUrl = subtitleUrl.startsWith('http') ? subtitleUrl : `https:${subtitleUrl}`;
    
    console.log('下载字幕URL:', fullUrl);
    if (retryInfo) {
      console.log(`当前尝试: ${retryInfo.count + 1}/${retryInfo.max}`);
    }
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': `https://www.bilibili.com/video/${bvid}`
    };
    
    if (BILIBILI_COOKIE) {
      headers['Cookie'] = BILIBILI_COOKIE;
    }
    
    const response = await axios.get(fullUrl, { 
      headers,
      timeout: 10000 // 10秒超时
    });

    console.log('字幕下载响应状态:', response.status);
    console.log('响应数据类型:', typeof response.data);
    
    const subtitleData = response.data;
    
    // 验证响应数据结构
    if (!subtitleData || typeof subtitleData !== 'object') {
      console.error('❌ 字幕数据格式错误: 不是对象');
      throw new Error('字幕数据格式错误');
    }
    
    if (!subtitleData.body || !Array.isArray(subtitleData.body)) {
      console.error('❌ 字幕数据缺少body字段或格式错误');
      console.error('实际数据结构:', JSON.stringify(subtitleData).substring(0, 200));
      throw new Error('字幕数据结构异常');
    }
    
    const body = subtitleData.body as SubtitleItem[];
    
    if (body.length === 0) {
      console.warn('⚠️ 字幕body数组为空');
      throw new Error('字幕内容为空');
    }
    
    console.log(`✓ 字幕片段数量: ${body.length}`);
    console.log(`✓ 第一条字幕: ${body[0].content}`);
    console.log(`✓ 最后一条字幕: ${body[body.length - 1].content}`);
    
    // 将字幕数组合并成纯文本
    const text = body.map(item => item.content).join('\n');
    
    console.log(`✓ 合并后字幕总长度: ${text.length} 字符`);
    
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

/**
 * 提取视频字幕的完整流程
 * 增加内容验证机制，防止提取到错误的字幕
 */
export async function extractSubtitle(videoUrl: string, retryCount = 0): Promise<{
  title: string;
  subtitle: string;
}> {
  const MAX_RETRIES = 3; // 最多重试3次

  // 1. 提取BVID
  const bvid = extractBVID(videoUrl);
  if (!bvid) {
    throw new Error('无效的B站视频链接');
  }

  // 2. 获取视频信息
  const videoInfo = await getVideoInfo(bvid);
  const title = videoInfo.title;
  const cid = videoInfo.cid;
  const desc = videoInfo.desc || ''; // 视频简介

  if (!cid) {
    throw new Error('无法获取视频CID');
  }

  console.log(`\n========== 第${retryCount + 1}次提取尝试 ==========`);
  console.log('视频标题:', title);
  console.log('BVID:', bvid, 'CID:', cid);

  // 3. 获取字幕列表（多API交叉验证）
  const subtitles = await getSubtitleList(bvid, cid);

  console.log('获取到的字幕列表数量:', subtitles.length);
  subtitles.forEach((sub, idx) => {
    console.log(`  [${idx}] ${sub.lan_doc} (${sub.lan}) - URL: ${sub.subtitle_url.substring(0, 80)}...`);
    console.log(`      ID: ${(sub as any).id_str || (sub as any).id || 'N/A'}`);
  });

  if (!subtitles || subtitles.length === 0) {
    throw new Error('该视频暂无字幕，处理功能将在未来版本支持');
  }

  // 4. 使用增强验证器进行字幕验证和选择
  console.log('\n========== 使用增强验证器进行字幕验证 ==========');
  const videoInfoForValidation = {
    title: title,
    desc: desc,
    cid: cid
  };

  const validationResult = await validateSubtitles(
    subtitles,
    videoInfoForValidation,
    subtitles,
    []
  );

  console.log('增强验证结果:');
  console.log('是否有效:', validationResult.isValid);
  console.log('置信度:', validationResult.confidence.toFixed(2));
  console.log('问题:', validationResult.issues);

  if (!validationResult.isValid && validationResult.confidence < 0.3) {
    console.error('❌ 增强验证器检测到严重问题');
    console.error('问题详情:', validationResult.issues);
    console.error('建议:', validationResult.suggestions);

    if (retryCount < MAX_RETRIES) {
      console.log(`\n将在 ${(retryCount + 1) * 2} 秒后重试...（${retryCount + 1}/${MAX_RETRIES}）`);
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
      return extractSubtitle(videoUrl, retryCount + 1);
    } else {
      throw new Error(`增强验证失败：${validationResult.issues.join('; ')}。建议：${validationResult.suggestions.join('; ')}`);
    }
  }

  // 5. 优先选择中文字幕（包括AI字幕），并记录所有候选项
  console.log('\n开始选择字幕...');

  // 如果有备选字幕，选择相关性最高的
  let selectedSubtitle = subtitles[0];
  if (validationResult.alternativeSubtitles && validationResult.alternativeSubtitles.length > 0) {
    // 按相关性评分排序，选择评分最高的
    const sortedSubtitles = validationResult.alternativeSubtitles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const bestSubtitle = sortedSubtitles[0];
    selectedSubtitle = subtitles[bestSubtitle.index];
    console.log(`选择最佳字幕: ${selectedSubtitle.lan_doc} (相关性: ${bestSubtitle.relevanceScore.toFixed(2)})`);
  } else {
    // 回退到原来的选择逻辑
    const aiSubtitle = subtitles.find(sub =>
      sub.lan === 'ai-zh' ||
      sub.lan_doc.includes('AI') ||
      (sub as any).ai_status !== undefined
    );

    const zhSubtitle = subtitles.find(sub =>
      sub.lan === 'zh-CN' ||
      sub.lan === 'zh-Hans' ||
      sub.lan_doc.includes('中')
    );

    selectedSubtitle = aiSubtitle || zhSubtitle || subtitles[0];
    console.log('选择策略:', aiSubtitle ? 'AI字幕' : (zhSubtitle ? '中文CC字幕' : '默认第一个'));
  }

  console.log('选择的字幕:', {
    lan: selectedSubtitle.lan,
    lan_doc: selectedSubtitle.lan_doc,
    subtitle_url: selectedSubtitle.subtitle_url,
    id: (selectedSubtitle as any).id_str || (selectedSubtitle as any).id
  });

  // 检查subtitle_url是否有效
  if (!selectedSubtitle.subtitle_url || selectedSubtitle.subtitle_url.trim() === '') {
    console.error('❌ 选中的字幕URL为空！');
    console.error('当前重试次数:', retryCount);

    // 如果URL无效且还有重试机会，立即重试
    if (retryCount < MAX_RETRIES) {
      console.log(`URL无效，将在 2 秒后重试...（${retryCount + 1}/${MAX_RETRIES}）`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return extractSubtitle(videoUrl, retryCount + 1);
    }

    throw new Error(`字幕URL无效，请检查是否需要登录或视频是否有有效字幕。选中的字幕：${selectedSubtitle.lan_doc}`);
  }

  // 验证URL格式是否正确
  if (!selectedSubtitle.subtitle_url.includes('://') && !selectedSubtitle.subtitle_url.startsWith('//')) {
    console.error('❌ 字幕URL格式异常:', selectedSubtitle.subtitle_url);
    throw new Error('字幕URL格式错误');
  }

  // 6. 下载字幕
  const subtitleText = await downloadSubtitle(
    selectedSubtitle.subtitle_url,
    bvid,
    { count: retryCount, max: MAX_RETRIES }
  );

  console.log('提取的字幕内容长度:', subtitleText.length);
  console.log('字幕内容前200字符:', subtitleText.substring(0, 200));

  // 7. 使用原有验证器进行最终检查（作为双重验证）
  console.log('\n========== 开始传统字幕内容验证 ==========');
  const traditionalValidationResult = validateSubtitleContent(title, desc, subtitleText, selectedSubtitle.lan_doc);

  if (!traditionalValidationResult.isValid) {
    console.warn('⚠️ 传统验证器检测到字幕内容与视频不匹配！');
    console.warn('视频标题:', title);
    console.warn('字幕类型:', selectedSubtitle.lan_doc);
    console.warn('失败原因:', traditionalValidationResult.reason);
    console.warn('匹配率:', `${(traditionalValidationResult.matchRate * 100).toFixed(1)}%`);
    console.warn('字幕内容预览:', subtitleText.substring(0, 150));

    // 如果增强验证器通过了但传统验证器失败了，我们需要谨慎处理
    if (validationResult.isValid) {
      console.log('💡 增强验证器通过但传统验证器失败，采用增强验证器结果');
    } else if (retryCount < MAX_RETRIES) {
      console.log(`\n将在 ${(retryCount + 1) * 2} 秒后重试...（${retryCount + 1}/${MAX_RETRIES}）`);
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
      return extractSubtitle(videoUrl, retryCount + 1);
    } else {
      console.error('\n❌ 已达到最大重试次数，字幕验证仍然失败');
      console.error('传统验证结果:', traditionalValidationResult);
      throw new Error(`字幕内容验证失败：${traditionalValidationResult.reason}。视频「${title}」的字幕匹配率仅为${(traditionalValidationResult.matchRate * 100).toFixed(1)}%。请稍后再试或联系开发者。`);
    }
  } else {
    console.log('✅ 传统字幕内容验证通过！');
    console.log('匹配率:', `${(traditionalValidationResult.matchRate * 100).toFixed(1)}%`);
    console.log('匹配关键词:', traditionalValidationResult.matchedKeywords?.slice(0, 5).join(', '));
  }

  console.log('========================================\n');

  return {
    title,
    subtitle: subtitleText
  };
}

/**
 * 验证字幕内容是否与视频相关
 * 通过多维度检测防止提取到错误的字幕
 */
function validateSubtitleContent(
  title: string, 
  desc: string, 
  subtitle: string,
  subtitleType: string
): {
  isValid: boolean;
  reason?: string;
  matchRate: number;
  matchedKeywords?: string[];
} {
  console.log('\n---------- 字幕验证开始 ----------');
  console.log('视频标题:', title);
  console.log('字幕类型:', subtitleType);
  console.log('字幕长度:', subtitle.length, '字符');
  
  // 如果字幕太短，可能是错误数据
  if (subtitle.length < 50) {
    console.warn('⚠️ 字幕长度过短:', subtitle.length);
    return {
      isValid: false,
      reason: '字幕长度过短（<50字符）',
      matchRate: 0
    };
  }

  // 提取视频标题中的关键词（去除常见停用词）
  const titleKeywords = extractKeywords(title);
  const descKeywords = extractKeywords(desc);
  const allKeywords = [...titleKeywords, ...descKeywords];
  
  console.log('标题关键词数量:', titleKeywords.length);
  console.log('标题关键词:', titleKeywords.slice(0, 10).join(', '));
  
  if (descKeywords.length > 0) {
    console.log('简介关键词数量:', descKeywords.length);
    console.log('简介关键词:', descKeywords.slice(0, 5).join(', '));
  }

  if (allKeywords.length === 0) {
    // 如果没有关键词，返回 true（无法验证）
    console.log('ℹ️ 未提取到关键词，跳过验证');
    return {
      isValid: true,
      reason: '无法提取关键词',
      matchRate: 1
    };
  }

  // 检查关键词匹配率
  let matchCount = 0;
  const checkKeywords = allKeywords.slice(0, 20); // 检查前20个关键词
  const matchedKeywords: string[] = [];
  
  console.log('\n开始匹配关键词...');
  for (const keyword of checkKeywords) {
    if (subtitle.includes(keyword)) {
      matchCount++;
      matchedKeywords.push(keyword);
    }
  }

  const matchRate = matchCount / checkKeywords.length;
  console.log(`\n匹配结果: ${matchCount}/${checkKeywords.length} = ${(matchRate * 100).toFixed(1)}%`);
  
  if (matchedKeywords.length > 0) {
    console.log('匹配的关键词:', matchedKeywords.slice(0, 10).join(', '));
  } else {
    console.warn('⚠️ 没有匹配到任何关键词！');
  }

  // 动态阈值策略
  let threshold = 0.15; // 默认15%阈值
  let thresholdReason = '默认阈值';
  
  // 如果是AI字幕，降低阈值（AI字幕可能使用不同词汇）
  if (subtitleType.includes('AI')) {
    threshold = 0.10; // AI字幕使用10%阈值
    thresholdReason = 'AI字幕低阈值';
  }
  
  // 如果字幕很长且至少有3个关键词匹配，认为有效
  if (subtitle.length > 2000 && matchedKeywords.length >= 3) {
    console.log('✅ 长字幕特殊处理: 字幕超过2000字符且有3+关键词匹配');
    return {
      isValid: true,
      reason: '长字幕且匹配关键词足够',
      matchRate,
      matchedKeywords
    };
  }
  
  console.log(`使用阈值: ${(threshold * 100).toFixed(0)}% (${thresholdReason})`);
  console.log('---------- 验证结束 ----------\n');
  
  if (matchRate >= threshold) {
    return {
      isValid: true,
      matchRate,
      matchedKeywords
    };
  }
  
  return {
    isValid: false,
    reason: `关键词匹配率过低 (${(matchRate * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}%)`,
    matchRate,
    matchedKeywords
  };
}

/**
 * 从文本中提取关键词
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];

  // 去除标点符号和特殊字符，但保留中文、英文、数字
  const cleaned = text.replace(/[\u3000-\u303f\uff00-\uffef\u2000-\u206f\u0020-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]/g, ' ');
  
  // 分词（简单处理：按空格分割+中文单字）
  const words: string[] = [];

  // 英文单词（长度>=2）
  const englishWords = cleaned.split(/\s+/).filter(w => w.length >= 2 && /[a-zA-Z]/.test(w));
  words.push(...englishWords);

  // 中文处理：分解长词组为更短的词
  // 提取所有中文字符串（2个字以上）
  const chineseRegex = /[\u4e00-\u9fa5]{2,}/g;
  const chinesePhrases = text.match(chineseRegex) || [];

  // 分解长词组
  chinesePhrases.forEach(phrase => {
    // 如果词组很长（>=6字），尝试分解成更小的片段
    if (phrase.length >= 6) {
      // 尝试按3字一组分割
      for (let i = 0; i < phrase.length - 2; i += 2) {
        const shortWord = phrase.substring(i, i + 3);
        if (shortWord.length >= 2) {
          words.push(shortWord);
        }
      }
      // 同时保留原长词组（降低权重，但可能有完整匹配）
      words.push(phrase);
    } else if (phrase.length >= 4) {
      // 4-5字的词组，尝试提取前3字和后3字
      words.push(phrase.substring(0, 3));
      if (phrase.length > 3) {
        words.push(phrase.substring(phrase.length - 3));
      }
      words.push(phrase);
    } else {
      // 2-3字的词组直接使用
      words.push(phrase);
    }
  });

  // 去重和过滤停用词
  const stopWords = [
    '这个', '那个', '一些', '这些', '那些', '可以', '已经', '就是', '所以', '因为', '但是',
    '然后', '这样', '那么', '这里', '那里', '一直', '现在', '不是', '没有', '什么', '也是',
    '很多', '非常', '比较', '都', '还', '也', '就', '才', '会', '到', '来', '要', '被', '把',
    '去', '从', '上', '下', '中', '前', '后', '左', '右', '内', '外', '间', '时', '年', '月',
    '日', '人', '个', '的', '了', '和', '是', '在', '我', '有', '他', '她',
    'about', 'above', 'across', 'after', 'again', 'against', 'all', 'almost', 'along',
    'also', 'although', 'always', 'among', 'an', 'and', 'another', 'any', 'are', 'around',
    'as', 'at', 'back', 'been', 'before', 'began', 'being', 'below', 'between', 'both',
    'but', 'by', 'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'each',
    'during', 'either', 'else', 'even', 'ever', 'every', 'first', 'for', 'found', 'from',
    'had', 'has', 'have', 'having', 'her', 'here', 'him', 'his', 'how', 'however', 'hundred',
    'into', 'its', 'just', 'know', 'large', 'last', 'later', 'like', 'little', 'long',
    'made', 'make', 'man', 'many', 'may', 'men', 'might', 'more', 'most', 'much', 'must',
    'never', 'new', 'next', 'not', 'now', 'num', 'number', 'off', 'old', 'once', 'one',
    'only', 'other', 'our', 'out', 'over', 'own', 'part', 'people', 'place', 'put', 'real',
    'right', 'said', 'same', 'saw', 'say', 'see', 'seem', 'several', 'she', 'should', 'show',
    'side', 'small', 'so', 'some', 'something', 'take', 'tell', 'than', 'that', 'the', 'their',
    'them', 'then', 'there', 'these', 'they', 'thing', 'think', 'this', 'through', 'time',
    'to', 'too', 'two', 'under', 'up', 'use', 'very', 'was', 'water', 'way', 'we', 'well',
    'went', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'will', 'with', 'words',
    'work', 'world', 'would', 'write', 'year', 'years', 'you', 'your'
  ];

  const uniqueWords = [...new Set(words)]
    .filter(w => w.length >= 2) // 只保留长度>=2的词（去掉单字）
    .filter(w => !stopWords.includes(w.toLowerCase()))
    .sort((a, b) => {
      // 优先排序：有中文的 > 英文字母+数字 > 纯英文
      const aHasChinese = /[\u4e00-\u9fa5]/.test(a);
      const bHasChinese = /[\u4e00-\u9fa5]/.test(b);

      if (aHasChinese && !bHasChinese) return -1;
      if (!aHasChinese && bHasChinese) return 1;

      // 长度优先（长词更具体）
      return b.length - a.length;
    });

  return uniqueWords;
}

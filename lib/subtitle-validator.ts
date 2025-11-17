/**
 * 增强字幕验证器
 * 解决字幕内容错配问题
 */

import axios from 'axios';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  alternativeSubtitles?: any[];
}

export interface VideoInfo {
  title: string;
  desc: string;
  cid: number;
}

/**
 * 关键词提取和分析
 */
function extractKeywords(text: string): string[] {
  // 提取有意义的关键词
  const keywords = [];

  // 1. 提取核心名词和概念
  const coreConcepts = [
    // 学习相关
    '学习', '教育', '知识', '理解', '掌握', '技能', '方法', '技巧',
    // 费曼相关
    '费曼', '费曼技巧', '费曼学习法', '理查德费曼',
    // 心智模型
    '心智', '模型', '思维', '认知', '心理学', '大脑', '记忆',
    // 通用概念
    '概念', '原理', '理论', '实践', '应用', '例子', '案例'
  ];

  // 2. 提取出现的关键词
  for (const concept of coreConcepts) {
    if (text.includes(concept)) {
      keywords.push(concept);
    }
  }

  // 3. 提取专有名词（大写字母开头的词）
  const properNouns = text.match(/[A-Z][a-z]+/g) || [];
  keywords.push(...properNouns.slice(0, 5)); // 限制数量

  // 4. 提取数字和特定模式
  const numbers = text.match(/\d+/g) || [];
  keywords.push(...numbers.slice(0, 3)); // 限制数量

  return [...new Set(keywords)]; // 去重
}

/**
 * 内容相关性分析
 */
function analyzeRelevance(subtitleContent: string, videoInfo: VideoInfo): number {
  const content = subtitleContent.toLowerCase();
  const title = videoInfo.title.toLowerCase();
  const desc = videoInfo.desc.toLowerCase();

  // 1. 标题关键词匹配
  const titleKeywords = extractKeywords(title);
  const matchingTitleKeywords = titleKeywords.filter(kw => content.includes(kw.toLowerCase()));
  const titleRelevance = matchingTitleKeywords.length / Math.max(titleKeywords.length, 1);

  // 2. 描述关键词匹配（如果描述不为空）
  let descRelevance = 0;
  if (desc && desc !== '-') {
    const descKeywords = extractKeywords(desc);
    const matchingDescKeywords = descKeywords.filter(kw => content.includes(kw.toLowerCase()));
    descRelevance = matchingDescKeywords.length / Math.max(descKeywords.length, 1);
  }

  // 3. 语义相似度检查
  let semanticScore = 0;

  // 检查是否包含与主题相关的关键概念
  if (title.includes('费曼') || title.includes('学习')) {
    if (content.includes('费曼') || content.includes('学习') || content.includes('理解')) {
      semanticScore += 0.3;
    }
  }

  // 检查内容类型一致性
  const isEducationalContent = title.includes('学习') || title.includes('教育') || title.includes('知识');
  const hasEducationalKeywords = content.includes('学习') || content.includes('知识') || content.includes('理解') || content.includes('概念');

  if (isEducationalContent && hasEducationalKeywords) {
    semanticScore += 0.2;
  }

  // 检查异常内容指标
  const hasGamingKeywords = /电竞|比赛|战队|选手|WBG|LNG|BLG|gala/i.test(content);
  const isGamingTitle = /电竞|比赛|游戏/i.test(title);

  if (hasGamingKeywords && !isGamingTitle) {
    // 内容包含游戏关键词但标题不是游戏内容，严重扣分
    semanticScore -= 0.5;
  }

  // 综合评分
  const finalScore = (titleRelevance * 0.6) + (descRelevance * 0.2) + (semanticScore * 0.2);
  return Math.max(0, Math.min(1, finalScore));
}

/**
 * 异常内容检测
 */
function detectAnomalousContent(subtitleContent: string, videoInfo: VideoInfo): string[] {
  const issues: string[] = [];
  const content = subtitleContent.toLowerCase();
  const title = videoInfo.title.toLowerCase();

  // 1. 内容类型不匹配检测
  const educationalIndicators = ['学习', '教育', '知识', '理解', '概念', '理论'];
  const gamingIndicators = ['电竞', '比赛', '战队', '选手', '直播', '解说'];
  const entertainmentIndicators = ['综艺', '娱乐', '明星', '八卦'];

  const isEducationalVideo = educationalIndicators.some(indicator => title.includes(indicator));
  const isGamingVideo = gamingIndicators.some(indicator => title.includes(indicator));
  const isEntertainmentVideo = entertainmentIndicators.some(indicator => title.includes(indicator));

  const hasGamingContent = gamingIndicators.some(indicator => content.includes(indicator));
  const hasEntertainmentContent = entertainmentIndicators.some(indicator => content.includes(indicator));

  // 视频类型与内容类型不匹配
  if (isEducationalVideo && (hasGamingContent || hasEntertainmentContent)) {
    issues.push('教育类视频却包含游戏/娱乐内容');
  }

  if (!isGamingVideo && hasGamingContent) {
    issues.push('非游戏类视频却包含大量游戏相关内容');
  }

  // 2. 特定平台关键词检测
  const platformKeywords = {
    gaming: ['WBG', 'LNG', 'BLG', 'RNG', 'EDG', 'TES', 'JDG', 'gala', 'scout', 'theshy'],
    entertainment: ['某幻', '中国boy', '花少', '综艺'],
    tech: ['苹果', '华为', '小米', '评测', '测评']
  };

  for (const [platform, keywords] of Object.entries(platformKeywords)) {
    const hasPlatformContent = keywords.some(kw => content.includes(kw.toLowerCase()));

    if (hasPlatformContent) {
      // 检查是否与视频标题相关
      const isRelevantToTitle = keywords.some(kw => title.includes(kw.toLowerCase()));
      if (!isRelevantToTitle) {
        issues.push(`内容包含${platform}平台特定关键词但与标题无关`);
      }
    }
  }

  // 3. 时间戳异常检测
  const timestampPattern = /\d{1,2}:\d{2}/g;
  const timestamps = content.match(timestampPattern) || [];
  if (timestamps.length > 10) {
    // 检查时间戳是否连续
    let hasSequential = false;
    for (let i = 1; i < timestamps.length; i++) {
      const prev = timestamps[i-1].split(':');
      const curr = timestamps[i].split(':');
      const prevMinutes = parseInt(prev[0]) * 60 + parseInt(prev[1]);
      const currMinutes = parseInt(curr[0]) * 60 + parseInt(curr[1]);

      if (currMinutes - prevMinutes < 5) { // 时间间隔小于5秒
        hasSequential = true;
        break;
      }
    }

    if (!hasSequential) {
      issues.push('时间戳不连续，可能为错误字幕');
    }
  }

  return issues;
}

/**
 * 多API结果交叉验证
 */
function crossValidateAPIResults(subtitlesFromV2: any[], subtitlesFromPlayerSo: any[]): {isConsistent: boolean, issues: string[]} {
  const issues: string[] = [];

  // 1. 数量一致性检查
  if (subtitlesFromV2.length !== subtitlesFromPlayerSo.length) {
    issues.push(`API字幕数量不一致: v2=${subtitlesFromV2.length}, player.so=${subtitlesFromPlayerSo.length}`);
  }

  // 2. 语言选项一致性检查
  const v2Langs = new Set(subtitlesFromV2.map(sub => sub.lan));
  const soLangs = new Set(subtitlesFromPlayerSo.map(sub => sub.lan));
  const commonLangs = [...v2Langs].filter(l => soLangs.has(l));

  if (commonLangs.length === 0 && subtitlesFromV2.length > 0 && subtitlesFromPlayerSo.length > 0) {
    issues.push('两个API没有共同的语言选项，可能存在数据不一致');
  }

  // 3. 字幕URL一致性检查
  const v2Urls = new Set(subtitlesFromV2.map(sub => sub.subtitle_url));
  const soUrls = new Set(subtitlesFromPlayerSo.map(sub => sub.subtitle_url));
  const commonUrls = [...v2Urls].filter(url => soUrls.has(url));

  if (commonUrls.length === 0 && subtitlesFromV2.length > 0 && subtitlesFromPlayerSo.length > 0) {
    issues.push('两个API返回完全不同的字幕URL，需要进一步验证');
  }

  return {
    isConsistent: issues.length === 0,
    issues
  };
}

/**
 * 增强字幕验证主函数
 */
export async function validateSubtitles(
  subtitles: any[],
  videoInfo: VideoInfo,
  subtitlesFromV2: any[] = [],
  subtitlesFromPlayerSo: any[] = []
): Promise<ValidationResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];

  console.log('🔄 开始增强字幕验证...');
  console.log('视频标题:', videoInfo.title);
  console.log('找到字幕数量:', subtitles.length);

  // 1. 基础检查
  if (!subtitles || subtitles.length === 0) {
    return {
      isValid: false,
      confidence: 0,
      issues: ['没有找到字幕'],
      suggestions: ['尝试使用不同的API端点', '检查视频是否确实有字幕']
    };
  }

  // 2. 多API交叉验证
  if (subtitlesFromV2.length > 0 || subtitlesFromPlayerSo.length > 0) {
    const crossValidation = crossValidateAPIResults(subtitlesFromV2, subtitlesFromPlayerSo);
    if (!crossValidation.isConsistent) {
      issues.push(...crossValidation.issues);
      suggestions.push('API数据不一致，建议人工复核');
    }
  }

  // 3. 对每个字幕进行详细验证
  let totalRelevance = 0;
  let validSubtitles = 0;
  const alternativeSubtitles = [];

  for (let i = 0; i < subtitles.length; i++) {
    const subtitle = subtitles[i];
    console.log(`\n--- 验证字幕 ${i + 1}/${subtitles.length} ---`);
    console.log('类型:', subtitle.lan_doc);
    console.log('语言:', subtitle.lan);

    try {
      // 下载字幕内容
      const content = await downloadSubtitleContent(subtitle.subtitle_url);

      // 内容相关性分析
      const relevanceScore = analyzeRelevance(content, videoInfo);
      totalRelevance += relevanceScore;

      console.log('相关性评分:', relevanceScore);

      // 异常内容检测
      const anomalousIssues = detectAnomalousContent(content, videoInfo);

      if (relevanceScore > 0.5 && anomalousIssues.length === 0) {
        validSubtitles++;
        console.log('✅ 字幕通过验证');
      } else {
        console.log('❌ 字幕未通过验证');
        console.log('问题:', anomalousIssues);

        issues.push(`字幕${i + 1}验证失败: 相关性${relevanceScore.toFixed(2)}`);
        if (anomalousIssues.length > 0) {
          issues.push(...anomalousIssues.map(issue => `字幕${i + 1}: ${issue}`));
        }
      }

      // 记录备选字幕信息
      alternativeSubtitles.push({
        index: i,
        type: subtitle.lan_doc,
        language: subtitle.lan,
        relevanceScore,
        issues: anomalousIssues,
        url: subtitle.subtitle_url
      });

    } catch (error) {
      console.error(`字幕${i + 1}下载失败:`, error);
      issues.push(`字幕${i + 1}下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 4. 综合评估
  const avgRelevance = totalRelevance / Math.max(subtitles.length, 1);
  const validationPassRate = validSubtitles / Math.max(subtitles.length, 1);

  console.log('\n=== 验证总结 ===');
  console.log('平均相关性评分:', avgRelevance.toFixed(2));
  console.log('验证通过率:', (validationPassRate * 100).toFixed(1) + '%');

  // 5. 生成建议
  if (avgRelevance < 0.3) {
    suggestions.push('字幕内容与视频标题相关性很低，可能获取了错误的字幕');
    suggestions.push('建议检查API响应是否正确');
    suggestions.push('考虑使用其他API端点重新获取');
  }

  if (validationPassRate < 0.5) {
    suggestions.push('大部分字幕未通过验证，需要人工干预');
  }

  if (issues.length > 0) {
    suggestions.push('发现多个验证问题，建议详细检查');
  }

  // 6. 最终判定
  const isValid = avgRelevance > 0.3 && validationPassRate > 0.5 && issues.length < 3;
  const confidence = Math.max(0, Math.min(1, avgRelevance * validationPassRate));

  return {
    isValid,
    confidence,
    issues,
    suggestions,
    alternativeSubtitles: alternativeSubtitles.length > 0 ? alternativeSubtitles : undefined
  };
}

/**
 * 下载字幕内容（带缓存和重试）
 */
async function downloadSubtitleContent(url: string): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : `https:${url}`;

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.bilibili.com'
      },
      timeout: 10000
    });

    if (!response.data || typeof response.data !== 'object') {
      throw new Error('字幕数据格式错误：不是对象');
    }

    if (!response.data.body || !Array.isArray(response.data.body)) {
      throw new Error('字幕数据结构异常：缺少body字段或格式错误');
    }

    const body = response.data.body as Array<{from: number, to: number, content: string}>;

    if (body.length === 0) {
      throw new Error('字幕内容为空');
    }

    // 合并所有字幕内容
    const text = body.map(item => item.content).join('\n');
    return text;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`下载字幕失败: ${error.message}`);
    }
    throw error;
  }
}
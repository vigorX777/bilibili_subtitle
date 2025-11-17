const { validateSubtitles } = require('./lib/subtitle-validator.ts');

// 测试数据 - 基于BV1bBCcBtEnA的调试结果
const testVideoInfo = {
  title: "费曼的学习心智模型 | 用来学任何你想学的东西",
  desc: "-",
  cid: 33886963966
};

const testSubtitles = [
  {
    lan: 'ai-zh',
    lan_doc: '中文',
    subtitle_url: '//aisubtitle.hdslb.com/bfs/ai_subtitle/prod/11335916899809326434014738050fc35bed9e8dbdaba87e424214fae0'
  }
];

async function testValidator() {
  console.log('🧪 测试增强字幕验证器...\n');

  try {
    const result = await validateSubtitles(testSubtitles, testVideoInfo);

    console.log('=== 验证结果 ===');
    console.log('是否有效:', result.isValid);
    console.log('置信度:', result.confidence.toFixed(2));
    console.log('问题:', result.issues);
    console.log('建议:', result.suggestions);

    if (result.alternativeSubtitles) {
      console.log('\n=== 备选字幕分析 ===');
      result.alternativeSubtitles.forEach(sub => {
        console.log(`字幕${sub.index}: ${sub.type} (相关性: ${sub.relevanceScore.toFixed(2)})`);
        if (sub.issues.length > 0) {
          console.log(`  问题: ${sub.issues.join(', ')}`);
        }
      });
    }

  } catch (error) {
    console.error('验证器测试失败:', error);
  }
}

testValidator();
const { extractSubtitle } = require('./lib/bilibili.ts');

async function testIntegratedSystem() {
  console.log('🚀 测试集成增强验证系统...\n');

  try {
    const result = await extractSubtitle('https://www.bilibili.com/video/BV1bBCcBtEnA/');

    console.log('\n=== 集成系统测试结果 ===');
    console.log('视频标题:', result.title);
    console.log('字幕长度:', result.subtitle.length);
    console.log('字幕预览:', result.subtitle.substring(0, 300));

  } catch (error) {
    console.error('\n❌ 集成系统测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

testIntegratedSystem();
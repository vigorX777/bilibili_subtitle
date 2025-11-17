const { runDebugForTestVideo } = require('./scripts/debug-subtitle-extraction.ts');

async function test() {
  try {
    console.log('开始运行调试工具...');
    const result = await runDebugForTestVideo();
    console.log('调试结果:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('调试失败:', error);
  }
}

test();
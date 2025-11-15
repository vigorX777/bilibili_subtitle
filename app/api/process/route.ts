import { NextRequest, NextResponse } from 'next/server';
import { extractSubtitle } from '@/lib/bilibili';
import { generateNotes, generateSimpleNotes } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrl } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: '请提供视频链接' },
        { status: 400 }
      );
    }

    // 1. 提取字幕
    console.log('开始提取字幕:', videoUrl);
    const { title, subtitle } = await extractSubtitle(videoUrl);
    console.log('字幕提取成功:', title);

    // 2. 生成AI笔记
    console.log('开始生成笔记...');
    let markdown: string;
    
    try {
      // 尝试使用AI生成笔记
      markdown = await generateNotes(title, subtitle);
      console.log('AI笔记生成成功');
    } catch (aiError) {
      // 如果AI生成失败，使用简单格式
      console.warn('AI生成失败，使用简单格式:', aiError);
      markdown = generateSimpleNotes(title, subtitle);
    }

    return NextResponse.json({
      success: true,
      markdown,
      title
    });

  } catch (error) {
    console.error('处理出错:', error);
    
    const errorMessage = error instanceof Error ? error.message : '处理过程中出现未知错误';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// 支持OPTIONS请求（CORS预检）
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

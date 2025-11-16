import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "B站视频字幕提取工具",
  description: "一键将B站视频字幕转换为结构化学习笔记",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

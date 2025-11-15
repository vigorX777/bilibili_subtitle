# B站视频字幕提取工具

一键将B站视频字幕转换为结构化学习笔记的Web应用。

## 功能特性

✅ **视频链接解析**：支持多种B站链接格式（bilibili.com/video/BV...、b23.tv/...等）  
✅ **自动字幕提取**：自动获取视频的CC字幕  
✅ **AI笔记生成**：使用阿里云通义千问AI生成结构化Markdown笔记  
✅ **美观的界面**：现代化的渐变设计，支持深色模式  
✅ **便捷导出**：支持一键复制和下载Markdown文件  
✅ **备用方案**：当AI不可用时，自动使用简单格式生成笔记  

## 技术栈

- **前端框架**：Next.js 16 + React 19 + TypeScript
- **样式方案**：Tailwind CSS 4
- **Markdown渲染**：react-markdown + remark-gfm
- **HTTP客户端**：Axios
- **AI服务**：阿里云通义千问API
- **部署平台**：Vercel

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，并配置您的API密钥：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
# 阿里云通义千问API密钥（可选，不配置则使用简单格式）
QWEN_API_KEY=sk-your-api-key-here
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 部署到Vercel

### 方式一：通过Git仓库部署（推荐）

1. 将代码推送到GitHub/GitLab/Bitbucket
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量 `QWEN_API_KEY`
4. 点击部署

### 方式二：通过Vercel CLI部署

```bash
npm install -g vercel
vercel login
vercel
```

### 环境变量配置

在Vercel项目设置中添加：

- `QWEN_API_KEY`：阿里云通义千问API密钥

## 使用说明

1. **输入视频链接**：在输入框中粘贴B站视频链接
2. **开始提取**：点击"开始提取"按钮
3. **等待处理**：系统会自动提取字幕并生成笔记（约15-30秒）
4. **查看结果**：笔记会以Markdown格式展示
5. **导出笔记**：可以复制内容或下载为.md文件

## 支持的链接格式

- `https://www.bilibili.com/video/BV1xx411c7mD`
- `https://b23.tv/xxxxxx`
- `BV1xx411c7mD`

## 注意事项

⚠️ **字幕要求**：目前仅支持有CC字幕的视频  
⚠️ **API配置**：需要配置通义千问API才能使用AI生成功能  
⚠️ **处理时间**：视频越长，处理时间越久（一般15分钟视频约30秒）  

## 项目结构

```
bilibili-subtitle/
├── app/                    # Next.js App Router
│   ├── api/               # API路由
│   │   └── process/       # 视频处理端点
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 主页面
├── lib/                   # 工具库
│   ├── bilibili.ts        # B站API封装
│   └── ai.ts              # AI处理逻辑
├── public/                # 静态资源
├── .env.example           # 环境变量示例
├── package.json           # 项目依赖
├── tsconfig.json          # TypeScript配置
└── vercel.json            # Vercel部署配置
```

## 开发计划

### MVP版本 ✅
- [x] 基础UI界面
- [x] B站视频链接解析
- [x] 字幕提取功能
- [x] AI笔记生成
- [x] Markdown渲染
- [x] 复制和下载功能

### 未来版本 🚀
- [ ] 无字幕视频处理（语音转文字）
- [ ] 批量处理功能
- [ ] 处理历史记录
- [ ] 个性化笔记模板
- [ ] 多语言支持

## License

MIT

## 联系方式

如有问题或建议，欢迎提交Issue。

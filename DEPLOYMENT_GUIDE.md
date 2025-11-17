# B站字幕提取工具 - 部署指南

## 🚀 快速部署到Vercel

### 步骤1: 一键部署
点击下面的按钮进行一键部署：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/bilibili-subtitle&env=AI_PROVIDER,QWEN_API_KEY,KIMI_API_KEY,QWEN_MODEL,KIMI_MODEL,BILIBILI_COOKIE,QWEN_MAX_TOKENS,SYSTEM_PROMPT,PROMPT_TEMPLATE)

### 步骤2: 配置环境变量
在Vercel部署页面中，配置以下环境变量：

#### 必需的环境变量：
| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `AI_PROVIDER` | AI服务商选择 | `kimi` 或 `qwen` |
| `QWEN_API_KEY` | 通义千问API密钥 | 从阿里云获取 |
| `KIMI_API_KEY` | KIMI API密钥 | 从Moonshot获取 |
| `QWEN_MODEL` | 通义千问模型 | `qwen-plus` |
| `KIMI_MODEL` | KIMI模型 | `kimi-k2-turbo-preview` |
| `BILIBILI_COOKIE` | B站Cookie | 从浏览器获取 |

#### 可选的环境变量：
| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `QWEN_MAX_TOKENS` | 最大输出长度 | `8000` |
| `SYSTEM_PROMPT` | AI系统提示词 | 内置默认 |
| `PROMPT_TEMPLATE` | AI Prompt模板 | 内置默认 |

### 步骤3: 获取API密钥

#### 通义千问API密钥
1. 访问 [阿里云DashScope](https://dashscope.console.aliyun.com/apiKey)
2. 注册/登录阿里云账号
3. 创建API密钥
4. 复制密钥到`QWEN_API_KEY`

#### KIMI API密钥
1. 访问 [Moonshot平台](https://platform.moonshot.cn/console/api-keys)
2. 注册/登录账号
3. 创建API密钥
4. 复制密钥到`KIMI_API_KEY`

### 步骤4: 获取B站Cookie（可选）
如需使用AI字幕功能，需要配置B站Cookie：

1. 登录 [B站](https://www.bilibili.com)
2. 按F12打开开发者工具
3. 切换到"Application"标签
4. 左侧找到"Cookies" → "https://www.bilibili.com"
5. 找到`SESSDATA`，复制其值
6. 将整个Cookie字符串填入`BILIBILI_COOKIE`

## 🔧 本地开发环境配置

### 步骤1: 克隆项目
```bash
git clone https://github.com/your-username/bilibili-subtitle.git
cd bilibili-subtitle
```

### 步骤2: 安装依赖
```bash
npm install
```

### 步骤3: 配置环境变量
```bash
# 运行环境检查工具
npm run check-env

# 根据提示完善 .env.local 文件
cp .env.example .env.local
# 编辑 .env.local 文件，填入您的配置
```

### 步骤4: 启动开发服务器
```bash
npm run dev
```

## ✅ 部署验证

部署完成后，使用我们的验证工具检查配置：

```bash
# 验证生产环境部署
npm run validate https://your-app.vercel.app

# 检查本地环境配置
npm run check-env
```

## 🎯 功能验证清单

部署完成后，请验证以下功能：

### 基础功能
- [ ] 访问首页正常加载
- [ ] 可以输入B站视频链接
- [ ] 能够提取普通CC字幕

### AI功能（需要API Key）
- [ ] 可以配置API Key
- [ ] AI能够生成学习笔记
- [ ] 可以切换AI服务商

### 高级功能（需要Cookie）
- [ ] 可以配置B站Cookie
- [ ] 能够访问AI字幕
- [ ] 支持重试机制

## 🔍 常见问题

### Q: 部署后显示"生产环境配置指南"
A: 这是正常的，说明您需要在Vercel控制台中手动设置环境变量。按照界面提示的步骤操作即可。

### Q: AI功能无法使用
A: 请检查：
1. API Key是否正确配置
2. API Key是否有效（可尝试在对应平台测试）
3. 配额是否用完

### Q: 无法提取字幕
A: 请检查：
1. 视频链接是否正确
2. 视频是否有字幕
3. 是否需要配置Cookie（特别是AI字幕）
4. 网络连接是否正常

### Q: 部署到Vercel后访问速度慢
A: 这是正常的，因为：
1. 需要调用外部API（B站、AI服务）
2. Vercel函数有冷启动时间
3. 建议添加重试机制

## 📋 环境变量详解

### AI_PROVIDER
选择使用的AI服务商：
- `qwen`: 阿里云通义千问
- `kimi`: Moonshot KIMI

### API密钥相关
- `QWEN_API_KEY`: 通义千问API密钥
- `KIMI_API_KEY`: KIMI API密钥
- 两个都配置，可在前端切换使用

### 模型选择
- `QWEN_MODEL`: 通义千问模型
  - `qwen-turbo`: 快速响应
  - `qwen-plus`: 推荐，平衡性能
  - `qwen-max`: 最强性能
  - `qwen-max-longcontext`: 超长文本

- `KIMI_MODEL`: KIMI模型
  - `kimi-k2-0905-preview`: 256K上下文，最新
  - `kimi-k2-0711-preview`: 128K上下文
  - `kimi-k2-turbo-preview`: 256K上下文，极速

### B站Cookie
- `BILIBILI_COOKIE`: 用于访问需要登录的资源
- 不配置也能使用，但无法访问AI字幕

## 🚀 高级配置

### 自定义系统提示词
```env
SYSTEM_PROMPT=你是一个专业的学习笔记助手，擅长整理视频内容
```

### 自定义Prompt模板
```env
PROMPT_TEMPLATE=请根据视频标题{title}和字幕内容{subtitle}生成学习笔记
```

### 调整输出长度
```env
QWEN_MAX_TOKENS=12000
```

## 📞 技术支持

如遇到问题，请：
1. 检查浏览器控制台错误信息
2. 查看Vercel函数日志
3. 使用验证工具检查配置
4. 提交Issue到项目仓库

## 📄 更新日志

### v2.0
- 新增生产环境配置指导
- 增强错误处理和用户反馈
- 添加部署验证工具
- 改进环境变量管理

### v1.0
- 基础字幕提取功能
- AI学习笔记生成
- B站Cookie支持
- 重试机制

---

🎉 祝您使用愉快！如有问题，欢迎反馈。`} 现在让我测试一下构建，确保所有修复都正常工作：现在让我测试一下构建，确保所有修复都正常工作： <invoke name=
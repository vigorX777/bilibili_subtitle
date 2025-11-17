## Vercel环境变量配置指南

### 步骤1: 访问Vercel控制台
1. 打开 https://vercel.com/dashboard
2. 选择您的项目

### 步骤2: 进入环境变量设置
1. 点击项目页面的 "Settings" 标签
2. 在左侧菜单中选择 "Environment Variables"

### 步骤3: 添加环境变量
复制以下变量名和对应的值到Vercel控制台:

#### 必需的环境变量:
- AI_PROVIDER = kimi (或 qwen)
- QWEN_API_KEY = 您的通义千问API密钥
- KIMI_API_KEY = 您的KIMI API密钥
- QWEN_MODEL = qwen-plus
- KIMI_MODEL = kimi-k2-turbo-preview
- BILIBILI_COOKIE = 您的B站Cookie (可选)

#### 可选的环境变量:
- QWEN_MAX_TOKENS = 8000
- SYSTEM_PROMPT = 自定义AI系统提示词
- PROMPT_TEMPLATE = 自定义AI Prompt模板

### 步骤4: 保存并重新部署
1. 点击 "Save" 按钮保存环境变量
2. 返回项目页面，点击 "Redeploy" 重新部署项目

### 验证配置
部署完成后，访问您的应用，点击右上角的"配置API"按钮，
如果看到"生产环境配置指南"，说明配置成功。

### 获取API密钥
- 通义千问: https://dashscope.console.aliyun.com/apiKey
- KIMI: https://platform.moonshot.cn/console/api-keys

### 获取B站Cookie
1. 登录 bilibili.com
2. 按F12打开开发者工具
3. 切换到Application标签
4. 找到Cookies -> https://www.bilibili.com
5. 复制SESSDATA的值

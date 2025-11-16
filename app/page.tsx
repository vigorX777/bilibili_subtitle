'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Home() {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [provider, setProvider] = useState<'qwen' | 'kimi'>('qwen');
  // 分别存储两个AI服务的key和model
  const [qwenConfig, setQwenConfig] = useState({ apiKey: '', model: 'qwen-plus' });
  const [kimiConfig, setKimiConfig] = useState({ apiKey: '', model: 'kimi-k2-0905-preview' });
  const [configLoading, setConfigLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [bilibiliCookie, setBilibiliCookie] = useState('');
  const [showCookie, setShowCookie] = useState(false);
  const [hasCookie, setHasCookie] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);

  // 初始化时检查是否已配置API Key和Cookie
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.provider) {
            setProvider(data.provider);
          }
          
          // 加载通义千问配置
          if (data.qwen) {
            setQwenConfig({
              apiKey: data.qwen.apiKey || '',
              model: data.qwen.model || 'qwen-plus'
            });
          }
          
          // 加载KIMI配置
          if (data.kimi) {
            setKimiConfig({
              apiKey: data.kimi.apiKey || '',
              model: data.kimi.model || 'kimi-k2-0905-preview'
            });
          }
          
          // 加载B站Cookie配置
          if (data.bilibiliCookie) {
            setBilibiliCookie(data.bilibiliCookie || '');
            setHasCookie(data.hasCookie || false);
          }
          
          // 设置当前服务商是否有Key
          const currentHasKey = data.provider === 'kimi' ? (data.kimi?.hasKey || false) : (data.qwen?.hasKey || false);
          setHasApiKey(currentHasKey);
        }
      })
      .catch(err => console.error('获取配置失败:', err));
  }, []);

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigLoading(true);

    try {
      const currentConfig = provider === 'kimi' ? kimiConfig : qwenConfig;
      
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          apiKey: currentConfig.apiKey, 
          provider,
          model: currentConfig.model,
          bilibiliCookie: bilibiliCookie // 添加Cookie
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '配置失败');
      }

      alert(data.message);
      setHasApiKey(true);
      if (bilibiliCookie) {
        setHasCookie(true);
      }
      setShowConfigModal(false);
      setShowApiKey(false);
      setShowCookie(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '配置过程中出现错误');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult('');
    setRetryCount(0);
    setIsRetrying(false);
    
    // 创建新的AbortController用于取消请求
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '处理失败');
      }

      setResult(data.markdown);
      setRetryCount(0);
    } catch (err) {
      // 检查是否是用户主动取消
      if (err instanceof Error && err.name === 'AbortError') {
        setError('处理已取消');
      } else {
        setError(err instanceof Error ? err.message : '处理过程中出现错误');
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  const handleAbort = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setLoading(false);
      setError('处理已取消');
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setIsRetrying(true);
    setError('');
    
    // 直接调用提交逻辑，复用现有的videoUrl
    const form = document.querySelector('form');
    if (form) {
      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
    }
    
    setTimeout(() => setIsRetrying(false), 500);
  };

  const handleCopy = async () => {
    try {
      // 先尝试使用降级方案（在iframe中更可靠）
      const textArea = document.createElement('textarea');
      textArea.value = result;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
          document.body.removeChild(textArea);
          return;
        }
      } catch (execErr) {
        console.error('传统复制方法失败:', execErr);
      }
      document.body.removeChild(textArea);
      
      // 如果传统方法失败，尝试Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(result);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } else {
        throw new Error('所有复制方法都不可用');
      }
    } catch (err) {
      console.error('复制错误:', err);
      alert('复制失败，请手动复制内容');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bilibili-notes-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1"></div>
            <h1 className="flex-1 text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              B站视频字幕提取工具
            </h1>
            <div className="flex-1 flex justify-end gap-3">
              <button
                onClick={() => setShowCookieModal(true)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center gap-2"
                title="配置B站Cookie"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {hasCookie ? 'Cookie配置' : '配置Cookie'}
              </button>
              <button
                onClick={() => setShowConfigModal(true)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center gap-2"
                title="配置API Key"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {hasApiKey ? 'API配置' : '配置API'}
              </button>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            一键将B站视频字幕转换为结构化学习笔记
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                输入B站视频链接
              </label>
              <input
                type="text"
                id="videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="例如：https://www.bilibili.com/video/BV..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !videoUrl}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  处理中...
                  {retryCount > 0 && <span className="text-sm">(第{retryCount + 1}次尝试)</span>}
                </>
              ) : (
                '开始提取'
              )}
            </button>
            
            {/* 中断按钮 */}
            {loading && (
              <button
                type="button"
                onClick={handleAbort}
                className="w-full bg-gradient-to-r from-red-400 to-pink-400 text-white py-3 px-6 rounded-lg font-medium hover:from-red-500 hover:to-pink-500 transition flex items-center justify-center gap-2 mt-3"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                中断处理
              </button>
            )}
          </form>

          {/* 操作流程说明 */}
          <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-blue-100 dark:border-gray-600">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              使用流程
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mb-2">1</div>
                <h4 className="font-medium text-gray-800 dark:text-white mb-1">输入视频链接</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">粘贴B站视频URL</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center mb-2">2</div>
                <h4 className="font-medium text-gray-800 dark:text-white mb-1">提取字幕</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">自动获取视频字幕</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center mb-2">3</div>
                <h4 className="font-medium text-gray-800 dark:text-white mb-1">AI处理</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">生成结构化笔记</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center mb-2">4</div>
                <h4 className="font-medium text-gray-800 dark:text-white mb-1">获取结果</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">复制或下载笔记</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-blue-100 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>AI字幕需要配置B站Cookie，普通CC字幕无需登录</span>
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">错误：</p>
                  <p>{error}</p>
                  {error.includes('字幕内容验证失败') && (
                    <p className="text-sm mt-2 text-red-600 dark:text-red-400">
                      💡 提示：这可能是B站API返回了错误的字幕，请点击“重试”按钮
                    </p>
                  )}
                  {retryCount > 0 && (
                    <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                      已重试 {retryCount} 次
                    </p>
                  )}
                </div>
                <button
                  onClick={handleRetry}
                  disabled={loading || isRetrying}
                  className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                  {isRetrying ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      重试中
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      重试
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Result Display */}
        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">生成的笔记</h2>
              <div className="flex gap-3">
                <div className="relative">
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {copySuccess ? '复制成功' : '复制'}
                  </button>
                  {/* 复制成功Toast提示 */}
                  {copySuccess && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 whitespace-nowrap animate-fade-in">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      复制成功！
                    </div>
                  )}
                </div>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下载
                </button>
              </div>
            </div>
            
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* 配置模态框 */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">配置大模型API Key</h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleConfigSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  选择服务商
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'qwen' | 'kimi')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="qwen">阿里云通义千问</option>
                  <option value="kimi">Moonshot KIMI</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  模型选择
                </label>
                <select
                  value={provider === 'kimi' ? kimiConfig.model : qwenConfig.model}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    if (provider === 'kimi') {
                      setKimiConfig({ ...kimiConfig, model: newModel });
                    } else {
                      setQwenConfig({ ...qwenConfig, model: newModel });
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {provider === 'kimi' ? (
                    <>
                      <option value="kimi-k2-0905-preview">kimi-k2-0905-preview (256K上下文, 最新)</option>
                      <option value="kimi-k2-0711-preview">kimi-k2-0711-preview (128K上下文)</option>
                      <option value="kimi-k2-turbo-preview">kimi-k2-turbo-preview (256K上下文, 极速)</option>
                    </>
                  ) : (
                    <>
                      <option value="qwen-turbo">qwen-turbo (快速响应)</option>
                      <option value="qwen-plus">qwen-plus (推荐)</option>
                      <option value="qwen-max">qwen-max (最强性能)</option>
                      <option value="qwen-max-longcontext">qwen-max-longcontext (超长文本)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    id="apiKey"
                    value={provider === 'kimi' ? kimiConfig.apiKey : qwenConfig.apiKey}
                    onChange={(e) => {
                      const newApiKey = e.target.value;
                      if (provider === 'kimi') {
                        setKimiConfig({ ...kimiConfig, apiKey: newApiKey });
                      } else {
                        setQwenConfig({ ...qwenConfig, apiKey: newApiKey });
                      }
                    }}
                    placeholder={provider === 'kimi' ? '输入你的KIMI API Key' : '输入你的通义千问API Key'}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showApiKey ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  获取地址: {provider === 'kimi' ? (
                    <a href="https://platform.moonshot.cn/console/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      https://platform.moonshot.cn/console/api-keys
                    </a>
                  ) : (
                    <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      https://dashscope.console.aliyun.com/apiKey
                    </a>
                  )}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={configLoading || !(provider === 'kimi' ? kimiConfig.apiKey : qwenConfig.apiKey)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50"
                >
                  {configLoading ? '保存中...' : '保存'}
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>注意：</strong>配置保存后需要刷新页面才能生效。API Key仅保存在本地，不会上传到服务器。
                </p>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      🔒 隐私保护声明
                    </p>
                    <ul className="mt-2 text-xs text-green-700 dark:text-green-300 space-y-1">
                      <li>• 您的API Key仅存储在您的设备本地，<strong>不会被上传或分享</strong></li>
                      <li>• 所有身份信息<strong>仅用于访问AI服务</strong>，不会用于其他目的</li>
                      <li>• 您可以随时删除或更新配置信息</li>
                      <li>• 本工具<strong>完全开源</strong>，您可以查看源代码验证安全性</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* B站Cookie配置模态框 */}
      {showCookieModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCookieModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">配置B站Cookie</h2>
              <button
                onClick={() => setShowCookieModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleConfigSubmit} className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor="bilibiliCookie" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    B站Cookie（可选，用于访问AI字幕）
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {hasCookie ? '✅ 已配置' : '⚠️ 未配置'}
                  </span>
                </div>
                
                <div className="relative">
                  <textarea
                    id="bilibiliCookie"
                    value={bilibiliCookie}
                    onChange={(e) => setBilibiliCookie(e.target.value)}
                    placeholder="粘贴你的B站Cookie..."
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                    rows={4}
                    style={{ filter: showCookie ? 'none' : 'blur(4px)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookie(!showCookie)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showCookie ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* 获取Cookie的步骤说明 */}
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">📝 获取步骤：</h3>
                  <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-4 list-decimal">
                    <li>在新标签页打开 <a href="https://www.bilibili.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">bilibili.com</a> 并登录你的账号</li>
                    <li>按 <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded font-mono text-xs">F12</code> 打开开发者工具</li>
                    <li>切换到 <strong>“应用程序”</strong> 或 <strong>“Application”</strong> 选项卡</li>
                    <li>左侧菜单找到 <strong>“Cookie”</strong> → <strong>“https://www.bilibili.com”</strong></li>
                    <li>右侧找到 <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded font-mono text-xs">SESSDATA</code> 这一项</li>
                    <li>双击其 <strong>值</strong>（Value）列，复制完整的Cookie字符串，粘贴到上方输入框</li>
                  </ol>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    📌 <strong>提示：</strong>也可以复制整个Cookie字符串，格式如：<code className="px-1 bg-gray-200 dark:bg-gray-600 rounded font-mono text-xs">SESSDATA=xxx; bili_jct=xxx; ...</code>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCookieModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition"
                >
                  保存配置
                </button>
              </div>
            </form>

            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    🔒 隐私保护声明
                  </p>
                  <ul className="mt-2 text-xs text-green-700 dark:text-green-300 space-y-1">
                    <li>• 您的Cookie仅存储在您的设备本地，<strong>不会被上传或分享</strong></li>
                    <li>• 所有身份信息<strong>仅用于访问B站API</strong>，不会用于其他目的</li>
                    <li>• 您可以随时删除或更新配置信息</li>
                    <li>• 本工具<strong>完全开源</strong>，您可以查看源代码验证安全性</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

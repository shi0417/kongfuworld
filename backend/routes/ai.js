const express = require('express');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const router = express.Router();

// 从环境变量或直接从 server.js 中获取的 API Key
// 注意：这里使用与 server.js 中相同的 API Key，确保一致性
const uploadApi = process.env.OPENAI_API_KEY || "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";

let openai = null;
if (uploadApi && uploadApi.trim()) {
  try {
    openai = new OpenAI({
      apiKey: uploadApi.trim(),
      timeout: 180000, // 180秒（3分钟）超时，给长文本足够的处理时间
      maxRetries: 1, // 减少重试次数，避免等待时间过长
    });
    console.log('AI Layout: OpenAI API 配置成功');
  } catch (error) {
    console.error('AI Layout: OpenAI 初始化失败:', error.message);
  }
} else {
  console.warn('AI Layout: OpenAI API Key 未提供');
}

// 中间件：验证用户认证
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (token) {
    try {
      const decoded = jwt.verify(token, 'your-secret-key');
      req.userId = decoded.id || decoded.userId;
      return next();
    } catch (err) {
      // Token无效，继续检查其他方式
    }
  }
  
  // 如果token无效或不存在，尝试从请求参数获取（用于开发测试）
  const userId = req.body.user_id || req.query.user_id || req.params.user_id;
  if (userId) {
    req.userId = parseInt(userId);
    return next();
  }
  
  return res.status(401).json({ success: false, message: '用户未认证' });
};

// AI 排版接口
router.post('/layout', authenticateUser, async (req, res) => {
  if (!openai) {
    return res.status(500).json({ 
      success: false, 
      message: 'OpenAI API 未配置' 
    });
  }

  const { title, content, translator_note } = req.body;

  // 验证必填字段
  if (!content || !content.trim()) {
    return res.status(400).json({ 
      success: false, 
      message: '章节内容不能为空' 
    });
  }

  try {
    // 构建提示词
    const prompt = `你是一位专业的小说编辑和排版专家。你的任务是对以下章节内容进行排版优化，主要关注：

1. **段落划分**：根据内容逻辑和语义，合理划分段落，避免段落过长或过短
2. **段落间距**：确保段落之间有适当的空行分隔
3. **标点符号**：检查和修正标点符号的使用，确保符合中文写作规范
4. **文字格式**：确保文字清晰易读，保持原意不变
5. **对话格式**：如果是对话内容，确保每个说话人的内容独立成段

**重要提示**：
- 不要改变原文的意思和内容
- 不要添加或删除任何实质性内容
- 只进行排版和格式优化
- 保持原有的文风和语调

章节标题：${title || '无标题'}

章节内容：
${content}

${translator_note ? `作者有话说：${translator_note}` : ''}

请返回优化后的内容，格式为 JSON 对象：
{
  "formatted_title": "优化后的标题",
  "formatted_content": "优化后的内容",
  "formatted_translator_note": "优化后的作者有话说（如果有）"
}`;

    console.log('开始调用 OpenAI API 进行排版...');
    console.log('内容长度:', content.length);
    console.log('标题:', title);

    // 根据内容长度动态调整超时时间（最少90秒，最长180秒）
    const contentLength = content.length;
    const timeoutMs = Math.min(Math.max(contentLength / 50, 90000), 180000); // 每50字符增加1秒，最少90秒，最多180秒
    console.log('设置的超时时间:', timeoutMs / 1000, '秒');

    // 如果内容太长，可能需要减少 max_tokens 或分块处理
    let maxTokens = 8000;
    if (contentLength > 20000) {
      maxTokens = 12000; // 长文本增加 token 限制
    }

    // 设置超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`OpenAI API 调用超时（${timeoutMs / 1000}秒）`)), timeoutMs);
    });

    // 调用 OpenAI API
    const apiPromise = openai.chat.completions.create({
      model: 'gpt-4o-mini', // 使用 gpt-4o-mini 模型，更经济
      messages: [
        {
          role: 'system',
          content: '你是一位专业的小说编辑和排版专家，擅长优化文本的段落结构和格式。请快速高效地完成排版任务。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2, // 更低的 temperature 确保输出稳定和快速
      max_tokens: maxTokens, // 根据需要调整，确保能处理长文本
      timeout: timeoutMs, // 动态超时
    });

    // 使用 Promise.race 来处理超时
    const response = await Promise.race([apiPromise, timeoutPromise]);
    console.log('OpenAI API 调用成功');

    const aiResponse = response.choices[0].message.content.trim();
    
    // 尝试解析 JSON 响应
    let formattedResult;
    try {
      // 尝试直接解析
      formattedResult = JSON.parse(aiResponse);
    } catch (parseError) {
      // 如果直接解析失败，尝试提取 JSON 部分
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        formattedResult = JSON.parse(jsonMatch[0]);
      } else {
        // 如果仍然无法解析，返回原始响应作为内容
        console.warn('AI 返回的不是标准 JSON，使用原始响应');
        formattedResult = {
          formatted_title: title || '',
          formatted_content: aiResponse,
          formatted_translator_note: translator_note || ''
        };
      }
    }

    // 返回格式化后的内容
    res.json({
      success: true,
      data: {
        title: formattedResult.formatted_title || title || '',
        content: formattedResult.formatted_content || content,
        translator_note: formattedResult.formatted_translator_note || translator_note || ''
      }
    });

  } catch (error) {
    console.error('AI 排版失败 - 详细错误信息:');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误堆栈:', error.stack);
    
    // 处理不同类型的错误
    let errorMessage = 'AI 排版失败';
    
    if (error.message && (error.message.includes('超时') || error.message.includes('timeout'))) {
      errorMessage = 'AI 排版超时，内容可能过长。建议将内容分成多个部分进行排版，或稍后再试';
    } else if (error.code === 'insufficient_quota') {
      errorMessage = 'OpenAI API 配额不足，请联系管理员';
    } else if (error.code === 'rate_limit_exceeded' || error.status === 429) {
      errorMessage = 'API 调用频率过高，请稍后再试';
    } else if (error.code === 'ECONNREFUSED' || error.message?.includes('Connection')) {
      errorMessage = '无法连接到 OpenAI 服务，请检查网络连接';
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = '请求超时，请稍后再试';
    } else if (error.message) {
      errorMessage = `AI 排版失败: ${error.message}`;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        type: error.constructor.name
      } : undefined
    });
  }
});

module.exports = router;


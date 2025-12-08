/**
 * AI 翻译模型服务
 * 封装 OpenAI API 调用，用于翻译章节内容
 */

const { OpenAI } = require('openai');

// 从环境变量读取配置
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const KFW_AI_TRANSLATION_ENABLED = process.env.KFW_AI_TRANSLATION_ENABLED !== 'false';

let openaiClient = null;

// 初始化 OpenAI 客户端
function getOpenAIClient() {
  if (!KFW_AI_TRANSLATION_ENABLED) {
    throw new Error('AI translation is disabled. Set KFW_AI_TRANSLATION_ENABLED=true to enable.');
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
      timeout: 120000, // 120秒超时
      maxRetries: 3, // 最大重试次数
      // 如果需要代理，可以在这里配置
      // httpAgent: ...,
      // httpsAgent: ...,
    });
    console.log('[TranslationModel] OpenAI client initialized with timeout: 120s, maxRetries: 3');
  }

  return openaiClient;
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 翻译章节正文（带重试机制和速率限制处理）
 * @param {string} chineseText - 中文文本
 * @param {number} retryCount - 当前重试次数（内部使用）
 * @returns {Promise<string>} 翻译后的英文文本
 */
async function translateChapterText(chineseText, retryCount = 0) {
  if (!chineseText || !chineseText.trim()) {
    return '';
  }

  const client = getOpenAIClient();
  const maxRetries = 3; // 最大重试次数
  const baseDelay = 2000; // 基础延迟（毫秒）

  // 限制文本长度（避免超出 token 限制）
  const maxLength = 8000; // 大约 2000 个中文字符
  const textToTranslate = chineseText.length > maxLength 
    ? chineseText.substring(0, maxLength) + '...'
    : chineseText;

  try {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator specializing in Chinese web novels. Translate the Chinese text into natural, fluent English while maintaining the original style and tone. Preserve paragraph breaks and formatting. Do not add extra explanations or notes.',
        },
        {
          role: 'user',
          content: `Please translate the following Chinese text into English:\n\n${textToTranslate}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const translatedText = response.choices[0]?.message?.content || '';
    
    if (!translatedText) {
      throw new Error('Translation returned empty result');
    }

    return translatedText.trim();
  } catch (error) {
    console.error('[TranslationModel] Error translating chapter text:', error);
    
    // 处理速率限制错误（429）
    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      const retryAfter = error.headers?.['retry-after-ms'] 
        ? parseInt(error.headers['retry-after-ms']) 
        : (error.headers?.['retry-after'] 
          ? parseInt(error.headers['retry-after']) * 1000 
          : 20000); // 默认等待20秒
      
      console.log(`[TranslationModel] Rate limit reached, waiting ${retryAfter}ms before retry...`);
      
      if (retryCount < maxRetries) {
        await sleep(retryAfter);
        return translateChapterText(chineseText, retryCount + 1);
      } else {
        throw new Error(`Translation failed: Rate limit exceeded after ${maxRetries} retries`);
      }
    }
    
    // 处理连接错误（可重试）
    if (error.type === 'requests' || 
        error.code === 'UND_ERR_SOCKET' || 
        error.message?.includes('Connection error') ||
        error.message?.includes('fetch failed') ||
        error.cause?.code === 'UND_ERR_SOCKET') {
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // 指数退避：2s, 4s, 8s
        console.log(`[TranslationModel] Connection error (${error.message || error.cause?.message || 'unknown'}), retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        await sleep(delay);
        return translateChapterText(chineseText, retryCount + 1);
      } else {
        console.error(`[TranslationModel] Connection error after ${maxRetries} retries. Last error:`, error.message || error.cause?.message);
        throw new Error(`Translation failed: Connection error after ${maxRetries} retries. Please check your network connection or OpenAI API status.`);
      }
    }
    
    // 其他错误直接抛出
    throw new Error(`Translation failed: ${error.message}`);
  }
}

/**
 * 翻译章节标题（带重试机制）
 * @param {string} chineseTitle - 中文标题
 * @param {string} englishContent - 英文正文（可选，用于上下文）
 * @param {number} retryCount - 当前重试次数（内部使用）
 * @returns {Promise<string>} 翻译后的英文标题
 */
async function translateChapterTitle(chineseTitle, englishContent = '', retryCount = 0) {
  if (!chineseTitle || !chineseTitle.trim()) {
    return 'Chapter';
  }

  const client = getOpenAIClient();
  const maxRetries = 2; // 标题翻译重试次数较少
  const baseDelay = 1000;

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a professional translator specializing in Chinese web novel titles. Translate the Chinese title into natural, concise English. Return only the translated title, without any explanations or additional text.',
      },
    ];

    if (englishContent) {
      messages.push({
        role: 'user',
        content: `Context (first paragraph of the chapter):\n${englishContent.substring(0, 500)}\n\nPlease translate this chapter title: "${chineseTitle}"`,
      });
    } else {
      messages.push({
        role: 'user',
        content: `Please translate this chapter title: "${chineseTitle}"`,
      });
    }

    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages,
      temperature: 0.3,
      max_tokens: 100,
    });

    const translatedTitle = response.choices[0]?.message?.content || '';
    
    if (!translatedTitle) {
      // Fallback: 如果翻译失败，返回原标题或默认值
      return chineseTitle.length > 100 ? chineseTitle.substring(0, 100) : chineseTitle;
    }

    // 清理可能的引号或多余字符
    return translatedTitle.trim().replace(/^["']|["']$/g, '').substring(0, 255);
  } catch (error) {
    console.error('[TranslationModel] Error translating chapter title:', error);
    
    // 处理速率限制错误
    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      const retryAfter = error.headers?.['retry-after-ms'] 
        ? parseInt(error.headers['retry-after-ms']) 
        : 20000;
      
      if (retryCount < maxRetries) {
        await sleep(retryAfter);
        return translateChapterTitle(chineseTitle, englishContent, retryCount + 1);
      }
    }
    
    // 处理连接错误
    if ((error.type === 'requests' || error.code === 'UND_ERR_SOCKET') && retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount);
      await sleep(delay);
      return translateChapterTitle(chineseTitle, englishContent, retryCount + 1);
    }
    
    // Fallback: 返回原标题（截断到255字符）
    return chineseTitle.substring(0, 255);
  }
}

module.exports = {
  translateChapterText,
  translateChapterTitle,
  getOpenAIClient,
};


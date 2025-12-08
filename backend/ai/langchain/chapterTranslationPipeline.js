/**
 * 章节翻译流水线
 * 使用 LangChain 构建翻译流程：清洗 + 分段 + 翻译 + 后处理
 */

// 注意：LangChain JS 的导入路径可能因版本而异
// 如果 langchain 包不存在，使用简单的文本切分实现
let RecursiveCharacterTextSplitter;
let HumanMessage, SystemMessage;
try {
  RecursiveCharacterTextSplitter = require('langchain/text_splitter').RecursiveCharacterTextSplitter;
  const schema = require('langchain/schema');
  HumanMessage = schema.HumanMessage;
  SystemMessage = schema.SystemMessage;
} catch (e) {
  console.warn('[ChapterTranslationPipeline] LangChain not found, using fallback implementations');
  RecursiveCharacterTextSplitter = null;
  HumanMessage = null;
  SystemMessage = null;
}

const { getPrimaryLlm } = require('./llmRegistry');
const aiTranslationConfig = require('../../config/aiTranslationConfig');

// 共享的 OpenAI 客户端实例（用于回退模式）
let fallbackOpenAIClient = null;

/**
 * 获取共享的 OpenAI 客户端实例（用于回退模式）
 * @returns {OpenAI}
 */
function getFallbackOpenAIClient() {
  if (!fallbackOpenAIClient) {
    const { OpenAI } = require('openai');
    fallbackOpenAIClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 120000, // 120秒超时
      maxRetries: 3, // 最大重试次数
    });
    console.log('[ChapterTranslationPipeline] Fallback OpenAI client initialized with timeout: 120s, maxRetries: 3');
  }
  return fallbackOpenAIClient;
}

/**
 * 选择输入文本（优先使用清洗后的文本）
 * @param {string} rawTitle - 原始标题
 * @param {string} rawContent - 原始内容
 * @param {string} cleanTitle - 清洗后的标题（可选）
 * @param {string} cleanContent - 清洗后的内容（可选）
 * @returns {{title: string, content: string}}
 */
function selectInputText({ rawTitle, rawContent, cleanTitle, cleanContent }) {
  return {
    title: cleanTitle || rawTitle,
    content: cleanContent || rawContent,
  };
}

/**
 * 长文本切分
 * @param {string} text - 要切分的文本
 * @param {number} maxChars - 最大字符数
 * @returns {Promise<Array<string>>} 切分后的文本块列表
 */
/**
 * 简单的文本切分实现（当 LangChain 不可用时使用）
 */
function simpleTextSplit(text, maxChars, overlap = 200) {
  if (!text || text.length <= maxChars) {
    return [text];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;
    
    if (end < text.length) {
      // 尝试在句号、换行符等位置切分
      const separators = ['\n\n', '\n', '。', '.', ' '];
      let bestSplit = end;
      
      for (const sep of separators) {
        const lastIndex = text.lastIndexOf(sep, end);
        if (lastIndex > start) {
          bestSplit = lastIndex + sep.length;
          break;
        }
      }
      
      end = bestSplit;
    } else {
      end = text.length;
    }

    chunks.push(text.substring(start, end));
    start = end - overlap; // 重叠处理
    if (start < 0) start = 0;
  }

  return chunks;
}

async function splitLongText(text, maxChars) {
  if (!text || text.length <= maxChars) {
    return [text];
  }

  if (RecursiveCharacterTextSplitter) {
    // 使用 LangChain 的文本切分器
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: maxChars,
      chunkOverlap: 200, // 重叠200字符，保持上下文连贯
      separators: ['\n\n', '\n', '。', '.', ' ', ''],
    });

    const chunks = await splitter.splitText(text);
    return chunks;
  } else {
    // 使用简单的文本切分实现
    return simpleTextSplit(text, maxChars, 200);
  }
}

/**
 * 翻译文本块（包含广告清洗）
 * @param {string} chunkText - 文本块
 * @param {string} context - 上下文说明（可选）
 * @returns {Promise<string>} 翻译后的英文文本
 */
async function translateChunk(chunkText, context = '') {
  const llm = getPrimaryLlm();

  const systemPrompt = `You are a professional translator specializing in Chinese web novels. 
Your task is to:
1. First, remove any content that looks like website advertisements, promotional text, or site identifiers (e.g., "爱小说，爱玉书堂：YSXS3.COM", "请访问我们的网站", etc.)
2. Then, translate the cleaned Chinese text into natural, fluent English while maintaining the original style and tone
3. Preserve paragraph breaks and formatting
4. Do not add extra explanations or notes
5. Return only the translated English text`;

  const userPrompt = context
    ? `This is ${context}. Please translate the following Chinese text:\n\n${chunkText}`
    : `Please translate the following Chinese text:\n\n${chunkText}`;

  // 如果 LangChain 可用，使用 LangChain 的消息格式
  if (SystemMessage && HumanMessage) {
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];

    const response = await llm.invoke(messages);
    return response.content.trim();
  } else {
    // 回退到 OpenAI SDK 直接调用
    const client = getFallbackOpenAIClient();
    
    try {
      const response = await client.chat.completions.create({
        model: aiTranslationConfig.primaryModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('[ChapterTranslationPipeline] Error in translateChunk:', error.message);
      throw error;
    }
  }
}

/**
 * 翻译标题
 * @param {string} title - 中文标题
 * @param {string} englishContentSummary - 英文正文摘要（可选，用于上下文）
 * @returns {Promise<string>} 翻译后的英文标题
 */
async function translateTitle(title, englishContentSummary = '') {
  if (!title || !title.trim()) {
    return 'Chapter';
  }

  const llm = getPrimaryLlm();

  const systemPrompt = `You are a professional translator specializing in Chinese web novel titles. 
Translate the Chinese title into natural, concise English. 
Return only the translated title, without any explanations or additional text. 
The title should be no more than 255 characters.`;

  let userPrompt;
  if (englishContentSummary) {
    const summary = englishContentSummary.substring(0, 500);
    userPrompt = `Context (first paragraph of the chapter):\n${summary}\n\nPlease translate this chapter title: "${title}"`;
  } else {
    userPrompt = `Please translate this chapter title: "${title}"`;
  }

  // 如果 LangChain 可用，使用 LangChain 的消息格式
  if (SystemMessage && HumanMessage) {
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];

    const response = await llm.invoke(messages);
    let translatedTitle = response.content.trim();

    // 清理可能的引号或多余字符
    translatedTitle = translatedTitle.replace(/^["']|["']$/g, '').substring(0, 255);
    
    return translatedTitle || title.substring(0, 255);
  } else {
    // 回退到 OpenAI SDK 直接调用
    const client = getFallbackOpenAIClient();
    
    try {
      const response = await client.chat.completions.create({
        model: aiTranslationConfig.primaryModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 100,
      });

      let translatedTitle = response.choices[0]?.message?.content?.trim() || '';
      translatedTitle = translatedTitle.replace(/^["']|["']$/g, '').substring(0, 255);
      
      return translatedTitle || title.substring(0, 255);
    } catch (error) {
      console.error('[ChapterTranslationPipeline] Error in translateTitle:', error.message);
      // 如果翻译失败，返回原标题（截断）
      return title.substring(0, 255);
    }
  }
}

/**
 * 计算字数（去除空格）
 * @param {string} text - 文本
 * @returns {number} 字数
 */
function calculateWordCount(text) {
  if (!text) return 0;
  return text.replace(/\s/g, '').length;
}

/**
 * 运行章节翻译流水线
 * @param {Object} params
 * @param {string} params.raw_title - 原始标题
 * @param {string} params.raw_content - 原始内容
 * @param {string} [params.clean_title] - 清洗后的标题（可选）
 * @param {string} [params.clean_content] - 清洗后的内容（可选）
 * @returns {Promise<{clean_title: string, clean_content: string, en_title: string, en_content: string, word_count: number}>}
 */
async function runChapterPipeline({ raw_title, raw_content, clean_title, clean_content }) {
  try {
    // Step 1: 选择输入文本
    const { title: inputTitle, content: inputContent } = selectInputText({
      rawTitle: raw_title,
      rawContent: raw_content,
      cleanTitle: clean_title,
      cleanContent: clean_content,
    });

    // Step 2: 长文本切分
    const maxChars = aiTranslationConfig.maxCharsPerChapter;
    const chunks = await splitLongText(inputContent, maxChars);

    // Step 3: 翻译所有文本块
    const translatedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const context = chunks.length > 1 ? `part ${i + 1} of ${chunks.length} of a chapter` : 'a chapter';
      const translatedChunk = await translateChunk(chunk, context);
      translatedChunks.push(translatedChunk);
    }

    // 合并所有翻译块
    const enContent = translatedChunks.join('\n\n');

    // Step 4: 翻译标题（使用英文正文摘要作为上下文）
    const contentSummary = enContent.substring(0, 500);
    const enTitle = await translateTitle(inputTitle, contentSummary);

    // Step 5: 计算字数
    const wordCount = calculateWordCount(enContent);

    // 返回结果
    return {
      clean_title: inputTitle, // 使用选择的标题（可能是清洗后的）
      clean_content: inputContent, // 使用选择的内容（可能是清洗后的）
      en_title: enTitle,
      en_content: enContent,
      word_count: wordCount,
    };
  } catch (error) {
    console.error('[ChapterTranslationPipeline] Error in pipeline:', error);
    throw error;
  }
}

module.exports = {
  runChapterPipeline,
  selectInputText,
  splitLongText,
  translateChunk,
  translateTitle,
  calculateWordCount,
};


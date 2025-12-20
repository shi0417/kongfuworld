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
const { batchByLength } = require('../utils/batchByLength');

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

  console.log(`[translateTitle] Translating title: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`);
  
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
 * @param {string} [params.existingEnglishTitle] - 已翻译的英文标题（可选，如果提供则跳过标题翻译）
 * @returns {Promise<{clean_title: string, clean_content: string, en_title: string, en_content: string, word_count: number}>}
 */
async function runChapterPipeline({ raw_title, raw_content, clean_title, clean_content, existingEnglishTitle }) {
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
    // 阶段 2：如果已有英文标题，直接复用，避免重复调用 LLM
    let enTitle = existingEnglishTitle && existingEnglishTitle.trim();
    if (!enTitle) {
      const contentSummary = enContent.substring(0, 500);
      console.log(`[ChapterTranslationPipeline] Translating title for chapter (no existing title found): "${inputTitle.substring(0, 50)}"`);
      enTitle = await translateTitle(inputTitle, contentSummary);
    } else {
      console.log(`[ChapterTranslationPipeline] Reusing existing English title: "${enTitle.substring(0, 50)}"`);
    }

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

/**
 * 获取用于章节翻译的 LLM 实例（兼容 LangChain 和 fallback 模式）
 * @param {object} [modelConfig] - 可选的模型配置（预留，用于未来切换模型）
 * @returns {object} LLM 实例或兼容对象
 */
function getChapterTranslationLlm(modelConfig = {}) {
  // 复用现有的 getPrimaryLlm
  return getPrimaryLlm();
}

/**
 * 批量翻译章节标题（仅标题，不含正文），按长度自动分批调用 LLM
 * @param {Array<{ index: number, chineseTitle: string, englishContentSummary?: string }>} items - 待翻译的标题数组
 * @param {object} [options] - 配置选项
 * @param {number} [options.maxCharsPerBatch=8000] - 每批最大字符数，默认 8000
 * @param {number} [options.maxItemsPerBatch=50] - 每批最大条数，默认 50
 * @param {object} [options.modelConfig={}] - 模型配置（预留，用于未来切换模型）
 * @returns {Promise<Array<{ index: number, translatedTitle: string }>>} 翻译结果数组，按 index 排序
 */
async function batchTranslateTitles(items, options = {}) {
  const {
    maxCharsPerBatch = 8000,
    maxItemsPerBatch = 50,
    modelConfig = {},
  } = options;

  if (!items || items.length === 0) {
    return [];
  }

  // 使用现有的 llm 实例（与 translateTitle 同源）
  const llm = getChapterTranslationLlm(modelConfig);

  // 1. 根据标题文本长度做分批
  const batches = batchByLength(
    items,
    (item) => item.chineseTitle || '',
    maxCharsPerBatch,
    maxItemsPerBatch
  );

  console.log(`[BatchTranslateTitles] 共 ${items.length} 个标题，分成 ${batches.length} 批处理`);

  const results = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    // 计算本批的总字符数（用于日志）
    const batchTotalChars = batch.reduce((sum, item) => sum + (item.chineseTitle || '').length, 0);
    console.log(`[BatchTranslateTitles] 处理第 ${batchIndex + 1}/${batches.length} 批，包含 ${batch.length} 个标题，总字符数 ${batchTotalChars}`);

    // 构造 prompt：让模型输出 JSON 数组
    // 注意：必须要求按照 index 返回，方便对号入座
    const inputListText = batch
      .map((it) => `- [${it.index}] ${it.chineseTitle}`)
      .join('\n');

    const systemPrompt = `你是一个专业的中译英小说标题翻译器。
现在给你一组章节标题，请将每个标题翻译成自然、地道、适合作为英文网络小说章节标题的英文。
只输出一个 JSON 数组，每个元素形如：
{"index": 数字, "title_en": "英文标题"}

要求：
- 保留原标题的大致语义和风格
- 不要添加章节号（例如 Chapter 1），只翻译标题本身
- 不要输出多余解释或说明，只返回 JSON

// TODO: 未来可以在 system prompt 里追加：
// - "若标题中出现站点广告、作者宣传语等，请直接删除这部分再翻译。"
// - "若检测到与全书风格不一致的命名方式，可适度统一风格。"
`.trim();

    const userPrompt = `以下是本批需要翻译的章节标题（中括号内是 index，请原样返回）：

${inputListText}

请按 index 顺序返回 JSON 数组。`.trim();

    try {
      let response;
      let responseText;

      // 如果 LangChain 可用，使用 LangChain 的消息格式
      if (SystemMessage && HumanMessage) {
        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt),
        ];
        response = await llm.invoke(messages);
        // LangChain 返回的对象通常有 content 属性
        responseText = typeof response === 'string' 
          ? response 
          : (response.content || response.text || JSON.stringify(response));
      } else {
        // 回退到 OpenAI SDK 直接调用
        const client = getFallbackOpenAIClient();
        const apiResponse = await client.chat.completions.create({
          model: aiTranslationConfig.primaryModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 2000, // 批量翻译可能需要更多 tokens
        });
        responseText = apiResponse.choices[0]?.message?.content || '';
      }

      // 解析 JSON
      let json;
      try {
        // 尝试提取 JSON 部分（可能模型返回了额外的说明文字）
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          json = JSON.parse(jsonMatch[0]);
        } else {
          // 如果没有找到数组，尝试直接解析整个响应
          json = JSON.parse(responseText);
        }
      } catch (err) {
        console.error(`[BatchTranslateTitles] 批次 ${batchIndex + 1} JSON 解析失败:`, err.message);
        console.error(`[BatchTranslateTitles] 原始响应:`, responseText.substring(0, 500));
        throw new Error(`batchTranslateTitles JSON parse error: ${err.message}`);
      }

      // 验证并映射到标准格式
      if (!Array.isArray(json)) {
        throw new Error(`batchTranslateTitles: 期望 JSON 数组，但得到 ${typeof json}`);
      }

      for (const item of json) {
        if (typeof item.index === 'number' && typeof item.title_en === 'string') {
          results.push({
            index: item.index,
            translatedTitle: item.title_en.trim(),
          });
        } else {
          console.warn(`[BatchTranslateTitles] 跳过无效项:`, item);
        }
      }

      console.log(`[BatchTranslateTitles] 批次 ${batchIndex + 1} 完成，解析到 ${json.length} 个结果`);

    } catch (error) {
      console.error(`[BatchTranslateTitles] 批次 ${batchIndex + 1} 处理失败:`, error.message);
      // 可以选择继续处理下一批，或者抛出错误中断
      throw error;
    }
  }

  // 返回按照 index 排序好的结果（方便调用方合并）
  const sortedResults = results.sort((a, b) => a.index - b.index);
  console.log(`[BatchTranslateTitles] 全部完成，共翻译 ${sortedResults.length}/${items.length} 个标题`);
  
  return sortedResults;
}

module.exports = {
  runChapterPipeline,
  selectInputText,
  splitLongText,
  translateChunk,
  translateTitle,
  calculateWordCount,
  batchTranslateTitles,
};


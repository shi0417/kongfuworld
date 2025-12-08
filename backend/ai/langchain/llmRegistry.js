/**
 * LLM 注册表
 * 封装对 OpenAI 客户端 / LangChain LLM 实例的创建
 */

// 注意：LangChain JS 的导入路径可能因版本而异
// 如果 langchain 包不存在，可以暂时使用 OpenAI SDK 直接调用
// 这里先使用条件导入，如果 LangChain 不可用则回退到 OpenAI SDK
let ChatOpenAI;
try {
  // 尝试导入 LangChain（如果已安装）
  ChatOpenAI = require('langchain/chat_models/openai').ChatOpenAI;
} catch (e) {
  // 如果 LangChain 未安装，使用 OpenAI SDK
  console.warn('[LLMRegistry] LangChain not found, will use OpenAI SDK directly');
  ChatOpenAI = null;
}

const aiTranslationConfig = require('../../config/aiTranslationConfig');

let primaryLlm = null;
let secondaryLlm = null;

/**
 * 获取主 LLM 实例
 * @returns {ChatOpenAI}
 */
function getPrimaryLlm() {
  // 如果 LangChain 不可用，返回一个兼容对象
  if (!ChatOpenAI) {
    // 返回一个简单的包装对象，实际调用会在 chapterTranslationPipeline 中处理
    return {
      invoke: async () => {
        throw new Error('LangChain not available, use OpenAI SDK directly');
      }
    };
  }

  if (!primaryLlm) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    primaryLlm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: aiTranslationConfig.primaryModel,
      temperature: 0.3,
      maxTokens: 4000,
    });
  }

  return primaryLlm;
}

/**
 * 获取备用 LLM 实例
 * @returns {ChatOpenAI}
 */
function getSecondaryLlm() {
  // 如果 LangChain 不可用，返回一个兼容对象
  if (!ChatOpenAI) {
    return {
      invoke: async () => {
        throw new Error('LangChain not available, use OpenAI SDK directly');
      }
    };
  }

  if (!secondaryLlm) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    secondaryLlm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: aiTranslationConfig.secondaryModel,
      temperature: 0.3,
      maxTokens: 4000,
    });
  }

  return secondaryLlm;
}

module.exports = {
  getPrimaryLlm,
  getSecondaryLlm,
};


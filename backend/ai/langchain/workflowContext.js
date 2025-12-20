/**
 * LangChain Workflow 上下文
 * 提供共享的 LLM 实例和工具函数
 */

let sharedLlm = null;
let sharedOpenAIClient = null;

/**
 * 获取共享的 LangChain LLM 实例
 * @returns {object} LangChain Chat Model 实例
 */
function getSharedLlm() {
  if (sharedLlm) return sharedLlm;

  try {
    // 尝试使用 LangChain
    const { ChatOpenAI } = require('@langchain/openai');
    const aiTranslationConfig = require('../../config/aiTranslationConfig');

    sharedLlm = new ChatOpenAI({
      modelName: aiTranslationConfig.primaryModel || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      maxRetries: 3,
      timeout: 120000,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    console.log('[WorkflowContext] LangChain ChatOpenAI 初始化成功');
    return sharedLlm;
  } catch (err) {
    console.warn('[WorkflowContext] LangChain 不可用，将使用 OpenAI SDK 直接调用:', err.message);
    return null;
  }
}

/**
 * 获取共享的 OpenAI 客户端（fallback）
 * @returns {object} OpenAI 客户端实例
 */
function getSharedOpenAIClient() {
  if (sharedOpenAIClient) return sharedOpenAIClient;

  const { getOpenAIClient } = require('../translationModel');
  sharedOpenAIClient = getOpenAIClient();
  return sharedOpenAIClient;
}

/**
 * 获取 Workflow 上下文对象
 * @returns {object} 包含 llm、log 等工具的上下文对象
 */
function getWorkflowContext() {
  const llm = getSharedLlm();
  const openAIClient = getSharedOpenAIClient();

  return {
    llm,
    openAIClient,
    log: (...args) => {
      console.log('[AI Workflow]', ...args);
    },
    error: (...args) => {
      console.error('[AI Workflow]', ...args);
    },
  };
}

module.exports = {
  getWorkflowContext,
  getSharedLlm,
  getSharedOpenAIClient,
};


/**
 * AI 翻译配置模块
 * 封装从环境变量读取的 AI 翻译相关配置
 */

/**
 * 从环境变量读取配置
 */
const rpmLimit = parseInt(process.env.KFW_AI_RPM_LIMIT) || 3;
const maxConcurrent = parseInt(process.env.KFW_AI_MAX_CONCURRENT) || 1;
const primaryModel = process.env.KFW_AI_PRIMARY_MODEL || 'gpt-4o-mini';
const secondaryModel = process.env.KFW_AI_SECONDARY_MODEL || 'gpt-4o-mini';
const maxCharsPerChapter = parseInt(process.env.KFW_AI_MAX_CHARS_PER_CHAPTER) || 12000;

// 导出为对象，方便其他模块使用
const aiTranslationConfig = {
  rpmLimit,
  maxConcurrent,
  primaryModel,
  secondaryModel,
  maxCharsPerChapter,
};

module.exports = aiTranslationConfig;
module.exports.aiTranslationConfig = aiTranslationConfig; // 兼容导出


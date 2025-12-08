/**
 * AI 批量翻译导入配置模块
 * 定义和管理章节导入参数配置
 */

/**
 * @typedef {Object} ChapterImportConfig
 * @property {number} novelId - 本次导入的小说 ID（整本固定）
 * @property {'fixed'|'by_range'} volumeMode - 卷分配模式
 * @property {number} [fixedVolumeId] - volumeMode = 'fixed' 时，全书使用的卷 ID
 * @property {number} [volumeRangeSize] - volumeMode = 'by_range' 时，每多少章一个卷，如 100
 * @property {number} freeChapterCount - 前多少章免费，例如 50
 * @property {number} [advanceStartChapter] - 从第几章开始算预读（可选，默认 freeChapterCount+1）
 * @property {'by_word_count'} unlockPriceStrategy - 解锁价格策略（目前只支持按字数）
 * @property {number} [unlockPricePlanId] - 如有需要，绑定 unlockprice 方案 id
 * @property {string} releaseStartDate - 第一批发布时间，如 '2025-12-08 08:00:00'
 * @property {number} chaptersPerDay - 每天发布多少章，例如 2 或 3
 * @property {string} releaseTimeOfDay - 每天的发布时间点，如 '08:00:00'
 */

/**
 * 根据前端传入的 body（或默认规则）构造 ChapterImportConfig
 * @param {any} payload - 前端传入的配置对象
 * @returns {ChapterImportConfig}
 */
function buildChapterImportConfig(payload) {
  const novelId = parseInt(payload.novelId);
  if (!novelId || isNaN(novelId)) {
    throw new Error('novelId is required and must be a valid number');
  }

  // volumeMode 初期可固定为 'fixed'，fixedVolumeId 必填
  const volumeMode = payload.volumeMode || 'fixed';
  const fixedVolumeId = payload.fixedVolumeId !== undefined 
    ? parseInt(payload.fixedVolumeId) 
    : (volumeMode === 'fixed' ? 1 : undefined);
  
  if (volumeMode === 'fixed' && (!fixedVolumeId || isNaN(fixedVolumeId))) {
    throw new Error('fixedVolumeId is required when volumeMode is "fixed"');
  }

  const volumeRangeSize = payload.volumeRangeSize 
    ? parseInt(payload.volumeRangeSize) 
    : (volumeMode === 'by_range' ? 100 : undefined);

  // 免费章节数，默认 50
  const freeChapterCount = payload.freeChapterCount !== undefined
    ? parseInt(payload.freeChapterCount)
    : 50;

  // 预读起始章节，默认 freeChapterCount + 1
  const advanceStartChapter = payload.advanceStartChapter !== undefined
    ? parseInt(payload.advanceStartChapter)
    : freeChapterCount + 1;

  // 每天发布章节数，默认 3
  const chaptersPerDay = payload.chaptersPerDay !== undefined
    ? parseInt(payload.chaptersPerDay)
    : 3;

  // 发布开始日期，默认「今天 08:00」
  let releaseStartDate = payload.releaseStartDate;
  if (!releaseStartDate) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    releaseStartDate = `${year}-${month}-${day} 08:00:00`;
  }

  // 每天发布时间，默认 '08:00:00'
  const releaseTimeOfDay = payload.releaseTimeOfDay || '08:00:00';

  return {
    novelId,
    volumeMode,
    fixedVolumeId,
    volumeRangeSize,
    freeChapterCount,
    advanceStartChapter,
    unlockPriceStrategy: 'by_word_count', // 目前只支持按字数
    unlockPricePlanId: payload.unlockPricePlanId,
    releaseStartDate,
    chaptersPerDay,
    releaseTimeOfDay,
  };
}

module.exports = {
  buildChapterImportConfig,
};


/**
 * 按长度分批工具
 * 根据字符串长度，把 items 分组，保证每组的总长度不超过 maxChars
 */

/**
 * 根据字符串长度，把 items 分组，保证每组的总长度不超过 maxChars
 * @param {Array<T>} items - 原始数组
 * @param {(item: T) => string} getText - 把 item 转成要计数的字符串
 * @param {number} maxChars - 每批最大字符数（例如 12000）
 * @param {number} [maxItems] - 每批最多条数（可选，例如 50），默认 Infinity
 * @returns {Array<Array<T>>} 分组后的二维数组
 */
function batchByLength(items, getText, maxChars, maxItems = Infinity) {
  if (!items || items.length === 0) {
    return [];
  }

  const batches = [];
  let currentBatch = [];
  let currentLen = 0;

  for (const item of items) {
    const text = getText(item);
    const len = text.length;

    // 如果单个 item 的长度就超过 maxChars，单独作为一批（避免死循环）
    if (len > maxChars) {
      // 先把当前批次保存（如果有）
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentLen = 0;
      }
      // 单独作为一批
      batches.push([item]);
      continue;
    }

    // 判断是否需要新开一批
    const wouldExceedLength = currentLen + len > maxChars;
    const wouldExceedCount = currentBatch.length >= maxItems;

    if (wouldExceedLength || wouldExceedCount) {
      // 保存当前批次
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }
      // 新开一批
      currentBatch = [item];
      currentLen = len;
    } else {
      // 加入当前批次
      currentBatch.push(item);
      currentLen += len;
    }
  }

  // 保存最后一批
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

module.exports = { batchByLength };


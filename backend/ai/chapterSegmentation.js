/**
 * 章节分割服务
 * 从整本文本中切分出章节列表
 */

/**
 * 从整本文本中分割章节
 * @param {string} sourceText - 源文本
 * @returns {Array<{chapterNumber: number, title: string, content: string}>} 章节列表
 */
function segmentChapters(sourceText) {
  if (!sourceText || !sourceText.trim()) {
    return [];
  }

  // 章节分割正则表达式
  // 匹配：第X章、Chapter X、第X回 等格式
  const chapterPatterns = [
    /第[一二三四五六七八九十百千0-9]+章[^\n]*/g,
    /Chapter\s+\d+[^\n]*/gi,
    /第[一二三四五六七八九十百千0-9]+回[^\n]*/g,
    /第\s*\d+\s*章[^\n]*/g,
  ];

  // 找到所有章节标题的位置
  const chapterMarkers = [];
  
  for (const pattern of chapterPatterns) {
    let match;
    while ((match = pattern.exec(sourceText)) !== null) {
      chapterMarkers.push({
        index: match.index,
        title: match[0].trim(),
      });
    }
  }

  // 如果没有找到章节标记，将整个文本作为一章
  if (chapterMarkers.length === 0) {
    const lines = sourceText.trim().split('\n');
    const firstLine = lines[0] || 'Chapter 1';
    const content = lines.slice(1).join('\n').trim() || sourceText.trim();
    
    return [{
      chapterNumber: 1,
      title: firstLine.substring(0, 255), // 限制标题长度
      content: content,
    }];
  }

  // 按位置排序
  chapterMarkers.sort((a, b) => a.index - b.index);

  // 分割章节
  const chapters = [];
  for (let i = 0; i < chapterMarkers.length; i++) {
    const startIndex = chapterMarkers[i].index;
    const endIndex = i < chapterMarkers.length - 1 
      ? chapterMarkers[i + 1].index 
      : sourceText.length;

    const chapterText = sourceText.substring(startIndex, endIndex).trim();
    
    // 提取标题（第一行）
    const lines = chapterText.split('\n');
    let title = chapterMarkers[i].title;
    let content = chapterText;

    // 如果标题在文本中，尝试提取更完整的标题
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length > 0 && firstLine.length <= 255) {
        title = firstLine;
        content = lines.slice(1).join('\n').trim();
      }
    }

    // 如果内容为空，使用整个章节文本
    if (!content || content.length === 0) {
      content = chapterText;
    }

    chapters.push({
      chapterNumber: i + 1,
      title: title.substring(0, 255), // 限制标题长度
      content: content,
    });
  }

  return chapters;
}

module.exports = {
  segmentChapters,
};


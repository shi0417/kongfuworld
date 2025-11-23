# 文件名作为章节标题功能

## 功能描述

当上传多个文件时，如果文件名与文件正文开始部分相似，系统可以自动使用文件名作为章节标题，或者提供手动选择使用文件名的选项。

## 实现原理

### 1. 相似性检查算法

系统使用 `isFileNameSimilarToContent` 函数来检查文件名与章节内容的相似性：

```typescript
const isFileNameSimilarToContent = (fileName: string, content: string): boolean => {
  // 移除文件扩展名
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  // 获取内容的前100个字符
  const contentStart = content.substring(0, 100).trim();
  
  // 如果文件名长度太短（少于3个字符），不进行相似性检查
  if (nameWithoutExt.length < 3) {
    return false;
  }
  
  // 检查文件名是否包含在内容开始部分中
  if (contentStart.includes(nameWithoutExt)) {
    return true;
  }
  
  // 检查内容开始部分是否包含文件名的主要部分（去除特殊字符）
  const cleanFileName = nameWithoutExt.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const cleanContentStart = contentStart.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  
  if (cleanFileName.length >= 3 && cleanContentStart.includes(cleanFileName)) {
    return true;
  }
  
  // 检查是否有足够的共同字符（至少50%的匹配）
  const commonChars = cleanFileName.split('').filter(char => cleanContentStart.includes(char));
  const similarity = commonChars.length / cleanFileName.length;
  
  return similarity >= 0.5;
};
```

### 2. 相似性检查规则

1. **长度检查**：文件名长度必须至少3个字符
2. **直接包含**：内容开始部分直接包含文件名
3. **清理后包含**：去除特殊字符后，内容包含文件名
4. **字符相似性**：至少50%的字符匹配

### 3. 数据结构扩展

在 `Chapter` 接口中添加了 `fileName` 字段：

```typescript
interface Chapter {
  id: number;
  title: string;
  content: string;
  wordCount: number;
  chapterNumber: number;
  volumeId?: number;
  fileName?: string; // 新增：文件名字段
  isLocked: boolean;
  isVipOnly: boolean;
  isAdvance: boolean;
  isVisible: boolean;
  unlockCost: number;
  translatorNote: string;
}
```

## 功能特性

### 1. 自动检测

在章节标题显示时，系统会自动检查文件名与内容的相似性：

```typescript
// 检查是否应该使用文件名作为章节标题
if (chapter.fileName && isFileNameSimilarToContent(chapter.fileName, chapter.content)) {
  const fileNameWithoutExt = chapter.fileName.replace(/\.[^/.]+$/, '');
  // 如果标题已经包含章节号，直接使用文件名
  if (title.match(/^第?[一二三四五六七八九十百千万\d]+[章节回]/)) {
    return `${title} - ${fileNameWithoutExt}`;
  } else {
    // 否则根据章节类型添加章节号
    if (title.includes('回')) {
      return `第${chapterNumber}回: ${fileNameWithoutExt}`;
    } else if (title.includes('节')) {
      return `第${chapterNumber}节: ${fileNameWithoutExt}`;
    } else {
      return `第${chapterNumber}章: ${fileNameWithoutExt}`;
    }
  }
}
```

### 2. 手动选择

提供"📁 使用文件名"按钮，允许用户手动选择使用文件名作为章节标题：

```typescript
<button 
  onClick={() => {
    // 使用文件名作为章节标题（如果相似）
    setChapters(prev => prev.map(chapter => {
      if (chapter.fileName && isFileNameSimilarToContent(chapter.fileName, chapter.content)) {
        const fileNameWithoutExt = chapter.fileName.replace(/\.[^/.]+$/, '');
        return {
          ...chapter,
          title: fileNameWithoutExt
        };
      }
      return chapter;
    }));
  }}
  className={styles.reorderButton}
  title="使用文件名作为章节标题（如果相似）"
>
  📁 使用文件名
</button>
```

## 使用场景

### 1. 多文件上传

当用户上传多个文件时，每个文件都会被解析为章节，系统会：

1. 为每个章节记录文件名
2. 检查文件名与内容的相似性
3. 在显示时优先使用相似的文件名作为标题

### 2. 文件命名规范

适用于以下文件命名场景：

- **章节标题命名**：`第1回 甄士隐梦幻识通灵.docx`
- **内容关键词命名**：`红楼梦开篇.docx`
- **序号命名**：`第一章.docx`、`第二章.docx`

### 3. 智能匹配

系统能够智能识别：

- 文件名包含章节号的情况
- 文件名包含内容关键词的情况
- 文件名与内容高度相似的情况

## 显示效果

### 1. 自动检测模式

- **相似文件名**：`第1回: 甄士隐梦幻识通灵` → `第1回: 甄士隐梦幻识通灵 - 第1回 甄士隐梦幻识通灵`
- **不相似文件名**：`第1回: 甄士隐梦幻识通灵` → `第1回: 甄士隐梦幻识通灵`

### 2. 手动选择模式

- **相似文件名**：`第1回: 甄士隐梦幻识通灵` → `第1回 甄士隐梦幻识通灵`
- **不相似文件名**：保持不变

## 技术实现

### 1. 文件处理

在 `handleFilesUpload` 函数中，为每个章节添加文件名信息：

```typescript
const fileChapters = data.chapters.map((chapter: any) => ({
  ...chapter,
  id: globalChapterId++,
  chapterNumber: chapter.chapterNumber || globalChapterId - 1,
  fileName: file.name // 添加文件名信息
}));
```

### 2. 相似性算法

使用多种策略检查相似性：

1. **直接匹配**：检查内容是否包含完整文件名
2. **清理匹配**：去除特殊字符后检查
3. **字符相似性**：计算共同字符比例

### 3. 用户界面

在章节列表上方添加"📁 使用文件名"按钮，提供手动选择功能。

## 优势

### 1. 提高准确性

- 自动识别有意义的文件名
- 避免使用无意义的章节标题
- 保持章节标题的一致性

### 2. 用户友好

- 提供自动检测和手动选择两种模式
- 保持原有的章节标题显示逻辑
- 不影响现有的功能

### 3. 灵活性

- 支持多种文件命名方式
- 可配置的相似性阈值
- 可扩展的匹配算法

## 注意事项

### 1. 性能考虑

- 相似性检查只在显示时进行
- 避免在大量章节时影响性能
- 使用高效的字符串匹配算法

### 2. 准确性

- 相似性阈值设置为50%，可根据需要调整
- 文件名长度限制确保有意义
- 支持中英文混合文件名

### 3. 兼容性

- 保持与现有章节标题逻辑的兼容
- 不影响章节号提取功能
- 支持所有文件格式

## 总结

这个功能通过智能的文件名相似性检查，为多文件上传提供了更好的章节标题管理体验。用户可以通过有意义的文件名来组织章节，系统会自动识别并使用这些文件名作为章节标题，提高了章节管理的准确性和便利性。 
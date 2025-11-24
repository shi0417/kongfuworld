import React, { useState, useRef, useEffect } from 'react';
import styles from './NovelUpload.module.css';
import { API_ENDPOINTS, API_BASE_URL } from '../config';

interface Chapter {
  id: number;
  title: string;
  content: string;
  wordCount: number;
  chapterNumber: number; // 添加章节编号字段
  volumeId?: number; // 添加卷ID字段
  fileName?: string; // 添加文件名字段
  isLocked: boolean;
  isVipOnly: boolean;
  isAdvance: boolean;
  isVisible: boolean;
  unlockCost: number;
  translatorNote: string;
}

interface NovelConfig {
  title: string;
  author: string;
  description: string;
  volumeTitle: string;
  freeChapters: number;
  minCost: number;
  maxCost: number;
}

interface Novel {
  id: number;
  title: string;
  author: string;
  description: string;
  chapters: number;
}



interface ChapterRange {
  type: 'all' | 'range';
  startChapter: number;
  endChapter: number;
}

interface ChapterSetting {
  enabled: boolean;
  range: ChapterRange;
}

interface SimilarNovel {
  id: number;
  title: string;
  author: string;
  description: string;
  chapters: number;
  volume_id: number;
  volume_title: string;
  chapter_count: number;
}

interface NovelInfo {
  maxChapterNumber: number;
  volumes: Array<{
    id: number;
    title: string;
    volume_id: number;
    chapter_count: number;
  }>;
}

interface ExistingChapter {
  id: number;
  chapter_number: number;
  title: string;
  volume_id: number;
  volume_title: string;
}



const NovelUpload: React.FC = () => {
  const [novelConfig, setNovelConfig] = useState<NovelConfig>({
    title: '',
    author: '',
    description: '',
    volumeTitle: '第一卷',
    freeChapters: 3,
    minCost: 10,
    maxCost: 63
  });

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'parsing' | 'processing' | 'completed' | 'error'>('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 续传相关状态
  const [startChapterNumber, setStartChapterNumber] = useState(1);

  // 新增状态
  const [isNewNovel, setIsNewNovel] = useState(true);
  const [isContinueNovel, setIsContinueNovel] = useState(false);
  const [selectedNovelId, setSelectedNovelId] = useState<number | null>(null);
  const [allNovels, setAllNovels] = useState<Novel[]>([]);
  const [showNovelSelector, setShowNovelSelector] = useState(false);
  const [existingChapters, setExistingChapters] = useState<ExistingChapter[]>([]);



  // 章节设置
  const [chapterSettings, setChapterSettings] = useState<{
    isLocked: ChapterSetting;
    isVipOnly: ChapterSetting;
    isAdvance: ChapterSetting;
    isVisible: ChapterSetting;
  }>({
    isLocked: { enabled: false, range: { type: 'all', startChapter: 1, endChapter: 1 } },
    isVipOnly: { enabled: false, range: { type: 'all', startChapter: 1, endChapter: 1 } },
    isAdvance: { enabled: false, range: { type: 'all', startChapter: 1, endChapter: 1 } },
    isVisible: { enabled: true, range: { type: 'all', startChapter: 1, endChapter: 1 } }
  });

  // 自动递增状态
  const [autoIncrementChapters, setAutoIncrementChapters] = useState<Set<number>>(new Set());
  
  // 自动复制volume_id状态
  const [autoCopyVolumeId, setAutoCopyVolumeId] = useState<Set<number>>(new Set());

  // 文件排序状态
  const [fileSortOrder, setFileSortOrder] = useState<'name' | 'size' | 'date'>('name');

  // 重新排序文件
  const reorderFiles = () => {
    const sortedFiles = [...selectedFiles].sort((a, b) => {
      switch (fileSortOrder) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return a.size - b.size;
        case 'date':
          return a.lastModified - b.lastModified;
        default:
          return 0;
      }
    });
    setSelectedFiles(sortedFiles);
  };

  // 删除文件
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 清空所有文件
  const clearAllFiles = () => {
    setSelectedFiles([]);
    setChapters([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 检查文件名与章节内容开始部分的相似性
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

  // 处理拖拽上传
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/pdf', // .pdf
        'text/plain', // .txt
        'application/msword' // .doc
      ];
      return validTypes.includes(file.type);
    });

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      handleFilesUpload([...selectedFiles, ...validFiles]);
    } else {
      alert('请拖拽有效的文件格式：Word文档(.docx/.doc)、PDF(.pdf)或文本文件(.txt)');
    }
  };


  // 获取所有小说列表
  const getAllNovels = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.GET_ALL_NOVELS);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAllNovels(data.novels);
        }
      }
    } catch (error) {
      console.error('获取小说列表失败:', error);
    }
  };

  // 搜索小说
  const searchNovels = async (title: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.SEARCH_NOVELS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAllNovels(data.novels);
        }
      }
    } catch (error) {
      console.error('搜索小说失败:', error);
    }
  };

  // 获取小说章节信息
  const getNovelChapters = async (novelId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/novel/${novelId}/chapters`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setExistingChapters(data.chapters);
          console.log('获取到章节信息:', data.chapters);
        }
      }
    } catch (error) {
      console.error('获取章节信息失败:', error);
    }
  };





  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/pdf', // .pdf
      'text/plain' // .txt
    ];
    // 只允许 .docx/.pdf/.txt
    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return (
        validTypes.includes(file.type) ||
        ext === 'docx' || ext === 'pdf' || ext === 'txt'
      );
    });
    if (validFiles.length !== files.length) {
      alert('只支持上传 .docx、.pdf、.txt 文件，不支持 .doc 文件。请将 .doc 文件另存为 .docx 后再上传。');
      return;
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      handleFilesUpload(validFiles);
    } else {
      alert('请选择有效的文件格式：Word文档(.docx/.doc)、PDF(.pdf)或文本文件(.txt)');
    }
  };

  // 处理多文件上传和解析
  const handleFilesUpload = async (files: File[]) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStage('准备上传文件...');
    setUploadStatus('uploading');
    setTotalFiles(files.length);
    setCurrentFileIndex(0);

    try {
      // 根据用户选择的排序方式对文件进行排序
      const sortedFiles = [...files].sort((a, b) => {
        switch (fileSortOrder) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'size':
            return a.size - b.size;
          case 'date':
            return a.lastModified - b.lastModified;
          default:
            return 0;
        }
      });

      setUploadStatus('uploading');
      setUploadStage('正在上传文件到服务器...');
      setUploadProgress(20);

      // 使用新的ChatGPT API进行多文件解析
      const formData = new FormData();
      sortedFiles.forEach(file => {
        formData.append('files', file);
      });

      setUploadStatus('parsing');
      setUploadStage('正在使用ChatGPT分析章节...');
      setUploadProgress(40);

      const response = await fetch(API_ENDPOINTS.PARSE_MULTIPLE_FILES, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (data.chapters && Array.isArray(data.chapters)) {
          setUploadStatus('processing');
          setUploadStage('正在整理章节数据...');
          setUploadProgress(80);

          // 直接使用后端返回的已排序章节
          const finalChapters = data.chapters.map((chapter: any, index: number) => ({
            ...chapter,
            wordCount: chapter.content ? chapter.content.replace(/\s+/g, '').length : 0,
            isLocked: false,
            isVipOnly: false,
            isAdvance: false,
            isVisible: true,
            unlockCost: 0,
            translatorNote: ''
          }));

          setUploadStage('正在应用章节设置...');
          setUploadProgress(95);

          setChapters(finalChapters);
          setUploadProgress(100);
          setUploadStage(`ChatGPT分析完成！共解析 ${finalChapters.length} 个章节`);
          setUploadStatus('completed');
        
        // 更新章节范围设置
          if (finalChapters.length > 0) {
          setChapterSettings(prev => ({
            ...prev,
              isLocked: { ...prev.isLocked, range: { ...prev.isLocked.range, endChapter: finalChapters.length } },
              isVipOnly: { ...prev.isVipOnly, range: { ...prev.isVipOnly.range, endChapter: finalChapters.length } },
              isAdvance: { ...prev.isAdvance, range: { ...prev.isAdvance.range, endChapter: finalChapters.length } },
              isVisible: { ...prev.isVisible, range: { ...prev.isVisible.range, endChapter: finalChapters.length } }
          }));
        }
      } else {
          throw new Error('服务器返回的章节数据格式不正确');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '文件解析失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      setUploadStatus('error');
      setUploadStage('上传失败，请重试');
      alert('文件上传失败，请重试');
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStage('');
        setUploadStatus('idle');
        setCurrentFileIndex(0);
        setTotalFiles(0);
        setCurrentFileName('');
      }, 2000);
    }
  };

  // 更新章节设置
  const updateChapterSettings = (field: keyof typeof chapterSettings, value: any) => {
    setChapterSettings(prev => ({
      ...prev,
      [field]: { ...prev[field], ...value }
    }));

    // 应用设置到章节
    applySettingsToChapters();
  };

  // 应用设置到章节
  const applySettingsToChapters = () => {
    setChapters(prev => prev.map((chapter, index) => {
      const chapterNumber = index + 1;
      const newChapter = { ...chapter };

      // 检查每个设置是否应用到当前章节
      Object.entries(chapterSettings).forEach(([key, setting]) => {
        if (setting.enabled) {
          const isInRange = setting.range.type === 'all' || 
            (chapterNumber >= setting.range.startChapter && chapterNumber <= setting.range.endChapter);
          
          if (isInRange) {
            if (key === 'isLocked') newChapter.isLocked = true;
            if (key === 'isVipOnly') newChapter.isVipOnly = true;
            if (key === 'isAdvance') newChapter.isAdvance = true;
            if (key === 'isVisible') newChapter.isVisible = true;
          }
        }
      });

      return newChapter;
    }));
  };

  // 更新单个章节设置
  const updateChapter = (index: number, field: keyof Chapter, value: any) => {
    setChapters(prev => prev.map((chapter, i) => 
      i === index ? { ...chapter, [field]: value } : chapter
    ));
  };

  // 提交上传
  const handleSubmit = async () => {
    if (selectedFiles.length === 0 || chapters.length === 0) {
      alert('请先上传文档并确保有章节内容');
      return;
    }

    // 检查模式选择
    if (!isNewNovel && !isContinueNovel) {
      alert('请选择上传模式');
      return;
    }

    // 如果是续写模式但没有选择小说
    if (isContinueNovel && !selectedNovelId) {
      alert('请选择要续写的小说');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStage('正在上传到数据库...');

    try {
      const formData = new FormData();
      
      // 添加所有文件
      selectedFiles.forEach((file, index) => {
        formData.append('files', file);
      });
      
      formData.append('config', JSON.stringify(novelConfig));
      formData.append('chapters', JSON.stringify(chapters));
      formData.append('isNewNovel', isNewNovel.toString());
      formData.append('selectedNovelId', selectedNovelId?.toString() || '');
      formData.append('startChapterNumber', startChapterNumber.toString());
      formData.append('fileCount', selectedFiles.length.toString());

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 100);

      const response = await fetch(API_ENDPOINTS.UPLOAD_NOVEL, {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStage('上传完成');

      if (response.ok) {
        const result = await response.json();
        const modeText = result.isNewNovel ? '新建' : '续传';
        alert(`${modeText}成功！共上传 ${result.totalChapters} 个章节`);
        // 重置表单
        setChapters([]);
        setSelectedFiles([]);
        setSelectedNovelId(null);
        setStartChapterNumber(1);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败，请重试');
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStage('');
      }, 1000);
    }
  };

  // 渲染章节范围设置
  const renderChapterRangeSetting = (field: keyof typeof chapterSettings, label: string) => {
    const setting = chapterSettings[field];
    
    return (
      <div className={styles.chapterRangeSetting}>
        <div className={styles.settingHeader}>
          <label>
            <input
              type="checkbox"
              checked={setting.enabled}
              onChange={(e) => updateChapterSettings(field, { enabled: e.target.checked })}
            />
            {label}
          </label>
        </div>
        
        {setting.enabled && (
          <div className={styles.rangeControls}>
            <div className={styles.rangeType}>
              <label>
                <input
                  type="radio"
                  name={`${field}-type`}
                  checked={setting.range.type === 'all'}
                  onChange={() => updateChapterSettings(field, { 
                    range: { ...setting.range, type: 'all' } 
                  })}
                />
                所有章节
              </label>
              <label>
                <input
                  type="radio"
                  name={`${field}-type`}
                  checked={setting.range.type === 'range'}
                  onChange={() => updateChapterSettings(field, { 
                    range: { ...setting.range, type: 'range' } 
                  })}
                />
                指定范围
              </label>
            </div>
            
            {setting.range.type === 'range' && (
              <div className={styles.rangeInputs}>
                <span>从第</span>
                <input
                  type="number"
                  min="1"
                  max={chapters.length}
                  value={setting.range.startChapter}
                  onChange={(e) => updateChapterSettings(field, {
                    range: { ...setting.range, startChapter: parseInt(e.target.value) || 1 }
                  })}
                />
                <span>章到第</span>
                <input
                  type="number"
                  min="1"
                  max={chapters.length}
                  value={setting.range.endChapter}
                  onChange={(e) => updateChapterSettings(field, {
                    range: { ...setting.range, endChapter: parseInt(e.target.value) || 1 }
                  })}
                />
                <span>章</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>小说上传</h1>
      
      {/* 小说基本信息 */}
      <div className={styles.section}>
        <h2>小说基本信息</h2>
        
        {/* 上传模式选择 */}
        <div className={styles.uploadModeSelection}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isNewNovel}
              onChange={(e) => {
                setIsNewNovel(e.target.checked);
                if (e.target.checked) {
                  setIsContinueNovel(false);
                  setSelectedNovelId(null);
                  setShowNovelSelector(false);
                }
              }}
            />
            新创小说
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isContinueNovel}
              onChange={(e) => {
                setIsContinueNovel(e.target.checked);
                if (e.target.checked) {
                  setIsNewNovel(false);
                  setShowNovelSelector(true);
                  getAllNovels();
                } else {
                  setSelectedNovelId(null);
                  setShowNovelSelector(false);
                }
              }}
            />
            小说续写 (点击选择小说)
          </label>
        </div>

        {/* 小说选择器 */}
        {showNovelSelector && (
          <div className={styles.novelSelector}>
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="搜索小说名称..."
                onChange={(e) => {
                  if (e.target.value.trim()) {
                    searchNovels(e.target.value);
                  } else {
                    getAllNovels();
                  }
                }}
              />
              <button onClick={getAllNovels}>刷新列表</button>
            </div>
            
            <div className={styles.novelList}>
              {allNovels.map((novel) => (
                <div 
                  key={novel.id} 
                  className={`${styles.novelItem} ${selectedNovelId === novel.id ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedNovelId(novel.id);
                    // 自动填充小说信息
                    setNovelConfig(prev => ({
                      ...prev,
                      title: novel.title,
                      author: novel.author,
                      description: novel.description
                    }));
                    // 获取该小说的章节信息
                    getNovelChapters(novel.id);
                  }}
                >
                  <h3>{novel.title}</h3>
                  <p>作者: {novel.author}</p>
                  <p>总章节: {novel.chapters}</p>
                  <p>小说ID: {novel.id}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 已有章节信息 */}
        {selectedNovelId && existingChapters.length > 0 && (
          <div className={styles.existingChapters}>
            <h3>已有章节信息（供参考）</h3>
            <div className={styles.chaptersList}>
              {existingChapters.map((chapter) => (
                <div key={chapter.id} className={styles.chapterItem}>
                  <span className={styles.chapterNumber}>第{chapter.chapter_number}章</span>
                  <span className={styles.chapterTitle}>{chapter.title}</span>
                  <span className={styles.volumeInfo}>(卷{chapter.volume_id}: {chapter.volume_title})</span>
                </div>
              ))}
            </div>
            <div className={styles.chapterSummary}>
              <p>总计: {existingChapters.length} 个章节</p>
              <p>最大章节号: {Math.max(...existingChapters.map(c => c.chapter_number))}</p>
              <p>建议起始章节号: {Math.max(...existingChapters.map(c => c.chapter_number)) + 1}</p>
            </div>
          </div>
        )}

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>小说标题 *</label>
            <input
              type="text"
              value={novelConfig.title}
              onChange={(e) => setNovelConfig(prev => ({ ...prev, title: e.target.value }))}
              placeholder="请输入小说标题"
            />
          </div>
          <div className={styles.formGroup}>
            <label>作者 *</label>
            <input
              type="text"
              value={novelConfig.author}
              onChange={(e) => setNovelConfig(prev => ({ ...prev, author: e.target.value }))}
              placeholder="请输入作者姓名"
            />
          </div>
          <div className={styles.formGroup}>
            <label>卷标题</label>
            <input
              type="text"
              value={novelConfig.volumeTitle}
              onChange={(e) => setNovelConfig(prev => ({ ...prev, volumeTitle: e.target.value }))}
              placeholder="请输入卷标题"
            />
          </div>
          <div className={styles.formGroup}>
            <label>免费章节数</label>
            <input
              type="number"
              value={novelConfig.freeChapters}
              onChange={(e) => setNovelConfig(prev => ({ ...prev, freeChapters: parseInt(e.target.value) || 0 }))}
              min="0"
            />
          </div>
          <div className={styles.formGroup}>
            <label>最小解锁金币</label>
            <input
              type="number"
              value={novelConfig.minCost}
              onChange={(e) => setNovelConfig(prev => ({ ...prev, minCost: parseInt(e.target.value) || 0 }))}
              min="0"
            />
          </div>
          <div className={styles.formGroup}>
            <label>最大解锁金币</label>
            <input
              type="number"
              value={novelConfig.maxCost}
              onChange={(e) => setNovelConfig(prev => ({ ...prev, maxCost: parseInt(e.target.value) || 0 }))}
              min="0"
            />
          </div>
        </div>
        <div className={styles.formGroup}>
          <label>小说描述</label>
          <textarea
            value={novelConfig.description}
            onChange={(e) => setNovelConfig(prev => ({ ...prev, description: e.target.value }))}
            placeholder="请输入小说描述"
            rows={4}
          />
        </div>
      </div>

      



      {/* 文档上传 */}
      <div className={styles.section}>
        <h2>文档上传</h2>
        <div 
          className={`${styles.uploadArea} ${isDragOver ? styles.dragover : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc,.pdf,.txt"
            multiple
            onChange={handleFileSelect}
            className={styles.fileInput}
          />
          <div className={styles.uploadContent}>
            <div className={styles.uploadIcon}>📄</div>
            <p>点击选择文件或拖拽文件到此处</p>
            <p className={styles.fileTypes}>支持格式：Word文档(.docx/.doc)、PDF(.pdf)、文本文件(.txt)</p>
            
            {/* 文件排序选项 */}
            {selectedFiles.length > 1 && (
              <div className={styles.fileSortOptions}>
                <label>文件处理顺序：</label>
                <select
                  value={fileSortOrder}
                  onChange={(e) => setFileSortOrder(e.target.value as 'name' | 'size' | 'date')}
                  className={styles.sortSelect}
                >
                  <option value="name">按文件名排序</option>
                  <option value="size">按文件大小排序</option>
                  <option value="date">按修改时间排序</option>
                </select>
                <button 
                  onClick={reorderFiles}
                  className={styles.reorderButton}
                  title="重新排序文件列表"
                >
                  🔄 重新排序
                </button>
              </div>
            )}
            
            {selectedFiles.length > 0 && (
              <div className={styles.fileList}>
                <div className={styles.fileListHeader}>
                  <p>已选择 {selectedFiles.length} 个文件：</p>
                  <button 
                    onClick={clearAllFiles}
                    className={styles.clearAllButton}
                    title="清空所有文件"
                  >
                    🗑️ 清空所有
                  </button>
                </div>
                {selectedFiles.map((file, index) => (
                  <div key={index} className={styles.fileItem}>
                    <span className={styles.fileName}>
                      {index + 1}. {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <button
                      onClick={() => removeFile(index)}
                      className={styles.removeFileButton}
                      title={`删除 ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {isUploading && (
          <div className={styles.progress}>
            <div className={styles.progressHeader}>
              <div className={styles.progressInfo}>
                <span className={styles.progressPercentage}>{uploadProgress}%</span>
                <span className={styles.progressStatus}>
                  {uploadStatus === 'uploading' && '📤 上传中'}
                  {uploadStatus === 'parsing' && '📖 解析中'}
                  {uploadStatus === 'processing' && '⚙️ 处理中'}
                  {uploadStatus === 'completed' && '✅ 完成'}
                  {uploadStatus === 'error' && '❌ 错误'}
                </span>
              </div>
              {totalFiles > 0 && (
                <div className={styles.fileProgress}>
                  <span>文件进度: {currentFileIndex}/{totalFiles}</span>
                  {currentFileName && (
                    <span className={styles.currentFile}>当前: {currentFileName}</span>
                  )}
                </div>
              )}
            </div>
            
            <div className={styles.progressBar}>
              <div 
                className={`${styles.progressFill} ${styles[uploadStatus]}`}
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            
            <div className={styles.progressDetails}>
            <span className={styles.uploadStage}>{uploadStage}</span>
              {uploadStatus === 'completed' && (
                <div className={styles.completionInfo}>
                  <span>🎉 上传完成！</span>
                </div>
              )}
              {uploadStatus === 'error' && (
                <div className={styles.errorInfo}>
                  <span>⚠️ 上传过程中出现错误</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 章节设置 */}
      {chapters.length > 0 && (
        <div className={styles.section}>
          <h2>章节设置</h2>
          <div className={styles.chapterSettings}>
            {renderChapterRangeSetting('isLocked', '锁定章节（需要付费解锁）')}
            {renderChapterRangeSetting('isVipOnly', 'VIP专享')}
            {renderChapterRangeSetting('isAdvance', '抢先版')}
            {renderChapterRangeSetting('isVisible', '可见')}
            
            {/* 批量章节编号调整 */}
            <div className={styles.chapterRangeSetting}>
              <div className={styles.settingHeader}>
                <label>批量调整章节编号</label>
              </div>
              <div className={styles.rangeControls}>
                <div className={styles.rangeInputs}>
                  <span>起始章节号:</span>
                  <input
                    type="number"
                    value={startChapterNumber}
                    onChange={(e) => {
                      const newStart = parseInt(e.target.value) || 1;
                      setStartChapterNumber(newStart);
                      // 批量更新所有章节的编号
                      setChapters(prev => prev.map((chapter, index) => ({
                        ...chapter,
                        chapterNumber: newStart + index
                      })));
                    }}
                    min={1}
                  />
                  <button 
                    className={styles.batchUpdateBtn}
                    onClick={() => {
                      // 根据章节标题中的数字自动调整编号
                      setChapters(prev => prev.map((chapter, index) => {
                        const titleMatch = chapter.title.match(/第([一二三四五六七八九十百千万\d]+)[章节回]/);
                        if (titleMatch) {
                          const chineseNumber = titleMatch[1];
                          // 简单的数字转换（可以扩展支持更多中文数字）
                          let number = 0;
                          if (/^\d+$/.test(chineseNumber)) {
                            number = parseInt(chineseNumber);
                          } else {
                            // 扩展的中文数字映射表（支持到3000）
                            const chineseToNumber: { [key: string]: number } = {
                              // 基础数字
                              '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
                              '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
                              
                              // 十几
                              '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
                              '十六': 16, '十七': 17, '十八': 18, '十九': 19,
                              
                              // 几十
                              '二十': 20, '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25,
                              '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29,
                              '三十': 30, '三十一': 31, '三十二': 32, '三十三': 33, '三十四': 34, '三十五': 35,
                              '三十六': 36, '三十七': 37, '三十八': 38, '三十九': 39,
                              '四十': 40, '四十一': 41, '四十二': 42, '四十三': 43, '四十四': 44, '四十五': 45,
                              '四十六': 46, '四十七': 47, '四十八': 48, '四十九': 49,
                              '五十': 50, '五十一': 51, '五十二': 52, '五十三': 53, '五十四': 54, '五十五': 55,
                              '五十六': 56, '五十七': 57, '五十八': 58, '五十九': 59,
                              '六十': 60, '六十一': 61, '六十二': 62, '六十三': 63, '六十四': 64, '六十五': 65,
                              '六十六': 66, '六十七': 67, '六十八': 68, '六十九': 69,
                              '七十': 70, '七十一': 71, '七十二': 72, '七十三': 73, '七十四': 74, '七十五': 75,
                              '七十六': 76, '七十七': 77, '七十八': 78, '七十九': 79,
                              '八十': 80, '八十一': 81, '八十二': 82, '八十三': 83, '八十四': 84, '八十五': 85,
                              '八十六': 86, '八十七': 87, '八十八': 88, '八十九': 89,
                              '九十': 90, '九十一': 91, '九十二': 92, '九十三': 93, '九十四': 94, '九十五': 95,
                              '九十六': 96, '九十七': 97, '九十八': 98, '九十九': 99,
                              
                              // 一百多
                              '一百': 100, '一百零一': 101, '一百零二': 102, '一百零三': 103, '一百零四': 104, '一百零五': 105,
                              '一百零六': 106, '一百零七': 107, '一百零八': 108, '一百零九': 109,
                              '一百一十': 110, '一百一十一': 111, '一百一十二': 112, '一百一十三': 113, '一百一十四': 114, '一百一十五': 115,
                              '一百一十六': 116, '一百一十七': 117, '一百一十八': 118, '一百一十九': 119,
                              '一百二十': 120, '一百二十一': 121, '一百二十二': 122, '一百二十三': 123, '一百二十四': 124, '一百二十五': 125,
                              '一百二十六': 126, '一百二十七': 127, '一百二十八': 128, '一百二十九': 129,
                              '一百三十': 130, '一百三十一': 131, '一百三十二': 132, '一百三十三': 133, '一百三十四': 134, '一百三十五': 135,
                              '一百三十六': 136, '一百三十七': 137, '一百三十八': 138, '一百三十九': 139,
                              '一百四十': 140, '一百四十一': 141, '一百四十二': 142, '一百四十三': 143, '一百四十四': 144, '一百四十五': 145,
                              '一百四十六': 146, '一百四十七': 147, '一百四十八': 148, '一百四十九': 149,
                              '一百五十': 150, '一百五十一': 151, '一百五十二': 152, '一百五十三': 153, '一百五十四': 154, '一百五十五': 155,
                              '一百五十六': 156, '一百五十七': 157, '一百五十八': 158, '一百五十九': 159,
                              '一百六十': 160, '一百六十一': 161, '一百六十二': 162, '一百六十三': 163, '一百六十四': 164, '一百六十五': 165,
                              '一百六十六': 166, '一百六十七': 167, '一百六十八': 168, '一百六十九': 169,
                              '一百七十': 170, '一百七十一': 171, '一百七十二': 172, '一百七十三': 173, '一百七十四': 174, '一百七十五': 175,
                              '一百七十六': 176, '一百七十七': 177, '一百七十八': 178, '一百七十九': 179,
                              '一百八十': 180, '一百八十一': 181, '一百八十二': 182, '一百八十三': 183, '一百八十四': 184, '一百八十五': 185,
                              '一百八十六': 186, '一百八十七': 187, '一百八十八': 188, '一百八十九': 189,
                              '一百九十': 190, '一百九十一': 191, '一百九十二': 192, '一百九十三': 193, '一百九十四': 194, '一百九十五': 195,
                              '一百九十六': 196, '一百九十七': 197, '一百九十八': 198, '一百九十九': 199,
                              
                              // 二百多
                              '二百': 200, '二百零一': 201, '二百零二': 202, '二百零三': 203, '二百零四': 204, '二百零五': 205,
                              '二百零六': 206, '二百零七': 207, '二百零八': 208, '二百零九': 209,
                              '二百一十': 210, '二百一十一': 211, '二百一十二': 212, '二百一十三': 213, '二百一十四': 214, '二百一十五': 215,
                              '二百一十六': 216, '二百一十七': 217, '二百一十八': 218, '二百一十九': 219,
                              '二百二十': 220, '二百二十一': 221, '二百二十二': 222, '二百二十三': 223, '二百二十四': 224, '二百二十五': 225,
                              '二百二十六': 226, '二百二十七': 227, '二百二十八': 228, '二百二十九': 229,
                              '二百三十': 230, '二百三十一': 231, '二百三十二': 232, '二百三十三': 233, '二百三十四': 234, '二百三十五': 235,
                              '二百三十六': 236, '二百三十七': 237, '二百三十八': 238, '二百三十九': 239,
                              '二百四十': 240, '二百四十一': 241, '二百四十二': 242, '二百四十三': 243, '二百四十四': 244, '二百四十五': 245,
                              '二百四十六': 246, '二百四十七': 247, '二百四十八': 248, '二百四十九': 249,
                              '二百五十': 250, '二百五十一': 251, '二百五十二': 252, '二百五十三': 253, '二百五十四': 254, '二百五十五': 255,
                              '二百五十六': 256, '二百五十七': 257, '二百五十八': 258, '二百五十九': 259,
                              '二百六十': 260, '二百六十一': 261, '二百六十二': 262, '二百六十三': 263, '二百六十四': 264, '二百六十五': 265,
                              '二百六十六': 266, '二百六十七': 267, '二百六十八': 268, '二百六十九': 269,
                              '二百七十': 270, '二百七十一': 271, '二百七十二': 272, '二百七十三': 273, '二百七十四': 274, '二百七十五': 275,
                              '二百七十六': 276, '二百七十七': 277, '二百七十八': 278, '二百七十九': 279,
                              '二百八十': 280, '二百八十一': 281, '二百八十二': 282, '二百八十三': 283, '二百八十四': 284, '二百八十五': 285,
                              '二百八十六': 286, '二百八十七': 287, '二百八十八': 288, '二百八十九': 289,
                              '二百九十': 290, '二百九十一': 291, '二百九十二': 292, '二百九十三': 293, '二百九十四': 294, '二百九十五': 295,
                              '二百九十六': 296, '二百九十七': 297, '二百九十八': 298, '二百九十九': 299,
                              
                              // 三百多
                              '三百': 300, '三百零一': 301, '三百零二': 302, '三百零三': 303, '三百零四': 304, '三百零五': 305,
                              '三百零六': 306, '三百零七': 307, '三百零八': 308, '三百零九': 309,
                              '三百一十': 310, '三百一十一': 311, '三百一十二': 312, '三百一十三': 313, '三百一十四': 314, '三百一十五': 315,
                              '三百一十六': 316, '三百一十七': 317, '三百一十八': 318, '三百一十九': 319,
                              '三百二十': 320, '三百二十一': 321, '三百二十二': 322, '三百二十三': 323, '三百二十四': 324, '三百二十五': 325,
                              '三百二十六': 326, '三百二十七': 327, '三百二十八': 328, '三百二十九': 329,
                              '三百三十': 330, '三百三十一': 331, '三百三十二': 332, '三百三十三': 333, '三百三十四': 334, '三百三十五': 335,
                              '三百三十六': 336, '三百三十七': 337, '三百三十八': 338, '三百三十九': 339,
                              '三百四十': 340, '三百四十一': 341, '三百四十二': 342, '三百四十三': 343, '三百四十四': 344, '三百四十五': 345,
                              '三百四十六': 346, '三百四十七': 347, '三百四十八': 348, '三百四十九': 349,
                              '三百五十': 350, '三百五十一': 351, '三百五十二': 352, '三百五十三': 353, '三百五十四': 354, '三百五十五': 355,
                              '三百五十六': 356, '三百五十七': 357, '三百五十八': 358, '三百五十九': 359,
                              '三百六十': 360, '三百六十一': 361, '三百六十二': 362, '三百六十三': 363, '三百六十四': 364, '三百六十五': 365,
                              '三百六十六': 366, '三百六十七': 367, '三百六十八': 368, '三百六十九': 369,
                              '三百七十': 370, '三百七十一': 371, '三百七十二': 372, '三百七十三': 373, '三百七十四': 374, '三百七十五': 375,
                              '三百七十六': 376, '三百七十七': 377, '三百七十八': 378, '三百七十九': 379,
                              '三百八十': 380, '三百八十一': 381, '三百八十二': 382, '三百八十三': 383, '三百八十四': 384, '三百八十五': 385,
                              '三百八十六': 386, '三百八十七': 387, '三百八十八': 388, '三百八十九': 389,
                              '三百九十': 390, '三百九十一': 391, '三百九十二': 392, '三百九十三': 393, '三百九十四': 394, '三百九十五': 395,
                              '三百九十六': 396, '三百九十七': 397, '三百九十八': 398, '三百九十九': 399,
                              
                              // 四百多到九百多（简化，只列出一些关键数字）
                              '四百': 400, '四百一十': 410, '四百二十': 420, '四百三十': 430, '四百四十': 440, '四百五十': 450,
                              '四百六十': 460, '四百七十': 470, '四百八十': 480, '四百九十': 490,
                              '五百': 500, '五百一十': 510, '五百二十': 520, '五百三十': 530, '五百四十': 540, '五百五十': 550,
                              '五百六十': 560, '五百七十': 570, '五百八十': 580, '五百九十': 590,
                              '六百': 600, '六百一十': 610, '六百二十': 620, '六百三十': 630, '六百四十': 640, '六百五十': 650,
                              '六百六十': 660, '六百七十': 670, '六百八十': 680, '六百九十': 690,
                              '七百': 700, '七百一十': 710, '七百二十': 720, '七百三十': 730, '七百四十': 740, '七百五十': 750,
                              '七百六十': 760, '七百七十': 770, '七百八十': 780, '七百九十': 790,
                              '八百': 800, '八百一十': 810, '八百二十': 820, '八百三十': 830, '八百四十': 840, '八百五十': 850,
                              '八百六十': 860, '八百七十': 870, '八百八十': 880, '八百九十': 890,
                              '九百': 900, '九百一十': 910, '九百二十': 920, '九百三十': 930, '九百四十': 940, '九百五十': 950,
                              '九百六十': 960, '九百七十': 970, '九百八十': 980, '九百九十': 990,
                              
                              // 一千多
                              '一千': 1000, '一千零一': 1001, '一千零一十': 1010, '一千零一十一': 1011, '一千一百': 1100, '一千一百一十一': 1111,
                              
                              // 二千多
                              '二千': 2000, '二千零一': 2001, '二千零一十': 2010, '二千零一十一': 2011, '二千一百': 2100, '二千一百一十一': 2111,
                              
                              // 三千多
                              '三千': 3000, '三千零一': 3001, '三千零一十': 3010, '三千零一十一': 3011, '三千一百': 3100, '三千一百一十一': 3111
                            };
                            
                            number = chineseToNumber[chineseNumber] || (startChapterNumber + index);
                          }
                          return { ...chapter, chapterNumber: number };
                        }
                        return { ...chapter, chapterNumber: startChapterNumber + index };
                      }));
                    }}
                  >
                    根据标题自动调整
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 章节列表 */}
      {chapters.length > 0 && (
        <div className={styles.section}>
          <h2>章节列表 ({chapters.length} 章)</h2>
          
          {/* 章节排序选项 */}
          <div className={styles.chapterSortOptions}>
            <label>章节显示顺序：</label>
            <select
              value="chapterNumber"
              className={styles.sortSelect}
              disabled
            >
              <option value="chapterNumber">按章节号排序</option>
            </select>
            <button 
              onClick={() => {
                // 重新按章节号排序
                setChapters(prev => [...prev].sort((a, b) => {
                  const aNum = a.chapterNumber || 0;
                  const bNum = b.chapterNumber || 0;
                  return aNum - bNum;
                }));
              }}
              className={styles.reorderButton}
              title="重新按章节号排序"
            >
              🔄 重新排序
            </button>
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
          </div>
          
          <div className={styles.chaptersList}>
            {chapters.map((chapter, index) => {
              return (
                                <div key={chapter.id} className={styles.chapterItem}>
                {/* 第一行：章节标题和字数统计 */}
                <div className={styles.chapterTitleRow}>
                    <h3>
                      {(() => {
                        // 显示章节标题，如果标题已经包含章节号，则直接显示
                        const title = chapter.title;
                        const chapterNumber = chapter.chapterNumber || (startChapterNumber + index);
                        
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
                        } else {
                          // 如果标题已经包含章节号（如"第1回"、"第一章"等），直接显示
                          if (title.match(/^第?[一二三四五六七八九十百千万\d]+[章节回]/)) {
                            return title;
                          } else {
                            // 否则根据章节类型添加章节号
                            if (title.includes('回')) {
                              return `第${chapterNumber}回: ${title}`;
                            } else if (title.includes('节')) {
                              return `第${chapterNumber}节: ${title}`;
                            } else {
                              return `第${chapterNumber}章: ${title}`;
                            }
                          }
                        }
                      })()}
                    </h3>
                  <span className={styles.wordCount}>{chapter.wordCount} 字</span>
                </div>

                {/* 第二行：章节号和自动递增设置 */}
                <div className={styles.chapterNumberRow}>
                  <div className={styles.chapterNumberEdit}>
                    <label>章节号:</label>
                    <input
                      type="number"
                      value={chapter.chapterNumber || (startChapterNumber + index)}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value) || 1;
                        
                        // 如果当前章节启用自动递增，则批量更新后续章节
                        if (autoIncrementChapters.has(index)) {
                          setChapters(prev => prev.map((ch, i) => {
                            if (i < index) return ch;
                            if (i === index) return { ...ch, chapterNumber: newValue };
                            // 后续章节按递增规则更新
                            return { ...ch, chapterNumber: newValue + (i - index) };
                          }));
                        } else {
                          // 手动修改章节号时，停止该章节的自动递增状态
                          setAutoIncrementChapters(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(index);
                            return newSet;
                          });
                          updateChapter(index, 'chapterNumber', newValue);
                        }
                      }}
                      min={1}
                      className={styles.chapterNumberInput}
                    />
                    <label style={{ marginLeft: 8 }}>
                      <input
                        type="checkbox"
                        checked={autoIncrementChapters.has(index)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // 选中checkbox时，立即更新后续所有章节的编号
                            const currentChapterNumber = chapter.chapterNumber || (startChapterNumber + index);
                            
                            setChapters(prevChapters => prevChapters.map((ch, i) => {
                              if (i < index) return ch;
                              if (i === index) return { ...ch, chapterNumber: currentChapterNumber };
                              // 后续章节按递增规则更新
                              return { ...ch, chapterNumber: currentChapterNumber + (i - index) };
                            }));
                            
                            // 将当前章节和后续章节都标记为自动递增
                            setAutoIncrementChapters(prev => {
                              const newSet = new Set(prev);
                              for (let i = index; i < chapters.length; i++) {
                                newSet.add(i);
                              }
                              return newSet;
                            });
                          } else {
                            // 取消选中时，只移除当前章节的自动递增状态
                            setAutoIncrementChapters(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(index);
                              return newSet;
                            });
                          }
                        }}
                      />
                      后面章节依次递增
                    </label>
                  </div>
                  <div className={styles.volumeEdit}>
                    <label>位卷:</label>
                    <input
                      type="number"
                      value={chapter.volumeId || ''}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value) || undefined;
                        
                        // 如果当前章节启用自动复制volume_id，则批量更新后续章节
                        if (autoCopyVolumeId.has(index)) {
                          setChapters(prev => prev.map((ch, i) => {
                            if (i < index) return ch;
                            if (i === index) return { ...ch, volumeId: newValue };
                            // 后续章节复制相同的volume_id
                            return { ...ch, volumeId: newValue };
                          }));
                        } else {
                          // 手动修改volume_id时，停止该章节的自动复制状态
                          setAutoCopyVolumeId(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(index);
                            return newSet;
                          });
                          updateChapter(index, 'volumeId', newValue);
                        }
                      }}
                      min={1}
                      style={{ width: 60, marginLeft: 4, marginRight: 8 }}
                    />
                    <label style={{ marginLeft: 4 }}>
                      <input
                        type="checkbox"
                        checked={autoCopyVolumeId.has(index)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // 选中checkbox时，立即更新后续所有章节的volume_id
                            const currentVolumeId = chapter.volumeId;
                            
                            setChapters(prevChapters => prevChapters.map((ch, i) => {
                              if (i < index) return ch;
                              if (i === index) return { ...ch, volumeId: currentVolumeId };
                              // 后续章节复制相同的volume_id
                              return { ...ch, volumeId: currentVolumeId };
                            }));
                            
                            // 将当前章节和后续章节都标记为自动复制
                            setAutoCopyVolumeId(prev => {
                              const newSet = new Set(prev);
                              for (let i = index; i < chapters.length; i++) {
                                newSet.add(i);
                              }
                              return newSet;
                            });
                          } else {
                            // 取消选中时，只移除当前章节的自动复制状态
                            setAutoCopyVolumeId(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(index);
                              return newSet;
                            });
                          }
                        }}
                      />
                      后面章节位卷依次复制
                    </label>
                  </div>
                  {/* 删除按钮 */}
                  <button
                    className={styles.deleteButton}
                    onClick={() => {
                      // 确认删除
                      const chapterNumber = chapter.chapterNumber || (startChapterNumber + index);
                      const title = chapter.title;
                      let chapterType = '章';
                      if (title.includes('回')) chapterType = '回';
                      else if (title.includes('节')) chapterType = '节';
                      
                      if (window.confirm(`确定要删除"第${chapterNumber}${chapterType}: ${title}"吗？`)) {
                        // 删除章节
                        setChapters(prev => prev.filter((_, i) => i !== index));
                        
                        // 更新自动递增状态
                        setAutoIncrementChapters(prev => {
                          const newSet = new Set<number>();
                          prev.forEach(i => {
                            if (i < index) {
                              newSet.add(i);
                            } else if (i > index) {
                              newSet.add(i - 1);
                            }
                          });
                          return newSet;
                        });
                        
                        // 更新自动复制状态
                        setAutoCopyVolumeId(prev => {
                          const newSet = new Set<number>();
                          prev.forEach(i => {
                            if (i < index) {
                              newSet.add(i);
                            } else if (i > index) {
                              newSet.add(i - 1);
                            }
                          });
                          return newSet;
                        });
                      }
                    }}
                    title="删除此章节"
                  >
                    ×
                  </button>
                </div>

                {/* 第三行：章节设置选项 */}
                <div className={styles.chapterSettings}>
                  <div className={styles.settingItem}>
                    <label>
                      <input
                        type="checkbox"
                        checked={chapter.isLocked}
                        onChange={(e) => updateChapter(index, 'isLocked', e.target.checked)}
                      />
                      锁定
                    </label>
                  </div>
                  <div className={styles.settingItem}>
                    <label>
                      <input
                        type="checkbox"
                        checked={chapter.isVipOnly}
                        onChange={(e) => updateChapter(index, 'isVipOnly', e.target.checked)}
                      />
                      VIP专享
                    </label>
                  </div>
                  <div className={styles.settingItem}>
                    <label>
                      <input
                        type="checkbox"
                        checked={chapter.isAdvance}
                        onChange={(e) => updateChapter(index, 'isAdvance', e.target.checked)}
                      />
                      抢先版
                    </label>
                  </div>
                  <div className={styles.settingItem}>
                    <label>
                      <input
                        type="checkbox"
                        checked={chapter.isVisible}
                        onChange={(e) => updateChapter(index, 'isVisible', e.target.checked)}
                      />
                      可见
                    </label>
                  </div>
                  <div className={styles.settingItem}>
                    <label>解锁金币:</label>
                    <input
                      type="number"
                      value={chapter.unlockCost}
                      onChange={(e) => updateChapter(index, 'unlockCost', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                </div>

                {/* 第四行：章节内容 */}
                <div className={styles.chapterContent}>
                  <p>{chapter.content.substring(0, 200)}...</p>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* 提交按钮 */}
      {chapters.length > 0 && (
        <div className={styles.submitSection}>
          <button 
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={isUploading}
          >
            {isUploading ? '上传中...' : '提交上传'}
          </button>
        </div>
      )}
    </div>
  );
};

export default NovelUpload; 
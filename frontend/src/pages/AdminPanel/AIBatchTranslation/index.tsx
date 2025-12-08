import React, { useState, useEffect } from 'react';
import styles from './AIBatchTranslation.module.css';

interface ChapterTranslation {
  id: number;
  chapter_number: number;
  title: string;
  status: string;
  error_message?: string;
  chapter_id?: number;
}

interface TranslationTask {
  id: number;
  novel_id: number;
  source_language: string;
  target_language: string;
  status: string;
  total_chapters: number;
  completed_chapters: number;
  failed_chapters: number;
  error_message?: string;
  created_at: string;
}

interface ImportBatch {
  id: number;
  novel_id: number;
  created_by_admin_id: number;
  source_file_name: string | null;
  source_type: 'text' | 'file';
  status: 'draft' | 'confirmed' | 'translating' | 'completed' | 'failed';
  total_chapters: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ImportChapter {
  id: number;
  batch_id: number;
  novel_id: number;
  chapter_number: number;
  volume_id: number | null;
  raw_title: string;
  raw_content: string;
  clean_title: string | null;
  clean_content: string | null;
  en_title: string | null;
  en_content: string | null;
  word_count: number;
  unlock_price: number;
  key_cost: number;
  is_advance: number;
  unlock_priority: 'free' | 'key' | 'karma' | 'subscription';
  review_status: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected';
  is_released: number;
  release_date: string | null;
  status: 'draft' | 'ready_for_translation' | 'translating' | 'translated' | 'imported' | 'skipped' | 'duplicate_existing';
  chapter_id: number | null;
  created_at: string;
  updated_at: string;
}

interface AIBatchTranslationProps {
  onError?: (error: string) => void;
}

const AIBatchTranslation: React.FC<AIBatchTranslationProps> = ({ onError }) => {
  // 基础字段
  const [novelId, setNovelId] = useState<string>('');
  const [sourceText, setSourceText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [task, setTask] = useState<TranslationTask | null>(null);
  const [chapters, setChapters] = useState<ChapterTranslation[]>([]);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // 导入配置字段
  const [volumeMode, setVolumeMode] = useState<'fixed' | 'by_range'>('fixed');
  const [fixedVolumeId, setFixedVolumeId] = useState<string>('1');
  const [volumeRangeSize, setVolumeRangeSize] = useState<string>('100');
  const [freeChapterCount, setFreeChapterCount] = useState<string>('50');
  const [advanceStartChapter, setAdvanceStartChapter] = useState<string>('');
  const [releaseStartDate, setReleaseStartDate] = useState<string>('');
  const [releaseTimeOfDay, setReleaseTimeOfDay] = useState<string>('08:00');
  const [chaptersPerDay, setChaptersPerDay] = useState<string>('3');
  
  // 导入模式：文本模式 / 文件模式
  const [importMode, setImportMode] = useState<'text' | 'file'>('text');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  
  // 工作模式：直接翻译 / 预览导入（LangChain流程）
  const [workMode, setWorkMode] = useState<'direct' | 'preview'>('direct');
  
  // 预览模式相关状态
  const [importBatch, setImportBatch] = useState<ImportBatch | null>(null);
  const [chapterRows, setChapterRows] = useState<ImportChapter[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<number>>(new Set());
  
  // 编辑相关状态
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [changedChapterIds, setChangedChapterIds] = useState<Set<number>>(new Set());
  
  // 批量操作相关状态
  const [batchVolumeSize, setBatchVolumeSize] = useState<string>('100');
  const [batchStartNumber, setBatchStartNumber] = useState<string>('1');
  const [batchFreeCount, setBatchFreeCount] = useState<string>('100');
  const [batchChaptersPerDay, setBatchChaptersPerDay] = useState<string>('3');
  const [batchReleaseTime, setBatchReleaseTime] = useState<string>('08:00');
  
  // 初始化发布开始日期为今天
  useEffect(() => {
    if (!releaseStartDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setReleaseStartDate(`${year}-${month}-${day}`);
    }
  }, []);

  // API请求函数
  const adminApiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('adminToken');
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };
    
    if (!(options.body instanceof FormData) && !options.headers) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(`http://localhost:5000/api${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '请求失败' }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  };

  // 开始翻译任务
  const handleStartTranslation = async () => {
    // 前端校验
    if (!novelId || !novelId.trim()) {
      onError?.('请输入小说ID');
      return;
    }

    const novelIdNum = parseInt(novelId);
    if (isNaN(novelIdNum)) {
      onError?.('小说ID必须是数字');
      return;
    }

    if (importMode === 'text') {
      if (!sourceText || !sourceText.trim()) {
        onError?.('请输入源文本内容');
        return;
      }
    } else {
      if (!sourceFile) {
        onError?.('请选择要上传的文件');
        return;
      }
    }

    // 构造 importConfig 对象
    const importConfig: any = {
      volumeMode,
      freeChapterCount: parseInt(freeChapterCount) || 50,
      chaptersPerDay: parseInt(chaptersPerDay) || 3,
      releaseTimeOfDay: releaseTimeOfDay || '08:00:00',
    };

    if (volumeMode === 'fixed') {
      importConfig.fixedVolumeId = parseInt(fixedVolumeId) || 1;
    } else {
      importConfig.volumeRangeSize = parseInt(volumeRangeSize) || 100;
    }

    if (advanceStartChapter) {
      importConfig.advanceStartChapter = parseInt(advanceStartChapter);
    }

    if (releaseStartDate) {
      importConfig.releaseStartDate = `${releaseStartDate} ${releaseTimeOfDay || '08:00:00'}`;
    }

    setLoading(true);
    try {
      let response;

      if (importMode === 'text') {
        // 文本模式：使用原有接口，带上 importConfig
        response = await adminApiRequest('/admin/ai-translation/start-from-text', {
          method: 'POST',
          body: JSON.stringify({
            novelId: novelIdNum,
            sourceText: sourceText.trim(),
            importConfig,
          }),
        });
      } else {
        // 文件模式：使用 FormData 上传
        // 此时 sourceFile 已经通过前面的验证，不会是 null
        const formData = new FormData();
        formData.append('novelId', String(novelIdNum));
        formData.append('file', sourceFile!); // 使用非空断言，因为前面已经验证过
        formData.append('importConfig', JSON.stringify(importConfig));

        response = await adminApiRequest('/admin/ai-translation/upload-source-file', {
          method: 'POST',
          body: formData,
        });
      }

      if (response.success) {
        setTaskId(response.data.taskId);
        setTask(response.data.task);
        setChapters(response.data.chapters || []);
        
        // 显示成功提示
        if (importMode === 'text') {
          const totalChapters = response.data.totalChapters || 0;
          alert(`本次共解析并翻译了 ${totalChapters} 章，已按规则写入章节表。`);
        } else {
          alert('文件已上传并开始后台翻译，请稍后在章节列表中查看。');
        }
        
        // 开始轮询任务状态
        if (response.data.taskId) {
          startPolling(response.data.taskId);
        }
      } else {
        onError?.(response.message || '启动翻译任务失败');
      }
    } catch (error: any) {
      onError?.(error.message || '启动翻译任务失败');
    } finally {
      setLoading(false);
    }
  };

  // 轮询任务状态
  const startPolling = (id: number) => {
    // 清除之前的轮询
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // 立即查询一次
    fetchTaskStatus(id);

    // 每3秒轮询一次
    const interval = setInterval(() => {
      fetchTaskStatus(id);
    }, 3000);

    setPollingInterval(interval);
  };

  // 获取任务状态
  const fetchTaskStatus = async (id: number) => {
    try {
      const response = await adminApiRequest(`/admin/ai-translation/task/${id}`);
      
      if (response.success) {
        setTask(response.data.task);
        setChapters(response.data.chapters || []);

        // 如果任务完成或失败，停止轮询
        if (response.data.task.status === 'completed' || response.data.task.status === 'failed') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        }
      }
    } catch (error: any) {
      console.error('获取任务状态失败:', error);
    }
  };

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // 获取状态显示文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': '待处理',
      'translated': '翻译完成',
      'imported': '已导入',
      'failed': '失败',
      'running': '运行中',
      'completed': '已完成',
      'draft': '草稿',
      'ready_for_translation': '准备翻译',
      'translating': '翻译中',
      'duplicate_existing': '重复',
      'skipped': '已跳过',
    };
    return statusMap[status] || status;
  };

  // 获取状态样式类
  const getStatusClass = (status: string) => {
    const classMap: Record<string, string> = {
      'pending': styles.statusPending,
      'translated': styles.statusTranslated,
      'imported': styles.statusImported,
      'failed': styles.statusFailed,
      'running': styles.statusRunning,
      'completed': styles.statusCompleted,
      'draft': styles.statusPending,
      'ready_for_translation': styles.statusPending,
      'translating': styles.statusRunning,
      'duplicate_existing': styles.statusFailed,
      'skipped': styles.statusFailed,
    };
    return classMap[status] || '';
  };

  // 预览导入处理函数
  const handlePreviewImport = async () => {
    if (!novelId || !novelId.trim()) {
      onError?.('请输入小说ID');
      return;
    }

    const novelIdNum = parseInt(novelId);
    if (isNaN(novelIdNum)) {
      onError?.('小说ID必须是数字');
      return;
    }

    if (importMode === 'text' && !sourceText.trim()) {
      onError?.('请输入源文本');
      return;
    }

    if (importMode === 'file' && !sourceFile) {
      onError?.('请选择文件');
      return;
    }

    setLoading(true);
    try {
      let response;
      const importConfig = {
        novelId: novelIdNum,
        volumeMode,
        fixedVolumeId: volumeMode === 'fixed' ? parseInt(fixedVolumeId) : undefined,
        volumeRangeSize: volumeMode === 'by_range' ? parseInt(volumeRangeSize) : undefined,
        freeChapterCount: parseInt(freeChapterCount) || 50,
        advanceStartChapter: advanceStartChapter ? parseInt(advanceStartChapter) : undefined,
        releaseStartDate: releaseStartDate ? `${releaseStartDate} ${releaseTimeOfDay}:00` : undefined,
        chaptersPerDay: parseInt(chaptersPerDay) || 3,
        releaseTimeOfDay: releaseTimeOfDay || '08:00:00',
      };

      if (importMode === 'text') {
        response = await adminApiRequest('/admin/ai-translation/preview-import-from-text', {
          method: 'POST',
          body: JSON.stringify({
            novelId: novelIdNum,
            sourceText: sourceText.trim(),
            importConfig,
          }),
        });
      } else {
        const formData = new FormData();
        formData.append('novelId', String(novelIdNum));
        formData.append('file', sourceFile!);
        formData.append('importConfig', JSON.stringify(importConfig));

        response = await adminApiRequest('/admin/ai-translation/preview-import-from-file', {
          method: 'POST',
          body: formData,
        });
      }

      if (response.success) {
        setImportBatch(response.data.batch);
        setChapterRows(response.data.chapters || []);
        setChangedChapterIds(new Set()); // 重置变更记录
        // 默认选中所有非重复的章节
        const nonDuplicateIds = new Set<number>(
          (response.data.chapters || [])
            .filter((ch: ImportChapter) => ch.status !== 'duplicate_existing')
            .map((ch: ImportChapter) => ch.id)
        );
        setSelectedChapterIds(nonDuplicateIds);
        alert(`预览导入成功，共 ${response.data.chapters.length} 章`);
      } else {
        onError?.(response.message || '预览导入失败');
      }
    } catch (error: any) {
      onError?.(error.message || '预览导入失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新单个章节字段
  const updateChapterField = (chapterId: number, field: keyof ImportChapter, value: any) => {
    setChapterRows(prev => prev.map(ch => {
      if (ch.id === chapterId) {
        const updated = { ...ch, [field]: value };
        setChangedChapterIds(prev => new Set(prev).add(chapterId));
        return updated;
      }
      return ch;
    }));
  };

  // 批量更新章节字段
  const batchUpdateChapters = (updates: Partial<ImportChapter>, chapterIds?: number[]) => {
    const idsToUpdate = chapterIds || Array.from(selectedChapterIds);
    setChapterRows(prev => prev.map(ch => {
      if (idsToUpdate.includes(ch.id)) {
        const updated = { ...ch, ...updates };
        setChangedChapterIds(prev => new Set(prev).add(ch.id));
        return updated;
      }
      return ch;
    }));
  };

  // 批量自动分卷
  const handleBatchAutoVolume = () => {
    const volumeSize = parseInt(batchVolumeSize) || 100;
    const sortedChapters = [...chapterRows].sort((a, b) => a.chapter_number - b.chapter_number);
    
    sortedChapters.forEach((ch, index) => {
      const volumeId = Math.floor(index / volumeSize) + 1;
      updateChapterField(ch.id, 'volume_id', volumeId);
    });
    
    alert(`已按每 ${volumeSize} 章一卷自动分配卷号`);
  };

  // 批量重排章节号
  const handleBatchRenumber = () => {
    const startNumber = parseInt(batchStartNumber) || 1;
    const sortedChapters = [...chapterRows].sort((a, b) => a.chapter_number - b.chapter_number);
    
    sortedChapters.forEach((ch, index) => {
      updateChapterField(ch.id, 'chapter_number', startNumber + index);
    });
    
    alert(`已从 ${startNumber} 开始重新编号`);
  };

  // 批量生成发布计划
  const handleBatchReleasePlan = () => {
    const freeCount = parseInt(batchFreeCount) || 100;
    const perDay = parseInt(batchChaptersPerDay) || 3;
    const releaseTime = batchReleaseTime || '08:00';
    const sortedChapters = [...chapterRows].sort((a, b) => a.chapter_number - b.chapter_number);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    sortedChapters.forEach((ch) => {
      if (ch.chapter_number <= freeCount) {
        // 免费章节：立即发布
        updateChapterField(ch.id, 'is_released', 1);
        updateChapterField(ch.id, 'release_date', now.toISOString().slice(0, 19).replace('T', ' '));
      } else {
        // 收费章节：按计划发布
        const dayIndex = Math.floor((ch.chapter_number - freeCount - 1) / perDay);
        const releaseDate = new Date(today);
        releaseDate.setDate(releaseDate.getDate() + dayIndex + 1);
        
        const [hours, minutes] = releaseTime.split(':');
        releaseDate.setHours(parseInt(hours) || 8, parseInt(minutes) || 0, 0, 0);
        
        updateChapterField(ch.id, 'is_released', 0);
        updateChapterField(ch.id, 'release_date', releaseDate.toISOString().slice(0, 19).replace('T', ' '));
      }
    });
    
    alert(`已生成发布计划：前 ${freeCount} 章立即发布，之后每天发布 ${perDay} 章`);
  };

  // 保存修改
  const handleSaveChanges = async () => {
    if (!importBatch || changedChapterIds.size === 0) {
      alert('没有需要保存的修改');
      return;
    }

    setLoading(true);
    try {
      const updates = chapterRows
        .filter(ch => changedChapterIds.has(ch.id))
        .map(ch => ({
          id: ch.id,
          volume_id: ch.volume_id,
          chapter_number: ch.chapter_number,
          raw_title: ch.raw_title,
          raw_content: ch.raw_content,
          clean_title: ch.clean_title,
          clean_content: ch.clean_content,
          en_title: ch.en_title,
          en_content: ch.en_content,
          unlock_price: ch.unlock_price,
          key_cost: ch.key_cost,
          is_released: ch.is_released,
          release_date: ch.release_date,
          is_advance: ch.is_advance,
          unlock_priority: ch.unlock_priority,
        }));

      const response = await adminApiRequest(`/admin/ai-translation/import-batch/${importBatch.id}/update`, {
        method: 'POST',
        body: JSON.stringify({ updates }),
      });

      if (response.success) {
        setChapterRows(response.data.chapters || []);
        setChangedChapterIds(new Set());
        alert(`已保存 ${updates.length} 个章节的修改`);
      } else {
        onError?.(response.message || '保存失败');
      }
    } catch (error: any) {
      onError?.(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 确认并开始翻译
  const handleConfirmAndStartTranslation = async () => {
    if (!importBatch) {
      onError?.('请先预览导入');
      return;
    }

    setLoading(true);
    try {
      // 1. 如果有未保存的修改，先保存
      if (changedChapterIds.size > 0) {
        await handleSaveChanges();
      }

      // 2. 确认批次
      await adminApiRequest(`/admin/ai-translation/import-batch/${importBatch.id}/confirm`, {
        method: 'POST',
      });

      // 3. 开始翻译
      const response = await adminApiRequest(`/admin/ai-translation/import-batch/${importBatch.id}/start-translation`, {
        method: 'POST',
      });

      if (response.success) {
        setTaskId(response.data.taskId);
        setTask(response.data.task);
        setChapters(response.data.chapters || []);
        alert('翻译任务已启动，请稍后查看进度');
        
        // 开始轮询
        if (response.data.taskId) {
          startPolling(response.data.taskId);
        }
      } else {
        onError?.(response.message || '启动翻译任务失败');
      }
    } catch (error: any) {
      onError?.(error.message || '启动翻译任务失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开编辑弹窗
  const openEditDialog = (chapterId: number, field: string, content: string) => {
    setEditingChapterId(chapterId);
    setEditingField(field);
    setEditingContent(content || '');
  };

  // 关闭编辑弹窗并保存
  const closeEditDialog = (save: boolean = false) => {
    if (save && editingChapterId && editingField) {
      updateChapterField(editingChapterId, editingField as keyof ImportChapter, editingContent);
    }
    setEditingChapterId(null);
    setEditingField(null);
    setEditingContent('');
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>AI 批量翻译导入</h2>
      
      {/* 工作模式切换 */}
      <div className={styles.formGroup} style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>工作模式：</label>
        <div className={styles.radioGroup}>
          <label style={{ marginRight: 20 }}>
            <input
              type="radio"
              value="direct"
              checked={workMode === 'direct'}
              onChange={() => setWorkMode('direct')}
              disabled={loading || taskId !== null || importBatch !== null}
            />
            直接翻译（原有流程）
          </label>
          <label>
            <input
              type="radio"
              value="preview"
              checked={workMode === 'preview'}
              onChange={() => setWorkMode('preview')}
              disabled={loading || taskId !== null || importBatch !== null}
            />
            导入预览（LangChain流程，推荐）
          </label>
        </div>
      </div>

      <div className={styles.formSection}>
        {/* 导入参数配置区域 */}
        <div className={styles.configSection}>
          <h3 className={styles.configTitle}>导入参数配置</h3>
          
          <div className={styles.formGroup}>
            <label htmlFor="novelId">小说ID <span style={{ color: 'red' }}>*</span>：</label>
            <input
              id="novelId"
              type="number"
              value={novelId}
              onChange={(e) => setNovelId(e.target.value)}
              placeholder="请输入小说ID"
              disabled={loading || taskId !== null}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>卷模式：</label>
            <div className={styles.radioGroup}>
              <label style={{ marginRight: 20 }}>
                <input
                  type="radio"
                  value="fixed"
                  checked={volumeMode === 'fixed'}
                  onChange={(e) => setVolumeMode(e.target.value as 'fixed' | 'by_range')}
                  disabled={loading || taskId !== null}
                />
                固定卷
              </label>
              <label>
                <input
                  type="radio"
                  value="by_range"
                  checked={volumeMode === 'by_range'}
                  onChange={(e) => setVolumeMode(e.target.value as 'fixed' | 'by_range')}
                  disabled={loading || taskId !== null}
                />
                按章节区间分卷（暂未启用）
              </label>
            </div>
          </div>

          {volumeMode === 'fixed' && (
            <div className={styles.formGroup}>
              <label htmlFor="fixedVolumeId">固定卷ID：</label>
              <input
                id="fixedVolumeId"
                type="number"
                value={fixedVolumeId}
                onChange={(e) => setFixedVolumeId(e.target.value)}
                placeholder="1"
                disabled={loading || taskId !== null}
                className={styles.input}
                style={{ width: '200px' }}
              />
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="freeChapterCount">免费章节数：</label>
            <input
              id="freeChapterCount"
              type="number"
              value={freeChapterCount}
              onChange={(e) => setFreeChapterCount(e.target.value)}
              placeholder="50"
              disabled={loading || taskId !== null}
              className={styles.input}
              style={{ width: '200px' }}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="advanceStartChapter">预读起始章节（留空则使用免费章节数+1）：</label>
            <input
              id="advanceStartChapter"
              type="number"
              value={advanceStartChapter}
              onChange={(e) => setAdvanceStartChapter(e.target.value)}
              placeholder="留空自动计算"
              disabled={loading || taskId !== null}
              className={styles.input}
              style={{ width: '200px' }}
            />
          </div>

          <div className={styles.formGroup}>
            <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>每日发布节奏：</label>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '200px' }}>
                <label htmlFor="releaseStartDate">发布开始日期：</label>
                <input
                  id="releaseStartDate"
                  type="date"
                  value={releaseStartDate}
                  onChange={(e) => setReleaseStartDate(e.target.value)}
                  disabled={loading || taskId !== null}
                  className={styles.input}
                />
              </div>
              <div style={{ flex: '1', minWidth: '150px' }}>
                <label htmlFor="releaseTimeOfDay">每日发布时间：</label>
                <input
                  id="releaseTimeOfDay"
                  type="time"
                  value={releaseTimeOfDay}
                  onChange={(e) => setReleaseTimeOfDay(e.target.value)}
                  disabled={loading || taskId !== null}
                  className={styles.input}
                />
              </div>
              <div style={{ flex: '1', minWidth: '150px' }}>
                <label htmlFor="chaptersPerDay">每天发布章节数：</label>
                <input
                  id="chaptersPerDay"
                  type="number"
                  value={chaptersPerDay}
                  onChange={(e) => setChaptersPerDay(e.target.value)}
                  placeholder="3"
                  disabled={loading || taskId !== null}
                  className={styles.input}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 导入模式切换 */}
        <div className={styles.formGroup} style={{ marginTop: '30px', marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>导入方式：</label>
          <div className={styles.radioGroup}>
            <label style={{ marginRight: 20 }}>
              <input
                type="radio"
                value="text"
                checked={importMode === 'text'}
                onChange={() => setImportMode('text')}
                disabled={loading || taskId !== null}
              />
              粘贴文本导入
            </label>
            <label>
              <input
                type="radio"
                value="file"
                checked={importMode === 'file'}
                onChange={() => setImportMode('file')}
                disabled={loading || taskId !== null}
              />
              上传整本小说文件导入
            </label>
          </div>
        </div>

        {/* 源文本内容区域 */}
        {importMode === 'text' ? (
          <div className={styles.formGroup}>
            <label htmlFor="sourceText">源文本内容：</label>
            <textarea
              id="sourceText"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="请粘贴中文小说文本内容（支持包含「第X章」等章节标识）"
              disabled={loading || taskId !== null}
              className={styles.textarea}
              rows={15}
            />
          </div>
        ) : (
          <div className={styles.formGroup}>
            <label htmlFor="sourceFile">上传整本小说文件：</label>
            <input
              id="sourceFile"
              type="file"
              accept=".txt,.md,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSourceFile(file);
              }}
              disabled={loading || taskId !== null}
              className={styles.input}
            />
            <p style={{ color: '#999', marginTop: 8, fontSize: '14px' }}>
              请选择整本小说的文本文件（推荐 .txt，包含「第X章」等章节标识）
            </p>
          </div>
        )}

        <div className={styles.buttonGroup}>
          {workMode === 'direct' ? (
            <button
              onClick={handleStartTranslation}
              disabled={
                loading || 
                taskId !== null || 
                !novelId || 
                (importMode === 'text' ? !sourceText : !sourceFile)
              }
              className={styles.startButton}
            >
              {loading ? '处理中...' : '开始解析并翻译'}
            </button>
          ) : (
            <>
              <button
                onClick={handlePreviewImport}
                disabled={
                  loading || 
                  importBatch !== null || 
                  !novelId || 
                  (importMode === 'text' ? !sourceText : !sourceFile)
                }
                className={styles.startButton}
              >
                {loading ? '处理中...' : '预览导入'}
              </button>
              {importBatch && (
                <>
                  <button
                    onClick={handleSaveChanges}
                    disabled={loading || changedChapterIds.size === 0}
                    className={styles.startButton}
                    style={{ marginLeft: '10px', backgroundColor: '#28a745' }}
                  >
                    {loading ? '保存中...' : `保存修改（${changedChapterIds.size} 个章节）`}
                  </button>
                  <button
                    onClick={handleConfirmAndStartTranslation}
                    disabled={loading || selectedChapterIds.size === 0}
                    className={styles.startButton}
                    style={{ marginLeft: '10px' }}
                  >
                    {loading ? '启动中...' : `开始翻译（已选 ${selectedChapterIds.size} 章）`}
                  </button>
                </>
              )}
            </>
          )}
          {(taskId || importBatch) && (
            <button
              onClick={() => {
                setTaskId(null);
                setTask(null);
                setChapters([]);
                setNovelId('');
                setSourceText('');
                setSourceFile(null);
                setImportBatch(null);
                setChapterRows([]);
                setSelectedChapterIds(new Set());
                setChangedChapterIds(new Set());
                setEditingChapterId(null);
                setEditingField(null);
                setEditingContent('');
                if (pollingInterval) {
                  clearInterval(pollingInterval);
                  setPollingInterval(null);
                }
              }}
              className={styles.resetButton}
            >
              重置
            </button>
          )}
        </div>
      </div>

      {/* 预览章节列表 - 完整可编辑版本 */}
      {workMode === 'preview' && importBatch && chapterRows.length > 0 && (
        <div className={styles.taskSection}>
          <h3>导入预览（共 {chapterRows.length} 章）</h3>
          
          {/* 批量操作工具条 */}
          <div className={styles.batchToolbar}>
            <div className={styles.toolbarSection}>
              <h4>批量操作</h4>
              <div className={styles.toolbarRow}>
                <div className={styles.toolbarItem}>
                  <label>每卷章节数：</label>
                  <input
                    type="number"
                    value={batchVolumeSize}
                    onChange={(e) => setBatchVolumeSize(e.target.value)}
                    style={{ width: '80px', marginRight: '10px' }}
                    className={styles.input}
                  />
                  <button
                    onClick={handleBatchAutoVolume}
                    className={styles.toolbarButton}
                    disabled={loading}
                  >
                    按章节号自动分卷
                  </button>
                </div>
                
                <div className={styles.toolbarItem}>
                  <label>起始章节号：</label>
                  <input
                    type="number"
                    value={batchStartNumber}
                    onChange={(e) => setBatchStartNumber(e.target.value)}
                    style={{ width: '80px', marginRight: '10px' }}
                    className={styles.input}
                  />
                  <button
                    onClick={handleBatchRenumber}
                    className={styles.toolbarButton}
                    disabled={loading}
                  >
                    重新编号
                  </button>
                </div>
              </div>
              
              <div className={styles.toolbarRow}>
                <div className={styles.toolbarItem}>
                  <label>免费章节数：</label>
                  <input
                    type="number"
                    value={batchFreeCount}
                    onChange={(e) => setBatchFreeCount(e.target.value)}
                    style={{ width: '80px', marginRight: '10px' }}
                    className={styles.input}
                  />
                  <label style={{ marginRight: '10px' }}>每天发布：</label>
                  <input
                    type="number"
                    value={batchChaptersPerDay}
                    onChange={(e) => setBatchChaptersPerDay(e.target.value)}
                    style={{ width: '60px', marginRight: '10px' }}
                    className={styles.input}
                  />
                  <label style={{ marginRight: '10px' }}>发布时间：</label>
                  <input
                    type="time"
                    value={batchReleaseTime}
                    onChange={(e) => setBatchReleaseTime(e.target.value)}
                    style={{ width: '100px', marginRight: '10px' }}
                    className={styles.input}
                  />
                  <button
                    onClick={handleBatchReleasePlan}
                    className={styles.toolbarButton}
                    disabled={loading}
                  >
                    生成发布计划
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 章节列表表格 */}
          <div className={styles.chaptersSection}>
            <div className={styles.chaptersTable} style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedChapterIds.size === chapterRows.filter(ch => ch.status !== 'duplicate_existing').length && chapterRows.filter(ch => ch.status !== 'duplicate_existing').length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const nonDuplicateIds = new Set<number>(
                              chapterRows
                                .filter(ch => ch.status !== 'duplicate_existing')
                                .map(ch => ch.id)
                            );
                            setSelectedChapterIds(nonDuplicateIds);
                          } else {
                            setSelectedChapterIds(new Set<number>());
                          }
                        }}
                      />
                    </th>
                    <th style={{ width: '80px' }}>章节号</th>
                    <th style={{ width: '80px' }}>卷ID</th>
                    <th style={{ width: '200px' }}>中文标题</th>
                    <th style={{ width: '150px' }}>中文正文</th>
                    <th style={{ width: '200px' }}>英文标题</th>
                    <th style={{ width: '150px' }}>英文正文</th>
                    <th style={{ width: '80px' }}>字数</th>
                    <th style={{ width: '100px' }}>解锁价格</th>
                    <th style={{ width: '80px' }}>钥匙</th>
                    <th style={{ width: '100px' }}>发布日期</th>
                    <th style={{ width: '80px' }}>已发布</th>
                    <th style={{ width: '100px' }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {chapterRows.map((chapter) => (
                    <tr 
                      key={chapter.id}
                      style={{ 
                        backgroundColor: chapter.status === 'duplicate_existing' ? '#fff3cd' : (changedChapterIds.has(chapter.id) ? '#e7f3ff' : 'transparent')
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedChapterIds.has(chapter.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedChapterIds);
                            if (e.target.checked) {
                              newSet.add(chapter.id);
                            } else {
                              newSet.delete(chapter.id);
                            }
                            setSelectedChapterIds(newSet);
                          }}
                          disabled={chapter.status === 'duplicate_existing'}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={chapter.chapter_number}
                          onChange={(e) => updateChapterField(chapter.id, 'chapter_number', parseInt(e.target.value) || 0)}
                          style={{ width: '60px' }}
                          className={styles.input}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={chapter.volume_id || ''}
                          onChange={(e) => updateChapterField(chapter.id, 'volume_id', e.target.value ? parseInt(e.target.value) : null)}
                          style={{ width: '60px' }}
                          className={styles.input}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={chapter.clean_title || chapter.raw_title || ''}
                          onChange={(e) => updateChapterField(chapter.id, 'clean_title', e.target.value)}
                          style={{ width: '100%' }}
                          className={styles.input}
                          placeholder="中文标题"
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => openEditDialog(chapter.id, 'clean_content', chapter.clean_content || chapter.raw_content || '')}
                          className={styles.editButton}
                        >
                          查看/编辑 ({((chapter.clean_content || chapter.raw_content || '').length)} 字)
                        </button>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={chapter.en_title || ''}
                          onChange={(e) => updateChapterField(chapter.id, 'en_title', e.target.value)}
                          style={{ width: '100%' }}
                          className={styles.input}
                          placeholder="英文标题"
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => openEditDialog(chapter.id, 'en_content', chapter.en_content || '')}
                          className={styles.editButton}
                        >
                          查看/编辑 ({((chapter.en_content || '').length)} 字)
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>{chapter.word_count || 0}</td>
                      <td>
                        <input
                          type="number"
                          value={chapter.unlock_price}
                          onChange={(e) => updateChapterField(chapter.id, 'unlock_price', parseInt(e.target.value) || 0)}
                          style={{ width: '80px' }}
                          className={styles.input}
                        />
                        <small style={{ display: 'block', color: '#666', fontSize: '10px' }}>系统自动生成</small>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={chapter.key_cost}
                          onChange={(e) => updateChapterField(chapter.id, 'key_cost', parseInt(e.target.value) || 0)}
                          style={{ width: '60px' }}
                          className={styles.input}
                          min="0"
                          max="1"
                        />
                      </td>
                      <td>
                        <input
                          type="datetime-local"
                          value={chapter.release_date ? chapter.release_date.slice(0, 16) : ''}
                          onChange={(e) => updateChapterField(chapter.id, 'release_date', e.target.value ? e.target.value.replace('T', ' ') + ':00' : null)}
                          className={styles.input}
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={chapter.is_released === 1}
                          onChange={(e) => updateChapterField(chapter.id, 'is_released', e.target.checked ? 1 : 0)}
                        />
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(chapter.status)}`}>
                          {chapter.status === 'duplicate_existing' ? '重复' : getStatusText(chapter.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingChapterId && editingField && (
        <div className={styles.modalOverlay} onClick={() => closeEditDialog(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>编辑 {editingField === 'clean_content' ? '中文正文' : editingField === 'en_content' ? '英文正文' : editingField}</h3>
              <button className={styles.modalClose} onClick={() => closeEditDialog(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className={styles.modalTextarea}
                rows={20}
                placeholder="请输入内容..."
              />
            </div>
            <div className={styles.modalFooter}>
              <button
                onClick={() => closeEditDialog(false)}
                className={styles.modalButton}
                style={{ backgroundColor: '#6c757d' }}
              >
                取消
              </button>
              <button
                onClick={() => closeEditDialog(true)}
                className={styles.modalButton}
                style={{ backgroundColor: '#007bff' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {task && (
        <div className={styles.taskSection}>
          <h3>任务进度</h3>
          <div className={styles.taskInfo}>
            <div className={styles.taskItem}>
              <span className={styles.taskLabel}>任务ID：</span>
              <span>{task.id}</span>
            </div>
            <div className={styles.taskItem}>
              <span className={styles.taskLabel}>状态：</span>
              <span className={`${styles.statusBadge} ${getStatusClass(task.status)}`}>
                {getStatusText(task.status)}
              </span>
            </div>
            <div className={styles.taskItem}>
              <span className={styles.taskLabel}>总章节数：</span>
              <span>{task.total_chapters}</span>
            </div>
            <div className={styles.taskItem}>
              <span className={styles.taskLabel}>已完成：</span>
              <span>{task.completed_chapters}</span>
            </div>
            <div className={styles.taskItem}>
              <span className={styles.taskLabel}>失败：</span>
              <span>{task.failed_chapters}</span>
            </div>
            {task.error_message && (
              <div className={styles.taskItem}>
                <span className={styles.taskLabel}>错误信息：</span>
                <span className={styles.errorText}>{task.error_message}</span>
              </div>
            )}
          </div>

          {chapters.length > 0 && (
            <div className={styles.chaptersSection}>
              <h4>章节列表</h4>
              <div className={styles.chaptersTable}>
                <table>
                  <thead>
                    <tr>
                      <th>章节号</th>
                      <th>标题</th>
                      <th>状态</th>
                      <th>章节ID</th>
                      <th>错误信息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chapters.map((chapter) => (
                      <tr key={chapter.id}>
                        <td>{chapter.chapter_number}</td>
                        <td>{chapter.title || '-'}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${getStatusClass(chapter.status)}`}>
                            {getStatusText(chapter.status)}
                          </span>
                        </td>
                        <td>{chapter.chapter_id || '-'}</td>
                        <td className={styles.errorCell}>
                          {chapter.error_message || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIBatchTranslation;


import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import ApiService from '../../services/ApiService';
import { getPublishStatus, getReviewStatusLabel, filterChapterByStatus, Chapter } from '../../utils/chapterStatusUtils';
import Toast from '../../components/Toast/Toast';
import styles from './ChapterManageTab.module.css';

interface Volume {
  id: number;
  novel_id: number;
  volume_id: number;
  title: string;
}

interface ChapterData extends Chapter {
  id: number;
  chapter_number: number;
  title: string;
  word_count: number | null;
  created_at: string;
  unlock_price?: number;
  volume_id?: number | null;
}

interface ChapterManageTabProps {
  novelId: number;
  novelTitle?: string;
}

const ChapterManageTab: React.FC<ChapterManageTabProps> = ({ novelId, novelTitle }) => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'scheduled' | 'unreleased' | 'submitted' | 'reviewing' | 'approved' | 'rejected'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [volumeFilter, setVolumeFilter] = useState<number | 'all' | 'none'>('all');
  
  // 卷轴管理相关状态
  const [newVolumeModalVisible, setNewVolumeModalVisible] = useState(false);
  const [volumeFormMode, setVolumeFormMode] = useState<'create' | 'edit'>('create');
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null);
  const [creatingForChapterId, setCreatingForChapterId] = useState<number | null>(null);
  const [volumeFormData, setVolumeFormData] = useState({ volume_id: 1, title: '' });
  
  // 批量操作相关状态
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [batchVolumeModalVisible, setBatchVolumeModalVisible] = useState(false);
  const [batchRangeModalVisible, setBatchRangeModalVisible] = useState(false);
  const [batchSelectionVolumeId, setBatchSelectionVolumeId] = useState<number | null>(null);
  const [batchRangeData, setBatchRangeData] = useState({ startChapter: 1, endChapter: 1, volumeId: null as number | null });
  
  // Toast状态
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  
  // 显示Toast的辅助函数
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (novelId) {
      fetchVolumes();
    }
  }, [novelId]);

  useEffect(() => {
    loadChapters();
  }, [novelId, sortOrder, statusFilter, searchKeyword, volumeFilter]);
  
  // 更新loadChapters函数以支持"无卷"筛选
  const loadChapters = async () => {
    setLoading(true);
    setError(null);
    try {
      // 构建查询参数 - 后端默认排除 draft，这里不需要传 review_status
      const params = new URLSearchParams();
      params.append('sort', sortOrder);
      if (volumeFilter !== 'all') {
        if (volumeFilter === 'none') {
          // 前端筛选无卷章节
        } else {
          params.append('volumeId', volumeFilter.toString());
        }
      }
      
      const queryString = params.toString();
      const url = `/chapters/novel/${novelId}${queryString ? '?' + queryString : ''}`;
      const response = await ApiService.get(url);
      
      let chaptersList: ChapterData[] = [];
      if (Array.isArray(response)) {
        chaptersList = response;
      } else if (response && typeof response === 'object' && response.data) {
        chaptersList = Array.isArray(response.data) ? response.data : [];
      }

      // 前端筛选：根据状态筛选器过滤
      if (statusFilter !== 'all') {
        chaptersList = chaptersList.filter(ch => filterChapterByStatus(ch, statusFilter));
      }
      
      // 前端筛选：根据卷筛选器过滤
      if (volumeFilter === 'none') {
        chaptersList = chaptersList.filter(ch => !ch.volume_id);
      }

      // 过滤搜索关键词
      if (searchKeyword.trim()) {
        chaptersList = chaptersList.filter(ch => 
          ch.title.toLowerCase().includes(searchKeyword.toLowerCase())
        );
      }

      setChapters(chaptersList);
    } catch (error) {
      console.error('加载章节列表失败:', error);
      setError(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchVolumes = async () => {
    try {
      const response = await ApiService.get(`/novel/${novelId}/volumes`);
      let volumesList: Volume[] = [];
      if (response.success && response.data) {
        if (Array.isArray(response.data.volumes)) {
          volumesList = response.data.volumes;
        } else if (Array.isArray(response.data)) {
          volumesList = response.data;
        }
      } else if (Array.isArray(response)) {
        volumesList = response;
      } else if (response && typeof response === 'object' && response.data) {
        volumesList = Array.isArray(response.data) ? response.data : [];
      }
      // 按volume_id排序
      volumesList.sort((a, b) => a.volume_id - b.volume_id);
      setVolumes(volumesList);
    } catch (error) {
      console.error('加载卷轴信息失败:', error);
    }
  };
  
  // 获取卷标签显示文本
  const getVolumeLabel = (v: Volume) => {
    const name = v.title?.trim() || '';
    if (language === 'zh') {
      return name ? `第${v.volume_id}卷 ${name}` : `第${v.volume_id}卷`;
    } else {
      return name ? `Volume ${v.volume_id} ${name}` : `Volume ${v.volume_id}`;
    }
  };
  
  // 处理卷下拉选择变化
  const handleVolumeChange = (chapterId: number, value: string, currentVolumeId: number | null | undefined) => {
    if (value === "__new") {
      setVolumeFormMode("create");
      setCreatingForChapterId(chapterId);
      // 计算默认卷序号
      const maxVolumeId = volumes.length > 0 ? Math.max(...volumes.map(v => v.volume_id)) : 0;
      setVolumeFormData({ volume_id: maxVolumeId + 1, title: '' });
      setNewVolumeModalVisible(true);
      return;
    }
    
    if (value === "__edit") {
      const v = volumes.find(v => v.id === currentVolumeId);
      if (v) {
        setVolumeFormMode("edit");
        setEditingVolume(v);
        setCreatingForChapterId(null);
        setVolumeFormData({ volume_id: v.volume_id, title: v.title });
        setNewVolumeModalVisible(true);
      }
      return;
    }
    
    // 更新章节的卷轴
    const volumeId = value === '' || value === 'null' ? null : parseInt(value);
    updateChapterVolume(chapterId, volumeId);
  };
  
  // 卷弹窗提交逻辑
  const handleVolumeFormSubmit = async () => {
    if (!volumeFormData.title.trim()) {
      showToast(language === 'zh' ? '请输入卷名' : 'Please enter volume title', 'warning');
      return;
    }
    
    try {
      if (volumeFormMode === 'create') {
        const response = await ApiService.post(`/author/novels/${novelId}/volumes`, {
          volume_id: volumeFormData.volume_id,
          title: volumeFormData.title.trim()
        });
        
        if (response.success && response.data) {
          const newVolume = response.data;
          setVolumes([...volumes, newVolume].sort((a, b) => a.volume_id - b.volume_id));
          
          // 如果是从章节行触发的新建卷，自动将该章节设置为新卷
          if (creatingForChapterId) {
            updateChapterVolume(creatingForChapterId, newVolume.id);
          }
          
          showToast(language === 'zh' ? '卷轴创建成功' : 'Volume created successfully', 'success');
          resetVolumeModal();
        } else {
          throw new Error(response.message || '创建失败');
        }
      } else {
        if (!editingVolume) return;
        
        const response = await ApiService.put(`/author/novels/${novelId}/volumes/${editingVolume.id}`, {
          volume_id: volumeFormData.volume_id,
          title: volumeFormData.title.trim()
        });
        
        if (response.success && response.data) {
          const updated = response.data;
          setVolumes(volumes.map(v => v.id === updated.id ? updated : v).sort((a, b) => a.volume_id - b.volume_id));
          showToast(language === 'zh' ? '卷轴更新成功' : 'Volume updated successfully', 'success');
          resetVolumeModal();
        } else {
          throw new Error(response.message || '更新失败');
        }
      }
    } catch (error) {
      console.error('卷轴操作失败:', error);
      showToast(
        language === 'zh' 
          ? `操作失败: ${error instanceof Error ? error.message : '未知错误'}` 
          : `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  };
  
  // 重置卷弹窗
  const resetVolumeModal = () => {
    setNewVolumeModalVisible(false);
    setVolumeFormMode('create');
    setEditingVolume(null);
    setCreatingForChapterId(null);
    setVolumeFormData({ volume_id: 1, title: '' });
  };


  const handleSearch = () => {
    loadChapters();
  };

  const formatWordCount = (count: number | null) => {
    if (!count) return '0';
    return count.toLocaleString();
  };

  const getStatusClass = (status: string) => {
    return styles[`status_${status}`] || styles.statusDefault;
  };

  const getPublishStatusText = (chapter: ChapterData) => {
    const status = getPublishStatus(chapter);
    if (language === 'zh') {
      return status;
    }
    // English translations
    const statusMap: { [key: string]: string } = {
      '已发布': 'Published',
      '定时发布': 'Scheduled',
      '未发布': 'Unreleased',
      '草稿': 'Draft'
    };
    return statusMap[status] || status;
  };

  const getPublishStatusClass = (chapter: ChapterData) => {
    const status = getPublishStatus(chapter);
    // 根据状态返回对应的 CSS 类名
    if (status === '已发布' || status === 'Published') {
      return styles.publishStatusPublished;
    } else if (status === '定时发布' || status === 'Scheduled') {
      return styles.publishStatusScheduled;
    } else if (status === '未发布' || status === 'Unreleased') {
      return styles.publishStatusUnreleased;
    } else if (status === '草稿' || status === 'Draft') {
      return styles.publishStatusDraft;
    }
    return styles.publishStatusDefault;
  };

  const getReviewStatusText = (chapter: ChapterData) => {
    const label = getReviewStatusLabel(chapter);
    if (language === 'zh') {
      return label;
    }
    // English translations
    const labelMap: { [key: string]: string } = {
      '待审核': 'Pending',
      '审核中': 'Reviewing',
      '审核通过': 'Approved',
      '审核不通过': 'Rejected',
      '草稿': 'Draft'
    };
    return labelMap[label] || label;
  };

  // 根据日期（月日）生成颜色
  const getDateColor = (dateString: string | null): string => {
    if (!dateString) return '#8c8c8c'; // 默认灰色
    
    try {
      const date = new Date(dateString);
      const month = date.getMonth() + 1; // 0-11 -> 1-12
      const day = date.getDate();
      
      // 使用月日生成一个稳定的颜色
      // 使用哈希算法生成颜色，确保同一天总是相同颜色
      const hash = (month * 31 + day) % 360; // 0-359 (HSL hue)
      const saturation = 65 + (hash % 20); // 65-85%
      const lightness = 45 + (hash % 15); // 45-60%
      
      return `hsl(${hash}, ${saturation}%, ${lightness}%)`;
    } catch {
      return '#8c8c8c';
    }
  };

  // 根据日期（月日）生成背景颜色（更浅）
  const getDateBackgroundColor = (dateString: string | null): string => {
    if (!dateString) return 'rgba(140, 140, 140, 0.1)';
    
    try {
      const date = new Date(dateString);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      
      const hash = (month * 31 + day) % 360;
      const saturation = 40 + (hash % 15); // 40-55%
      const lightness = 92 + (hash % 5); // 92-97%
      
      return `hsla(${hash}, ${saturation}%, ${lightness}%, 0.15)`;
    } catch {
      return 'rgba(140, 140, 140, 0.1)';
    }
  };

  const updateChapterVolume = async (chapterId: number, volumeId: number | null) => {
    try {
      const response = await ApiService.request(`/chapter/${chapterId}/volume`, {
        method: 'PATCH',
        body: JSON.stringify({ volume_id: volumeId }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.success) {
        // 更新本地状态
        setChapters(prev =>
          prev.map(ch =>
            ch.id === chapterId ? { ...ch, volume_id: volumeId } : ch
          )
        );
      } else {
        throw new Error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新卷轴失败:', error);
      showToast(
        language === 'zh' 
          ? `更新失败: ${error instanceof Error ? error.message : '未知错误'}` 
          : `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  };
  
  // 批量设置卷轴（按勾选）
  const handleBatchUpdateBySelection = async (volumeId: number | null) => {
    if (selectedChapters.length === 0) {
      showToast(language === 'zh' ? '请先选择章节' : 'Please select chapters first', 'warning');
      return;
    }
    
    const selectedCount = selectedChapters.length; // 保存数量，因为后面会清空
    
    try {
      const response = await ApiService.post('/author/chapters/batch/update-volume', {
        chapter_ids: selectedChapters,
        volume_id: volumeId
      });
      
      if (response.success) {
        // 更新本地状态
        setChapters(prev =>
          prev.map(ch =>
            selectedChapters.includes(ch.id) ? { ...ch, volume_id: volumeId } : ch
          )
        );
        setSelectedChapters([]);
        setBatchSelectionVolumeId(null);
        setBatchVolumeModalVisible(false);
        showToast(
          language === 'zh' 
            ? `已成功为 ${selectedCount} 个章节设置卷轴` 
            : `Successfully set volume for ${selectedCount} chapters`,
          'success'
        );
      } else {
        throw new Error(response.message || '批量更新失败');
      }
    } catch (error) {
      console.error('批量更新失败:', error);
      showToast(
        language === 'zh' 
          ? `批量更新失败: ${error instanceof Error ? error.message : '未知错误'}` 
          : `Batch update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  };
  
  // 批量设置卷轴（按章节号范围）
  const handleBatchUpdateByRange = async () => {
    if (batchRangeData.startChapter > batchRangeData.endChapter) {
      showToast(
        language === 'zh' ? '起始章节号不能大于结束章节号' : 'Start chapter cannot be greater than end chapter',
        'warning'
      );
      return;
    }
    
    // 保存范围值，因为后面会重置
    const { startChapter, endChapter } = batchRangeData;
    
    try {
      const response = await ApiService.post('/author/chapters/batch/update-volume-by-range', {
        novel_id: novelId,
        start_chapter: batchRangeData.startChapter,
        end_chapter: batchRangeData.endChapter,
        volume_id: batchRangeData.volumeId
      });
      
      if (response.success) {
        const updatedCount = response.data?.updated_count || 0;
        // 重新加载章节列表
        await loadChapters();
        setBatchRangeModalVisible(false);
        setBatchRangeData({ startChapter: 1, endChapter: 1, volumeId: null });
        showToast(
          language === 'zh' 
            ? `已成功为第 ${startChapter}-${endChapter} 章设置卷轴（共 ${updatedCount} 个章节）` 
            : `Successfully set volume for chapters ${startChapter}-${endChapter} (${updatedCount} chapters)`,
          'success'
        );
      } else {
        throw new Error(response.message || '批量更新失败');
      }
    } catch (error) {
      console.error('批量更新失败:', error);
      showToast(
        language === 'zh' 
          ? `批量更新失败: ${error instanceof Error ? error.message : '未知错误'}` 
          : `Batch update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  };
  
  // 切换章节选择
  const toggleChapterSelection = (chapterId: number) => {
    setSelectedChapters(prev =>
      prev.includes(chapterId)
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId]
    );
  };
  
  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedChapters.length === chapters.length) {
      setSelectedChapters([]);
    } else {
      setSelectedChapters(chapters.map(ch => ch.id));
    }
  };

  if (loading) {
    return <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>;
  }

  return (
    <div className={styles.container}>
      {/* Search and Filter Section */}
      <div className={styles.filterSection}>
        <div className={styles.filterRow}>
          {/* 卷筛选 */}
          <select
            className={styles.filterSelect}
            style={{ width: '160px', marginRight: '8px' }}
            value={volumeFilter === 'none' ? 'none' : volumeFilter === 'all' ? 'all' : volumeFilter}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'all') {
                setVolumeFilter('all');
              } else if (value === 'none') {
                setVolumeFilter('none');
              } else {
                setVolumeFilter(parseInt(value));
              }
            }}
          >
            <option value="all">{language === 'zh' ? '全部卷' : 'All Volumes'}</option>
            {volumes.map(v => (
              <option key={v.id} value={v.id}>
                {getVolumeLabel(v)}
              </option>
            ))}
            <option value="none">{language === 'zh' ? '无卷' : 'No Volume'}</option>
          </select>

          <select 
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">{language === 'zh' ? '全部状态' : 'All Status'}</option>
            <option value="published">{language === 'zh' ? '已发布' : 'Published'}</option>
            <option value="scheduled">{language === 'zh' ? '定时发布' : 'Scheduled'}</option>
            <option value="unreleased">{language === 'zh' ? '未发布' : 'Unreleased'}</option>
            <option value="submitted">{language === 'zh' ? '待审核' : 'Pending'}</option>
            <option value="reviewing">{language === 'zh' ? '审核中' : 'Reviewing'}</option>
            <option value="approved">{language === 'zh' ? '审核通过' : 'Approved'}</option>
            <option value="rejected">{language === 'zh' ? '审核不通过' : 'Rejected'}</option>
          </select>

          <select className={styles.filterSelect}>
            <option>{language === 'zh' ? '章节内容' : 'Chapter Content'}</option>
          </select>

          <input
            type="text"
            className={styles.searchInput}
            placeholder={language === 'zh' ? '请输入章节内容' : 'Please enter chapter content'}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />

          <button className={styles.searchBtn} onClick={handleSearch}>
            🔍 {language === 'zh' ? '搜索' : 'Search'}
          </button>

          <div className={styles.sortButtons}>
            <button
              className={`${styles.sortBtn} ${sortOrder === 'desc' ? styles.active : ''}`}
              onClick={() => setSortOrder('desc')}
            >
              {language === 'zh' ? '倒序' : 'Desc'}
            </button>
            <button
              className={`${styles.sortBtn} ${sortOrder === 'asc' ? styles.active : ''}`}
              onClick={() => setSortOrder('asc')}
            >
              {language === 'zh' ? '正序' : 'Asc'}
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className={styles.infoBanner}>
        <span className={styles.infoIcon}>ℹ️</span>
        <span>
          {language === 'zh' 
            ? '作品签约评估通过后,才会进入审核流程。故当前状态均为"待审核"或"排队待审核" 点击查看详情>' 
            : 'After the work contract evaluation passes, it will enter the review process. Click to view details>'}
        </span>
      </div>
      
      {/* 批量操作按钮 */}
      {chapters.length > 0 && (
        <div className={styles.batchActions}>
          <button
            className={styles.batchBtn}
            onClick={() => setBatchVolumeModalVisible(true)}
            disabled={selectedChapters.length === 0}
          >
            {language === 'zh' ? '批量设置卷轴（按勾选）' : 'Batch Set Volume (By Selection)'}
            {selectedChapters.length > 0 && ` (${selectedChapters.length})`}
          </button>
          <button
            className={styles.batchBtn}
            onClick={() => setBatchRangeModalVisible(true)}
          >
            {language === 'zh' ? '批量设置卷轴（按章节号范围）' : 'Batch Set Volume (By Range)'}
          </button>
        </div>
      )}

      {/* Chapters Table */}
      {error ? (
        <div className={styles.error}>{error}</div>
      ) : chapters.length === 0 ? (
        <div className={styles.noChapters}>
          <p>{language === 'zh' ? '暂时没有章节，去上传' : 'No chapters yet, go upload'}</p>
          <button
            className={styles.uploadBtn}
            onClick={() => navigate(`/novel-upload?novelId=${novelId}`)}
          >
            {language === 'zh' ? '上传章节' : 'Upload Chapter'}
          </button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.chaptersTable}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedChapters.length === chapters.length && chapters.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>{language === 'zh' ? '章节名称' : 'Chapter Name'}</th>
                <th>{language === 'zh' ? '字数' : 'Word Count'}</th>
                <th>{language === 'zh' ? '章节类别' : 'Chapter Type'}</th>
                <th>{language === 'zh' ? '卷轴' : 'Volume'}</th>
                <th>{language === 'zh' ? '发布时间' : 'Publish Time'}</th>
                <th>{language === 'zh' ? '发布状态' : 'Release Status'}</th>
                <th>{language === 'zh' ? '状态' : 'Status'}</th>
                <th>{language === 'zh' ? '操作' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map(chapter => (
                <tr key={chapter.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedChapters.includes(chapter.id)}
                      onChange={() => toggleChapterSelection(chapter.id)}
                    />
                  </td>
                  <td>
                    第{chapter.chapter_number}章 {chapter.title}
                  </td>
                  <td>{formatWordCount(chapter.word_count)}</td>
                  <td>
                    {chapter.unlock_price && chapter.unlock_price > 0 ? 
                      (language === 'zh' ? '付费章节' : 'Premium Chapter') : 
                      (language === 'zh' ? '免费章节' : 'Free Chapter')
                    }
                  </td>
                  <td>
                    <select
                      style={{ width: '100%', padding: '4px 8px', fontSize: '14px' }}
                      value={chapter.volume_id ?? ''}
                      onChange={(e) => handleVolumeChange(chapter.id, e.target.value, chapter.volume_id)}
                    >
                      <option value="">{language === 'zh' ? '无卷' : 'No Volume'}</option>
                      {volumes.map(v => (
                        <option key={v.id} value={v.id}>
                          {getVolumeLabel(v)}
                        </option>
                      ))}
                      <option value="__new" style={{ fontWeight: 'bold', color: '#007bff' }}>
                        + {language === 'zh' ? '新建卷' : 'New Volume'}
                      </option>
                      {chapter.volume_id && (
                        <option value="__edit" style={{ fontWeight: 'bold', color: '#ff9900' }}>
                          ✏ {language === 'zh' ? '编辑本卷信息…' : 'Edit This Volume...'}
                        </option>
                      )}
                    </select>
                  </td>
                  <td>
                    {chapter.release_date ? (
                      <span 
                        style={{
                          color: getDateColor(chapter.release_date),
                          backgroundColor: getDateBackgroundColor(chapter.release_date),
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 500,
                          display: 'inline-block'
                        }}
                      >
                        {new Date(chapter.release_date).toLocaleString('zh-CN', { 
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <span className={`${styles.publishStatusTag} ${getPublishStatusClass(chapter)}`}>
                      {getPublishStatusText(chapter)}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusTag} ${getStatusClass(chapter.review_status)}`}>
                      {getReviewStatusText(chapter)}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.actionLink}
                        onClick={() => navigate(`/novel/${novelId}/chapter/${chapter.id}`)}
                      >
                        {language === 'zh' ? '预览' : 'Preview'}
                      </button>
                      <button
                        className={styles.actionLink}
                        onClick={() => {
                          // 跳转到章节上传/编辑页面，带上chapterId参数
                          const titleParam = novelTitle ? encodeURIComponent(novelTitle) : '';
                          navigate(`/novel-upload?novelId=${novelId}&chapterId=${chapter.id}${titleParam ? `&title=${titleParam}` : ''}`);
                        }}
                      >
                        {language === 'zh' ? '修改' : 'Modify'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* 卷轴创建/编辑弹窗 */}
      {newVolumeModalVisible && (
        <div 
          className={styles.modalOverlay}
          onClick={resetVolumeModal}
        >
          <div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>{volumeFormMode === 'create' 
                ? (language === 'zh' ? '新建卷轴' : 'Create Volume')
                : (language === 'zh' ? '编辑卷轴' : 'Edit Volume')}
              </h3>
              <button className={styles.modalClose} onClick={resetVolumeModal}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>{language === 'zh' ? '卷序号' : 'Volume Number'}</label>
                <input
                  type="number"
                  min="1"
                  value={volumeFormData.volume_id}
                  onChange={(e) => setVolumeFormData({ ...volumeFormData, volume_id: parseInt(e.target.value) || 1 })}
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label>{language === 'zh' ? '卷名' : 'Volume Title'} <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  value={volumeFormData.title}
                  onChange={(e) => setVolumeFormData({ ...volumeFormData, title: e.target.value })}
                  placeholder={language === 'zh' ? '请输入卷名' : 'Enter volume title'}
                  className={styles.formInput}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnCancel} onClick={resetVolumeModal}>
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button className={styles.modalBtnSubmit} onClick={handleVolumeFormSubmit}>
                {language === 'zh' ? '确定' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 批量设置卷轴弹窗（按勾选） */}
      {batchVolumeModalVisible && (
        <div 
          className={styles.modalOverlay}
          onClick={() => setBatchVolumeModalVisible(false)}
        >
          <div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>{language === 'zh' ? '批量设置卷轴' : 'Batch Set Volume'}</h3>
              <button className={styles.modalClose} onClick={() => setBatchVolumeModalVisible(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p>{language === 'zh' 
                ? `已选择 ${selectedChapters.length} 个章节` 
                : `${selectedChapters.length} chapters selected`}
              </p>
              <div className={styles.formGroup}>
                <label>{language === 'zh' ? '选择卷轴' : 'Select Volume'}</label>
                <select
                  className={styles.formInput}
                  value={batchSelectionVolumeId ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : parseInt(e.target.value);
                    setBatchSelectionVolumeId(value);
                  }}
                >
                  <option value="">{language === 'zh' ? '无卷' : 'No Volume'}</option>
                  {volumes.map(v => (
                    <option key={v.id} value={v.id}>
                      {getVolumeLabel(v)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnCancel} onClick={() => {
                setBatchVolumeModalVisible(false);
                setBatchSelectionVolumeId(null);
              }}>
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button 
                className={styles.modalBtnSubmit} 
                onClick={() => handleBatchUpdateBySelection(batchSelectionVolumeId)}
              >
                {language === 'zh' ? '确定' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 批量设置卷轴弹窗（按章节号范围） */}
      {batchRangeModalVisible && (
        <div 
          className={styles.modalOverlay}
          onClick={() => setBatchRangeModalVisible(false)}
        >
          <div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>{language === 'zh' ? '批量设置卷轴（按章节号范围）' : 'Batch Set Volume (By Range)'}</h3>
              <button className={styles.modalClose} onClick={() => setBatchRangeModalVisible(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>{language === 'zh' ? '起始章节号' : 'Start Chapter Number'}</label>
                <input
                  type="number"
                  min="1"
                  value={batchRangeData.startChapter}
                  onChange={(e) => setBatchRangeData({ ...batchRangeData, startChapter: parseInt(e.target.value) || 1 })}
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label>{language === 'zh' ? '结束章节号' : 'End Chapter Number'}</label>
                <input
                  type="number"
                  min="1"
                  value={batchRangeData.endChapter}
                  onChange={(e) => setBatchRangeData({ ...batchRangeData, endChapter: parseInt(e.target.value) || 1 })}
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label>{language === 'zh' ? '选择卷轴' : 'Select Volume'}</label>
                <select
                  className={styles.formInput}
                  value={batchRangeData.volumeId ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : parseInt(e.target.value);
                    setBatchRangeData({ ...batchRangeData, volumeId: value });
                  }}
                >
                  <option value="">{language === 'zh' ? '无卷' : 'No Volume'}</option>
                  {volumes.map(v => (
                    <option key={v.id} value={v.id}>
                      {getVolumeLabel(v)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnCancel} onClick={() => setBatchRangeModalVisible(false)}>
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button className={styles.modalBtnSubmit} onClick={handleBatchUpdateByRange}>
                {language === 'zh' ? '确定' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast提示 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default ChapterManageTab;


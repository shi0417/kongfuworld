import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ChapterDisplay.module.css';
import ApiService from '../../services/ApiService';

interface Volume {
  id: number;
  volume_id: number;
  title: string;
  start_chapter: number;
  end_chapter: number;
  chapter_count: number;
  actual_chapter_count: number;
  latest_chapter_date: string;
}

interface Chapter {
  id: number;
  chapter_number: number;
  title: string;
  created_at: string;
  unlock_price: number;
  is_advance: boolean;
}

interface ChapterDisplayProps {
  novelId: number;
  user?: any;
}

const ChapterDisplay: React.FC<ChapterDisplayProps> = ({ novelId, user }) => {
  const navigate = useNavigate();
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [expandedVolumes, setExpandedVolumes] = useState<Set<number>>(new Set());
  const [volumeChapters, setVolumeChapters] = useState<Record<number, Chapter[]>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'volume_id'>('newest');
  const [latestChapter, setLatestChapter] = useState<any>(null);

  // 加载卷信息
  const loadVolumes = async () => {
    console.log('🔍 ChapterDisplay: 开始加载卷信息, novelId:', novelId);
    try {
      const response = await ApiService.request(`/novel/${novelId}/volumes?sort=${sortBy}`);
      console.log('🔍 ChapterDisplay: API响应状态:', response.success);
      const data = response.data;
      console.log('🔍 ChapterDisplay: API响应数据:', data);
      
      // 处理两种数据格式
      if (data.success && data.data) {
        // 新格式: { success: true, data: { volumes, latest_chapter } }
        console.log('🔍 ChapterDisplay: 设置卷数据 (新格式):', data.data.volumes);
        setVolumes(data.data.volumes);
        setLatestChapter(data.data.latest_chapter);
      } else if (data.volumes) {
        // 旧格式: { volumes }
        console.log('🔍 ChapterDisplay: 设置卷数据 (旧格式):', data.volumes);
        setVolumes(data.volumes);
        setLatestChapter(null);
      } else {
        console.error('🔍 ChapterDisplay: API返回失败:', data);
      }
    } catch (error) {
      console.error('🔍 ChapterDisplay: 加载卷信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载指定卷的章节
  const loadVolumeChapters = async (volumeId: number) => {
    try {
      // 传递 userId 参数以支持可见性过滤
      const userIdParam = user?.id ? `&userId=${user.id}` : '';
      // 传递一个足够大的limit值，确保获取所有章节
      const response = await ApiService.request(`/volume/${volumeId}/chapters?sort=chapter_number&limit=1000${userIdParam}`);
      
      if (response.success) {
        setVolumeChapters(prev => ({
          ...prev,
          [volumeId]: response.data.chapters
        }));
      }
    } catch (error) {
      console.error('加载章节失败:', error);
    }
  };

  // 切换卷的展开状态
  const toggleVolume = (volumeId: number) => {
    const newExpanded = new Set(expandedVolumes);
    if (newExpanded.has(volumeId)) {
      newExpanded.delete(volumeId);
    } else {
      newExpanded.add(volumeId);
      // 如果展开且没有加载过章节，则加载章节
      if (!volumeChapters[volumeId]) {
        loadVolumeChapters(volumeId);
      }
    }
    setExpandedVolumes(newExpanded);
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} days ago`;
    }
  };

  // 获取章节状态图标
  const getChapterStatusIcon = (chapter: Chapter) => {
    if (chapter.unlock_price && chapter.unlock_price > 0) return '🔒';
    if (chapter.is_advance) return '⚡';
    return '📖';
  };

  // 获取章节状态颜色
  const getChapterStatusColor = (chapter: Chapter) => {
    if (chapter.unlock_price && chapter.unlock_price > 0) return '#f44336';
    if (chapter.is_advance) return '#9c27b0';
    return '#4caf50';
  };

  // 处理章节点击
  const handleChapterClick = (chapter: Chapter) => {
    navigate(`/novel/${novelId}/chapter/${chapter.id}`);
  };

  useEffect(() => {
    loadVolumes();
  }, [novelId, sortBy]);

  console.log('🔍 ChapterDisplay: 渲染状态 - loading:', loading, 'volumes:', volumes.length);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>加载章节信息中...</p>
      </div>
    );
  }

  return (
    <div className={styles.chapterDisplay}>
      {/* 最新章节信息 - 重新设计排版 */}
      {latestChapter && (
        <div className={styles.latestChapter}>
          <div className={styles.latestChapterHeader}>
            <span className={styles.latestLabel}>Latest Chapter</span>
            <span className={styles.latestChapterDate}>
              {formatDate(latestChapter.created_at)}
            </span>
          </div>
          <div className={styles.latestChapterContent}>
            <span className={styles.latestChapterTitle}>
              Chapter {latestChapter.chapter_number}: {latestChapter.title}
            </span>
          </div>
        </div>
      )}

      {/* 排序选项 */}
      <div className={styles.sortOptions}>
        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value as any)}
          className={styles.sortSelect}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="volume_id">Volume ID</option>
        </select>
      </div>

      {/* 卷列表 - WuxiaWorld样式 */}
      <div className={styles.volumesList}>
        {volumes.map((volume) => (
          <div key={volume.id} className={styles.volumeCard}>
            {/* 卷头部 - 类似WuxiaWorld的卡片样式 */}
            <div 
              className={styles.volumeCardHeader}
              onClick={() => toggleVolume(volume.id)}
            >
              <div className={styles.volumeCardNumber}>
                {volume.volume_id}
              </div>
              <div className={styles.volumeCardContent}>
                <div className={styles.volumeCardTitle}>
                  {volume.title}
                </div>
                <div className={styles.volumeCardRange}>
                  Chapters {volume.start_chapter}-{volume.end_chapter}
                </div>
              </div>
              <div className={styles.volumeCardStats}>
                {volume.actual_chapter_count} chapters
              </div>
              <div className={styles.volumeCardExpand}>
                {expandedVolumes.has(volume.id) ? '▲' : '▼'}
              </div>
            </div>

            {/* 章节列表 - 展开时显示 */}
            {expandedVolumes.has(volume.id) && volumeChapters[volume.id] && (
              <div className={styles.volumeChaptersList}>
                {volumeChapters[volume.id].map((chapter) => (
                  <div 
                    key={chapter.id} 
                    className={styles.volumeChapterItem}
                    onClick={() => handleChapterClick(chapter)}
                  >
                    <div className={styles.volumeChapterInfo}>
                      <span className={styles.volumeChapterNumber}>
                        Chapter {chapter.chapter_number}:
                      </span>
                      <span className={styles.volumeChapterTitle}>
                        {chapter.title}
                      </span>
                    </div>
                    <div className={styles.volumeChapterMeta}>
                      <span className={styles.volumeChapterDate}>
                        {formatDate(chapter.created_at)}
                      </span>
                      <span 
                        className={styles.volumeChapterStatus}
                        style={{ color: getChapterStatusColor(chapter) }}
                        title={chapter.is_advance ? 'Champion Advance Chapter' : ''}
                      >
                        {getChapterStatusIcon(chapter)}
                        {chapter.is_advance && (
                          <span style={{ marginLeft: '4px', fontSize: '12px', color: '#9c27b0' }}>
                            Champion Advance
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChapterDisplay;

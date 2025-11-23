// ChapterReader.tsx 集成时间追踪的示例代码
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '../hooks/useAuth';
import { useReadingTiming } from '../hooks/useReadingTiming';
import readingTimingService from '../services/readingTimingService';
import ApiService from '../services/ApiService';

const ChapterReader: React.FC = () => {
  const { novelId, chapterId } = useParams<{ novelId: string; chapterId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user: authUser } = useAuth();
  const { user: userData } = useUser();
  
  // 使用认证Hook，无需手动管理用户状态
  const user = authUser || userData;
  
  // 章节数据状态
  const [chapterData, setChapterData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 使用阅读时间追踪Hook
  const {
    enterTime,
    exitTime,
    duration,
    isTracking,
    startTracking,
    stopTracking
  } = useReadingTiming({
    userId: user?.id || 0,
    chapterId: parseInt(chapterId || '0'),
    onTimingUpdate: async (timingData) => {
      // 当时间追踪更新时，发送到后端
      if (user && chapterId) {
        try {
          await readingTimingService.updateReadingTiming(
            user.id,
            parseInt(chapterId),
            timingData
          );
          console.log('📊 阅读时间已记录:', timingData);
        } catch (error) {
          console.error('记录阅读时间失败:', error);
        }
      }
    }
  });

  // 获取章节内容
  useEffect(() => {
    const loadChapter = async () => {
      if (!user || !chapterId) return;
      
      try {
        setLoading(true);
        const response = await ApiService.request(`/api/chapter/${chapterId}`);
        
        if (response.success) {
          setChapterData(response.data);
        } else {
          setError(response.message || '加载章节失败');
        }
      } catch (error) {
        console.error('加载章节失败:', error);
        setError('加载章节失败');
      } finally {
        setLoading(false);
      }
    };

    loadChapter();
  }, [user, chapterId]);

  // 页面离开时的清理工作
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 确保在页面离开前记录时间
      if (isTracking && user && chapterId) {
        // 使用 navigator.sendBeacon 确保数据发送成功
        const timingData = {
          userId: user.id,
          chapterId: parseInt(chapterId),
          enterTime: enterTime?.toISOString(),
          exitTime: new Date().toISOString(),
          duration: duration || 0
        };
        
        navigator.sendBeacon(
          '/api/reading-timing/update-timing',
          JSON.stringify(timingData)
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isTracking, user, chapterId, enterTime, duration]);

  // 显示当前阅读状态
  const renderReadingStatus = () => {
    if (!isTracking) return null;
    
    return (
      <div className="reading-status">
        <div className="status-indicator">
          <span className="status-dot"></span>
          <span>正在阅读中...</span>
        </div>
        {enterTime && (
          <div className="timing-info">
            <small>
              进入时间: {enterTime.toLocaleTimeString()}
              {duration && ` | 已阅读: ${readingTimingService.formatDuration(duration)}`}
            </small>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>加载章节中...</p>
        {renderReadingStatus()}
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <h2>加载失败</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          重新加载
        </button>
      </div>
    );
  }

  if (!chapterData) {
    return (
      <div className="error">
        <h2>章节不存在</h2>
        <button onClick={() => navigate(-1)}>
          返回上一页
        </button>
      </div>
    );
  }

  return (
    <div className="chapter-reader">
      {/* 阅读状态指示器 */}
      {renderReadingStatus()}
      
      {/* 章节标题 */}
      <header className="chapter-header">
        <h1>{chapterData.title}</h1>
        <div className="chapter-meta">
          <span>第 {chapterData.chapter_number} 章</span>
          {chapterData.word_count && (
            <span> | {chapterData.word_count} 字</span>
          )}
        </div>
      </header>
      
      {/* 章节内容 */}
      <div className="chapter-content">
        <div 
          className="content-text"
          dangerouslySetInnerHTML={{ __html: chapterData.content }}
        />
      </div>
      
      {/* 阅读控制 */}
      <div className="reading-controls">
        <button 
          onClick={() => navigate(`/novel/${novelId}/chapter/${parseInt(chapterId || '0') - 1}`)}
          disabled={!chapterData.previous_chapter_id}
        >
          上一章
        </button>
        
        <button 
          onClick={() => navigate(`/novel/${novelId}`)}
        >
          目录
        </button>
        
        <button 
          onClick={() => navigate(`/novel/${novelId}/chapter/${parseInt(chapterId || '0') + 1}`)}
          disabled={!chapterData.next_chapter_id}
        >
          下一章
        </button>
      </div>
    </div>
  );
};

export default ChapterReader;

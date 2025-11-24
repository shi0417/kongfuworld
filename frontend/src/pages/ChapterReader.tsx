import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import ParagraphComment from '../components/ParagraphComment/ParagraphComment';
import ChapterUnlockModal from '../components/ChapterUnlockModal/ChapterUnlockModal';
import { useAuth, useUser } from '../hooks/useAuth';
import ApiService from '../services/ApiService';
import readingService from '../services/readingService';
import novelService from '../services/novelService';
import ChapterCommentSectionNew from '../components/ChapterCommentSection/ChapterCommentSectionNew';
import FavoriteButton from '../components/FavoriteButton/FavoriteButton';

const ChapterReader: React.FC = () => {
  const { novelId, chapterId } = useParams<{ novelId: string; chapterId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user: authUser } = useAuth();
  const { user: userData } = useUser();
  const [showChapterList, setShowChapterList] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  
  // 章节数据状态
  const [chapterData, setChapterData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readingRecordId, setReadingRecordId] = useState<number | null>(null);
  const [currentRecordId, setCurrentRecordId] = useState<number | null>(null);
  const [hasRecordedForChapter, setHasRecordedForChapter] = useState<string | null>(null);
  const recordingInProgress = useRef<Set<string>>(new Set());
  
  // 章节列表状态
  const [chapters, setChapters] = useState<any[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  
  // 段落评论状态
  const [paragraphComments, setParagraphComments] = useState<Record<number, number>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);
  
  // 章节解锁状态
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [isChapterLocked, setIsChapterLocked] = useState(false);

  // 监听章节锁定状态变化
  useEffect(() => {
    console.log('🔒 章节锁定状态变化:', isChapterLocked);
    if (isChapterLocked) {
      console.log('🔒 章节被锁定，将显示锁定界面');
    } else {
      console.log('🔓 章节已解锁，将显示章节内容');
    }
  }, [isChapterLocked]);

  // 使用认证Hook，无需手动管理用户状态
  const user = authUser || userData;

  // 页面离开时记录离开时间
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentRecordId) {
        console.log('📤 页面离开，记录离开时间...');
        
        // 使用 sendBeacon 确保请求能够发送
        const exitTime = new Date().toISOString();
        
        // 使用 JSON 格式发送数据
        ApiService.request('/reading-timing/update-exit-time', {
          method: 'POST',
          body: JSON.stringify({ recordId: currentRecordId, exitTime }),
          keepalive: true
        }).then(response => {
          if (response.success) {
            console.log('✅ 离开时间已记录');
          } else {
            console.log('❌ 离开时间记录失败:', response.message);
          }
        }).catch(error => {
          console.error('❌ 记录离开时间失败:', error);
        });
      }
    };

    // 监听页面离开事件
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [currentRecordId]);

  // 组件卸载时记录离开时间
  useEffect(() => {
    return () => {
      if (currentRecordId) {
        console.log('🛑 组件卸载，记录离开时间...');
        
        // 使用 sendBeacon 确保请求能够发送
        const exitTime = new Date().toISOString();
        
        // 使用 JSON 格式发送数据
        ApiService.request('/reading-timing/update-exit-time', {
          method: 'POST',
          body: JSON.stringify({ recordId: currentRecordId, exitTime }),
          keepalive: true
        }).catch(error => {
          console.error('❌ 记录离开时间失败:', error);
        });
      }
    };
  }, [currentRecordId]);

  // 获取章节内容 - 检查用户登录状态
  useEffect(() => {
    // 如果用户未登录，直接跳转到登录页面
    if (user === null) {
      console.log('❌ 用户未登录，跳转到登录页面');
      const currentPath = `/novel/${novelId}/chapter/${chapterId}`;
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    const loadChapterContent = async () => {
      console.log('📖 开始加载章节内容，章节ID:', chapterId);
      console.log('👤 当前用户状态:', user);
      
      if (!chapterId) {
        console.log('❌ 章节ID不存在');
        setError('章节ID不存在');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log('📖 开始加载章节内容:', chapterId);
        const chapter = await novelService.getChapterContent(parseInt(chapterId));
        console.log('📖 章节内容加载成功:', chapter.title);
        setChapterData(chapter);
        
        // 检查章节是否被锁定
        console.log('🔍 章节锁定检查开始:');
        console.log('📖 章节信息:', {
          id: chapter.id,
          title: chapter.title,
          unlock_price: chapter.unlock_price || 0,
          novel_id: chapter.novel_id
        });
        console.log('👤 用户信息:', {
          id: user?.id,
          username: user?.username,
          isLoggedIn: !!user
        });
        
        if (chapter.unlock_price && chapter.unlock_price > 0) {
          console.log('🔒 章节被锁定，需要检查用户权限');
          // 如果章节被锁定，需要进一步检查用户权限
          if (user) {
            console.log('✅ 用户已登录，调用权限检查API');
            await checkUserChapterAccess(chapter, user);
          } else {
            console.log('❌ 用户未登录，直接显示锁定');
            setIsChapterLocked(true);
          }
        } else {
          console.log('🔓 章节未锁定，直接显示内容');
          setIsChapterLocked(false);
        }
      } catch (err: any) {
        console.error('加载章节内容失败:', err);
        const errorMessage = err.message || '加载章节内容失败，请稍后重试';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadChapterContent();
  }, [chapterId, user, novelId, navigate]); // 添加 user, novelId 和 navigate 依赖

  // 加载段落评论
  useEffect(() => {
    if (chapterId) {
      loadParagraphComments();
    }
  }, [chapterId]);

  // 记录阅读日志（强化防重复机制）
  useEffect(() => {
    const recordReading = async () => {
      if (user && chapterId) {
        const chapterKey = `${user.id}-${chapterId}`;
        
        // 多重检查：状态检查 + 进行中检查
        if (hasRecordedForChapter !== chapterKey && !recordingInProgress.current.has(chapterKey)) {
          try {
            console.log('📝 开始记录阅读日志...');
            
            // 标记正在记录，防止重复请求
            recordingInProgress.current.add(chapterKey);
            setHasRecordedForChapter(chapterKey);
            
            const response = await readingService.recordReading(user.id, parseInt(chapterId));
            console.log('📊 阅读记录响应:', response);
            
            // 保存记录ID供时间追踪使用
            if (response.recordId) {
              setReadingRecordId(response.recordId);
              setCurrentRecordId(response.recordId);
              console.log('✅ 阅读记录已创建，记录ID:', response.recordId);
            } else {
              console.log('⚠️ 响应中没有recordId字段');
              // 失败时重置标志，允许重试
              setHasRecordedForChapter(null);
            }
          } catch (error) {
            console.error('❌ 记录阅读日志失败:', error);
            // 失败时重置标志，允许重试
            setHasRecordedForChapter(null);
          } finally {
            // 无论成功失败，都清除进行中标记
            recordingInProgress.current.delete(chapterKey);
          }
        } else {
          if (hasRecordedForChapter === chapterKey) {
            console.log('⚠️ 已记录过阅读日志，跳过重复记录');
          } else if (recordingInProgress.current.has(chapterKey)) {
            console.log('⚠️ 正在记录中，跳过重复请求');
          }
        }
      } else {
        console.log('⚠️ 用户或章节ID为空，无法记录阅读日志');
      }
    };

    // 添加防抖机制，避免快速连续调用
    const timeoutId = setTimeout(recordReading, 100);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [user, chapterId]); // 移除 hasRecordedForChapter 依赖，避免循环触发

  // 获取章节列表
  useEffect(() => {
    const loadChapters = async () => {
      if (!novelId) return;
      
      try {
        setChaptersLoading(true);
        console.log('开始获取章节列表:', novelId);
        const chaptersList = await novelService.getNovelChapters(parseInt(novelId));
        console.log('章节列表获取成功:', chaptersList.length, '个章节');
        setChapters(chaptersList);
      } catch (err) {
        console.error('获取章节列表失败:', err);
        // 如果API失败，使用空数组，不显示错误
        setChapters([]);
      } finally {
        setChaptersLoading(false);
      }
    };

    loadChapters();
  }, [novelId]);

  // 处理章节点击
  const handleChapterClick = (chapter: any) => {
    console.log('点击章节:', chapter);
    // 使用真实的章节ID进行导航
    navigate(`/novel/${novelId}/chapter/${chapter.id}`);
    setShowChapterList(false);
  };

  const handlePrevChapter = () => {
    if (chapterData && chapterData.has_prev) {
      navigate(`/novel/${novelId}/chapter/${chapterData.prev_chapter_id}`);
    }
  };

  const handleNextChapter = () => {
    if (chapterData && chapterData.has_next) {
      navigate(`/novel/${novelId}/chapter/${chapterData.next_chapter_id}`);
    }
  };

  // 加载段落评论统计
  const loadParagraphComments = async () => {
    if (!chapterId) return;
    
    try {
      setCommentsLoading(true);
      const response = await ApiService.request(`/chapter/${chapterId}/paragraph-comments`);
      
      if (response.success) {
        setParagraphComments(response.data);
      }
    } catch (error) {
      console.error('加载段落评论失败:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  // 处理评论添加
  const handleCommentAdded = () => {
    loadParagraphComments();
  };

  // 处理章节解锁
  const handleUnlockSuccess = () => {
    setShowUnlockModal(false);
    setIsChapterLocked(false);
    // 重新加载章节内容
    window.location.reload();
  };

  // 检查用户章节访问权限
  const checkUserChapterAccess = async (chapter: any, user: any) => {
    try {
      console.log('🔍 开始检查用户章节访问权限:');
      console.log('📖 章节ID:', chapter.id);
      console.log('👤 用户ID:', user.id);
      console.log('🌐 API URL:', `http://localhost:5000/api/chapter-unlock/status/${chapter.id}/${user.id}`);
      
      // 调用后端API检查用户权限
      console.log('📡 发送API请求...');
      const response = await ApiService.request(`/chapter-unlock/status/${chapter.id}/${user.id}`);
      console.log('📡 API响应状态:', response.success);
      
      console.log('📊 API响应数据:', response.data);
      
      if (response.success) {
        const unlockData = response.data;
        console.log('🔓 解锁状态:', unlockData);
        console.log('🔓 isUnlocked:', unlockData.isUnlocked);
        console.log('🔓 typeof isUnlocked:', typeof unlockData.isUnlocked);
        
        // 如果用户已解锁，不显示锁定
        if (unlockData.isUnlocked) {
          console.log('✅ 用户有访问权限，不显示锁定');
          console.log('✅ 设置: setIsChapterLocked(false)');
          setIsChapterLocked(false);
        } else {
          console.log('❌ 用户无访问权限，显示锁定');
          console.log('❌ 设置: setIsChapterLocked(true)');
          setIsChapterLocked(true);
        }
      } else {
        console.log('❌ API调用失败，默认显示锁定');
        console.log('❌ 设置: setIsChapterLocked(true)');
        setIsChapterLocked(true);
      }
    } catch (error) {
      console.error('❌ 检查用户权限失败:', error);
      console.log('❌ 设置: setIsChapterLocked(true)');
      setIsChapterLocked(true);
    }
  };

  // 启动时间解锁
  const startTimeUnlock = async (chapterId: number, userId: number) => {
    try {
      console.log('⏰ 启动时间解锁:', { chapterId, userId });
      const response = await ApiService.request(`/chapter-unlock/start-time-unlock/${chapterId}/${userId}`, {
        method: 'POST'
      });
      
      console.log('⏰ 时间解锁启动结果:', response.data);
      
      if (response.success) {
        console.log('✅ 时间解锁已启动');
        return true;
      } else {
        console.log('❌ 时间解锁启动失败:', response.message);
        return false;
      }
    } catch (error) {
      console.error('❌ 启动时间解锁失败:', error);
      return false;
    }
  };

  // 检查章节访问权限
  const checkChapterAccess = async () => {
    if (isChapterLocked && user && chapterId) {
      console.log('🔒 章节被锁定，启动时间解锁流程');
      // 启动时间解锁
      await startTimeUnlock(parseInt(chapterId), user.id);
      // 显示解锁模态框
      setShowUnlockModal(true);
      return false;
    }
    return true;
  };


  // 加载状态
  if (loading) {
    return (
      <div style={{ background: '#18191A', minHeight: '100vh', color: '#fff', fontFamily: 'inherit' }}>
        <NavBar />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>📖</div>
            <div>加载章节内容中...</div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // 重试加载章节内容
  const retryLoadChapter = async () => {
    if (!chapterId) return;
    
    try {
      setLoading(true);
      setError(null);
      console.log('重试加载章节内容:', chapterId);
      const chapter = await novelService.getChapterContent(parseInt(chapterId));
      console.log('重试成功，章节内容加载:', chapter.title);
      setChapterData(chapter);
    } catch (err: any) {
      console.error('重试加载章节内容失败:', err);
      const errorMessage = err.message || '加载章节内容失败，请稍后重试';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 错误状态
  if (error || !chapterData) {
    return (
      <div style={{ background: '#18191A', minHeight: '100vh', color: '#fff', fontFamily: 'inherit' }}>
        <NavBar />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', padding: '20px' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>❌</div>
            <div style={{ marginBottom: '16px', fontSize: '18px' }}>
              {error || '章节不存在'}
            </div>
            <div style={{ marginBottom: '24px', fontSize: '14px', color: '#ccc' }}>
              如果问题持续存在，请检查网络连接或联系管理员
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={retryLoadChapter}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: loading ? '#666' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                {loading ? '重试中...' : '重试加载'}
              </button>
              <button 
                onClick={() => navigate(`/book/${novelId}`)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                返回小说详情
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ background: '#18191A', minHeight: '100vh', color: '#fff', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <NavBar />
      

      {/* 章节导航栏 */}
      <div style={{ 
        background: '#23272F', 
        borderBottom: '1px solid #333',
        padding: '12px 0',
        position: 'sticky',
        top: '0',
        zIndex: 100
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button 
              onClick={() => navigate(`/book/${novelId}`)}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#6cf', 
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600
              }}
            >
              ← Back to Novel
            </button>
            <span style={{ color: '#666' }}>|</span>
            <span style={{ fontWeight: 600, fontSize: 18 }}>{chapterData.novel_title}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button 
              onClick={() => setFontSize(Math.max(14, fontSize - 2))}
              style={{ 
                background: '#333', 
                border: 'none', 
                color: '#fff', 
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              A-
            </button>
            <button 
              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              style={{ 
                background: '#333', 
                border: 'none', 
                color: '#fff', 
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              A+
            </button>
            <button 
              onClick={() => setShowChapterList(!showChapterList)}
              style={{ 
                background: '#1976d2', 
                border: 'none', 
                color: '#fff', 
                borderRadius: 6,
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Chapters
            </button>
          </div>
        </div>
      </div>

      {/* 章节列表侧边栏 */}
      {showChapterList && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 300,
          height: '100vh',
          background: '#23272F',
          borderLeft: '1px solid #333',
          zIndex: 200,
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Chapters</h3>
            <button 
              onClick={() => setShowChapterList(false)}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#666', 
                fontSize: 20,
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chaptersLoading ? (
              <div style={{ color: '#ccc', textAlign: 'center', padding: '20px' }}>
                加载章节列表中...
              </div>
            ) : chapters.length === 0 ? (
              <div style={{ color: '#ccc', textAlign: 'center', padding: '20px' }}>
                暂无章节数据
              </div>
            ) : (
              chapters.map((chapter) => {
                const isCurrent = chapterData ? chapter.id === chapterData.id : false;
                return (
                  <button
                    key={chapter.id}
                    onClick={() => handleChapterClick(chapter)}
                    style={{
                      background: isCurrent ? '#1976d2' : 'transparent',
                      border: 'none',
                      color: isCurrent ? '#fff' : '#ccc',
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 14,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent) {
                        e.currentTarget.style.background = '#333';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {chapter.title}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 主要内容区域 */}
      <div style={{ 
        maxWidth: 800, 
        margin: '0 auto', 
        padding: '40px 24px',
        lineHeight: lineHeight,
        fontSize: fontSize
      }}>
        {/* 章节标题 */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: 40,
          borderBottom: '1px solid #333',
          paddingBottom: 20
        }}>
          <h1 style={{ 
            fontSize: 28, 
            fontWeight: 700, 
            margin: '0 0 8px 0',
            color: '#fff'
          }}>
            {chapterData.title}
          </h1>
          <div style={{ color: '#666', fontSize: 16 }}>
            Chapter {chapterData.chapter_number}
          </div>
        </div>

        {/* 章节内容 */}
        <div style={{ 
          color: '#e0e0e0',
          fontSize: fontSize,
          lineHeight: lineHeight,
          textAlign: 'justify',
          marginBottom: 60
        }}>
          {chapterData.content ? (
            // 章节内容渲染
            (() => {
              const paragraphs = chapterData.content.split('\n');
              const previewParagraphs = isChapterLocked ? Math.max(3, Math.floor(paragraphs.length * 0.3)) : paragraphs.length;
              
              return paragraphs.map((paragraph: string, index: number) => {
                // 过滤空段落和只有空格的段落
                const trimmedParagraph = paragraph.trim();
                if (!trimmedParagraph) return null;
                
                const commentCount = paragraphComments[index] || 0;
                const isPreview = index < previewParagraphs;
                
                return (
                  <div key={index}>
                    <div style={{ 
                      margin: '0 0 24px 0',
                      position: 'relative',
                      opacity: isPreview ? 1 : 0.3,
                      filter: isPreview ? 'none' : 'blur(2px)'
                    }}>
                      <p style={{ 
                        textIndent: '2em', // 首行缩进
                        lineHeight: lineHeight,
                        margin: '0 0 0 0',
                      }}>
                        {trimmedParagraph}
                      </p>
                      {isPreview && (
                        <ParagraphComment
                          chapterId={parseInt(chapterId!)}
                          paragraphIndex={index}
                          commentCount={commentCount}
                          user={user}
                          onCommentAdded={handleCommentAdded}
                        />
                      )}
                    </div>
                    
                    {/* 锁定提示 - 在预览内容结束后显示 */}
                    {isChapterLocked && index === previewParagraphs - 1 && (
                      <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        background: 'rgba(26, 26, 26, 0.9)',
                        borderRadius: '12px',
                        border: '1px solid #404040',
                        margin: '40px 0',
                        position: 'relative'
                      }}>
                        <div style={{ 
                          position: 'absolute',
                          top: '-20px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#2a2a2a',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: '1px solid #404040',
                          fontSize: '14px',
                          color: '#fff'
                        }}>
                          🔒 章节已锁定
                        </div>
                        <p style={{ color: '#ccc', marginBottom: '24px', fontSize: '16px' }}>
                          继续阅读需要解锁此章节
                        </p>
                        <button
                          onClick={checkChapterAccess}
                          style={{
                            background: '#007bff',
                            color: '#fff',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '6px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'background 0.3s ease'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#0056b3'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#007bff'}
                        >
                          解锁章节
                        </button>
                      </div>
                    )}
                  </div>
                );
              });
            })()
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>章节内容暂不可用</p>
          )}
        </div>

        {/* 收藏按钮 */}
        {isAuthenticated && userData && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            marginTop: 20,
            marginBottom: 20
          }}>
            <FavoriteButton
              userId={userData.id}
              novelId={parseInt(novelId!)}
              novelName={chapterData?.novel_title || ''}
              chapterId={parseInt(chapterId!)}
              chapterName={chapterData?.title || ''}
              onFavoriteChange={(isFavorite) => {
                console.log('收藏状态变化:', isFavorite);
              }}
            />
          </div>
        )}

        {/* 翻页按钮 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderTop: '1px solid #333',
          paddingTop: 30
        }}>
          <button 
            onClick={handlePrevChapter}
            disabled={!chapterData.has_prev}
            style={{ 
              background: chapterData.has_prev ? '#1976d2' : '#333',
              border: 'none',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              cursor: chapterData.has_prev ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: 16
            }}
          >
            ← Previous Chapter
          </button>
          
          <div style={{ color: '#666', fontSize: 14 }}>
            Chapter {chapterData.chapter_number}
          </div>
          
          <button 
            onClick={handleNextChapter}
            disabled={!chapterData.has_next}
            style={{ 
              background: chapterData.has_next ? '#1976d2' : '#333',
              border: 'none',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              cursor: chapterData.has_next ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: 16
            }}
          >
            Next Chapter →
          </button>
        </div>
      </div>

        {/* 动态评论区块 */}
        <ChapterCommentSectionNew 
          chapterId={parseInt(chapterId!)} 
          user={user} 
        />

      {/* 相关小说推荐 */}
      <div style={{ maxWidth: 1100, margin: '60px auto 0 auto', padding: '0 24px' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 28, marginBottom: 24 }}>Related Novels</div>
        <div style={{ display: 'flex', gap: 32, overflowX: 'auto', paddingBottom: 20 }}>
          {/* 示例相关小说卡片 */}
          {[{
            cover: 'https://static.wuxiaworld.com/bookcover/star-odyssey.png',
            title: 'Star Odyssey',
            status: 'Ongoing',
            rating: 78
          }, {
            cover: 'https://static.wuxiaworld.com/bookcover/a-villains-will-to-survive.png',
            title: "A Villain's Will to Survive",
            status: 'Ongoing',
            rating: 93
          }, {
            cover: 'https://static.wuxiaworld.com/bookcover/life-once-again.png',
            title: 'Life, Once Again!',
            status: 'Completed',
            rating: 94
          }, {
            cover: 'https://static.wuxiaworld.com/bookcover/rebirth-of-a-fashionista.png',
            title: 'Rebirth of a Fashionista: This Life Is Soo Last Season!',
            status: 'Completed',
            rating: 46
          }, {
            cover: 'https://static.wuxiaworld.com/bookcover/barbarians-adventure.png',
            title: "Barbarian's Adventure in a Fantasy World",
            status: 'Ongoing',
            rating: 68
          }, {
            cover: 'https://static.wuxiaworld.com/bookcover/against-the-gods.png',
            title: 'Against the Gods',
            status: 'Ongoing',
            rating: 89
          }].map((novel, idx) => (
            <div key={idx} style={{ width: 160, background: '#23272F', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px #0002', marginRight: 8, flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <img src={novel.cover} alt={novel.title} style={{ width: '100%', height: 220, objectFit: 'cover' }} />
                <span style={{ position: 'absolute', top: 8, left: 8, background: '#222', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>{novel.status}</span>
              </div>
              <div style={{ padding: '12px 10px 8px 10px' }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 4, lineHeight: 1.3 }}>{novel.title}</div>
                <div style={{ color: '#aaa', fontSize: 15, marginBottom: 4 }}>👍 {novel.rating}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 章节解锁模态框 */}
      {showUnlockModal && user && chapterId && (
        <ChapterUnlockModal
          isOpen={showUnlockModal}
          onClose={() => setShowUnlockModal(false)}
          chapterId={parseInt(chapterId)}
          userId={user.id}
          onUnlockSuccess={handleUnlockSuccess}
        />
      )}
      
      <Footer />
    </div>
  );
};

export default ChapterReader;
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import ParagraphComment from '../components/ParagraphComment/ParagraphComment';
import ChapterUnlockModal from '../components/ChapterUnlockModal/ChapterUnlockModal';
import { useAuth, useUser } from '../hooks/useAuth';
import { useChapterLockStatus } from '../hooks/useChapterLockStatus';
import ApiService from '../services/ApiService';
import readingService from '../services/readingService';
import novelService from '../services/novelService';
import ChapterCommentSectionNew from '../components/ChapterCommentSection/ChapterCommentSectionNew';
import FavoriteButton from '../components/FavoriteButton/FavoriteButton';
import ReaderBottomBar from '../components/ReaderBottomBar/ReaderBottomBar';

const ChapterReader: React.FC = () => {
  const { novelId, chapterId } = useParams<{ novelId: string; chapterId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user: authUser } = useAuth();
  const { user: userData } = useUser();
  const [showChapterList, setShowChapterList] = useState(false);
  
  // 字体和行距范围常量
  const MIN_FONT_SIZE = 14;
  const MAX_FONT_SIZE = 48;
  const MIN_LINE_HEIGHT = 1.4;
  const MAX_LINE_HEIGHT = 3.0;
  
  // 从 localStorage 读取初始值，如果没有则使用默认值
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('readerFontSize');
    return saved ? parseInt(saved, 10) : 18;
  });
  const [lineHeight, setLineHeight] = useState(() => {
    const saved = localStorage.getItem('readerLineHeight');
    return saved ? parseFloat(saved) : 1.8;
  });
  
  // 底部控制条显隐状态
  const [showBottomBar, setShowBottomBar] = useState(true);
  const lastScrollYRef = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);
  
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
  
  // 使用认证Hook，无需手动管理用户状态（使用 useMemo 确保在所有地方都能正确访问）
  const user = useMemo(() => authUser || userData, [authUser, userData]);
  
  // 章节点赞/点踩（chapter_like）
  const [chapterLikeSummary, setChapterLikeSummary] = useState<{
    like_count: number;
    dislike_count: number;
    user_status: null | 0 | 1;
  }>({ like_count: 0, dislike_count: 0, user_status: null });
  const [chapterLikeLoading, setChapterLikeLoading] = useState(false);
  
  // 章节解锁状态 - 使用自定义 Hook
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [hasAutoOpenedUnlockModal, setHasAutoOpenedUnlockModal] = useState(false);
  const { isChapterLocked, isCheckingLockStatus, checkLockStatus } = useChapterLockStatus();

  // 监听章节锁定状态变化
  useEffect(() => {
    console.log('🔒 [ChapterReader] ========== 章节锁定状态变化 ==========');
    console.log('🔒 [ChapterReader] isChapterLocked:', isChapterLocked);
    console.log('🔒 [ChapterReader] isCheckingLockStatus:', isCheckingLockStatus);
    console.log('🔒 [ChapterReader] chapterData?.id:', chapterData?.id);
    console.log('🔒 [ChapterReader] chapterData?.unlock_price:', chapterData?.unlock_price);
    if (isChapterLocked) {
      console.log('🔒 [ChapterReader] 章节被锁定，将显示锁定界面');
    } else {
      console.log('🔓 [ChapterReader] 章节已解锁，将显示章节内容');
    }
    console.log('🔒 [ChapterReader] ======================================');
  }, [isChapterLocked, isCheckingLockStatus, chapterData]);

  // 自动打开解锁弹窗（当检测到章节锁定且检查完成时）
  useEffect(() => {
    if (
      isChapterLocked &&
      !isCheckingLockStatus &&
      user &&
      chapterId &&
      !showUnlockModal &&
      !hasAutoOpenedUnlockModal
    ) {
      console.log('🔓 [ChapterReader] 自动打开解锁弹窗');
      // 1. 启动时间解锁逻辑
      const startUnlock = async () => {
        try {
          console.log('⏰ 启动时间解锁:', { chapterId, userId: user.id });
          const response = await ApiService.request(`/chapter-unlock/start-time-unlock/${chapterId}/${user.id}`, {
            method: 'POST'
          });
          console.log('⏰ 时间解锁启动结果:', response.data);
        } catch (error) {
          console.error('❌ 启动时间解锁失败:', error);
        }
      };
      startUnlock();
      // 2. 打开弹窗
      setShowUnlockModal(true);
      setHasAutoOpenedUnlockModal(true);
    }
  }, [isChapterLocked, isCheckingLockStatus, user, chapterId, showUnlockModal, hasAutoOpenedUnlockModal]);

  // 使用 useMemo 缓存预览段落数量的计算结果
  const previewParagraphs = useMemo(() => {
    console.log('📊 [ChapterReader] ========== useMemo 计算 previewParagraphs ==========');
    console.log('📊 [ChapterReader] chapterData?.content 存在?:', !!chapterData?.content);
    console.log('📊 [ChapterReader] isChapterLocked:', isChapterLocked);
    
    if (!chapterData?.content) {
      console.log('📊 [ChapterReader] 章节内容不存在，返回 0');
      return 0;
    }
    
    const paragraphs = chapterData.content.split('\n');
    console.log('📊 [ChapterReader] 总段落数（包含空段落）:', paragraphs.length);
    
    // 过滤空段落（与渲染逻辑保持一致）
    const nonEmptyParagraphs = paragraphs.filter((p: string) => p.trim());
    console.log('📊 [ChapterReader] 非空段落数:', nonEmptyParagraphs.length);
    
    let result: number;
    if (isChapterLocked) {
      // 如果章节锁定，显示前1-2段，字数控制在100字左右
      let totalChars = 0;
      let previewCount = 0;
      const targetChars = 100; // 目标字数
      
      for (let i = 0; i < nonEmptyParagraphs.length; i++) {
        const paragraph = nonEmptyParagraphs[i];
        const paragraphChars = paragraph.trim().length;
        
        // 如果加上这段会超过100字，且已经有至少1段，就停止
        if (totalChars + paragraphChars > targetChars && previewCount >= 1) {
          break;
        }
        
        totalChars += paragraphChars;
        previewCount++;
        
        // 最多显示2段
        if (previewCount >= 2) {
          break;
        }
      }
      
      result = Math.max(1, previewCount); // 至少显示1段
      console.log('📊 [ChapterReader] 章节锁定，计算预览段落数:', previewCount, '->', result, `(字数: ${totalChars}字, 目标: ${targetChars}字)`);
    } else {
      // 如果章节未锁定，显示全部段落
      result = nonEmptyParagraphs.length;
      console.log('📊 [ChapterReader] 章节未锁定，显示全部段落:', result);
    }
    
    console.log('📊 [ChapterReader] 最终 previewParagraphs:', result);
    console.log('📊 [ChapterReader] ====================================================');
    return result;
  }, [chapterData?.content, isChapterLocked]);

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

  // 加载章节点赞/点踩摘要
  useEffect(() => {
    if (!chapterId) return;
    const loadSummary = async () => {
      try {
        setChapterLikeLoading(true);
        const resp = await ApiService.get(`/chapter-like/${chapterId}/summary`);
        if (resp && resp.success && resp.data) {
          setChapterLikeSummary({
            like_count: Number(resp.data.like_count || 0),
            dislike_count: Number(resp.data.dislike_count || 0),
            user_status:
              resp.data.user_status === 0 || resp.data.user_status === 1 ? resp.data.user_status : null
          });
        }
      } catch (e) {
        console.error('加载章节点赞/点踩摘要失败:', e);
      } finally {
        setChapterLikeLoading(false);
      }
    };
    loadSummary();
  }, [chapterId]);

  const handleChapterLikeAction = async (isLike: 0 | 1) => {
    if (!chapterId) return;
    try {
      setChapterLikeLoading(true);
      const resp = await ApiService.post(`/chapter-like/${chapterId}`, { is_like: isLike });
      if (resp && resp.success && resp.data) {
        setChapterLikeSummary({
          like_count: Number(resp.data.like_count || 0),
          dislike_count: Number(resp.data.dislike_count || 0),
          user_status:
            resp.data.user_status === 0 || resp.data.user_status === 1 ? resp.data.user_status : null
        });
      }
    } catch (e: any) {
      // ApiService 401 会清 token 并抛出 ApiError
      const msg = e?.message ? String(e.message) : '操作失败';
      if (String(msg).includes('认证失败') || String(msg).includes('登录')) {
        alert('请先登录后再点赞/点踩');
        const currentPath = `/novel/${novelId}/chapter/${chapterId}`;
        navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
        return;
      }
      console.error('章节点赞/点踩失败:', e);
      alert('操作失败，请稍后重试');
    } finally {
      setChapterLikeLoading(false);
    }
  };

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
        let chapter;
        try {
          chapter = await novelService.getChapterContent(parseInt(chapterId), user?.id);
          console.log('📖 章节内容加载成功:', chapter.title);
          console.log('📖 [ChapterReader] ========== 章节数据详情 ==========');
          console.log('📖 [ChapterReader] 章节ID:', chapter.id);
          console.log('📖 [ChapterReader] 章节标题:', chapter.title);
          console.log('📖 [ChapterReader] 章节完整数据对象:', chapter);
          console.log('📖 [ChapterReader] unlock_price (原始值):', chapter.unlock_price);
          console.log('📖 [ChapterReader] unlock_price (类型):', typeof chapter.unlock_price);
          console.log('📖 [ChapterReader] unlock_price === null?:', chapter.unlock_price === null);
          console.log('📖 [ChapterReader] unlock_price === undefined?:', chapter.unlock_price === undefined);
          console.log('📖 [ChapterReader] unlock_price == 0?:', chapter.unlock_price == 0);
          console.log('📖 [ChapterReader] unlock_price > 0?:', (chapter.unlock_price && chapter.unlock_price > 0));
          console.log('📖 [ChapterReader] !!chapter.unlock_price:', !!chapter.unlock_price);
          console.log('📖 [ChapterReader] Number(chapter.unlock_price):', Number(chapter.unlock_price));
          console.log('📖 [ChapterReader] 章节内容长度:', chapter.content?.length || 0);
          console.log('📖 [ChapterReader] 章节数据的所有键:', Object.keys(chapter));
          console.log('📖 [ChapterReader] ======================================');
          setChapterData(chapter);
        } catch (chapterError: any) {
          // 处理可见性错误
          if (chapterError.code === 'CHAPTER_NOT_ACCESSIBLE') {
            setError('This chapter is only available as Champion advance reading.');
            setLoading(false);
            return;
          }
          if (chapterError.code === 'CHAPTER_NOT_RELEASED') {
            setError('This chapter has not been released yet.');
            setLoading(false);
            return;
          }
          throw chapterError;
        }
        
        // 使用自定义 Hook 检查章节锁定状态
        if (chapter) {
          console.log('🔍 [ChapterReader] 准备调用 checkLockStatus...');
          console.log('🔍 [ChapterReader] 当前 isChapterLocked 状态:', isChapterLocked);
          await checkLockStatus(chapter, user);
          console.log('🔍 [ChapterReader] checkLockStatus 调用完成');
          console.log('🔍 [ChapterReader] 调用后 isChapterLocked 状态:', isChapterLocked);
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

  // 调试日志：检查章节导航数据
  useEffect(() => {
    if (chapterData) {
      console.log('📊 [ChapterReader] ========== 章节导航数据检查 ==========');
      console.log('📊 [ChapterReader] 章节ID:', chapterData.id);
      console.log('📊 [ChapterReader] 章节号:', chapterData.chapter_number);
      console.log('📊 [ChapterReader] has_prev (原始值):', chapterData.has_prev, '| 类型:', typeof chapterData.has_prev);
      console.log('📊 [ChapterReader] has_next (原始值):', chapterData.has_next, '| 类型:', typeof chapterData.has_next);
      console.log('📊 [ChapterReader] prev_chapter_id:', chapterData.prev_chapter_id, '| 是否为null:', chapterData.prev_chapter_id === null, '| 是否为undefined:', chapterData.prev_chapter_id === undefined);
      console.log('📊 [ChapterReader] next_chapter_id:', chapterData.next_chapter_id, '| 是否为null:', chapterData.next_chapter_id === null, '| 是否为undefined:', chapterData.next_chapter_id === undefined);
      console.log('📊 [ChapterReader] !!has_prev:', !!chapterData.has_prev);
      console.log('📊 [ChapterReader] !!has_next:', !!chapterData.has_next);
      
      // 计算按钮应该的状态
      const prevButtonShouldBeEnabled = !!(chapterData.has_prev && chapterData.prev_chapter_id);
      const nextButtonShouldBeEnabled = !!(chapterData.has_next && chapterData.next_chapter_id);
      
      console.log('📊 [ChapterReader] ========== 按钮状态预期 ==========');
      console.log('📊 [ChapterReader] Prev 按钮应该启用:', prevButtonShouldBeEnabled);
      console.log('📊 [ChapterReader] Next 按钮应该启用:', nextButtonShouldBeEnabled);
      console.log('📊 [ChapterReader] Prev 按钮应该禁用:', !prevButtonShouldBeEnabled);
      console.log('📊 [ChapterReader] Next 按钮应该禁用:', !nextButtonShouldBeEnabled);
      console.log('📊 [ChapterReader] ======================================');
    }
  }, [chapterData]);

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
        const chaptersList = await novelService.getNovelChapters(parseInt(novelId), user?.id);
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
  }, [novelId, user]);

  // 处理章节点击
  const handleChapterClick = (chapter: any) => {
    console.log('点击章节:', chapter);
    // 使用真实的章节ID进行导航
    navigate(`/novel/${novelId}/chapter/${chapter.id}`);
    setShowChapterList(false);
  };

  const handlePrevChapter = () => {
    console.log('🔵 [handlePrevChapter] 函数被调用');
    console.log('🔵 [handlePrevChapter] chapterData:', chapterData);
    console.log('🔵 [handlePrevChapter] chapterData?.has_prev:', chapterData?.has_prev);
    console.log('🔵 [handlePrevChapter] chapterData?.prev_chapter_id:', chapterData?.prev_chapter_id);
    console.log('🔵 [handlePrevChapter] novelId:', novelId);
    
    if (chapterData?.has_prev && chapterData.prev_chapter_id) {
      const targetUrl = `/novel/${novelId}/chapter/${chapterData.prev_chapter_id}`;
      console.log('🔵 [handlePrevChapter] ✅ 条件满足，准备跳转到:', targetUrl);
      navigate(targetUrl);
    } else {
      console.log('🔵 [handlePrevChapter] ❌ 条件不满足，无法跳转');
      console.log('🔵 [handlePrevChapter] - has_prev:', chapterData?.has_prev);
      console.log('🔵 [handlePrevChapter] - prev_chapter_id:', chapterData?.prev_chapter_id);
    }
  };

  const handleNextChapter = () => {
    console.log('🟢 [handleNextChapter] 函数被调用');
    console.log('🟢 [handleNextChapter] chapterData:', chapterData);
    console.log('🟢 [handleNextChapter] chapterData?.has_next:', chapterData?.has_next);
    console.log('🟢 [handleNextChapter] chapterData?.next_chapter_id:', chapterData?.next_chapter_id);
    console.log('🟢 [handleNextChapter] novelId:', novelId);
    
    if (chapterData?.has_next && chapterData.next_chapter_id) {
      const targetUrl = `/novel/${novelId}/chapter/${chapterData.next_chapter_id}`;
      console.log('🟢 [handleNextChapter] ✅ 条件满足，准备跳转到:', targetUrl);
      navigate(targetUrl);
    } else {
      console.log('🟢 [handleNextChapter] ❌ 条件不满足，无法跳转');
      console.log('🟢 [handleNextChapter] - has_next:', chapterData?.has_next);
      console.log('🟢 [handleNextChapter] - next_chapter_id:', chapterData?.next_chapter_id);
    }
  };

  // 字体大小和行距的封装函数
  // 修复：统一范围控制，避免子组件重复 clamp
  // TODO：后续可以在阅读设置中新增字体家族、主题等选项
  const handleChangeFontSize = (size: number) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
    setFontSize(clamped);
    localStorage.setItem('readerFontSize', String(clamped));
  };

  const handleChangeLineHeight = (lh: number) => {
    const clamped = Math.min(MAX_LINE_HEIGHT, Math.max(MIN_LINE_HEIGHT, lh));
    setLineHeight(clamped);
    localStorage.setItem('readerLineHeight', String(clamped));
  };

  // 切换章节列表
  const handleToggleChapters = () => {
    setShowChapterList((prev) => !prev);
  };

  // 监听窗口滚动，判断向上/向下
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY || window.pageYOffset;

      // 小范围波动忽略
      const delta = currentY - lastScrollYRef.current;

      // 向下滚动，且超过一定阈值 => 隐藏
      if (delta > 10 && currentY > 100) {
        if (showBottomBar) setShowBottomBar(false);
      }
      // 向上滚动 => 显示
      else if (delta < -10) {
        if (!showBottomBar) setShowBottomBar(true);
      }

      lastScrollYRef.current = currentY;

      // 可选：滑动停止后自动显示一次（增强可发现性）
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        setShowBottomBar(true);
      }, 800);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [showBottomBar]);

  // 键盘快捷键：左右方向键切换章节
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框中触发
      if ((e.target as HTMLElement).tagName === 'INPUT' || 
          (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (chapterData?.has_prev && chapterData.prev_chapter_id) {
          navigate(`/novel/${novelId}/chapter/${chapterData.prev_chapter_id}`);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (chapterData?.has_next && chapterData.next_chapter_id) {
          navigate(`/novel/${novelId}/chapter/${chapterData.next_chapter_id}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [chapterData, novelId, navigate]);

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
    setHasAutoOpenedUnlockModal(false); // 重置自动打开标志，允许下次解锁时再次自动打开
    // 重新加载章节内容以更新锁定状态
    if (chapterData && user) {
      checkLockStatus(chapterData, user);
    }
    // 重新加载章节内容
    window.location.reload();
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

  // 检查章节访问权限（已改为自动打开弹窗，此函数保留用于其他可能的调用）
  const checkChapterAccess = async () => {
    if (isChapterLocked && user && chapterId) {
      console.log('🔒 章节被锁定，启动时间解锁流程');
      // 启动时间解锁
      await startTimeUnlock(parseInt(chapterId, 10), user.id);
      // 不再手动设置 showUnlockModal，由 useEffect 自动处理
      return false;
    }
    return true;
  };


  // 加载状态
  if (loading) {
    return (
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'inherit' }}>
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
      const chapter = await novelService.getChapterContent(parseInt(chapterId), user?.id);
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
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'inherit' }}>
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
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <NavBar />
      

      {/* 章节导航栏 */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        borderBottom: '1px solid var(--border-color)',
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
            <span style={{ color: 'var(--text-secondary)' }}>|</span>
            <span style={{ fontWeight: 600, fontSize: 18 }}>{chapterData.novel_title}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button 
              onClick={() => handleChangeFontSize(fontSize - 2)}
              style={{ 
                background: 'var(--bg-tertiary)', 
                border: 'none', 
                color: 'var(--text-primary)', 
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              A-
            </button>
            <button 
              onClick={() => handleChangeFontSize(fontSize + 2)}
              style={{ 
                background: 'var(--bg-tertiary)', 
                border: 'none', 
                color: 'var(--text-primary)', 
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
        padding: '40px 24px 96px', // 底部预留 96px 避免被底部控制条遮挡
        lineHeight: lineHeight,
        fontSize: fontSize
      }}>
        {/* 章节标题 */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: 40,
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: 20
        }}>
          <h1 style={{ 
            fontSize: 28, 
            fontWeight: 700, 
            margin: '0 0 8px 0',
            color: 'var(--text-primary)'
          }}>
            {chapterData.title}
          </h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>Chapter {chapterData.chapter_number}</span>
            {chapterData.is_advance && (
              <span style={{ 
                background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Champion Advance
              </span>
            )}
          </div>
        </div>

        {/* 章节内容 */}
        <div style={{ 
          color: 'var(--text-primary)',
          fontSize: fontSize,
          lineHeight: lineHeight,
          textAlign: 'justify',
          marginBottom: 60
        }}>
          {/* 权限检查加载提示 */}
          {isCheckingLockStatus && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#ccc',
              fontSize: '16px'
            }}>
              <div style={{ marginBottom: '16px' }}>⏳ 正在检查章节访问权限...</div>
            </div>
          )}

          {chapterData.content && !isCheckingLockStatus ? (
            // 章节内容渲染
            (() => {
              console.log('📝 [ChapterReader] ========== 开始渲染章节内容 ==========');
              console.log('📝 [ChapterReader] isChapterLocked:', isChapterLocked);
              console.log('📝 [ChapterReader] previewParagraphs (useMemo 缓存值):', previewParagraphs);
              console.log('📝 [ChapterReader] isCheckingLockStatus:', isCheckingLockStatus);
              
              const paragraphs = chapterData.content.split('\n');
              console.log('📝 [ChapterReader] 总段落数（包含空段落）:', paragraphs.length);
              
              // 使用 useMemo 缓存的预览段落数量
              // 跟踪已渲染的非空段落数量
              let renderedNonEmptyCount = 0;
              let totalRendered = 0;
              let previewRendered = 0;
              
              return paragraphs.map((paragraph: string, index: number) => {
                // 过滤空段落和只有空格的段落
                const trimmedParagraph = paragraph.trim();
                if (!trimmedParagraph) return null;
                
                totalRendered++;
                
                // 判断当前段落是否在预览范围内（使用缓存的 previewParagraphs）
                const isPreview = renderedNonEmptyCount < previewParagraphs;
                if (isPreview) {
                  previewRendered++;
                }
                renderedNonEmptyCount++;
                
                // 如果不在预览范围内，且章节被锁定，则不显示该段落
                if (isChapterLocked && !isPreview) {
                  return null;
                }
                
                const commentCount = paragraphComments[index] || 0;
                
                if (index < 5 || !isPreview) { // 只记录前5段或非预览段落
                  console.log(`📝 [ChapterReader] 段落 ${index} (非空索引 ${renderedNonEmptyCount - 1}):`, {
                    trimmedParagraph: trimmedParagraph.substring(0, 20) + '...',
                    commentCount,
                    isPreview,
                    paragraphLength: trimmedParagraph.length,
                    renderedNonEmptyCount,
                    previewParagraphs
                  });
                }
                
                // 在最后一个预览段落时记录总结
                if (renderedNonEmptyCount === previewParagraphs && isPreview) {
                  console.log('📝 [ChapterReader] ========== 预览段落渲染总结 ==========');
                  console.log('📝 [ChapterReader] 总段落数:', paragraphs.length);
                  console.log('📝 [ChapterReader] 非空段落数:', renderedNonEmptyCount);
                  console.log('📝 [ChapterReader] 预览段落数:', previewParagraphs);
                  console.log('📝 [ChapterReader] 实际渲染的预览段落数:', previewRendered);
                  console.log('📝 [ChapterReader] isChapterLocked:', isChapterLocked);
                  console.log('📝 [ChapterReader] ======================================');
                }

                return (
                  <React.Fragment key={index}>
                    <div style={{ display: 'block', width: '100%' }}>
                      <div style={{ 
                        margin: '0 0 24px 0',
                        position: 'relative',
                        opacity: 1,
                        filter: 'none',
                        display: 'block',
                        width: '100%',
                      }}>
                        <p style={{ 
                          textIndent: '2em', // 首行缩进
                          lineHeight: lineHeight,
                          fontSize: fontSize, // 修复：显式使用 fontSize 控制段落字体，避免只改行距
                          margin: '0 0 0 0',
                          display: 'block',
                          width: '100%',
                        }}>
                          {trimmedParagraph}
                          {isPreview && (
                            <ParagraphComment
                              chapterId={parseInt(chapterId!)}
                              paragraphIndex={index}
                              commentCount={commentCount}
                              user={user}
                              onCommentAdded={handleCommentAdded}
                            />
                          )}
                        </p>
                      </div>
                    </div>
                    {/* 在最后一个预览段落后显示解锁窗口 */}
                    {isChapterLocked && renderedNonEmptyCount === previewParagraphs && isPreview && showUnlockModal && user && chapterId && (
                      <ChapterUnlockModal
                        isOpen={showUnlockModal}
                        onClose={() => {}} // 不允许关闭
                        chapterId={parseInt(chapterId)}
                        novelId={parseInt(novelId!)}
                        userId={user.id}
                        onUnlockSuccess={handleUnlockSuccess}
                      />
                    )}
                  </React.Fragment>
                );
              });
            })()
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>章节内容暂不可用</p>
          )}
        </div>

        {/* 收藏按钮 */}
        {isAuthenticated && userData && (
          <div style={{ 
            position: 'relative',
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

            {/* 章节点赞（精简为单按钮，可再次点击取消） */}
            <button
              onClick={() => handleChapterLikeAction(1)}
              disabled={chapterLikeLoading}
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 28px',
                border: '2px solid var(--border-color)',
                borderRadius: 30,
                background: chapterLikeSummary.user_status === 1 ? '#1976d2' : 'var(--bg-secondary)',
                color: chapterLikeSummary.user_status === 1 ? '#fff' : 'var(--text-primary)',
                fontSize: 18,
                cursor: chapterLikeLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                userSelect: 'none',
                fontWeight: 700,
                opacity: chapterLikeLoading ? 0.7 : 1
              }}
              title={chapterLikeSummary.user_status === 1 ? '取消喜欢' : '我喜欢'}
            >
              <span style={{ fontSize: 18, fontWeight: 800 }}>I LIKE</span>
              <span
                style={{
                  minWidth: 28,
                  textAlign: 'center',
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  fontSize: 16,
                  fontWeight: 800
                }}
              >
                {chapterLikeSummary.like_count}
              </span>
            </button>
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
            onClick={(e) => {
              console.log('🖱️ [内容区 Prev 按钮] 点击事件触发');
              console.log('🖱️ [内容区 Prev 按钮] event:', e);
              console.log('🖱️ [内容区 Prev 按钮] button disabled:', !chapterData.has_prev);
              console.log('🖱️ [内容区 Prev 按钮] chapterData.has_prev:', chapterData.has_prev);
              if (!chapterData.has_prev) {
                console.log('🖱️ [内容区 Prev 按钮] ⚠️ 按钮被禁用，点击无效');
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              handlePrevChapter();
            }}
            disabled={!chapterData.has_prev}
            style={{ 
              background: chapterData.has_prev ? '#1976d2' : '#333',
              border: 'none',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              cursor: chapterData.has_prev ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: 16,
              pointerEvents: chapterData.has_prev ? 'auto' : 'none',
            }}
          >
            ← Previous Chapter
          </button>
          
          <div style={{ color: '#666', fontSize: 14 }}>
            Chapter {chapterData.chapter_number}
          </div>
          
          <button 
            onClick={(e) => {
              console.log('🖱️ [内容区 Next 按钮] 点击事件触发');
              console.log('🖱️ [内容区 Next 按钮] event:', e);
              console.log('🖱️ [内容区 Next 按钮] button disabled:', !chapterData.has_next);
              console.log('🖱️ [内容区 Next 按钮] chapterData.has_next:', chapterData.has_next);
              if (!chapterData.has_next) {
                console.log('🖱️ [内容区 Next 按钮] ⚠️ 按钮被禁用，点击无效');
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              handleNextChapter();
            }}
            disabled={!chapterData.has_next}
            style={{ 
              background: chapterData.has_next ? '#1976d2' : '#333',
              border: 'none',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              cursor: chapterData.has_next ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: 16,
              pointerEvents: chapterData.has_next ? 'auto' : 'none',
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
        <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 28, marginBottom: 24 }}>Related Novels</div>
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
            <div key={idx} style={{ width: 160, background: 'var(--bg-secondary)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px var(--shadow-color)', marginRight: 8, flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <img src={novel.cover} alt={novel.title} style={{ width: '100%', height: 220, objectFit: 'cover' }} />
                <span style={{ position: 'absolute', top: 8, left: 8, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>{novel.status}</span>
              </div>
              <div style={{ padding: '12px 10px 8px 10px' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16, marginBottom: 4, lineHeight: 1.3 }}>{novel.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 4 }}>👍 {novel.rating}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      
      {/* 底部阅读控制条 */}
      {chapterData && (() => {
        const hasPrevValue = !!chapterData.has_prev;
        const hasNextValue = !!chapterData.has_next;
        
        console.log('📤 [ChapterReader] ========== 传递给 ReaderBottomBar 的 props ==========');
        console.log('📤 [ChapterReader] visible:', showBottomBar);
        console.log('📤 [ChapterReader] hasPrev (转换后):', hasPrevValue);
        console.log('📤 [ChapterReader] hasNext (转换后):', hasNextValue);
        console.log('📤 [ChapterReader] chapterData.has_prev (原始值):', chapterData.has_prev);
        console.log('📤 [ChapterReader] chapterData.has_next (原始值):', chapterData.has_next);
        console.log('📤 [ChapterReader] onPrev 函数类型:', typeof handlePrevChapter);
        console.log('📤 [ChapterReader] onNext 函数类型:', typeof handleNextChapter);
        console.log('📤 [ChapterReader] ====================================================');
        
        return (
          <ReaderBottomBar
            visible={showBottomBar}
            novelTitle={chapterData.novel_title || ''}
            chapterTitle={chapterData.title || ''}
            chapterNumber={chapterData.chapter_number}
            fontSize={fontSize}
            lineHeight={lineHeight}
            onFontSizeChange={handleChangeFontSize}
            onLineHeightChange={handleChangeLineHeight}
            hasPrev={hasPrevValue}
            hasNext={hasNextValue}
            onPrev={handlePrevChapter}
            onNext={handleNextChapter}
            onToggleChapters={handleToggleChapters}
          />
        );
      })()}
      
      <Footer />
    </div>
  );
};

export default ChapterReader;
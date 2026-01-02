import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import ApiService from '../services/ApiService';
import { getApiBaseUrl } from '../config';
import ScheduleReleaseModal from '../components/ScheduleReleaseModal/ScheduleReleaseModal';
import Toast from '../components/Toast/Toast';
import ChapterUpdateConfirmDialog from '../components/ChapterUpdateConfirmDialog/ChapterUpdateConfirmDialog';
import styles from './ChapterWriter.module.css';

interface ChapterInfo {
  id: number | null;
  chapter_number: number;
  title: string;
  content: string;
  translator_note: string;
  release_date?: string | null;
}

interface Note {
  id: number;
  user_id: number;
  novel_id: number;
  random_note: string;
  created_at: string;
  updated_at: string;
}

const ChapterWriter: React.FC = () => {
  const [searchParams] = useSearchParams();
  const novelId = searchParams.get('novelId') || searchParams.get('novelid');
  const title = searchParams.get('title') || '';
  // 支持 chapterId 和 chapterld（小写L）两种参数名
  const chapterId = searchParams.get('chapterId') || searchParams.get('chapterld') || null; // 如果是编辑现有章节
  
  const { user, isAuthenticated } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // 编辑器状态
  const [chapterInfo, setChapterInfo] = useState<ChapterInfo>({
    id: null,
    chapter_number: 1,
    title: '',
    content: '',
    translator_note: ''
  });

  // UI状态
  const [editorMode, setEditorMode] = useState<'day' | 'night' | 'eye-care'>('eye-care');
  const [fontSize, setFontSize] = useState(22);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [replaceTab, setReplaceTab] = useState<'find' | 'replace'>('replace'); // 当前激活的标签页
  const [replaceFind, setReplaceFind] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [replaceMatches, setReplaceMatches] = useState({ current: 0, total: 0 });
  const [highlightedContent, setHighlightedContent] = useState<string>(''); // 高亮后的内容（HTML）
  const [showHighlight, setShowHighlight] = useState(false); // 是否显示高亮
  const findDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 保存状态
  const [savedToCloud, setSavedToCloud] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLayouting, setIsLayouting] = useState(false); // AI 排版加载状态
  const [previousChapter, setPreviousChapter] = useState<any>(null);
  
  // 定时发布相关状态
  const [lastChapterStatus, setLastChapterStatus] = useState<{ review_status: string | null; is_released: number | null; release_date: string | null } | null>(null);
  const [currentChapterStatus, setCurrentChapterStatus] = useState<{ review_status: string; is_released: number } | null>(null);
  const [prevChapterStatus, setPrevChapterStatus] = useState<{ review_status: string | null; is_released: number | null; release_date: string | null } | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingChapterStatus, setIsLoadingChapterStatus] = useState(false); // 是否正在加载章节状态
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [showUpdateConfirmDialog, setShowUpdateConfirmDialog] = useState(false);
  const [existingChapter, setExistingChapter] = useState<{ id: number; title: string; review_status: string; is_released: number; release_date: string | null; created_at: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<'draft' | 'publish' | 'schedule' | null>(null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  
  // 历史版本状态
  const [showHistory, setShowHistory] = useState(false); // 是否显示历史版本侧边栏
  const [historyVersions, setHistoryVersions] = useState<any[]>([]); // 历史版本列表
  const [selectedVersion, setSelectedVersion] = useState<any>(null); // 当前选中的版本
  const [loadingHistory, setLoadingHistory] = useState(false); // 加载历史版本状态
  const [currentVersionId, setCurrentVersionId] = useState<number | null>(null); // 当前版本的ID
  
  // 自动保存相关状态
  const lastSavedContentRef = useRef<string>(''); // 上次保存的内容
  const lastSavedTitleRef = useRef<string>(''); // 上次保存的标题
  const lastSavedNoteRef = useRef<string>(''); // 上次保存的译者备注
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null); // 自动保存定时器
  const lastChangeTimeRef = useRef<number>(0); // 最后一次修改的时间
  const hasUnsavedChangesRef = useRef<boolean>(false); // 是否有未保存的改动

  // 作者有话说状态
  const [authorNote2, setAuthorNote2] = useState('');

  // 随记状态
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteSearchKeyword, setNoteSearchKeyword] = useState('');
  const [searchHighlight, setSearchHighlight] = useState(''); // 当前搜索的高亮文字
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteModalContent, setNoteModalContent] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [hasMoreNotes, setHasMoreNotes] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [notesCollapsed, setNotesCollapsed] = useState(false); // 随记部分是否收起
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // 整个侧边栏是否收缩

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // 加载上一章节信息和状态
  useEffect(() => {
    if (novelId) {
      loadPreviousChapter();
      if (chapterId) {
        // 编辑章节：加载当前章节状态和前一章节状态
        // loadChapter已经会设置currentChapterStatus，所以不需要再调用loadCurrentChapterStatus
        loadChapter();
        loadPrevChapterStatus();
      } else {
        // 新建章节：加载最后一章节状态
        loadLastChapterStatus();
        loadNextChapterNumber();
      }
    }
  }, [novelId, chapterId]);

  // 加载随记列表
  useEffect(() => {
    if (novelId && user) {
      loadNotes(1, noteSearchKeyword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novelId, user?.id]);

  // 加载随记列表
  const loadNotes = async (page = 1, keyword = '') => {
    if (!novelId || !user) return;
    
    setLoadingNotes(true);
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const params = new URLSearchParams({
        novel_id: novelId,
        page: page.toString(),
        limit: '10'
      });
      if (keyword) {
        params.append('keyword', keyword);
      }

      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(`${base}/random-notes/list?user_id=${user.id}&${params.toString()}`, {
        method: 'GET',
        headers
      });

      const result = await response.json();
      
      if (result.success) {
        if (page === 1) {
          setNotes(result.data);
        } else {
          setNotes(prev => [...prev, ...result.data]);
        }
        setHasMoreNotes(result.pagination.hasMore);
        setCurrentPage(page);
      } else {
        console.error('加载随记失败:', result.message);
      }
    } catch (error) {
      console.error('加载随记失败:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  // 搜索随记（从服务器搜索）
  const handleSearchNotesFromServer = () => {
    setCurrentPage(1);
    loadNotes(1, noteSearchKeyword);
  };

  // 在当前显示的随记列表中搜索文字并高亮
  const handleSearchInNotes = () => {
    const searchText = noteSearchKeyword.trim();
    
    if (!searchText) {
      alert(language === 'zh' ? '请输入要搜索的文字' : 'Please enter text to search');
      return;
    }

    // 清空之前的高亮
    setSearchHighlight('');

    // 在当前显示的随记中搜索
    const found = notes.some(note => {
      const title = `随记${note.id}`;
      const content = note.random_note || '';
      return title.includes(searchText) || content.includes(searchText);
    });

    if (found) {
      // 找到匹配，设置高亮文字
      setSearchHighlight(searchText);
    } else {
      // 没找到，弹出提示
      alert(language === 'zh' ? `没有搜索到"${searchText}"` : `No results found for "${searchText}"`);
    }
  };

  // 高亮文字的函数
  const highlightText = (text: string, highlight: string) => {
    if (!highlight || !text) return text;
    
    const parts = text.split(highlight);
    if (parts.length === 1) return text; // 没有匹配
    
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        result.push(<mark key={`highlight-${i}`} className={styles.searchHighlight}>{highlight}</mark>);
      }
      if (parts[i]) {
        result.push(parts[i]);
      }
    }
    return result;
  };

  // 创建或更新随记
  const handleSaveNote = async () => {
    if (!novelId || !user || !noteModalContent.trim()) {
      alert(language === 'zh' ? '请输入随记内容' : 'Please enter note content');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let response;
      if (editingNote) {
        // 更新随记
        const base = getApiBaseUrl();
        if (!base) {
          throw new Error('API base url is not configured');
        }
        response = await fetch(`${base}/random-notes/update/${editingNote.id}?user_id=${user.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            random_note: noteModalContent.trim()
          })
        });
      } else {
        // 创建随记
        const base = getApiBaseUrl();
        if (!base) {
          throw new Error('API base url is not configured');
        }
        response = await fetch(`${base}/random-notes/create?user_id=${user.id}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            novel_id: parseInt(novelId),
            random_note: noteModalContent.trim()
          })
        });
      }

      const result = await response.json();
      
      if (result.success) {
        setShowNoteModal(false);
        setEditingNote(null);
        setNoteModalContent('');
        // 重新加载随记列表
        loadNotes(1, noteSearchKeyword);
      } else {
        alert(result.message || (language === 'zh' ? '保存随记失败' : 'Failed to save note'));
      }
    } catch (error) {
      console.error('保存随记失败:', error);
      alert(language === 'zh' ? '保存随记失败' : 'Failed to save note');
    }
  };

  // 删除随记
  const handleDeleteNote = async (noteId: number) => {
    if (!user) return;
    
    if (!window.confirm(language === 'zh' ? '确定要删除这条随记吗？' : 'Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(`${base}/random-notes/delete/${noteId}?user_id=${user.id}`, {
        method: 'DELETE',
        headers
      });

      const result = await response.json();
      
      if (result.success) {
        // 重新加载随记列表
        loadNotes(1, noteSearchKeyword);
      } else {
        alert(result.message || (language === 'zh' ? '删除随记失败' : 'Failed to delete note'));
      }
    } catch (error) {
      console.error('删除随记失败:', error);
      alert(language === 'zh' ? '删除随记失败' : 'Failed to delete note');
    }
  };

  // 打开新建随记模态框
  const handleNewNote = () => {
    setEditingNote(null);
    setNoteModalContent('');
    setShowNoteModal(true);
  };

  // 打开编辑随记模态框
  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteModalContent(note.random_note);
    setShowNoteModal(true);
  };

  // 加载更多随记
  const handleLoadMore = () => {
    if (!loadingNotes && hasMoreNotes) {
      loadNotes(currentPage + 1, noteSearchKeyword);
    }
  };


  // 加载章节
  const loadChapter = async () => {
    if (!chapterId) return;
    setIsLoadingChapterStatus(true);
    try {
      const response = await ApiService.get(`/chapter/${chapterId}`);
      const chapter = (response.data || response) as any;
      const chapterContent = chapter.content || '';
      const chapterTitle = chapter.title || '';
      const chapterNote = chapter.translator_note || '';
      
      setChapterInfo({
        id: chapter.id,
        chapter_number: chapter.chapter_number || 1,
        title: chapterTitle,
        content: chapterContent,
        translator_note: chapterNote,
        release_date: chapter.release_date || null
      });
      updateWordCount(chapterContent);
      if (chapter.translator_note) {
        setAuthorNote2(chapterNote);
      }
      
      // 保存当前章节状态（用于判断按钮状态）
      // 确保正确设置review_status和is_released
      const reviewStatus = chapter.review_status || 'draft';
      const isReleased = chapter.is_released !== undefined && chapter.is_released !== null 
        ? (chapter.is_released === 1 || chapter.is_released === true ? 1 : 0)
        : 0;
      
      setCurrentChapterStatus({
        review_status: reviewStatus,
        is_released: isReleased
      });
      
      
      // 初始化自动保存的基准内容
      lastSavedContentRef.current = chapterContent;
      lastSavedTitleRef.current = chapterTitle;
      lastSavedNoteRef.current = chapterNote;
      hasUnsavedChangesRef.current = false;
      
      // 加载历史版本列表（如果历史版本侧边栏已打开）
      if (showHistory) {
        // 使用 setTimeout 确保 chapterInfo 状态已更新
        setTimeout(() => {
          loadHistoryVersions();
        }, 100);
      }
    } catch (error) {
      console.error('加载章节失败:', error);
      // 即使加载失败，也设置一个默认状态，避免按钮永远不显示
      setCurrentChapterStatus({
        review_status: 'draft',
        is_released: 0
      });
    } finally {
      setIsLoadingChapterStatus(false);
    }
  };

  
  // 当历史侧边栏打开时，加载历史版本
  useEffect(() => {
    if (showHistory && novelId && user && chapterInfo.chapter_number > 0 && historyVersions.length === 0) {
      loadHistoryVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory]);
  
  // 加载历史版本列表
  const loadHistoryVersions = async () => {
    if (!novelId || !user || !chapterInfo.chapter_number) return;
    
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(
        `${base}/draft/list?novel_id=${novelId}&chapter_number=${chapterInfo.chapter_number}`,
        {
          method: 'GET',
          headers
        }
      );

      const result = await response.json();
      
      if (result.success && result.data) {
        // 按创建时间降序排列，只保留最近10个版本
        const versions = result.data.slice(0, 10).map((v: any) => ({
          id: v.id,
          title: v.title || '',
          content: v.content || '',
          translator_note: v.translator_note || '',
          word_count: v.word_count || 0,
          created_at: v.created_at
        }));
        
        setHistoryVersions(versions);
        
        // 设置当前版本ID（最新的版本或与当前内容匹配的版本）
        if (versions.length > 0) {
          // 检查哪个版本与当前内容匹配
          const currentContent = chapterInfo.content || '';
          const currentTitle = chapterInfo.title || '';
          const currentNote = authorNote2.trim() || '';
          
          const matchingVersion = versions.find((v: any) => 
            v.content === currentContent && 
            v.title === currentTitle && 
            v.translator_note === currentNote
          );
          
          if (matchingVersion) {
            setCurrentVersionId(matchingVersion.id);
            setSelectedVersion(null); // 当前版本不需要选中
          } else {
            // 如果没有匹配的，认为最新的是当前版本
            setCurrentVersionId(versions[0].id);
            setSelectedVersion(null);
          }
        }
      }
    } catch (error) {
      console.error('加载历史版本失败:', error);
    } finally {
      setLoadingHistory(false);
    }
  };
  
  // 切换历史版本侧边栏
  const toggleHistory = () => {
    setShowHistory(!showHistory);
    // 历史版本加载将在 useEffect 中处理
  };
  
  // 选择版本（在编辑区域显示）
  const handleSelectVersion = (version: any) => {
    setSelectedVersion(version);
    // 在编辑区域显示该版本的内容
    setChapterInfo(prev => ({
      ...prev,
      title: version.title,
      content: version.content
    }));
    setAuthorNote2(version.translator_note || '');
    updateWordCount(version.content || '');
  };
  
  // 恢复版本（将内容填充到编辑框）
  const handleRestoreVersion = () => {
    if (!selectedVersion) return;
    
    // 直接将选中版本的内容填充到编辑框
    setChapterInfo(prev => ({
      ...prev,
      title: selectedVersion.title || prev.title,
      content: selectedVersion.content || prev.content
    }));
    setAuthorNote2(selectedVersion.translator_note || '');
    updateWordCount(selectedVersion.content || '');
    
    // 更新当前版本ID为恢复的版本
    setCurrentVersionId(selectedVersion.id);
    setSelectedVersion(null); // 恢复后清除选中状态
    
    // 更新自动保存的基准内容
    lastSavedContentRef.current = selectedVersion.content || '';
    lastSavedTitleRef.current = selectedVersion.title || '';
    lastSavedNoteRef.current = selectedVersion.translator_note || '';
    hasUnsavedChangesRef.current = true; // 标记为已改动，用户可以继续编辑
    
    // 提示用户
    alert(language === 'zh' ? '版本已恢复到编辑框，请记得保存' : 'Version restored to editor, please remember to save');
  };

  // 加载上一章节信息
  const loadPreviousChapter = async () => {
    if (!novelId) return;
    try {
      const response = await ApiService.get(`/chapters/novel/${novelId}?sort=desc&limit=1`);
      const chapters = response.data || response;
      if (Array.isArray(chapters) && chapters.length > 0) {
        setPreviousChapter(chapters[0]);
      }
    } catch (error) {
      console.error('加载上一章节失败:', error);
    }
  };

  // 加载最后一章节状态（用于新建章节时判断按钮状态）
  const loadLastChapterStatus = async () => {
    if (!novelId) return;
    try {
      const response = await ApiService.get(`/chapters/novel/${novelId}/last-chapter-status`);
      const data = response.data || response;
      if (data) {
        setLastChapterStatus({
          review_status: data.review_status || null,
          is_released: data.is_released !== undefined ? data.is_released : null,
          release_date: data.release_date || null
        });
      } else {
        setLastChapterStatus(null);
      }
    } catch (error) {
      console.error('加载最后一章节状态失败:', error);
      setLastChapterStatus(null);
    }
  };

  // 加载当前章节状态（用于编辑章节时判断按钮状态）
  const loadCurrentChapterStatus = async () => {
    if (!chapterId) return;
    try {
      const response = await ApiService.get(`/chapter/${chapterId}`);
      const chapter = response.data || response;
      if (chapter) {
        setCurrentChapterStatus({
          review_status: chapter.review_status || 'draft',
          is_released: chapter.is_released !== undefined ? chapter.is_released : 0
        });
      }
    } catch (error) {
      console.error('加载当前章节状态失败:', error);
    }
  };

  // 加载前一章节状态（用于编辑章节时判断按钮状态）
  const loadPrevChapterStatus = async () => {
    if (!novelId || !chapterId) return;
    try {
      const response = await ApiService.get(`/chapters/novel/${novelId}/chapter/${chapterId}/prev-chapter-status`);
      const data = response.data || response;
      if (data) {
        setPrevChapterStatus({
          review_status: data.review_status || null,
          is_released: data.is_released !== undefined ? data.is_released : null,
          release_date: data.release_date || null
        });
      } else {
        // 没有前一章节，设置为null
        setPrevChapterStatus(null);
      }
    } catch (error) {
      console.error('加载前一章节状态失败:', error);
      setPrevChapterStatus(null);
    }
  };

  // 获取下一个章节号（查询所有状态的章节，包括草稿）
  const loadNextChapterNumber = async () => {
    if (!novelId) return;
    try {
      const response = await ApiService.get(`/chapters/novel/${novelId}/next-number`);
      const data = response.data || response;
      if (data && data.next_chapter_number) {
        setChapterInfo(prev => ({ ...prev, chapter_number: data.next_chapter_number }));
      } else {
        setChapterInfo(prev => ({ ...prev, chapter_number: 1 }));
      }
      
      // 初始化自动保存的基准内容（新建章节时）
      lastSavedContentRef.current = '';
      lastSavedTitleRef.current = '';
      lastSavedNoteRef.current = '';
      hasUnsavedChangesRef.current = false;
    } catch (error) {
      console.error('获取章节号失败:', error);
      setChapterInfo(prev => ({ ...prev, chapter_number: 1 }));
      // 初始化自动保存的基准内容（新建章节时）
      lastSavedContentRef.current = '';
      lastSavedTitleRef.current = '';
      lastSavedNoteRef.current = '';
      hasUnsavedChangesRef.current = false;
    }
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // 更新字数统计
  const updateWordCount = (text: string) => {
    const count = text.replace(/\s/g, '').length;
    setWordCount(count);
  };

  // 处理内容变化
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setChapterInfo(prev => ({ ...prev, content: newContent }));
    updateWordCount(newContent);
    setSavedToCloud(false);
    markContentChanged(); // 标记内容已改动
    
    // 内容变化时清除高亮（删除查找目标时也会清除红色等突出显示）
    if (showHighlight) {
      setShowHighlight(false);
      setHighlightedContent('');
      // 如果查找文本仍然存在，保持匹配计数；否则重置
      if (replaceFind.trim()) {
        const searchText = replaceFind.trim();
        const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedText, 'g');
        const matches = newContent.match(regex);
        const total = matches ? matches.length : 0;
        setReplaceMatches({ current: 0, total: total });
      } else {
        setReplaceMatches({ current: 0, total: 0 });
      }
    }
    
    // 自动调整textarea高度
    if (contentRef.current) {
      contentRef.current.style.height = 'auto';
      const minHeight = window.innerHeight - 400; // 至少占据屏幕高度
      contentRef.current.style.height = `${Math.max(contentRef.current.scrollHeight, minHeight)}px`;
    }
  };
  
  // 组件加载后初始化textarea高度
  useEffect(() => {
    if (contentRef.current) {
      const minHeight = window.innerHeight - 400;
      contentRef.current.style.height = `${minHeight}px`;
    }
  }, []);
  
  // 同步样式的工具函数
  const syncOverlayStyles = () => {
    const textarea = contentRef.current;
    const overlay = document.querySelector(`.${styles.highlightOverlay}`) as HTMLElement;
    
    if (!textarea || !overlay) return;
    
    // 强制重新计算样式，确保获取最新的计算值
    void textarea.offsetHeight; // 触发重排
    
    const computedStyle = window.getComputedStyle(textarea);
    
    // 同步所有影响文本位置的样式属性
    // 字体相关
    overlay.style.fontSize = computedStyle.fontSize;
    overlay.style.fontFamily = computedStyle.fontFamily;
    overlay.style.fontWeight = computedStyle.fontWeight;
    overlay.style.fontStyle = computedStyle.fontStyle;
    overlay.style.fontVariant = computedStyle.fontVariant;
    overlay.style.fontStretch = computedStyle.fontStretch;
    
    // 文本布局相关
    overlay.style.lineHeight = computedStyle.lineHeight;
    overlay.style.letterSpacing = computedStyle.letterSpacing;
    overlay.style.wordSpacing = computedStyle.wordSpacing;
    overlay.style.textAlign = computedStyle.textAlign;
    overlay.style.textIndent = computedStyle.textIndent;
    overlay.style.textTransform = computedStyle.textTransform;
    overlay.style.textDecoration = computedStyle.textDecoration;
    
    // 间距相关
    overlay.style.padding = computedStyle.padding;
    overlay.style.paddingTop = computedStyle.paddingTop;
    overlay.style.paddingRight = computedStyle.paddingRight;
    overlay.style.paddingBottom = computedStyle.paddingBottom;
    overlay.style.paddingLeft = computedStyle.paddingLeft;
    overlay.style.margin = computedStyle.margin;
    
    // 边框相关
    overlay.style.borderWidth = computedStyle.borderWidth;
    overlay.style.borderTopWidth = computedStyle.borderTopWidth;
    overlay.style.borderRightWidth = computedStyle.borderRightWidth;
    overlay.style.borderBottomWidth = computedStyle.borderBottomWidth;
    overlay.style.borderLeftWidth = computedStyle.borderLeftWidth;
    overlay.style.borderStyle = computedStyle.borderStyle;
    
    // 布局相关
    overlay.style.width = computedStyle.width;
    overlay.style.height = computedStyle.height;
    overlay.style.boxSizing = computedStyle.boxSizing;
    overlay.style.borderRadius = computedStyle.borderRadius;
    overlay.style.minHeight = computedStyle.minHeight;
    overlay.style.maxHeight = computedStyle.maxHeight;
    overlay.style.minWidth = computedStyle.minWidth;
    overlay.style.maxWidth = computedStyle.maxWidth;
    
    // 文本渲染相关
    overlay.style.textRendering = computedStyle.textRendering;
    overlay.style.setProperty('-webkit-font-smoothing', computedStyle.getPropertyValue('-webkit-font-smoothing'));
    overlay.style.setProperty('-moz-osx-font-smoothing', computedStyle.getPropertyValue('-moz-osx-font-smoothing'));
    overlay.style.direction = computedStyle.direction;
    overlay.style.unicodeBidi = computedStyle.unicodeBidi;
    
    // 确保没有额外的样式干扰
    overlay.style.verticalAlign = 'top';
    overlay.style.transform = 'none';
    overlay.style.transformOrigin = 'initial';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.position = 'absolute';
    
    // 文本基线对齐相关
    overlay.style.overflowWrap = computedStyle.overflowWrap;
    overlay.style.wordBreak = computedStyle.wordBreak;
    overlay.style.hyphens = computedStyle.hyphens;
    
    // 确保文本渲染方式一致
    overlay.style.writingMode = computedStyle.writingMode;
    overlay.style.textOrientation = computedStyle.textOrientation;
    
    // 移除可能导致偏移的样式
    overlay.style.outline = 'none';
    overlay.style.outlineOffset = '0';
    overlay.style.textShadow = 'none';
    
    // 处理滚动条宽度差异
    const textareaScrollbarWidth = textarea.offsetWidth - textarea.clientWidth;
    const overlayScrollbarWidth = overlay.offsetWidth - overlay.clientWidth;
    if (textareaScrollbarWidth !== overlayScrollbarWidth) {
      // 调整padding以补偿滚动条宽度差异
      const paddingLeft = parseFloat(computedStyle.paddingLeft);
      const paddingRight = parseFloat(computedStyle.paddingRight);
      overlay.style.paddingLeft = `${paddingLeft}px`;
      overlay.style.paddingRight = `${paddingRight + (textareaScrollbarWidth - overlayScrollbarWidth)}px`;
    }
    
    // 同步滚动位置
    overlay.scrollTop = textarea.scrollTop;
    overlay.scrollLeft = textarea.scrollLeft;
  };

  // 监听textarea滚动，同步高亮层滚动和样式
  useEffect(() => {
    if (!showHighlight || !contentRef.current) return;
    
    const textarea = contentRef.current;
    const overlay = document.querySelector(`.${styles.highlightOverlay}`) as HTMLElement;
    
    if (!overlay) return;
    
    // 使用统一的样式同步函数
    const syncStyles = syncOverlayStyles;
    
    // 初始同步
    syncStyles();
    
    // 监听滚动
    const handleScroll = () => {
      if (overlay) {
        overlay.scrollTop = textarea.scrollTop;
        overlay.scrollLeft = textarea.scrollLeft;
      }
    };
    
    // 监听resize事件，确保样式保持同步
    const handleResize = () => {
      syncStyles();
    };
    
    textarea.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    
    // 使用ResizeObserver监听textarea尺寸变化
    const resizeObserver = new ResizeObserver(() => {
      syncStyles();
    });
    resizeObserver.observe(textarea);
    
    return () => {
      textarea.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [showHighlight, styles.highlightOverlay, fontSize]);

  // 标记内容已改动
  const markContentChanged = () => {
    hasUnsavedChangesRef.current = true;
    lastChangeTimeRef.current = Date.now();
    
    // 清除旧的定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // 设置新的3分钟定时器
    autoSaveTimerRef.current = setTimeout(() => {
      if (hasUnsavedChangesRef.current) {
        autoSaveDraft();
      }
    }, 3 * 60 * 1000); // 3分钟
  };

  // 自动保存到 draft 表
  const autoSaveDraft = async () => {
    if (!novelId || !user) return;
    
    // 检查是否有实际改动
    const currentContent = chapterInfo.content || '';
    const currentTitle = chapterInfo.title || '';
    const currentNote = authorNote2.trim() || '';
    
    if (currentContent === lastSavedContentRef.current &&
        currentTitle === lastSavedTitleRef.current &&
        currentNote === lastSavedNoteRef.current) {
      // 没有改动，不保存
      hasUnsavedChangesRef.current = false;
      return;
    }
    
    // 如果有改动，才保存
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const requestBody = {
        novel_id: parseInt(novelId),
        chapter_id: (chapterInfo.id || chapterId) || null,
        chapter_number: chapterInfo.chapter_number,
        title: currentTitle || `第${chapterInfo.chapter_number}章`,
        content: currentContent,
        translator_note: currentNote,
        word_count: wordCount
      };

      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(`${base}/draft/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '自动保存失败');
      }
      
      const result = await response.json();
      
      // 更新上次保存的内容
      lastSavedContentRef.current = currentContent;
      lastSavedTitleRef.current = currentTitle;
      lastSavedNoteRef.current = currentNote;
      hasUnsavedChangesRef.current = false;
      
      console.log('自动保存成功:', result);
    } catch (error: any) {
      console.error('自动保存失败:', error);
      // 自动保存失败不提示用户，避免打扰
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setChapterInfo(prev => ({ ...prev, title: newTitle }));
    setSavedToCloud(false);
    markContentChanged(); // 标记内容已改动
  };

  // 计算按钮状态（新建章节）
  const getNewChapterButtonStates = () => {
    if (!lastChapterStatus || lastChapterStatus.review_status === null) {
      // 没有前一章节，所有按钮都可用（第一个章节）
      return {
        canSaveDraft: true,
        canScheduleRelease: true,
        canPublishNow: true
      };
    }

    const { review_status, is_released } = lastChapterStatus;

    // 情况1：前一章节已发布（review_status != 'draft' AND is_released = 1）
    if (review_status !== 'draft' && is_released === 1) {
      return {
        canSaveDraft: true,
        canScheduleRelease: true,
        canPublishNow: true
      };
    }

    // 情况2：前一章节是定时发布（review_status != 'draft' AND is_released = 0）
    if (review_status !== 'draft' && is_released === 0) {
      return {
        canSaveDraft: true,
        canScheduleRelease: true,
        canPublishNow: false
      };
    }

    // 情况3：前一章节是草稿（review_status = 'draft'）
    if (review_status === 'draft') {
      return {
        canSaveDraft: true,
        canScheduleRelease: false,
        canPublishNow: false
      };
    }

    // 默认情况
    return {
      canSaveDraft: true,
      canScheduleRelease: false,
      canPublishNow: false
    };
  };

  // 计算按钮状态（编辑章节）
  const getEditChapterButtonStates = () => {
    // 如果状态还没有加载，但章节信息已加载（chapterInfo.id存在），使用默认状态（草稿）
    // 这样可以确保按钮能够显示
    if (!currentChapterStatus) {
      // 如果章节信息已加载，说明是编辑章节，使用默认草稿状态
      if (chapterInfo.id || chapterId) {
        return {
          canUpdateDraft: true, // 草稿状态默认可以更新为草稿
          canUpdateSchedule: false,
          canUpdatePublish: false
        };
      }
      // 否则不显示按钮
      return {
        canUpdateDraft: false,
        canUpdateSchedule: false,
        canUpdatePublish: false
      };
    }

    const { review_status, is_released } = currentChapterStatus;
    
    console.log('getEditChapterButtonStates: Processing with status', {
      review_status,
      is_released,
      prevChapterStatus
    });

    // 情况1：章节已发布（review_status != 'draft' AND is_released = 1）
    if (review_status !== 'draft' && is_released === 1) {
      return {
        canUpdateDraft: false,
        canUpdateSchedule: false,
        canUpdatePublish: true // 显示"更新立即发布"
      };
    }

    // 情况2：章节是定时发布（review_status != 'draft' AND is_released = 0）
    if (review_status !== 'draft' && is_released === 0) {
      const prevReleased = prevChapterStatus?.is_released === 1;
      
      if (prevReleased) {
        // 前一章节已发布，可以更新定时发布和立即发布
        return {
          canUpdateDraft: false,
          canUpdateSchedule: true,
          canUpdatePublish: true
        };
      } else {
        // 前一章节未发布，只能更新定时发布
        return {
          canUpdateDraft: false,
          canUpdateSchedule: true,
          canUpdatePublish: false
        };
      }
    }

    // 情况3：章节是草稿（review_status = 'draft'）
    // 注意：正常情况下草稿的is_released应该是0，但为了兼容异常数据，只要review_status='draft'就按草稿处理
    if (review_status === 'draft') {
      // (1) 如果前一章节的review_status != "draft"
      if (prevChapterStatus && prevChapterStatus.review_status !== 'draft') {
        // ① 如果前一章节的is_released=0：更新存为草稿、更新定时发布可用
        if (prevChapterStatus.is_released === 0) {
          return {
            canUpdateDraft: true,
            canUpdateSchedule: true,
            canUpdatePublish: false
          };
        }
        // ② 如果前一章节的is_released=1：更新存为草稿、更新定时发布、更新立即发布可用
        if (prevChapterStatus.is_released === 1) {
          return {
            canUpdateDraft: true,
            canUpdateSchedule: true,
            canUpdatePublish: true
          };
        }
      }
      // (2) 如果前一章节的review_status = "draft"：只有更新存为草稿可用
      // 或者没有前一章节（第一个章节是草稿）
      return {
        canUpdateDraft: true,
        canUpdateSchedule: false,
        canUpdatePublish: false
      };
    }

    return {
      canUpdateDraft: false,
      canUpdateSchedule: false,
      canUpdatePublish: false
    };
  };

  // 保存草稿
  const saveDraft = async () => {
    if (!novelId) return;
    
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('novel_id', novelId);
      formData.append('chapter_number', chapterInfo.chapter_number.toString());
      formData.append('title', chapterInfo.title || `第${chapterInfo.chapter_number}章`);
      formData.append('content', chapterInfo.content);
      // 只有当authorNote2不为空时才保存（占位符文本不会被保存，因为value为空）
      const translatorNote = authorNote2.trim() || '';
      formData.append('translator_note', translatorNote);
      formData.append('is_visible', '0'); // 草稿状态
      formData.append('is_draft', '1');
      formData.append('word_count', wordCount.toString());

      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let response;
      if (chapterInfo.id || chapterId) {
        // 更新现有章节
        formData.append('chapter_id', (chapterInfo.id || chapterId)!.toString());
        formData.append('action', 'draft');
        const base = getApiBaseUrl();
        if (!base) {
          throw new Error('API base url is not configured');
        }
        response = await fetch(`${base}/chapter/update`, {
          method: 'POST',
          headers,
          body: formData
        });
      } else {
        // 创建新章节
        formData.append('action', 'draft');
        const base = getApiBaseUrl();
        if (!base) {
          throw new Error('API base url is not configured');
        }
        response = await fetch(`${base}/chapter/create`, {
          method: 'POST',
          headers,
          body: formData
        });
        
        // 检查是否是重复章节号
        if (response.status === 409) {
          const errorData = await response.json();
          if (errorData.code === 'CHAPTER_EXISTS' && errorData.existingChapter) {
            setExistingChapter(errorData.existingChapter);
            setPendingAction('draft');
            setPendingFormData(formData);
            setShowUpdateConfirmDialog(true);
            setIsSaving(false);
            return;
          }
        }
        
        // 如果是新建章节，保存返回的chapter_id
        if (response.ok) {
          const result = await response.json();
          if (result.chapter_id) {
            setChapterInfo(prev => ({ ...prev, id: result.chapter_id }));
          }
        }
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '保存失败');
      }
      
      setSavedToCloud(true);
      
      // 更新自动保存的基准内容
      lastSavedContentRef.current = chapterInfo.content || '';
      lastSavedTitleRef.current = chapterInfo.title || '';
      lastSavedNoteRef.current = authorNote2.trim() || '';
      hasUnsavedChangesRef.current = false;
    } catch (error: any) {
      console.error('保存草稿失败:', error);
      alert(error.message || (language === 'zh' ? '保存草稿失败' : 'Failed to save draft'));
    } finally {
      setIsSaving(false);
    }
  };

  // 定时发布
  const handleScheduleRelease = () => {
    setShowScheduleModal(true);
  };

  // 确认定时发布
  const handleConfirmSchedule = async (releaseDate: Date) => {
    if (!novelId) return;
    if (!chapterInfo.title.trim()) {
      alert(language === 'zh' ? '请输入章节标题' : 'Please enter chapter title');
      return;
    }
    if (wordCount < 1000) {
      alert(language === 'zh' ? '正文字数不能少于1000字' : 'Content must be at least 1000 characters');
      return;
    }
    if (wordCount > 50000) {
      alert(language === 'zh' ? '正文字数不能超过50000字' : 'Content cannot exceed 50000 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('novel_id', novelId);
      formData.append('chapter_number', chapterInfo.chapter_number.toString());
      formData.append('title', chapterInfo.title.trim());
      formData.append('content', chapterInfo.content.trim());
      const translatorNote = authorNote2.trim() || '';
      formData.append('translator_note', translatorNote);
      formData.append('is_draft', '0');
      formData.append('word_count', wordCount.toString());
      formData.append('action', 'schedule');
      
      // 格式化发布时间为 YYYY-MM-DD HH:mm:ss（使用本地时间，不是UTC时间）
      const year = releaseDate.getFullYear();
      const month = String(releaseDate.getMonth() + 1).padStart(2, '0');
      const day = String(releaseDate.getDate()).padStart(2, '0');
      const hour = String(releaseDate.getHours()).padStart(2, '0');
      const minute = String(releaseDate.getMinutes()).padStart(2, '0');
      const second = String(releaseDate.getSeconds()).padStart(2, '0');
      const releaseDateStr = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
      formData.append('release_date', releaseDateStr);

      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let response;
      if (chapterInfo.id || chapterId) {
        formData.append('chapter_id', (chapterInfo.id || chapterId)!.toString());
        const base = getApiBaseUrl();
        if (!base) {
          throw new Error('API base url is not configured');
        }
        response = await fetch(`${base}/chapter/update`, {
          method: 'POST',
          headers,
          body: formData
        });
      } else {
        const base = getApiBaseUrl();
        if (!base) {
          throw new Error('API base url is not configured');
        }
        response = await fetch(`${base}/chapter/create`, {
          method: 'POST',
          headers,
          body: formData
        });
        
        // 检查是否是重复章节号
        if (response.status === 409) {
          const errorData = await response.json();
          if (errorData.code === 'CHAPTER_EXISTS' && errorData.existingChapter) {
            setExistingChapter(errorData.existingChapter);
            setPendingAction('schedule');
            setPendingFormData(formData);
            setShowUpdateConfirmDialog(true);
            setIsSubmitting(false);
            return;
          }
        }
        
        if (response.ok) {
          const result = await response.json();
          if (result.chapter_id) {
            setChapterInfo(prev => ({ ...prev, id: result.chapter_id }));
          }
        }
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '定时发布失败');
      }
      
      setShowScheduleModal(false);
      // 显示成功提示
      setToast({ 
        message: 'Scheduled release set successfully!', 
        type: 'success' 
      });
      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        navigate(`/novel-manage/${novelId}?tab=chapters`);
      }, 500);
    } catch (error: any) {
      console.error('定时发布失败:', error);
      setToast({ 
        message: error.message || 'Failed to schedule release', 
        type: 'error' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // AI 排版功能
  const handleAILayout = async () => {
    if (!novelId || !user) {
      alert(language === 'zh' ? '请先登录' : 'Please login first');
      return;
    }

    // 检查是否有内容
    if (!chapterInfo.content.trim() && !chapterInfo.title.trim()) {
      alert(language === 'zh' ? '没有内容需要排版' : 'No content to layout');
      return;
    }

    // 确认操作
    const confirmMessage = language === 'zh' 
      ? '确定要使用 AI 进行排版吗？排版前会自动保存一份草稿，排版后的内容将覆盖当前内容。'
      : 'Are you sure you want to use AI layout? A draft will be saved automatically before layout, and the formatted content will overwrite the current content.';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsLayouting(true);
    
    try {
      // 步骤1：先保存草稿（重要！）
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 保存当前内容到 draft 表
      const draftRequestBody = {
        novel_id: parseInt(novelId),
        chapter_id: (chapterInfo.id || chapterId) || null,
        chapter_number: chapterInfo.chapter_number,
        title: chapterInfo.title || `第${chapterInfo.chapter_number}章`,
        content: chapterInfo.content || '',
        translator_note: authorNote2.trim() || '',
        word_count: wordCount
      };

      const draftResponse = await fetch(`${getApiBaseUrl()}/draft/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify(draftRequestBody)
      });

      if (!draftResponse.ok) {
        const error = await draftResponse.json();
        throw new Error(error.message || (language === 'zh' ? '保存草稿失败' : 'Failed to save draft'));
      }

      console.log('排版前草稿已保存');

      // 步骤2：调用 AI 排版 API
      const layoutRequestBody = {
        title: chapterInfo.title || '',
        content: chapterInfo.content || '',
        translator_note: authorNote2.trim() || ''
      };

      const layoutResponse = await fetch(`${getApiBaseUrl()}/ai/layout`, {
        method: 'POST',
        headers,
        body: JSON.stringify(layoutRequestBody)
      });

      if (!layoutResponse.ok) {
        const error = await layoutResponse.json();
        throw new Error(error.message || (language === 'zh' ? 'AI 排版失败' : 'AI layout failed'));
      }

      const layoutResult = await layoutResponse.json();
      
      if (!layoutResult.success || !layoutResult.data) {
        throw new Error(layoutResult.message || (language === 'zh' ? 'AI 排版返回数据异常' : 'AI layout returned invalid data'));
      }

      // 步骤3：更新页面内容
      const formattedTitle = layoutResult.data.title || chapterInfo.title;
      const formattedContent = layoutResult.data.content || chapterInfo.content;
      const formattedNote = layoutResult.data.translator_note || authorNote2;

      setChapterInfo(prev => ({
        ...prev,
        title: formattedTitle,
        content: formattedContent
      }));
      
      setAuthorNote2(formattedNote);
      updateWordCount(formattedContent);

      // 更新自动保存的基准内容
      lastSavedContentRef.current = formattedContent;
      lastSavedTitleRef.current = formattedTitle;
      lastSavedNoteRef.current = formattedNote;
      hasUnsavedChangesRef.current = true; // 标记为已改动，触发自动保存

      // 成功提示
      alert(language === 'zh' ? 'AI 排版完成！排版前的版本已保存为草稿。' : 'AI layout completed! The version before layout has been saved as a draft.');

    } catch (error: any) {
      console.error('AI 排版失败:', error);
      alert(error.message || (language === 'zh' ? 'AI 排版失败，请重试' : 'AI layout failed, please try again'));
    } finally {
      setIsLayouting(false);
    }
  };

  // 查找和替换功能
  const handleFind = () => {
    const searchText = replaceFind.trim();
    
    if (!searchText) {
      setReplaceMatches({ current: 0, total: 0 });
      setShowHighlight(false);
      setHighlightedContent('');
      return;
    }
    
    const content = chapterInfo.content || '';
    
    // 对于中文文本，使用简单的全局匹配，不使用单词边界
    // 因为中文没有明确的单词边界概念
    const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 对于中文，直接匹配文本（不使用单词边界）
    // 对于英文，可以使用单词边界，但为了统一，中文和英文都使用简单匹配
    let regex: RegExp;
    try {
      // 简单全局匹配，适用于中文和英文
      regex = new RegExp(escapedText, 'g');
    } catch (e) {
      // 如果仍然失败，尝试不转义的匹配
      regex = new RegExp(searchText, 'g');
    }
    
    // 重新执行匹配以获取所有结果
    const matches: RegExpMatchArray[] = [];
    let match;
    regex.lastIndex = 0; // 重置正则表达式
    
    while ((match = regex.exec(content)) !== null) {
      matches.push(match);
      // 防止无限循环
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
    
    const total = matches.length;
    
    // 如果找到了匹配，设置当前为第一个，并高亮显示
    setReplaceMatches({ 
      current: total > 0 ? 1 : 0, 
      total: total 
    });
    
    // 生成高亮HTML内容
    if (total > 0) {
      // 使用新的高亮生成函数，默认突出显示第一个匹配
      const highlightedWithBreaks = generateHighlightedContent(1);
      setHighlightedContent(highlightedWithBreaks);
      setShowHighlight(true);
      
      // 等待DOM更新后同步样式并定位
      // 使用requestAnimationFrame确保在下一帧渲染前同步
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          syncOverlayStyles();
          setTimeout(() => {
            scrollToMatch(1);
          }, 50);
        });
      });
    } else {
      setShowHighlight(false);
      setHighlightedContent('');
      // 如果没有找到，提示用户
      if (language === 'zh') {
        alert(`未找到 "${searchText}"`);
      } else {
        alert(`Not found: "${searchText}"`);
      }
    }
  };

  // 查找下一个并滚动到匹配位置
  const handleFindNext = () => {
    if (!replaceFind.trim() || replaceMatches.total === 0) {
      // 如果没有匹配，先执行查找
      handleFind();
      return;
    }
    
    const newCurrent = replaceMatches.current < replaceMatches.total 
      ? replaceMatches.current + 1 
      : 1; // 循环到第一个
    
    setReplaceMatches(prev => ({
      ...prev,
      current: newCurrent
    }));
    
    // 立即更新高亮显示，突出显示新的当前匹配项（红色）
    const highlightedContent = generateHighlightedContent(newCurrent);
    setHighlightedContent(highlightedContent);
    setShowHighlight(true);
    
    // 等待DOM更新后同步样式并滚动
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncOverlayStyles();
        setTimeout(() => {
          scrollToMatch(newCurrent);
        }, 50);
      });
    });
  };

  // 查找上一个并滚动到匹配位置
  const handleFindPrev = () => {
    if (!replaceFind.trim() || replaceMatches.total === 0) {
      // 如果没有匹配，先执行查找
      handleFind();
      return;
    }
    
    const newCurrent = replaceMatches.current > 1 
      ? replaceMatches.current - 1 
      : replaceMatches.total; // 循环到最后一个
    
    setReplaceMatches(prev => ({
      ...prev,
      current: newCurrent
    }));
    
    // 立即更新高亮显示，突出显示新的当前匹配项（红色）
    const highlightedContent = generateHighlightedContent(newCurrent);
    setHighlightedContent(highlightedContent);
    setShowHighlight(true);
    
    // 等待DOM更新后同步样式并滚动
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncOverlayStyles();
        setTimeout(() => {
          scrollToMatch(newCurrent);
        }, 50);
      });
    });
  };

  // 生成高亮HTML，突出显示当前匹配项
  const generateHighlightedContent = (currentMatchIndex: number = 0) => {
    const content = chapterInfo.content || '';
    const searchText = replaceFind.trim();
    if (!searchText) return '';
    
    const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 使用与handleFind相同的简单全局匹配
    let regex: RegExp;
    try {
      // 简单全局匹配，适用于中文和英文
      regex = new RegExp(escapedText, 'g');
    } catch (e) {
      // 如果仍然失败，尝试不转义的匹配
      regex = new RegExp(searchText, 'g');
    }
    
    // 转义HTML特殊字符，但保留换行符
    // 注意：由于white-space: pre-wrap，\n会自然换行，不需要转换为<br>
    // 使用手动转义以确保换行符不被丢失
    const escapeHtmlPreservingNewlines = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      // \n保持不变，因为white-space: pre-wrap会处理它
    };
    
    // 将内容按匹配位置拆分并高亮
    const parts: string[] = [];
    let lastIndex = 0;
    let match;
    let matchCount = 0;
    
    while ((match = regex.exec(content)) !== null) {
      matchCount++;
      
      // 防止零长度匹配
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      
      // 添加匹配前的文本（包含换行符）
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        parts.push(escapeHtmlPreservingNewlines(textBefore));
      }
      
      // 添加高亮的匹配文本
      const matchedText = match[0];
      // 当前匹配项使用红色背景突出显示，其他使用黄色
      // 使用 !important 确保内联样式覆盖CSS规则
      // 注意：padding设为0，避免影响字符位置对齐
      if (matchCount === currentMatchIndex) {
        // 当前匹配项：红色背景，白色文字，加粗，无padding确保精确对齐
        const highlightStyle = `background-color: #ff0000 !important; color: #fff !important; padding: 0 !important; margin: 0 !important; border: 2px solid #cc0000 !important; border-radius: 2px; font-weight: bold !important; display: inline !important;`;
        parts.push(`<mark style="${highlightStyle}">${escapeHtmlPreservingNewlines(matchedText)}</mark>`);
      } else {
        // 其他匹配项：黄色背景，黑色文字，无padding确保精确对齐
        const highlightStyle = `background-color: #ffff00 !important; color: #000 !important; padding: 0 !important; margin: 0 !important; border: none !important; border-radius: 2px; font-weight: normal !important; display: inline !important;`;
        parts.push(`<mark style="${highlightStyle}">${escapeHtmlPreservingNewlines(matchedText)}</mark>`);
      }
      
      lastIndex = regex.lastIndex;
      
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
    
    // 添加剩余文本
    if (lastIndex < content.length) {
      parts.push(escapeHtmlPreservingNewlines(content.substring(lastIndex)));
    }
    
    // 直接返回，保留换行符（white-space: pre-wrap会处理）
    // 注意：dangerouslySetInnerHTML中，\n在HTML中会被视为空白字符
    // 但由于white-space: pre-wrap，它会正确换行
    return parts.join('');
  };

  // 滚动到指定的匹配位置
  const scrollToMatch = (matchIndex: number) => {
    if (!contentRef.current || !replaceFind.trim()) return;
    
    const content = chapterInfo.content || '';
    const searchText = replaceFind.trim();
    const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 使用与handleFind相同的简单全局匹配
    let regex: RegExp;
    try {
      // 简单全局匹配，适用于中文和英文
      regex = new RegExp(escapedText, 'g');
    } catch (e) {
      // 如果仍然失败，尝试不转义的匹配
      regex = new RegExp(searchText, 'g');
    }
    
    // 找到第matchIndex个匹配的位置
    let matchCount = 0;
    let targetMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(content)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      
      matchCount++;
      if (matchCount === matchIndex) {
        targetMatch = match;
        break;
      }
      
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
    
    if (targetMatch && contentRef.current) {
      // 重新生成高亮内容，突出显示当前匹配项
      const highlightedContent = generateHighlightedContent(matchIndex);
      setHighlightedContent(highlightedContent);
      setShowHighlight(true);
      
      // 等待DOM更新后再滚动
      setTimeout(() => {
        if (!contentRef.current) return;
        
        const textarea = contentRef.current;
        const textBeforeMatch = content.substring(0, targetMatch.index);
        
        // 方法1: 使用临时元素精确测量（更准确）
        const tempDiv = document.createElement('div');
        const computedStyle = window.getComputedStyle(textarea);
        tempDiv.style.position = 'absolute';
        tempDiv.style.visibility = 'hidden';
        tempDiv.style.whiteSpace = 'pre-wrap';
        tempDiv.style.wordWrap = 'break-word';
        tempDiv.style.font = computedStyle.font;
        tempDiv.style.fontSize = computedStyle.fontSize;
        tempDiv.style.fontFamily = computedStyle.fontFamily;
        tempDiv.style.lineHeight = computedStyle.lineHeight;
        tempDiv.style.width = computedStyle.width;
        tempDiv.style.padding = computedStyle.padding;
        tempDiv.style.border = computedStyle.border;
        tempDiv.style.boxSizing = 'border-box';
        tempDiv.textContent = textBeforeMatch;
        
        document.body.appendChild(tempDiv);
        
        // 获取实际高度
        const textBeforeHeight = tempDiv.scrollHeight;
        const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.8;
        const textareaHeight = textarea.clientHeight;
        const textareaScrollHeight = textarea.scrollHeight;
        
        // 计算滚动位置：让匹配文本在可视区域中心
        const scrollTop = textBeforeHeight - (textareaHeight / 2) + (lineHeight / 2);
        
        document.body.removeChild(tempDiv);
        
        // 确保滚动位置在有效范围内
        const maxScrollTop = textareaScrollHeight - textareaHeight;
        const finalScrollTop = Math.max(0, Math.min(scrollTop, maxScrollTop));
        
        // 滚动textarea
        textarea.scrollTop = finalScrollTop;
        
        // 同步高亮层滚动（确保高亮层完全同步）
        const overlay = document.querySelector(`.${styles.highlightOverlay}`) as HTMLElement;
        if (overlay) {
          overlay.scrollTop = finalScrollTop;
          
          // 再次确保同步（双重保险）
          setTimeout(() => {
            if (overlay && contentRef.current) {
              overlay.scrollTop = contentRef.current.scrollTop;
            }
          }, 10);
        }
        
        // 如果滚动后匹配文本仍然不在可视区域，尝试强制滚动
        setTimeout(() => {
          if (!contentRef.current) return;
          
          // 重新测量以确保准确性
          const verifyBeforeDiv = document.createElement('div');
          verifyBeforeDiv.style.position = 'absolute';
          verifyBeforeDiv.style.visibility = 'hidden';
          verifyBeforeDiv.style.whiteSpace = 'pre-wrap';
          verifyBeforeDiv.style.wordWrap = 'break-word';
          verifyBeforeDiv.style.font = computedStyle.font;
          verifyBeforeDiv.style.fontSize = computedStyle.fontSize;
          verifyBeforeDiv.style.fontFamily = computedStyle.fontFamily;
          verifyBeforeDiv.style.lineHeight = computedStyle.lineHeight;
          verifyBeforeDiv.style.width = computedStyle.width;
          verifyBeforeDiv.style.padding = computedStyle.padding;
          verifyBeforeDiv.style.border = computedStyle.border;
          verifyBeforeDiv.style.boxSizing = 'border-box';
          verifyBeforeDiv.textContent = textBeforeMatch;
          
          document.body.appendChild(verifyBeforeDiv);
          const matchTopHeight = verifyBeforeDiv.scrollHeight;
          
          const textAfterMatch = content.substring(0, targetMatch.index + targetMatch[0].length);
          verifyBeforeDiv.textContent = textAfterMatch;
          const matchBottomHeight = verifyBeforeDiv.scrollHeight;
          
          document.body.removeChild(verifyBeforeDiv);
          
          // 验证滚动是否成功
          const currentScroll = contentRef.current.scrollTop;
          const visibleTop = currentScroll;
          const visibleBottom = currentScroll + textarea.clientHeight;
          
          if (matchTopHeight < visibleTop || matchBottomHeight > visibleBottom) {
            // 匹配文本不在可视区域内，重新滚动
            const newScrollTop = Math.max(0, matchTopHeight - (textarea.clientHeight / 2));
            const finalNewScrollTop = Math.min(newScrollTop, maxScrollTop);
            contentRef.current.scrollTop = finalNewScrollTop;
            
            if (overlay) {
              overlay.scrollTop = finalNewScrollTop;
            }
          }
        }, 150);
      }, 100);
    }
  };

  // 替换当前匹配
  const handleReplace = () => {
    if (!replaceFind.trim()) {
      alert(language === 'zh' ? '请输入要查找的文字' : 'Please enter text to find');
      return;
    }
    
    if (replaceMatches.total === 0) {
      alert(language === 'zh' ? '没有找到匹配的文字' : 'No matching text found');
      return;
    }

    // 确认替换
    const confirmMessage = language === 'zh' 
      ? `确定要替换第 ${replaceMatches.current} 个匹配项吗？` 
      : `Are you sure you want to replace match ${replaceMatches.current}?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    const content = chapterInfo.content || '';
    const escapedText = replaceFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedText, 'g');
    let matchIndex = 0;
    let newContent = content.replace(regex, (match) => {
      matchIndex++;
      if (matchIndex === replaceMatches.current) {
        return replaceWith;
      }
      return match;
    });
    
    setChapterInfo(prev => ({ ...prev, content: newContent }));
    updateWordCount(newContent);
    markContentChanged(); // 标记内容已改动
    
    // 重新查找，更新匹配数
    handleFind();
  };

  // 替换全部
  const handleReplaceAll = () => {
    if (!replaceFind.trim()) {
      alert(language === 'zh' ? '请输入要查找的文字' : 'Please enter text to find');
      return;
    }
    
    const content = chapterInfo.content || '';
    const escapedText = replaceFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 重新计算匹配数量，不依赖状态
    let regex: RegExp;
    try {
      regex = new RegExp(escapedText, 'g');
    } catch (e) {
      regex = new RegExp(replaceFind, 'g');
    }
    
    // 计算匹配数
    const matches = content.match(regex);
    const totalMatches = matches ? matches.length : 0;
    
    if (totalMatches === 0) {
      alert(language === 'zh' ? '没有找到匹配的文字' : 'No matching text found');
      return;
    }

    // 确认全部替换
    const confirmMessage = language === 'zh' 
      ? `确定要替换所有 ${totalMatches} 个匹配项吗？此操作不可撤销。` 
      : `Are you sure you want to replace all ${totalMatches} matches? This action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    // 执行替换
    const newContent = content.replace(regex, replaceWith);
    
    setChapterInfo(prev => ({ ...prev, content: newContent }));
    updateWordCount(newContent);
    markContentChanged(); // 标记内容已改动
    
    // 清除高亮显示
    setShowHighlight(false);
    setHighlightedContent('');
    
    // 重置匹配数
    setReplaceMatches({ current: 0, total: 0 });
    
    alert(language === 'zh' 
      ? `已成功替换 ${totalMatches} 个匹配项` 
      : `Successfully replaced ${totalMatches} matches`);
  };

  // 发布章节（立即发布）
  const handlePublish = async () => {
    if (!novelId) return;
    if (!chapterInfo.title.trim()) {
      alert(language === 'zh' ? '请输入章节标题' : 'Please enter chapter title');
      return;
    }
    if (wordCount < 1000) {
      alert(language === 'zh' ? '正文字数不能少于1000字' : 'Content must be at least 1000 characters');
      return;
    }
    if (wordCount > 50000) {
      alert(language === 'zh' ? '正文字数不能超过50000字' : 'Content cannot exceed 50000 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('novel_id', novelId);
      formData.append('chapter_number', chapterInfo.chapter_number.toString());
      formData.append('title', chapterInfo.title.trim());
      formData.append('content', chapterInfo.content.trim());
      const translatorNote = authorNote2.trim() || '';
      formData.append('translator_note', translatorNote);
      formData.append('word_count', wordCount.toString());

      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let response: Response;
      let result: { success?: boolean; message?: string; chapter_id?: number; [key: string]: any };
      
      if (chapterInfo.id || chapterId) {
        // 编辑章节
        formData.append('chapter_id', (chapterInfo.id || chapterId)!.toString());
        
        // 如果当前章节已发布（is_released=1），只更新title和content，不改变发布状态
        if (currentChapterStatus?.is_released === 1) {
          // 不传递action和is_released，只更新title和content
        } else {
          // 其他情况，传递action='publish'
          formData.append('action', 'publish');
          formData.append('is_released', '1');
        }
        
        response = await fetch(`${getApiBaseUrl()}/chapter/update`, {
          method: 'POST',
          headers,
          body: formData
        });
        result = await response.json();
      } else {
        // 新建章节
        formData.append('is_draft', '0');
        formData.append('action', 'publish');
        formData.append('is_released', '1');
        
        response = await fetch(`${getApiBaseUrl()}/chapter/create`, {
          method: 'POST',
          headers,
          body: formData
        });
        result = await response.json();
        
        // 检查是否是重复章节号
        if (response.status === 409) {
          if (result.code === 'CHAPTER_EXISTS' && result.existingChapter) {
            setExistingChapter(result.existingChapter);
            setPendingAction('publish');
            setPendingFormData(formData);
            setShowUpdateConfirmDialog(true);
            setIsSubmitting(false);
            return;
          }
        }
        
        if (response.ok && result.chapter_id) {
          setChapterInfo(prev => ({ ...prev, id: result.chapter_id ?? null }));
        }
      }
      
      if (!response.ok) {
        throw new Error(result.message || '发布失败');
      }

      // 显示成功Toast提示
      setToast({
        message: language === 'zh' ? '章节发布成功！' : 'Chapter published successfully!',
        type: 'success'
      });
      
      // 延迟跳转，让用户看到成功提示，跳转到章节管理标签页
      setTimeout(() => {
        navigate(`/novel-manage/${novelId}?tab=chapters`);
      }, 1500);
    } catch (error: any) {
      console.error('发布章节失败:', error);
      // 显示错误Toast提示
      setToast({
        message: error.message || (language === 'zh' ? '发布章节失败' : 'Failed to publish chapter'),
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${styles.container} ${styles[editorMode]} ${styles[theme]} ${sidebarCollapsed ? styles.sidebarCollapsedContainer : ''} ${showHistory ? styles.historyOpen : ''}`}>
      {/* Top Header */}
      <div className={styles.topHeader}>
        <div className={styles.leftSection}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            ←
          </button>
          <div className={styles.novelInfo}>
            <span className={styles.novelTitle}>《{title}》</span>
            {previousChapter && (
              <span className={styles.prevChapter}>
                {language === 'zh' ? '上一章节:' : 'Previous Chapter:'} 
                第{previousChapter.chapter_number}章 {previousChapter.title}
              </span>
            )}
          </div>
          <div className={styles.saveStatus}>
            {isSaving ? (
              <span>{language === 'zh' ? '保存中...' : 'Saving...'}</span>
            ) : savedToCloud ? (
              <span className={styles.saved}>{language === 'zh' ? '已保存到云端' : 'Saved to cloud'}</span>
            ) : null}
            <span className={styles.wordCount}>
              {language === 'zh' ? '当前字数' : 'Current word count'} {wordCount}
            </span>
          </div>
        </div>
        
        <div className={styles.rightSection}>
          {/* 中英文切换按钮 - 在红色框位置 */}
          <button 
            className={styles.langToggleBtn}
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            title={language === 'zh' ? 'Switch to English' : '切换到中文'}
          >
            {language === 'zh' ? 'EN' : '中文'}
          </button>
          
          <a href="#" className={styles.uploadNotice}>
            ①{language === 'zh' ? '上传须知' : 'Upload Notice'}
          </a>
          {(() => {
            // 判断是新建章节还是编辑章节
            // 如果有chapterId参数，说明是编辑章节；如果chapterInfo.id存在，也说明是编辑章节
            const isNewChapter = !chapterId && !chapterInfo.id;
            let buttonStates;
            
            
            if (isNewChapter) {
              // 新建章节：根据前一章节状态判断
              buttonStates = getNewChapterButtonStates();
              
              return (
                <>
                  {buttonStates.canSaveDraft && (
                    <button 
                      className={styles.saveDraftBtn}
                      onClick={saveDraft}
                      disabled={isSubmitting}
                    >
                      {language === 'zh' ? '存为草稿' : 'Save as Draft'}
                    </button>
                  )}
                  {buttonStates.canScheduleRelease && (
                    <button 
                      className={styles.scheduleBtn}
                      onClick={handleScheduleRelease}
                      disabled={isSubmitting || wordCount < 1000}
                    >
                      {language === 'zh' ? '定时发布' : 'Schedule Release'}
                    </button>
                  )}
                  {buttonStates.canPublishNow && (
                    <button 
                      className={styles.publishBtn}
                      onClick={handlePublish}
                      disabled={isSubmitting || wordCount < 1000}
                    >
                      {language === 'zh' ? '立即发布' : 'Publish Now'}
                    </button>
                  )}
                </>
              );
            } else {
              // 编辑章节：根据当前章节状态判断
              // 如果正在加载状态，不显示按钮
              if (isLoadingChapterStatus) {
                return null;
              }
              
              // 调试信息
              console.log('Edit Chapter - Button States Calculation:', {
                chapterId,
                chapterInfoId: chapterInfo.id,
                currentChapterStatus,
                prevChapterStatus,
                isLoadingChapterStatus
              });
              
              buttonStates = getEditChapterButtonStates();
              
              console.log('Edit Chapter - Calculated Button States:', buttonStates);
              
              return (
                <>
                  {buttonStates.canUpdateDraft && (
                    <button 
                      className={styles.saveDraftBtn}
                      onClick={saveDraft}
                      disabled={isSubmitting}
                    >
                      {language === 'zh' ? '更新存为草稿' : 'Update as Draft'}
                    </button>
                  )}
                  {buttonStates.canUpdateSchedule && (
                    <button 
                      className={styles.scheduleBtn}
                      onClick={handleScheduleRelease}
                      disabled={isSubmitting || wordCount < 1000}
                    >
                      {language === 'zh' ? '更新定时发布' : 'Update Schedule'}
                    </button>
                  )}
                  {buttonStates.canUpdatePublish && (
                    <button 
                      className={styles.publishBtn}
                      onClick={handlePublish}
                      disabled={isSubmitting || wordCount < 1000}
                    >
                      {language === 'zh' ? '更新立即发布' : 'Update Publish Now'}
                    </button>
                  )}
                </>
              );
            }
          })()}
        </div>
      </div>

      <div className={styles.mainContent}>
        {/* Editor Toolbar */}
        <div className={styles.toolbar}>
          <button className={styles.toolBtn} title={language === 'zh' ? '撤销' : 'Undo'}>↶</button>
          <button className={styles.toolBtn} title={language === 'zh' ? '重做' : 'Redo'}>↷</button>
          <button 
            className={styles.toolBtn}
            onClick={handleAILayout}
            disabled={isLayouting}
            title={isLayouting ? (language === 'zh' ? '正在排版中...' : 'Layouting...') : (language === 'zh' ? 'AI 智能排版' : 'AI Smart Layout')}
          >
            {isLayouting ? (language === 'zh' ? '排版中...' : 'Layouting...') : (language === 'zh' ? '排版' : 'Layout')}
          </button>
          
          {/* 护眼模式下拉 */}
          <div className={styles.modeDropdown}>
            <button 
              className={styles.toolBtn}
              onClick={() => setEditorMode(editorMode === 'eye-care' ? 'day' : editorMode === 'day' ? 'night' : 'eye-care')}
            >
              {editorMode === 'eye-care' ? (language === 'zh' ? '护眼' : 'Eye-care') :
               editorMode === 'night' ? (language === 'zh' ? '夜间' : 'Night') :
               (language === 'zh' ? '日间' : 'Day')}
            </button>
            <div className={styles.modeMenu}>
              <button 
                className={editorMode === 'eye-care' ? styles.active : ''}
                onClick={() => setEditorMode('eye-care')}
              >
                {language === 'zh' ? '护眼' : 'Eye-care'}
              </button>
              <button 
                className={editorMode === 'night' ? styles.active : ''}
                onClick={() => setEditorMode('night')}
              >
                {language === 'zh' ? '夜间' : 'Night'}
              </button>
              <button 
                className={editorMode === 'day' ? styles.active : ''}
                onClick={() => setEditorMode('day')}
              >
                {language === 'zh' ? '日间' : 'Day'}
              </button>
            </div>
          </div>

          {/* 字体大小下拉 */}
          <div className={styles.fontSizeDropdown}>
            <button className={styles.toolBtn}>
              {fontSize}px ▼
            </button>
            <div className={styles.fontSizeMenu}>
              {[14, 16, 18, 20, 22, 24, 26, 28].map(size => (
                <button
                  key={size}
                  className={fontSize === size ? styles.active : ''}
                  onClick={() => setFontSize(size)}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>

          <button className={styles.toolBtn}>
            {language === 'zh' ? '有话说' : 'Author\'s Words'}
          </button>
          <button 
            className={`${styles.toolBtn} ${showHistory ? styles.active : ''}`}
            onClick={toggleHistory}
          >
            {language === 'zh' ? '历史' : 'History'}
          </button>
          <button 
            className={`${styles.toolBtn} ${showReplaceDialog ? styles.active : ''}`}
            onClick={() => setShowReplaceDialog(!showReplaceDialog)}
          >
            {language === 'zh' ? '替换' : 'Replace'}
          </button>
          {/* Replace Dialog */}
          {showReplaceDialog && (
            <div className={styles.replaceDialog}>
              <div className={styles.replaceTabs}>
                <button 
                  className={`${styles.replaceTab} ${replaceTab === 'find' ? styles.active : ''}`}
                  onClick={() => setReplaceTab('find')}
                >
                  {language === 'zh' ? '查找' : 'Find'}
                </button>
                <button 
                  className={`${styles.replaceTab} ${replaceTab === 'replace' ? styles.active : ''}`}
                  onClick={() => setReplaceTab('replace')}
                >
                  {language === 'zh' ? '替换' : 'Replace'}
                </button>
                <button 
                  className={styles.closeBtn}
                  onClick={() => setShowReplaceDialog(false)}
                >
                  ×
                </button>
              </div>
              <div className={styles.replaceContent}>
                {/* 查找输入框 - 两个标签页都显示 */}
                <div className={styles.replaceField}>
                  <label>{language === 'zh' ? '查找' : 'Find'}</label>
                  <input
                    type="text"
                    placeholder={language === 'zh' ? '输入查找词' : 'Enter search term'}
                    value={replaceFind}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setReplaceFind(newValue);
                      
                      // 清除高亮（输入时不清除，等待查找按钮）
                      if (!newValue.trim()) {
                        setShowHighlight(false);
                        setHighlightedContent('');
                        setReplaceMatches({ current: 0, total: 0 });
                      }
                      
                      // 清除之前的定时器
                      if (findDebounceTimerRef.current) {
                        clearTimeout(findDebounceTimerRef.current);
                      }
                      
                      // 实时查找匹配数（不显示高亮）
                      findDebounceTimerRef.current = setTimeout(() => {
                        if (newValue.trim()) {
                          const searchText = newValue.trim();
                          const content = chapterInfo.content || '';
                          const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                          const regex = new RegExp(escapedText, 'g');
                          const matches = content.match(regex);
                          const total = matches ? matches.length : 0;
                          setReplaceMatches({ 
                            current: total > 0 ? 1 : 0, 
                            total: total 
                          });
                        } else {
                          setReplaceMatches({ current: 0, total: 0 });
                        }
                        findDebounceTimerRef.current = null;
                      }, 300); // 300ms 防抖
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFind();
                      }
                    }}
                  />
                </div>
                
                {/* 替换输入框 - 仅在替换标签页显示 */}
                {replaceTab === 'replace' && (
                  <div className={styles.replaceField}>
                    <label>{language === 'zh' ? '替换' : 'Replace'}</label>
                    <input
                      type="text"
                      placeholder={language === 'zh' ? '输入替换词' : 'Enter replacement term'}
                      value={replaceWith}
                      onChange={(e) => setReplaceWith(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (replaceMatches.total > 0) {
                            handleReplace();
                          }
                        }
                      }}
                    />
                  </div>
                )}
                
                {/* 操作按钮区域 */}
                <div className={styles.replaceActions}>
                  <div className={styles.matchControls}>
                    <button 
                      className={styles.navBtn}
                      onClick={handleFindPrev}
                      disabled={replaceMatches.total === 0}
                      title={language === 'zh' ? '上一个' : 'Previous'}
                    >
                      &lt;
                    </button>
                    <span className={styles.matchCount}>
                      {replaceMatches.total > 0 
                        ? `${replaceMatches.current}/${replaceMatches.total}` 
                        : language === 'zh' ? '0/0' : '0/0'}
                    </span>
                    <button 
                      className={styles.navBtn}
                      onClick={handleFindNext}
                      disabled={replaceMatches.total === 0}
                      title={language === 'zh' ? '下一个' : 'Next'}
                    >
                      &gt;
                    </button>
                  </div>
                  
                  {/* 替换按钮 - 仅在替换标签页显示 */}
                  {replaceTab === 'replace' && (
                    <div className={styles.replaceButtons}>
                      <button 
                        className={styles.replaceAllBtn} 
                        onClick={handleReplaceAll}
                        disabled={replaceMatches.total === 0}
                      >
                        {language === 'zh' ? '全部替换' : 'Replace All'}
                      </button>
                      <button 
                        className={styles.replaceBtn} 
                        onClick={handleReplace}
                        disabled={replaceMatches.total === 0}
                      >
                        {language === 'zh' ? '替换' : 'Replace'}
                      </button>
                    </div>
                  )}
                  
                  {/* 查找按钮 - 仅在查找标签页显示 */}
                  {replaceTab === 'find' && (
                    <div className={styles.replaceButtons}>
                      <button 
                        className={styles.findBtn} 
                        onClick={handleFind}
                      >
                        {language === 'zh' ? '查找' : 'Find'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chapter Title Input */}
        <div className={styles.titleInput}>
          <span className={styles.chapterNumberLabel}>
            {language === 'zh' ? `第${chapterInfo.chapter_number}章` : `Chapter ${chapterInfo.chapter_number}`}
          </span>
          <input
            ref={titleRef}
            type="text"
            placeholder={language === 'zh' ? '请输入章节名称,最多100个字' : 'Please enter chapter title, max 100 characters'}
            maxLength={100}
            value={chapterInfo.title}
            onChange={handleTitleChange}
            style={{ fontSize: `${fontSize}px` }}
          />
        </div>

        {/* Main Content Editor */}
        <div className={styles.editorArea}>
          <textarea
            ref={contentRef}
            placeholder={language === 'zh' ? '请输入正文(正文字数最少1000字,最多50000字)' : 'Please enter main text (minimum 1000 characters, maximum 50000 characters)'}
            value={chapterInfo.content}
            onChange={handleContentChange}
            style={{ fontSize: `${fontSize}px` }}
            className={styles.contentEditor}
          />
          {/* 高亮显示层 - 覆盖在textarea上显示高亮 */}
          {/* fontSize将通过useEffect动态同步，不在这里设置 */}
          {showHighlight && highlightedContent && (
            <div 
              className={styles.highlightOverlay}
              dangerouslySetInnerHTML={{ __html: highlightedContent }}
            />
          )}
        </div>

        {/* Scroll to Bottom Button */}
        <button 
          className={styles.scrollToBottom}
          onClick={() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
        >
          ↓ {language === 'zh' ? '到达底部' : 'Reach Bottom'}
        </button>

        {/* Author's Words Section */}
        <div className={styles.authorWordsSection}>
          <div className={styles.authorWordsHeader}>
            <span className={styles.authorWordsIcon}>宣</span>
            <span>{language === 'zh' ? '作者有话说' : 'Author\'s Words'}</span>
          </div>
          <div className={styles.authorWordsHint}>
            {language === 'zh' ? '让读者大大们投必读票' : 'Let readers vote for must-read'}
          </div>
          <textarea
            className={styles.authorNote2}
            placeholder={language === 'zh' ? '来和读者们说点什么吧!记得求点赞,求关注,求打赏!' : 'Come and tell readers something! Remember to like, follow, and tip!'}
            maxLength={2000}
            value={authorNote2}
            onChange={(e) => {
              setAuthorNote2(e.target.value);
              markContentChanged(); // 标记内容已改动
            }}
          />
          <div className={styles.charCount}>{authorNote2.length}/2000</div>
        </div>
      </div>

      {/* 历史版本侧边栏 */}
      {showHistory && (
        <aside className={styles.historySidebar}>
          <div className={styles.historyHeader}>
            <h3>{language === 'zh' ? '历史版本 保留最近10个版本' : 'History Versions Keep the latest 10 versions'}</h3>
            <button 
              className={styles.closeHistoryBtn}
              onClick={() => setShowHistory(false)}
              title={language === 'zh' ? '关闭' : 'Close'}
            >
              ×
            </button>
          </div>
          
          <div className={styles.restoreBtnContainer}>
            <button
              className={`${styles.restoreVersionBtn} ${selectedVersion && selectedVersion.id !== currentVersionId ? styles.active : ''}`}
              onClick={handleRestoreVersion}
              disabled={!selectedVersion || selectedVersion.id === currentVersionId}
            >
              {language === 'zh' ? '恢复此版本' : 'Restore this version'}
            </button>
          </div>
          
          <div className={styles.historyVersionsList}>
            {loadingHistory ? (
              <div className={styles.loadingHistory}>
                {language === 'zh' ? '加载中...' : 'Loading...'}
              </div>
            ) : historyVersions.length === 0 ? (
              <div className={styles.noHistoryVersions}>
                {language === 'zh' ? '暂无历史版本' : 'No history versions'}
              </div>
            ) : (
              historyVersions.map((version: any) => {
                const isCurrent = version.id === currentVersionId;
                const isSelected = selectedVersion && selectedVersion.id === version.id;
                const date = new Date(version.created_at);
                const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
                
                return (
                  <div
                    key={version.id}
                    className={`${styles.historyVersionItem} ${isCurrent ? styles.currentVersion : ''} ${isSelected ? styles.selectedVersion : ''}`}
                    onClick={() => handleSelectVersion(version)}
                  >
                    <div className={styles.versionHeader}>
                      <span className={styles.versionTime}>{dateStr} {timeStr}</span>
                      {isCurrent && (
                        <span className={styles.currentLabel}>
                          <span className={styles.currentDot}>●</span>
                          {language === 'zh' ? '当前' : 'Current'}
                        </span>
                      )}
                    </div>
                    <div className={styles.versionWordCount}>
                      {version.word_count || 0}{language === 'zh' ? '字' : ' chars'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* Right Sidebar - 工具导航栏 */}
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
        {/* 侧边栏收缩按钮 */}
        <button 
          className={styles.sidebarToggleBtn}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? (language === 'zh' ? '展开侧边栏' : 'Expand Sidebar') : (language === 'zh' ? '收缩侧边栏' : 'Collapse Sidebar')}
        >
          {sidebarCollapsed ? '>' : '<'}
        </button>
        
        {!sidebarCollapsed && (
          <>
        {/* 我的随记 - 在右侧边栏顶部 */}
        <div className={`${styles.notesSectionSidebar} ${notesCollapsed ? styles.collapsed : ''}`}>
          <div className={styles.notesHeaderSidebar}>
            <h3>{language === 'zh' ? '我的随记' : 'My Notes'}</h3>
            <div className={styles.notesHeaderActions}>
              <button 
                className={styles.newNoteBtn}
                  onClick={handleNewNote}
              >
                + {language === 'zh' ? '新建' : 'New'}
              </button>
              <button 
                  className={styles.notesCollapseBtn}
                onClick={() => setNotesCollapsed(!notesCollapsed)}
                title={notesCollapsed ? (language === 'zh' ? '展开' : 'Expand') : (language === 'zh' ? '收起' : 'Collapse')}
              >
                  {notesCollapsed ? '>' : '<'}
              </button>
            </div>
          </div>
          
          {!notesCollapsed && (
            <>
                <div className={styles.noteSearch}>
                  <div className={styles.searchIcon}>🔍</div>
                <input
                  type="text"
                  placeholder={language === 'zh' ? '请输入随记的名称或内容' : 'Please enter note name or content'}
                  value={noteSearchKeyword}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNoteSearchKeyword(value);
                      // 当输入改变时，清除高亮
                      if (searchHighlight) {
                        setSearchHighlight('');
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSearchInNotes();
                      }
                    }}
                  />
                  <button 
                    onClick={handleSearchInNotes}
                    className={styles.searchBtn}
                  >
                    {language === 'zh' ? '搜索' : 'Search'}
                  </button>
              </div>

              <div className={styles.notesListSidebar}>
                  {loadingNotes && notes.length === 0 ? (
                    <div className={styles.noNotes}>
                      {language === 'zh' ? '加载中...' : 'Loading...'}
                    </div>
                  ) : notes.length === 0 ? (
                  <div className={styles.noNotes}>
                    {language === 'zh' ? '暂无随记' : 'No notes yet'}
                  </div>
                ) : (
                    <>
                      {notes.map(note => {
                        const title = language === 'zh' ? `随记${note.id}` : `Note ${note.id}`;
                        const content = note.random_note || '';
                        const titleMatch = searchHighlight && title.includes(searchHighlight);
                        const contentMatch = searchHighlight && content.includes(searchHighlight);
                        
                        return (
                    <div key={note.id} className={styles.noteItem}>
                            <div className={styles.noteTitle}>
                              {searchHighlight && titleMatch ? highlightText(title, searchHighlight) : title}
                              <div className={styles.noteActions}>
                                <button 
                                  className={styles.editNoteBtn}
                                  onClick={() => handleEditNote(note)}
                                  title={language === 'zh' ? '编辑' : 'Edit'}
                                >
                                  ✏️
                                </button>
                                <button 
                                  className={styles.deleteNoteBtn}
                                  onClick={() => handleDeleteNote(note.id)}
                                  title={language === 'zh' ? '删除' : 'Delete'}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                            <div className={styles.noteContent}>
                              {searchHighlight && contentMatch ? highlightText(content, searchHighlight) : content}
                            </div>
                      <div className={styles.noteTime}>
                              {new Date(note.updated_at || note.created_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                        );
                      })}
                      {hasMoreNotes ? (
                        <button 
                          className={styles.loadMoreBtn}
                          onClick={handleLoadMore}
                          disabled={loadingNotes}
                        >
                          {loadingNotes ? (language === 'zh' ? '加载中...' : 'Loading...') : (language === 'zh' ? '加载更多' : 'Load More')}
                        </button>
                      ) : notes.length > 0 && (
                        <div className={styles.noMoreNotes}>
                          {language === 'zh' ? '已经到底啦~' : 'Already at the bottom~'}
              </div>
                      )}
            </>
          )}
        </div>
              </>
            )}
            
            {/* 新建/编辑随记模态框 */}
            {showNoteModal && (
              <div className={styles.noteModal} onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowNoteModal(false);
                  setEditingNote(null);
                  setNoteModalContent('');
                }
              }}>
                <div className={styles.noteModalContent}>
                  <div className={styles.noteModalHeader}>
                    <h3>{editingNote ? (language === 'zh' ? '编辑随记' : 'Edit Note') : (language === 'zh' ? '新建随记' : 'New Note')}</h3>
          <button 
                      className={styles.closeModalBtn}
                      onClick={() => {
                        setShowNoteModal(false);
                        setEditingNote(null);
                        setNoteModalContent('');
                      }}
                    >
                      ×
          </button>
                  </div>
                  <div className={styles.noteModalBody}>
                    <textarea
                      className={styles.noteModalTextarea}
                      placeholder={language === 'zh' ? '请输入随记内容...' : 'Please enter note content...'}
                      value={noteModalContent}
                      onChange={(e) => setNoteModalContent(e.target.value)}
                      rows={8}
                    />
                  </div>
                  <div className={styles.noteModalFooter}>
          <button 
                      className={styles.cancelBtn}
                      onClick={() => {
                        setShowNoteModal(false);
                        setEditingNote(null);
                        setNoteModalContent('');
                      }}
                    >
                      {language === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button 
                      className={styles.saveBtn}
                      onClick={handleSaveNote}
                    >
                      {language === 'zh' ? '保存' : 'Save'}
          </button>
        </div>
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </aside>

      {/* 定时发布对话框 */}
      <ScheduleReleaseModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onConfirm={handleConfirmSchedule}
        initialDate={chapterInfo.release_date ? new Date(chapterInfo.release_date) : undefined}
        minReleaseDate={
          (chapterId || chapterInfo.id) 
            ? (prevChapterStatus?.release_date ? new Date(prevChapterStatus.release_date) : undefined)
            : (lastChapterStatus?.release_date ? new Date(lastChapterStatus.release_date) : undefined)
        }
        isLoading={isSubmitting}
        novelTitle={title}
        previousChapter={previousChapter ? `第${previousChapter.chapter_number}章 ${previousChapter.title}` : ''}
        currentChapter={`第${chapterInfo.chapter_number}章 ${chapterInfo.title || ''}`}
        wordCount={wordCount}
        isEditMode={!!(chapterId || chapterInfo.id)}
      />

      {/* Toast 提示 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={5000}
          onClose={() => setToast(null)}
        />
      )}

      {/* 章节更新确认对话框 */}
      <ChapterUpdateConfirmDialog
        isOpen={showUpdateConfirmDialog}
        onClose={() => {
          setShowUpdateConfirmDialog(false);
          setExistingChapter(null);
          setPendingAction(null);
          setPendingFormData(null);
        }}
        onConfirm={async () => {
          if (!pendingFormData || !existingChapter || !pendingAction) return;
          
          setIsSubmitting(true);
          try {
            // 将创建请求改为更新请求
            pendingFormData.append('chapter_id', existingChapter.id.toString());
            
            let response: Response;
            if (pendingAction === 'schedule') {
              response = await fetch(`${getApiBaseUrl()}/chapter/update`, {
                method: 'POST',
                headers: {
                  'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
                },
                body: pendingFormData
              });
            } else if (pendingAction === 'publish') {
              pendingFormData.append('action', 'publish');
              pendingFormData.append('is_released', '1');
              response = await fetch(`${getApiBaseUrl()}/chapter/update`, {
                method: 'POST',
                headers: {
                  'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
                },
                body: pendingFormData
              });
            } else {
              // draft
              pendingFormData.append('action', 'draft');
              response = await fetch(`${getApiBaseUrl()}/chapter/update`, {
                method: 'POST',
                headers: {
                  'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
                },
                body: pendingFormData
              });
            }
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || '更新失败');
            }
            
            const result = await response.json();
            
            // 更新章节信息
            setChapterInfo(prev => ({ ...prev, id: existingChapter.id }));
            
            // 显示成功提示
            setToast({ 
              message: pendingAction === 'schedule' 
                ? 'Scheduled release updated successfully!' 
                : pendingAction === 'publish'
                ? 'Chapter updated and published successfully!'
                : 'Draft updated successfully!', 
              type: 'success' 
            });
            
            // 关闭对话框
            setShowUpdateConfirmDialog(false);
            setExistingChapter(null);
            setPendingAction(null);
            setPendingFormData(null);
            
            // 如果是定时发布或发布，跳转到章节管理页面
            if (pendingAction === 'schedule' || pendingAction === 'publish') {
              setTimeout(() => {
                navigate(`/novel-manage/${novelId}?tab=chapters`);
              }, 500);
            }
          } catch (error: any) {
            console.error('更新章节失败:', error);
            setToast({ 
              message: error.message || 'Failed to update chapter', 
              type: 'error' 
            });
          } finally {
            setIsSubmitting(false);
          }
        }}
        existingChapter={existingChapter}
        newChapterTitle={chapterInfo.title || `Chapter ${chapterInfo.chapter_number}`}
        chapterNumber={chapterInfo.chapter_number}
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default ChapterWriter;


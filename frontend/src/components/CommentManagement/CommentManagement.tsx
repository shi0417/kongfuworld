import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import ApiService from '../../services/ApiService';
import reviewService from '../../services/reviewService';
import chapterCommentService from '../../services/chapterCommentService';
import reportService from '../../services/reportService';
import ReviewReplies from '../ReviewSection/ReviewReplies';
import ChapterCommentReplies from '../ChapterCommentSection/ChapterCommentReplies';
import ReportButton from '../ReportButton/ReportButton';
import styles from './CommentManagement.module.css';
import reviewStyles from '../ReviewSection/ReviewSectionNew.module.css';
import chapterStyles from '../ChapterCommentSection/ChapterCommentSectionNew.module.css';
import paragraphStyles from '../ParagraphComment/ParagraphComment.module.css';

interface Novel {
  id: number;
  title: string;
  cover: string | null;
}

interface Comment {
  id: number;
  comment_type: 'review' | 'discussion' | 'chapter' | 'paragraph';
  content: string;
  rating: number | null;
  created_at: string;
  likes: number;
  dislikes?: number; // 点踩数量
  reply_count: number;
  views: number;
  is_recommended: number | null;
  user_id: number;
  username: string;
  pen_name?: string | null; // 笔名
  avatar: string | null;
  is_vip: number;
  is_author?: number; // 是否为作者（可选字段，用于回复列表）
  novel_id: number;
  novel_title: string;
  chapter_id: number | null;
  chapter_title: string | null;
  paragraph_index?: number; // 段落索引（用于段评）
  parent_comment_id: number | null;
  replies?: Comment[]; // 嵌套回复
  report_count?: number; // 举报数量
}

interface CommentManagementProps {
  userId: number;
}

const CommentManagement: React.FC<CommentManagementProps> = ({ userId }) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  
  // 评价相关状态（复用ReviewSectionNew的逻辑）
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editReviewContent, setEditReviewContent] = useState('');
  const [expandedReviews, setExpandedReviews] = useState<Set<number>>(new Set());
  
  // 章评相关状态（复用ChapterCommentSectionNew的逻辑）
  const [editingChapterCommentId, setEditingChapterCommentId] = useState<number | null>(null);
  const [editChapterCommentContent, setEditChapterCommentContent] = useState('');
  const [showRepliesMap, setShowRepliesMap] = useState<Record<number, boolean>>({});
  const [showReplyFormMap, setShowReplyFormMap] = useState<Record<number, boolean>>({});
  const [replyCountsMap, setReplyCountsMap] = useState<Record<number, number>>({});
  
  // 段评相关状态（复用ParagraphComment的逻辑）
  const [editingParagraphCommentId, setEditingParagraphCommentId] = useState<number | null>(null);
  const [editParagraphCommentContent, setEditParagraphCommentContent] = useState('');
  const [showParagraphRepliesMap, setShowParagraphRepliesMap] = useState<Record<number, boolean>>({});
  const [showParagraphReplyFormMap, setShowParagraphReplyFormMap] = useState<Record<number, boolean>>({});
  const [paragraphReplyCountsMap, setParagraphReplyCountsMap] = useState<Record<number, number>>({});
  const [paragraphReplyContentMap, setParagraphReplyContentMap] = useState<Record<number, string>>({});

  // 筛选条件
  const [selectedNovelId, setSelectedNovelId] = useState<number | ''>('');
  const [selectedCommentType, setSelectedCommentType] = useState<string>('review');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'hottest'>('newest');
  const [selectedReportReason, setSelectedReportReason] = useState<string>(''); // 举报原因筛选

  // 回复相关
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showReplies, setShowReplies] = useState<{ [key: number]: boolean }>({});
  const [replies, setReplies] = useState<{ [key: number]: Comment[] }>({});

  // 加载作品列表
  useEffect(() => {
    loadNovels();
  }, []);

  const loadNovels = async () => {
    try {
      const response = await ApiService.get('/comment-management/novels');
      if (response.success) {
        setNovels(response.data);
      }
    } catch (error) {
      console.error('加载作品列表失败:', error);
    }
  };

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit,
        sortBy
      };

      if (selectedNovelId) {
        params.novelId = selectedNovelId;
      }

      if (selectedCommentType) {
        params.commentType = selectedCommentType;
      }

      if (selectedDateRange) {
        const today = new Date();
        if (selectedDateRange === 'today') {
          params.startDate = today.toISOString().split('T')[0];
          params.endDate = today.toISOString().split('T')[0];
        } else if (selectedDateRange === '7days') {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          params.startDate = sevenDaysAgo.toISOString().split('T')[0];
          params.endDate = today.toISOString().split('T')[0];
        } else if (selectedDateRange === '30days') {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          params.startDate = thirtyDaysAgo.toISOString().split('T')[0];
          params.endDate = today.toISOString().split('T')[0];
        }
      }

      if (startDate) {
        params.startDate = startDate;
      }

      if (endDate) {
        params.endDate = endDate;
      }

      if (selectedReportReason) {
        params.reportReason = selectedReportReason;
      }

      const queryString = new URLSearchParams(params).toString();
      const response = await ApiService.get(`/comment-management/comments?${queryString}`);
      
      if (response.success) {
        setComments(response.data.comments || []);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      console.error('加载评论列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedNovelId, selectedCommentType, selectedDateRange, startDate, endDate, sortBy, page, selectedReportReason]);

  // 加载评论列表
  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleReply = useCallback(async (commentId: number, commentType: string) => {
    if (!replyContent.trim()) {
      alert(language === 'zh' ? '请输入回复内容' : 'Please enter reply content');
      return;
    }

    try {
      await ApiService.post(`/comment-management/comments/${commentId}/reply`, {
        content: replyContent,
        commentType
      });
      
      setReplyContent('');
      setReplyingTo(null);
      await loadComments();
      alert(language === 'zh' ? '回复成功' : 'Reply sent successfully');
    } catch (error: any) {
      console.error('回复失败:', error);
      alert(error.response?.data?.message || (language === 'zh' ? '回复失败' : 'Failed to reply'));
    }
  }, [replyContent, language, loadComments]);

  const loadReplies = useCallback(async (commentId: number) => {
    try {
      const response = await ApiService.get(`/comment-management/comments/${commentId}/replies`);
      if (response.success) {
        setReplies(prev => ({
          ...prev,
          [commentId]: response.data.replies || []
        }));
        setShowReplies(prev => ({
          ...prev,
          [commentId]: !prev[commentId]
        }));
      }
    } catch (error) {
      console.error('加载回复失败:', error);
    }
  }, []);

  const getCommentTypeText = useCallback((type: string) => {
    const typeMap: { [key: string]: { zh: string; en: string } } = {
      review: { zh: '评价', en: 'Review' },
      discussion: { zh: '讨论', en: 'Discussion' },
      chapter: { zh: '章评', en: 'Chapter Comment' },
      paragraph: { zh: '段评', en: 'Paragraph Comment' }
    };
    return typeMap[type] ? (language === 'zh' ? typeMap[type].zh : typeMap[type].en) : type;
  }, [language]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
  }, [language]);

  // 获取头像URL（与小说详情页面保持一致）
  const getAvatarUrl = useCallback((avatar?: string | null) => {
    if (!avatar) {
      return 'https://i.pravatar.cc/40?img=1';
    }
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    if (avatar.startsWith('/')) {
      return `${(typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')}${avatar}`;
    }
    return `http://localhost:5000/avatars/${avatar}`;
  }, []);

  // 获取显示名称（如果是作者且有笔名，显示笔名，否则显示用户名）
  const getDisplayName = useCallback((comment: Comment) => {
    if (comment.is_author && comment.pen_name) {
      return comment.pen_name;
    }
    return comment.username;
  }, []);

  // 判断是否为作者
  const isAuthor = useCallback((comment: Comment) => {
    return comment.is_author === 1;
  }, []);

  // 使用 useCallback 包装回调函数，避免每次渲染都创建新的函数引用
  const handleReplyClick = useCallback((id: number) => {
    setReplyingTo(prev => prev === id ? null : id);
  }, []);

  const handleReplyContentChange = useCallback((content: string) => {
    setReplyContent(content);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyContent('');
  }, []);

  // ========== 评价（Review）相关处理函数 ==========
  const handleLikeReview = useCallback(async (reviewId: number) => {
    if (!user) return;
    try {
      const result = await reviewService.likeReview(reviewId);
      if (result.data && result.data.likes !== undefined) {
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === reviewId && comment.comment_type === 'review'
              ? { ...comment, likes: result.data.likes, dislikes: result.data.dislikes || 0 }
              : comment
          )
        );
      } else {
        await loadComments();
      }
    } catch (err: any) {
      console.error('点赞失败:', err);
      await loadComments();
    }
  }, [user, loadComments]);

  const handleDislikeReview = useCallback(async (reviewId: number) => {
    if (!user) return;
    try {
      const result = await reviewService.dislikeReview(reviewId);
      if (result.data && result.data.dislikes !== undefined) {
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === reviewId && comment.comment_type === 'review'
              ? { ...comment, likes: result.data.likes, dislikes: result.data.dislikes }
              : comment
          )
        );
      } else {
        await loadComments();
      }
    } catch (err: any) {
      console.error('点踩失败:', err);
      await loadComments();
    }
  }, [user, loadComments]);

  const handleEditReview = useCallback((review: Comment) => {
    setEditingReviewId(review.id);
    setEditReviewContent(review.content);
  }, []);

  const handleCancelEditReview = useCallback(() => {
    setEditingReviewId(null);
    setEditReviewContent('');
  }, []);

  const handleSaveEditReview = useCallback(async (reviewId: number) => {
    if (!editReviewContent.trim()) return;
    try {
      await reviewService.updateReview(reviewId, editReviewContent);
      setEditingReviewId(null);
      setEditReviewContent('');
      await loadComments();
    } catch (err: any) {
      console.error('更新评论失败:', err);
    }
  }, [editReviewContent, loadComments]);

  const handleReplySubmitReview = useCallback(async (reviewId: number, content: string) => {
    if (!user) throw new Error('Please login first');
    try {
      await ApiService.request(`/review/${reviewId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      await loadComments();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to submit reply');
    }
  }, [user, loadComments]);

  const toggleReviewExpansion = useCallback((reviewId: number) => {
    setExpandedReviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  }, []);

  const getTruncatedContent = useCallback((content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }, []);

  const renderStars = useCallback((rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={reviewStyles.star}>
          {i <= rating ? '⭐️' : '☆'}
        </span>
      );
    }
    return stars;
  }, []);

  // 评价的formatDate（与ReviewSectionNew一致）
  const formatReviewDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffSeconds = Math.floor(diffTime / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) === 1 ? 'month' : 'months'} ago`;
    return `${Math.floor(diffDays / 365)} ${Math.floor(diffDays / 365) === 1 ? 'year' : 'years'} ago`;
  }, []);

  // ========== 章评（Chapter Comment）相关处理函数 ==========
  const handleLikeChapterComment = useCallback(async (commentId: number) => {
    if (!user) return;
    try {
      const result = await chapterCommentService.likeChapterComment(commentId);
      if (result.data && result.data.likes !== undefined) {
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === commentId && comment.comment_type === 'chapter'
              ? { ...comment, likes: result.data.likes, dislikes: result.data.dislikes || 0 }
              : comment
          )
        );
      } else {
        await loadComments();
      }
    } catch (err: any) {
      console.error('点赞失败:', err);
      await loadComments();
    }
  }, [user, loadComments]);

  const handleDislikeChapterComment = useCallback(async (commentId: number) => {
    if (!user) return;
    try {
      const result = await chapterCommentService.dislikeChapterComment(commentId);
      if (result.data && result.data.dislikes !== undefined) {
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === commentId && comment.comment_type === 'chapter'
              ? { ...comment, likes: result.data.likes, dislikes: result.data.dislikes }
              : comment
          )
        );
      } else {
        await loadComments();
      }
    } catch (err: any) {
      console.error('点踩失败:', err);
      await loadComments();
    }
  }, [user, loadComments]);

  const handleEditChapterComment = useCallback((comment: Comment | any) => {
    setEditingChapterCommentId(comment.id);
    setEditChapterCommentContent(comment.content);
  }, []);

  const handleCancelEditChapterComment = useCallback(() => {
    setEditingChapterCommentId(null);
    setEditChapterCommentContent('');
  }, []);

  const handleSaveEditChapterComment = useCallback(async (commentId: number) => {
    if (!editChapterCommentContent.trim() || editChapterCommentContent.trim().length < 10) return;
    try {
      await chapterCommentService.updateChapterComment(commentId, editChapterCommentContent);
      setEditingChapterCommentId(null);
      setEditChapterCommentContent('');
      await loadComments();
    } catch (err: any) {
      console.error('更新评论失败:', err);
    }
  }, [editChapterCommentContent, loadComments]);

  const handleReplySubmitChapterComment = useCallback(async (commentId: number, content: string) => {
    if (!user) return;
    try {
      await chapterCommentService.replyToComment(commentId, content);
      await loadComments();
    } catch (err: any) {
      console.error('回复失败:', err);
    }
  }, [user, loadComments]);

  // 章评的formatDate（与ChapterCommentSectionNew一致）
  const formatChapterDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffSeconds = Math.floor(diffTime / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) === 1 ? 'month' : 'months'} ago`;
    return `${Math.floor(diffDays / 365)} ${Math.floor(diffDays / 365) === 1 ? 'year' : 'years'} ago`;
  }, []);

  // 加载章评的回复数量
  useEffect(() => {
    const loadChapterReplyCounts = async () => {
      const chapterComments = comments.filter(c => c.comment_type === 'chapter');
      for (const comment of chapterComments) {
        try {
          const replyData = await chapterCommentService.getCommentReplies(comment.id);
          setReplyCountsMap(prev => ({ ...prev, [comment.id]: replyData.length }));
        } catch (err) {
          console.error('Failed to load reply count:', err);
        }
      }
    };
    if (selectedCommentType === 'chapter' && comments.length > 0) {
      loadChapterReplyCounts();
    }
  }, [comments, selectedCommentType]);

  // ========== 段评（Paragraph Comment）相关处理函数 ==========
  const handleLikeParagraphComment = useCallback(async (commentId: number, isLike: boolean) => {
    if (!user) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/paragraph-comment/${commentId}/like`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            isLike: isLike ? 1 : 0
          })
        }
      );
      const data = await response.json();
      if (data.success) {
        setComments(prevComments => 
          prevComments.map(comment => {
            if (comment.id === commentId && comment.comment_type === 'paragraph') {
              return { 
                ...comment, 
                likes: data.data.like_count, 
                dislikes: data.data.dislike_count || 0 
              };
            }
            return comment;
          })
        );
      }
    } catch (error) {
      console.error('点赞失败:', error);
    }
  }, [user]);

  const handleDislikeParagraphComment = useCallback(async (commentId: number, isLike: boolean) => {
    await handleLikeParagraphComment(commentId, false);
  }, [handleLikeParagraphComment]);

  const handleEditParagraphComment = useCallback((comment: Comment) => {
    setEditingParagraphCommentId(comment.id);
    setEditParagraphCommentContent(comment.content);
  }, []);

  const handleCancelEditParagraphComment = useCallback(() => {
    setEditingParagraphCommentId(null);
    setEditParagraphCommentContent('');
  }, []);

  const handleSaveEditParagraphComment = useCallback(async (commentId: number) => {
    if (!editParagraphCommentContent.trim() || editParagraphCommentContent.trim().length < 10) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/paragraph-comment/${commentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            content: editParagraphCommentContent.trim()
          })
        }
      );
      const data = await response.json();
      if (data.success) {
        setEditingParagraphCommentId(null);
        setEditParagraphCommentContent('');
        await loadComments();
      }
    } catch (error) {
      console.error('更新评论失败:', error);
    }
  }, [editParagraphCommentContent, loadComments]);

  const handleReplySubmitParagraphComment = useCallback(async (commentId: number, content: string) => {
    if (!content.trim() || !user) return;
    if (content.trim().length < 10) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/paragraph-comment/${commentId}/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content.trim(),
            userId: user.id,
            parentId: commentId
          })
        }
      );
      const data = await response.json();
      if (data.success) {
        setParagraphReplyContentMap(prev => ({ ...prev, [commentId]: '' }));
        setShowParagraphReplyFormMap(prev => ({ ...prev, [commentId]: false }));
        await loadComments();
      }
    } catch (error) {
      console.error('提交回复失败:', error);
    }
  }, [user, loadComments]);

  // 段评的formatDate（与ParagraphComment一致）
  const formatParagraphDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - date.getTime());
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks < 4) return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
    if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
  }, []);

  // 嵌套评论项组件
  interface CommentItemProps {
    comment: Comment;
    selectedReportReason: string;
    selectedCommentType: string;
    replyingTo: number | null;
    replyContent: string;
    showReplies: { [key: number]: boolean };
    replies: { [key: number]: Comment[] };
    onReplyClick: (id: number) => void;
    onReplyContentChange: (content: string) => void;
    onReplySubmit: (id: number, type: string) => void;
    onCancelReply: () => void;
    onLoadReplies: (id: number) => void;
    language: string;
    getAvatarUrl: (avatar?: string | null) => string;
    formatDate: (dateString: string) => string;
    getCommentTypeText: (type: string) => string;
  }

  const CommentItem: React.FC<CommentItemProps> = React.memo(({
    comment,
    selectedReportReason,
    selectedCommentType,
    replyingTo,
    replyContent,
    showReplies,
    replies,
    onReplyClick,
    onReplyContentChange,
    onReplySubmit,
    onCancelReply,
    onLoadReplies,
    language,
    getAvatarUrl,
    formatDate,
    getCommentTypeText
  }) => {
    // 使用 useRef 保存 textarea 的引用和光标位置
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const selectionStartRef = useRef<number>(0);
    const selectionEndRef = useRef<number>(0);
    const isComposingRef = useRef<boolean>(false); // 标记是否正在输入法组合中
    
    // 当 replyingTo 变为当前评论的 ID 时，自动聚焦到输入框
    useEffect(() => {
      if (replyingTo === comment.id && textareaRef.current) {
        // 使用 setTimeout 确保 DOM 已经更新
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            // 将光标移到文本末尾
            const length = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(length, length);
            selectionStartRef.current = length;
            selectionEndRef.current = length;
          }
        }, 0);
      }
    }, [replyingTo, comment.id]);
    
    // 当 replyContent 变化时，如果输入框有焦点且不在输入法组合中，恢复光标位置
    useEffect(() => {
      if (replyingTo === comment.id && textareaRef.current && document.activeElement === textareaRef.current && !isComposingRef.current) {
        // 如果输入框当前有焦点，恢复光标位置
        requestAnimationFrame(() => {
          if (textareaRef.current && document.activeElement === textareaRef.current && !isComposingRef.current) {
            const start = selectionStartRef.current;
            const end = selectionEndRef.current;
            // 确保光标位置在有效范围内
            const maxPos = textareaRef.current.value.length;
            const safeStart = Math.min(start, maxPos);
            const safeEnd = Math.min(end, maxPos);
            textareaRef.current.setSelectionRange(safeStart, safeEnd);
          }
        });
      }
    }, [replyContent, replyingTo, comment.id]);
    
    // 处理输入法组合开始
    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };
    
    // 处理输入法组合更新
    const handleCompositionUpdate = () => {
      // 在组合过程中不更新状态，让浏览器处理
    };
    
    // 处理输入法组合结束
    const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      isComposingRef.current = false;
      // 组合结束后，更新状态
      if (textareaRef.current) {
        selectionStartRef.current = textareaRef.current.selectionStart;
        selectionEndRef.current = textareaRef.current.selectionEnd;
      }
      onReplyContentChange(e.currentTarget.value);
    };
    
    // 处理输入变化，保存光标位置
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // 如果正在输入法组合中，不更新状态
      if (isComposingRef.current) {
        return;
      }
      
      if (textareaRef.current) {
        selectionStartRef.current = textareaRef.current.selectionStart;
        selectionEndRef.current = textareaRef.current.selectionEnd;
      }
      onReplyContentChange(e.target.value);
    };
    
    // 如果是review/chapter/paragraph类型且没有选择举报原因，显示嵌套结构
    const showNested = (selectedCommentType === 'review' || selectedCommentType === 'chapter' || selectedCommentType === 'paragraph') && !selectedReportReason && comment.replies;

    return (
      <div className={styles.commentItem}>
        <div className={styles.commentHeader}>
          <div className={styles.userInfo}>
            {comment.avatar ? (
              <img src={getAvatarUrl(comment.avatar)} alt={getDisplayName(comment)} className={styles.avatar} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {getDisplayName(comment).charAt(0).toUpperCase()}
              </div>
            )}
            <div className={styles.userDetails}>
              <span className={styles.username}>
                {getDisplayName(comment)}
                {isAuthor(comment) && (
                  <span className={styles.authorBadge}>{language === 'zh' ? '作者' : 'Author'}</span>
                )}
                {comment.is_vip && <span className={styles.vipBadge}>VIP</span>}
              </span>
              <span className={styles.commentMeta}>
                {formatDate(comment.created_at)}
                {comment.chapter_title && ` · ${comment.chapter_title}`}
              </span>
            </div>
          </div>
          <div className={styles.commentType}>
            {getCommentTypeText(comment.comment_type)}
          </div>
        </div>

        <div className={styles.commentContent}>
          {comment.rating && (
            <div className={styles.rating}>
              {language === 'zh' ? '评分:' : 'Rating:'} {'⭐'.repeat(comment.rating)}
            </div>
          )}
          {comment.is_recommended !== null && comment.is_recommended === 1 && (
            <span className={styles.recommended}>{language === 'zh' ? '推荐' : 'Recommended'}</span>
          )}
          {selectedReportReason && comment.report_count !== undefined && comment.report_count > 0 && (
            <div className={styles.reportCount}>
              {language === 'zh' ? `举报数量: ${comment.report_count}条` : `Report Count: ${comment.report_count}`}
            </div>
          )}
          <p>{comment.content}</p>
        </div>

        <div className={styles.commentFooter}>
          <div className={styles.commentStats}>
            <span>👍 {comment.likes}</span>
            {comment.reply_count > 0 && !showNested && (
              <span onClick={() => onLoadReplies(comment.id)} className={styles.replyCount}>
                💬 {comment.reply_count}
              </span>
            )}
            {comment.views > 0 && <span>👁️ {comment.views}</span>}
          </div>
          {!selectedReportReason && (
            <button
              className={styles.replyButton}
              onClick={() => onReplyClick(comment.id)}
            >
              {language === 'zh' ? '回复' : 'Reply'}
            </button>
          )}
        </div>

        {/* 回复输入框 */}
        {!selectedReportReason && replyingTo === comment.id && (
          <div className={styles.replyForm}>
            <textarea
              ref={textareaRef}
              value={replyContent}
              onChange={handleInputChange}
              onCompositionStart={handleCompositionStart}
              onCompositionUpdate={handleCompositionUpdate}
              onCompositionEnd={handleCompositionEnd}
              onSelect={(e) => {
                const target = e.target as HTMLTextAreaElement;
                selectionStartRef.current = target.selectionStart;
                selectionEndRef.current = target.selectionEnd;
              }}
              placeholder={language === 'zh' ? '输入回复内容...' : 'Enter reply content...'}
              className={styles.replyTextarea}
            />
            <div className={styles.replyActions}>
              <button
                className={styles.cancelButton}
                onClick={onCancelReply}
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                className={styles.submitButton}
                onClick={() => onReplySubmit(comment.id, comment.comment_type)}
              >
                {language === 'zh' ? '发送' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {/* 嵌套回复列表（review类型且没有选择举报原因时） */}
        {showNested && comment.replies && comment.replies.length > 0 && (
          <div className={styles.repliesList}>
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                selectedReportReason={selectedReportReason}
                selectedCommentType={selectedCommentType}
                replyingTo={replyingTo}
                replyContent={replyContent}
                showReplies={showReplies}
                replies={replies}
                onReplyClick={onReplyClick}
                onReplyContentChange={onReplyContentChange}
                onReplySubmit={onReplySubmit}
                onCancelReply={onCancelReply}
                onLoadReplies={onLoadReplies}
                language={language}
                getAvatarUrl={getAvatarUrl}
                formatDate={formatDate}
                getCommentTypeText={getCommentTypeText}
              />
            ))}
          </div>
        )}

        {/* 非嵌套回复列表（其他情况） */}
        {!showNested && showReplies[comment.id] && replies[comment.id] && (
          <div className={styles.repliesList}>
            {replies[comment.id].map(reply => (
              <div key={reply.id} className={styles.replyItem}>
                <div className={styles.replyHeader}>
                  {reply.avatar ? (
                    <img src={getAvatarUrl(reply.avatar)} alt={getDisplayName(reply)} className={styles.replyAvatar} />
                  ) : (
                    <div className={styles.replyAvatarPlaceholder}>
                      {getDisplayName(reply).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className={styles.replyUsername}>
                    {getDisplayName(reply)}
                    {isAuthor(reply) && <span className={styles.authorBadge}>{language === 'zh' ? '作者' : 'Author'}</span>}
                  </span>
                  <span className={styles.replyDate}>{formatDate(reply.created_at)}</span>
                </div>
                <div className={styles.replyContent}>{reply.content}</div>
                <div className={styles.replyFooter}>
                  <span>👍 {reply.likes}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  });

  return (
    <div className={styles.container}>
      {/* 操作按钮 */}
      <div className={styles.headerActions}>
        <button className={styles.writeCommentBtn}>
          <span>+</span> {language === 'zh' ? '写评论' : 'Write Comment'}
        </button>
        <button className={styles.settingsBtn}>⚙️</button>
      </div>

      {/* 筛选区域 */}
      <div className={styles.filters}>
        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label>{language === 'zh' ? '选择作品:' : 'Select Work:'}</label>
            <select
              value={selectedNovelId}
              onChange={(e) => setSelectedNovelId(e.target.value ? parseInt(e.target.value) : '')}
              className={styles.select}
            >
              <option value="">{language === 'zh' ? '选择作品' : 'Select Work'}</option>
              {novels.map(novel => (
                <option key={novel.id} value={novel.id}>{novel.title}</option>
              ))}
            </select>
          </div>

          <div className={styles.filterItem}>
            <label>{language === 'zh' ? '选择平台:' : 'Select Platform:'}</label>
            <select className={styles.select} defaultValue="kongfuworld">
              <option value="kongfuworld">{language === 'zh' ? 'kongfuworld网站' : 'kongfuworld Website'}</option>
            </select>
          </div>
        </div>

        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label>{language === 'zh' ? '评论类型:' : 'Comment Type:'}</label>
            <div className={styles.typeButtons}>
              {['review', 'discussion', 'chapter', 'paragraph'].map(type => (
                <button
                  key={type}
                  className={`${styles.typeButton} ${selectedCommentType === type ? styles.active : ''}`}
                  onClick={() => setSelectedCommentType(type)}
                >
                  {getCommentTypeText(type)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.filterRow}>
          <div className={styles.filterItem}>
            <label>{language === 'zh' ? '发表日期:' : 'Publication Date:'}</label>
            <div className={styles.dateFilterContainer}>
              <div className={styles.dateButtons}>
                <button
                  className={`${styles.dateButton} ${selectedDateRange === 'today' ? styles.active : ''}`}
                  onClick={() => setSelectedDateRange(selectedDateRange === 'today' ? '' : 'today')}
                >
                  {language === 'zh' ? '今日' : 'Today'}
                </button>
                <button
                  className={`${styles.dateButton} ${selectedDateRange === '7days' ? styles.active : ''}`}
                  onClick={() => setSelectedDateRange(selectedDateRange === '7days' ? '' : '7days')}
                >
                  {language === 'zh' ? '7日' : '7 Days'}
                </button>
                <button
                  className={`${styles.dateButton} ${selectedDateRange === '30days' ? styles.active : ''}`}
                  onClick={() => setSelectedDateRange(selectedDateRange === '30days' ? '' : '30days')}
                >
                  {language === 'zh' ? '30日' : '30 Days'}
                </button>
              </div>
              <div className={styles.dateRangePicker}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={styles.dateRangeInput}
                />
                <span className={styles.dateRangeSeparator}>{language === 'zh' ? '至' : 'to'}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={styles.dateRangeInput}
                />
                <span className={styles.dateRangeIcon}>📅</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 评论列表 */}
      <div className={styles.commentsSection}>
        <div className={styles.commentsHeader}>
          <h3>
            {language === 'zh' ? `全部${getCommentTypeText(selectedCommentType)}(${total})` : `All ${getCommentTypeText(selectedCommentType)}(${total})`}
          </h3>
          <div className={styles.sortButtons}>
            <button
              className={`${styles.sortButton} ${sortBy === 'hottest' ? styles.active : ''}`}
              onClick={() => setSortBy('hottest')}
            >
              {language === 'zh' ? '最热' : 'Hottest'}
            </button>
            <button
              className={`${styles.sortButton} ${sortBy === 'newest' ? styles.active : ''}`}
              onClick={() => setSortBy('newest')}
            >
              {language === 'zh' ? '最新' : 'Newest'}
            </button>
          </div>
        </div>

        {/* 举报原因筛选按钮 */}
        <div className={styles.reportReasonFilters}>
          {[
            'Spoilers',
            'Abuse or harassment',
            'Spam',
            'Copyright infringement',
            'Discrimination (racism, sexism, etc.)',
            'Request to delete a comment that you created'
          ].map(reason => (
            <button
              key={reason}
              className={`${styles.reportReasonButton} ${selectedReportReason === reason ? styles.active : ''}`}
              onClick={() => {
                setSelectedReportReason(selectedReportReason === reason ? '' : reason);
                setPage(1); // 重置到第一页
              }}
            >
              {reason}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>
        ) : comments.length === 0 ? (
          <div className={styles.emptyState}>
            {language === 'zh' ? '暂无评论' : 'No comments'}
          </div>
        ) : (
          <div className={
            selectedCommentType === 'review' ? reviewStyles.reviewsList :
            selectedCommentType === 'chapter' ? chapterStyles.commentsList :
            selectedCommentType === 'paragraph' ? paragraphStyles.commentsList :
            styles.commentsList
          }>
            {comments.map(comment => {
              // 根据评论类型使用不同的渲染组件
              if (comment.comment_type === 'review') {
                // 评价类型 - 使用ReviewSectionNew的样式和逻辑
                return (
                  <div key={comment.id} className={reviewStyles.reviewItem}>
                    <div className={reviewStyles.reviewHeader}>
                      <div className={reviewStyles.avatarContainer}>
                        <img 
                          src={getAvatarUrl(comment.avatar)} 
                          alt={getDisplayName(comment)}
                          className={reviewStyles.avatar}
                        />
                      </div>
                      <div className={reviewStyles.userInfoRow}>
                        <div className={reviewStyles.userInfoLeft}>
                          <span className={reviewStyles.username}>{getDisplayName(comment)}</span>
                          {isAuthor(comment) && (
                            <span className={styles.authorBadge}>{language === 'zh' ? '作者' : 'Author'}</span>
                          )}
                          {!!comment.is_vip && <span className={reviewStyles.vipBadge}>VIP</span>}
                          {comment.rating && comment.rating > 0 && (
                            <div className={reviewStyles.ratingContainer}>
                              {renderStars(comment.rating)}
                            </div>
                          )}
                          {!!comment.is_recommended && (
                            <div className={reviewStyles.recommendedBadge}>👍 Recommended</div>
                          )}
                          <span className={reviewStyles.reviewDate}>{formatReviewDate(comment.created_at)}</span>
                        </div>
                        <div className={reviewStyles.reviewActions}>
                          <button 
                            className={reviewStyles.likeButton}
                            onClick={() => handleLikeReview(comment.id)}
                          >
                            👍 {comment.likes || 0}
                          </button>
                          <button 
                            className={reviewStyles.dislikeButton}
                            onClick={() => handleDislikeReview(comment.id)}
                          >
                            👎 {comment.dislikes || 0}
                          </button>
                          <button className={reviewStyles.commentButton}>
                            💬 {comment.reply_count || 0}
                          </button>
                          {user && (
                            <ReportButton
                              commentId={comment.id}
                              commentType="review"
                              commentAuthor={getDisplayName(comment)}
                              userId={user.id}
                              onReportSubmit={async (commentId, commentType, reportReason) => {
                                await reportService.submitReport({
                                  commentId,
                                  commentType,
                                  reportReason
                                });
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {editingReviewId === comment.id ? (
                      <div className={reviewStyles.editForm}>
                        <textarea
                          value={editReviewContent}
                          onChange={(e) => setEditReviewContent(e.target.value)}
                          className={reviewStyles.reviewTextarea}
                          rows={6}
                        />
                        <div className={reviewStyles.formActions}>
                          <button 
                            className={reviewStyles.cancelButton}
                            onClick={handleCancelEditReview}
                          >
                            Cancel
                          </button>
                          <button 
                            className={reviewStyles.submitButton}
                            onClick={() => handleSaveEditReview(comment.id)}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={reviewStyles.reviewContent}>
                        {expandedReviews.has(comment.id) || comment.content.length <= 200 
                          ? comment.content 
                          : getTruncatedContent(comment.content)
                        }
                        {comment.content.length > 200 && (
                          <button 
                            className={reviewStyles.showMoreButton}
                            onClick={() => toggleReviewExpansion(comment.id)}
                          >
                            {expandedReviews.has(comment.id) ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    )}

                    {selectedReportReason && comment.report_count !== undefined && comment.report_count > 0 && (
                      <div className={styles.reportCount}>
                        {language === 'zh' ? `举报数量: ${comment.report_count}条` : `Report Count: ${comment.report_count}`}
                      </div>
                    )}

                    {!selectedReportReason && (
                      <div className={reviewStyles.viewRepliesWrapper}>
                        <ReviewReplies 
                          reviewId={comment.id}
                          user={user}
                          onReplySubmit={handleReplySubmitReview}
                          compactMode={true}
                          showToggle={true}
                          editingReviewId={editingReviewId}
                          onEditReview={handleEditReview}
                          review={{
                            ...comment,
                            comments: comment.reply_count // 将reply_count映射为comments字段
                          } as any}
                        />
                      </div>
                    )}
                  </div>
                );
              } else if (comment.comment_type === 'chapter') {
                // 章评类型 - 使用ChapterCommentSectionNew的样式和逻辑
                return (
                  <div key={comment.id} className={chapterStyles.commentItem}>
                    <div className={chapterStyles.commentHeader}>
                      <img 
                        src={getAvatarUrl(comment.avatar)} 
                        alt={getDisplayName(comment)} 
                        className={chapterStyles.avatar} 
                      />
                      <div className={chapterStyles.commentInfo}>
                        <div className={chapterStyles.username}>
                          {getDisplayName(comment)}
                          {isAuthor(comment) && (
                            <span className={styles.authorBadge}>{language === 'zh' ? '作者' : 'Author'}</span>
                          )}
                        </div>
                        <div className={chapterStyles.commentDate}>{formatChapterDate(comment.created_at)}</div>
                      </div>
                    </div>
                    
                    {editingChapterCommentId === comment.id ? (
                      <div className={chapterStyles.editForm}>
                        <textarea
                          value={editChapterCommentContent}
                          onChange={(e) => setEditChapterCommentContent(e.target.value)}
                          className={chapterStyles.commentTextarea}
                          rows={6}
                        />
                        <div className={chapterStyles.formActions}>
                          <button 
                            className={chapterStyles.cancelButton}
                            onClick={handleCancelEditChapterComment}
                          >
                            Cancel
                          </button>
                          <button 
                            className={chapterStyles.submitButton}
                            onClick={() => handleSaveEditChapterComment(comment.id)}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={chapterStyles.commentContent}>{comment.content}</div>
                        
                        {selectedReportReason && comment.report_count !== undefined && comment.report_count > 0 && (
                          <div className={styles.reportCount}>
                            {language === 'zh' ? `举报数量: ${comment.report_count}条` : `Report Count: ${comment.report_count}`}
                          </div>
                        )}
                        
                        {!selectedReportReason && (
                          <>
                            <div className={chapterStyles.commentActionsInline}>
                              <button 
                                className={chapterStyles.actionButton}
                                onClick={() => handleLikeChapterComment(comment.id)}
                              >
                                👍 {comment.likes}
                              </button>
                              <button 
                                className={chapterStyles.actionButton}
                                onClick={() => handleDislikeChapterComment(comment.id)}
                              >
                                👎 {comment.dislikes || 0}
                              </button>
                              {(replyCountsMap[comment.id] ?? 0) > 0 && (
                                <button 
                                  className={chapterStyles.toggleRepliesButton}
                                  onClick={() => setShowRepliesMap(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                                >
                                  {showRepliesMap[comment.id] ? 'Hide replies' : `View replies (${replyCountsMap[comment.id] ?? 0})`}
                                </button>
                              )}
                              {user && comment.user_id && user.id === comment.user_id && !editingChapterCommentId && (
                                <button 
                                  className={chapterStyles.editButton}
                                  onClick={() => handleEditChapterComment(comment)}
                                >
                                  Edit
                                </button>
                              )}
                              {user && !showReplyFormMap[comment.id] && !editingChapterCommentId && (
                                <button 
                                  className={chapterStyles.replyButton}
                                  onClick={() => setShowReplyFormMap(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                                >
                                  Reply
                                </button>
                              )}
                              {user && (
                                <ReportButton
                                  commentId={comment.id}
                                  commentType="comment"
                                  commentAuthor={getDisplayName(comment)}
                                  userId={user.id}
                                  onReportSubmit={async (commentId, commentType, reportReason) => {
                                    await reportService.submitReport({
                                      commentId,
                                      commentType,
                                      reportReason
                                    });
                                  }}
                                />
                              )}
                            </div>

                            <ChapterCommentReplies 
                              commentId={comment.id}
                              user={user}
                              onReplySubmit={handleReplySubmitChapterComment}
                              editingCommentId={editingChapterCommentId}
                              onEditComment={handleEditChapterComment}
                              onCancelEdit={handleCancelEditChapterComment}
                              onSaveEdit={handleSaveEditChapterComment}
                              comment={comment as any}
                              showReplies={showRepliesMap[comment.id] ?? false}
                              showReplyForm={showReplyFormMap[comment.id] ?? false}
                              onToggleReplies={(show) => setShowRepliesMap(prev => ({ ...prev, [comment.id]: show }))}
                              onToggleReplyForm={(show) => setShowReplyFormMap(prev => ({ ...prev, [comment.id]: show }))}
                            />
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              } else if (comment.comment_type === 'paragraph') {
                // 段评类型 - 使用ParagraphComment的样式和逻辑，支持嵌套回复
                const renderParagraphComment = (paragraphComment: Comment, depth: number = 0): React.ReactNode => {
                  const replyCount = paragraphComment.replies?.length || paragraphComment.reply_count || 0;
                  const showReplies = showParagraphRepliesMap[paragraphComment.id] || false;
                  const showReplyForm = showParagraphReplyFormMap[paragraphComment.id] || false;
                  const replyContent = paragraphReplyContentMap[paragraphComment.id] || '';
                  
                  return (
                    <div key={paragraphComment.id} className={paragraphStyles.commentItem} style={{ marginLeft: depth > 0 ? '20px' : '0' }}>
                      <div className={paragraphStyles.avatarColumn}>
                        <img 
                          src={getAvatarUrl(paragraphComment.avatar)} 
                          alt={getDisplayName(paragraphComment)}
                          className={paragraphStyles.avatar}
                        />
                      </div>
                      <div className={paragraphStyles.contentColumn}>
                        <div className={paragraphStyles.commentInfo}>
                          <div className={paragraphStyles.username}>
                            {getDisplayName(paragraphComment)}
                            {isAuthor(paragraphComment) && (
                              <span className={styles.authorBadge}>{language === 'zh' ? '作者' : 'Author'}</span>
                            )}
                          </div>
                          <div className={paragraphStyles.commentDate}>{formatParagraphDate(paragraphComment.created_at)}</div>
                        </div>
                        
                        {editingParagraphCommentId === paragraphComment.id ? (
                          <div className={paragraphStyles.editForm}>
                            <textarea
                              value={editParagraphCommentContent}
                              onChange={(e) => setEditParagraphCommentContent(e.target.value)}
                              className={paragraphStyles.replyTextarea}
                              rows={3}
                            />
                            <div className={paragraphStyles.replyActions}>
                              <button 
                                className={paragraphStyles.cancelButton}
                                onClick={handleCancelEditParagraphComment}
                              >
                                Cancel
                              </button>
                              <button 
                                className={paragraphStyles.submitButton}
                                onClick={() => handleSaveEditParagraphComment(paragraphComment.id)}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={paragraphStyles.commentContent}>{paragraphComment.content}</div>
                            
                            {selectedReportReason && paragraphComment.report_count !== undefined && paragraphComment.report_count > 0 && (
                              <div className={styles.reportCount}>
                                {language === 'zh' ? `举报数量: ${paragraphComment.report_count}条` : `Report Count: ${paragraphComment.report_count}`}
                              </div>
                            )}
                            
                            {!selectedReportReason && (
                              <>
                                <div className={paragraphStyles.commentActionsInline}>
                                  <button 
                                    className={paragraphStyles.actionButton}
                                    onClick={() => handleLikeParagraphComment(paragraphComment.id, true)}
                                  >
                                    👍 {paragraphComment.likes || 0}
                                  </button>
                                  <button 
                                    className={paragraphStyles.actionButton}
                                    onClick={() => handleDislikeParagraphComment(paragraphComment.id, false)}
                                  >
                                    👎 {paragraphComment.dislikes || 0}
                                  </button>
                                  {replyCount > 0 && (
                                    <button 
                                      type="button"
                                      className={paragraphStyles.toggleRepliesButton}
                                      onClick={() => {
                                        setShowParagraphRepliesMap(prev => ({ 
                                          ...prev, 
                                          [paragraphComment.id]: !prev[paragraphComment.id] 
                                        }));
                                      }}
                                    >
                                      {showReplies ? 'Hide replies' : `View replies (${replyCount})`}
                                    </button>
                                  )}
                                  {user && paragraphComment.user_id && user.id === paragraphComment.user_id && !editingParagraphCommentId && (
                                    <button 
                                      className={paragraphStyles.editButton}
                                      onClick={() => handleEditParagraphComment(paragraphComment)}
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {user && !showReplyForm && !editingParagraphCommentId && (
                                    <button 
                                      className={paragraphStyles.replyButton}
                                      onClick={() => setShowParagraphReplyFormMap(prev => ({ 
                                        ...prev, 
                                        [paragraphComment.id]: !prev[paragraphComment.id] 
                                      }))}
                                    >
                                      Reply
                                    </button>
                                  )}
                                  {user && (
                                    <ReportButton
                                      commentId={paragraphComment.id}
                                      commentType="paragraph_comment"
                                      commentAuthor={getDisplayName(paragraphComment)}
                                      userId={user.id}
                                      onReportSubmit={async (commentId, commentType, reportReason) => {
                                        await reportService.submitReport({
                                          commentId,
                                          commentType,
                                          reportReason
                                        });
                                      }}
                                    />
                                  )}
                                </div>

                                {/* 回复输入框 */}
                                {user && showReplyForm && !editingParagraphCommentId && (
                                  <div className={paragraphStyles.replyFormContainerCompact}>
                                    <div className={paragraphStyles.replyForm}>
                                      <textarea
                                        className={paragraphStyles.replyTextarea}
                                        placeholder="Write a reply..."
                                        value={replyContent}
                                        onChange={(e) => setParagraphReplyContentMap(prev => ({ 
                                          ...prev, 
                                          [paragraphComment.id]: e.target.value 
                                        }))}
                                        rows={3}
                                      />
                                      <div className={paragraphStyles.replyActions}>
                                        <button 
                                          className={paragraphStyles.cancelButton}
                                          onClick={() => setShowParagraphReplyFormMap(prev => ({ 
                                            ...prev, 
                                            [paragraphComment.id]: false 
                                          }))}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleReplySubmitParagraphComment(paragraphComment.id, replyContent)}
                                          disabled={!replyContent.trim() || replyContent.length < 10}
                                          className={paragraphStyles.submitButton}
                                        >
                                          Submit
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* 显示嵌套回复 */}
                                {showReplies && paragraphComment.replies && paragraphComment.replies.length > 0 && (
                                  <div className={paragraphStyles.repliesContainerCompact}>
                                    {paragraphComment.replies.map((reply) => renderParagraphComment(reply, depth + 1))}
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                };
                
                return renderParagraphComment(comment);
              } else {
                // 其他类型（discussion等）- 使用原有的CommentItem
                return (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    selectedReportReason={selectedReportReason}
                    selectedCommentType={selectedCommentType}
                    replyingTo={replyingTo}
                    replyContent={replyContent}
                    showReplies={showReplies}
                    replies={replies}
                    onReplyClick={handleReplyClick}
                    onReplyContentChange={handleReplyContentChange}
                    onReplySubmit={handleReply}
                    onCancelReply={handleCancelReply}
                    onLoadReplies={loadReplies}
                    language={language}
                    getAvatarUrl={getAvatarUrl}
                    formatDate={formatDate}
                    getCommentTypeText={getCommentTypeText}
                  />
                );
              }
            })}
          </div>
        )}

        {/* 分页 */}
        {total > limit && (
          <div className={styles.pagination}>
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className={styles.pageButton}
            >
              {language === 'zh' ? '上一页' : 'Previous'}
            </button>
            <span className={styles.pageInfo}>
              {language === 'zh' ? `第 ${page} 页，共 ${Math.ceil(total / limit)} 页` : `Page ${page} of ${Math.ceil(total / limit)}`}
            </span>
            <button
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage(page + 1)}
              className={styles.pageButton}
            >
              {language === 'zh' ? '下一页' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentManagement;


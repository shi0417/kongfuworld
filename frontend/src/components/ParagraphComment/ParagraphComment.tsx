import React, { useState, useEffect } from 'react';
import styles from './ParagraphComment.module.css';
import ReportButton from '../ReportButton/ReportButton';
import reportService from '../../services/reportService';
import Toast from '../Toast/Toast';

interface Comment {
  id: number;
  content: string;
  created_at: string;
  username: string;
  avatar: string;
  like_count: number;
  dislike_count: number;
  parent_id?: number;
  user_id?: number;
  replies?: Comment[];
}

interface NestedReplyItemProps {
  reply: Comment;
  user: any;
  getAvatarUrl: (avatar?: string) => string;
  formatDate: (dateString: string) => string;
  onEdit: (reply: Comment) => void;
  onSaveEdit: (replyId: number) => Promise<void>;
  onCancelEdit: () => void;
  onLike: (replyId: number, isLike: boolean) => Promise<void>;
  onDislike: (replyId: number, isLike: boolean) => Promise<void>;
  editingReplyId: number | null;
  editContent: string;
  setEditContent: (content: string) => void;
  onReplySubmit: (commentId: number, content: string) => Promise<void>;
  chapterId: number;
  paragraphIndex: number;
}

interface ParagraphCommentProps {
  chapterId: number;
  paragraphIndex: number;
  commentCount: number;
  user?: any;
  onCommentAdded?: () => void;
}

const ParagraphComment: React.FC<ParagraphCommentProps> = ({
  chapterId,
  paragraphIndex,
  commentCount,
  user,
  onCommentAdded
}) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showRepliesMap, setShowRepliesMap] = useState<Record<number, boolean>>({});
  const [showReplyFormMap, setShowReplyFormMap] = useState<Record<number, boolean>>({});
  const [replyCountsMap, setReplyCountsMap] = useState<Record<number, number>>({});
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // 显示 Toast 提示
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
  };

  // 排序评论函数（递归排序包括回复）
  const sortComments = React.useCallback((commentsToSort: Comment[], order: 'newest' | 'oldest'): Comment[] => {
    const sorted = [...commentsToSort].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return order === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // 递归排序每个评论的回复
    return sorted.map(comment => ({
      ...comment,
      replies: comment.replies ? sortComments(comment.replies, order) : undefined
    }));
  }, []);

  // 加载评论
  const loadComments = async () => {
    if (!showComments) return;
    
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:5000/api/chapter/${chapterId}/paragraph/${paragraphIndex}/comments`
      );
      const data = await response.json();
      
      if (data.success) {
        const loadedComments = data.data.comments;
        // 应用排序
        const sortedComments = sortComments(loadedComments, sortOrder);
        setComments(sortedComments);
      }
    } catch (error) {
      console.error('加载评论失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理排序变化
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSortOrder = e.target.value as 'newest' | 'oldest';
    setSortOrder(newSortOrder);
  };

  // 提交主评论
  const submitComment = async () => {
    if (!newComment.trim() || !user) return;
    
    if (newComment.trim().length < 10) {
      showToast('Comment must be at least 10 characters long', 'warning');
      return;
    }
    
    try {
      setSubmitting(true);
      const response = await fetch(
        `http://localhost:5000/api/chapter/${chapterId}/paragraph/${paragraphIndex}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: newComment.trim(),
            userId: user.id,
            parentId: null
          })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setNewComment('');
        loadComments();
        onCommentAdded?.();
        showToast('Comment submitted successfully', 'success');
      } else {
        showToast('Failed to submit comment', 'error');
      }
    } catch (error) {
      console.error('提交评论失败:', error);
      showToast('Failed to submit comment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 递归更新评论的点赞数
  const updateCommentLikes = (comments: Comment[], commentId: number, likeCount: number, dislikeCount: number): Comment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return { ...comment, like_count: likeCount, dislike_count: dislikeCount };
      }
      if (comment.replies) {
        return { ...comment, replies: updateCommentLikes(comment.replies, commentId, likeCount, dislikeCount) };
      }
      return comment;
    });
  };

  // 获取头像URL
  const getAvatarUrl = (avatar?: string) => {
    if (!avatar) {
      return 'https://i.pravatar.cc/40?img=1';
    }
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    if (avatar.startsWith('/')) {
      return `http://localhost:5000${avatar}`;
    }
    return `http://localhost:5000/avatars/${avatar}`;
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
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
    
    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else if (diffWeeks < 4) {
      return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
    } else if (diffMonths < 12) {
      return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    } else {
      return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
    }
  };

  // 加载回复数量
  useEffect(() => {
    const loadReplyCounts = async () => {
      for (const comment of comments) {
        try {
          const response = await fetch(
            `http://localhost:5000/api/paragraph-comment/${comment.id}/replies`
          );
          const data = await response.json();
          if (data.success) {
            setReplyCountsMap(prev => ({
              ...prev,
              [comment.id]: data.data.length
            }));
          }
        } catch (error) {
          console.error('加载回复数量失败:', error);
        }
      }
    };
    if (comments.length > 0) {
      loadReplyCounts();
    }
  }, [comments]);

  // 处理编辑评论
  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  // 保存编辑
  const handleSaveEdit = async (commentId: number) => {
    if (!editContent.trim() || editContent.trim().length < 10) {
      showToast('Comment must be at least 10 characters long', 'warning');
      return;
    }

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
            content: editContent.trim()
          })
        }
      );

      const data = await response.json();
      if (data.success) {
        setEditingCommentId(null);
        setEditContent('');
        loadComments();
        showToast('Comment updated successfully', 'success');
      } else {
        showToast(data.message || 'Failed to update comment', 'error');
      }
    } catch (error) {
      console.error('更新评论失败:', error);
      showToast('Failed to update comment', 'error');
    }
  };

  // 处理回复提交
  const handleReplySubmit = async (commentId: number, content: string) => {
    if (!content.trim() || !user) return;
    
    if (content.trim().length < 10) {
      showToast('Reply must be at least 10 characters long', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(
        `http://localhost:5000/api/chapter/${chapterId}/paragraph/${paragraphIndex}/comments`,
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
        loadComments();
        setShowReplyFormMap(prev => ({ ...prev, [commentId]: false }));
        onCommentAdded?.();
        showToast('Reply submitted successfully', 'success');
      }
    } catch (error) {
      console.error('提交回复失败:', error);
      showToast('Failed to submit reply', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 处理点赞（立即更新）
  const handleLikeComment = async (commentId: number, isLike: boolean): Promise<void> => {
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
        // 立即更新本地状态
        setComments(prevComments => 
          updateCommentLikes(prevComments, commentId, data.data.like_count, data.data.dislike_count)
        );
      }
    } catch (error) {
      console.error('点赞失败:', error);
      throw error;
    }
  };

  // 当排序方式改变时，重新排序现有评论
  useEffect(() => {
    if (comments.length > 0) {
      const sortedComments = sortComments(comments, sortOrder);
      setComments(sortedComments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOrder]);

  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments, chapterId, paragraphIndex]);

  // 点击外部区域关闭评论面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showComments) {
        const target = event.target as Element;
        
        // 检查点击是否在ReportModal内部（ReportModal使用Portal渲染到body）
        // 通过检查是否有ReportModal相关的类名或data属性
        const reportModal = target.closest('[class*="ReportModal"]') || 
                           target.closest('[class*="overlay"]') ||
                           target.closest('[data-report-modal]');
        if (reportModal) {
          // 如果点击在对话框内，不关闭评论面板
          return;
        }
        
        // 检查点击是否在评论面板外部
        if (!target.closest(`.${styles.commentPanel}`) && !target.closest(`.${styles.commentButton}`)) {
          setShowComments(false);
        }
      }
    };

    if (showComments) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showComments]);

  // 递归嵌套回复组件
  const NestedReplyItem: React.FC<NestedReplyItemProps> = ({
    reply,
    user,
    getAvatarUrl,
    formatDate,
    onEdit,
    onSaveEdit,
    onCancelEdit,
    onLike,
    onDislike,
    editingReplyId,
    editContent,
    setEditContent,
    onReplySubmit,
    chapterId,
    paragraphIndex
  }) => {
    const [showNestedReplies, setShowNestedReplies] = useState(false);
    const [nestedReplies, setNestedReplies] = useState<Comment[]>([]);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [currentReply, setCurrentReply] = useState<Comment>(reply);
    const [nestedReplyCount, setNestedReplyCount] = useState(0);

    useEffect(() => {
      setCurrentReply(reply);
    }, [reply]);

    // 加载嵌套回复数量
    useEffect(() => {
      const loadNestedReplyCount = async () => {
        try {
          const response = await fetch(
            `http://localhost:5000/api/paragraph-comment/${currentReply.id}/replies`
          );
          const data = await response.json();
          if (data.success) {
            setNestedReplyCount(data.data.length);
          }
        } catch (err) {
          console.error('Failed to load nested reply count:', err);
          setNestedReplyCount(0);
        }
      };
      loadNestedReplyCount();
    }, [currentReply.id]);

    // 加载嵌套回复
    const loadNestedReplies = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/paragraph-comment/${currentReply.id}/replies`
        );
        const data = await response.json();
        if (data.success) {
          setNestedReplies(data.data);
          setNestedReplyCount(data.data.length);
        }
      } catch (err) {
        console.error('Failed to load nested replies:', err);
        setNestedReplies([]);
      }
    };

    useEffect(() => {
      if (showNestedReplies && nestedReplies.length === 0) {
        loadNestedReplies();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showNestedReplies, currentReply.id]);

    const handleSubmitReply = async () => {
      if (!user) {
        showToast('Please login first', 'warning');
        return;
      }

      if (!replyContent.trim()) {
        showToast('Please enter reply content', 'warning');
        return;
      }

      if (replyContent.trim().length < 10) {
        showToast('Reply must be at least 10 characters long', 'warning');
        return;
      }

      setSubmitting(true);
      try {
        await onReplySubmit(currentReply.id, replyContent);
        setReplyContent('');
        setShowReplyForm(false);
        await loadNestedReplies();
        showToast('Reply submitted successfully', 'success');
      } catch (err: any) {
        console.error('Failed to submit reply:', err);
        showToast('Failed to submit reply', 'error');
      } finally {
        setSubmitting(false);
      }
    };

    const handleLikeNestedReply = async (replyId: number) => {
      if (!user) {
        showToast('Please login first', 'warning');
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:5000/api/paragraph-comment/${replyId}/like`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              isLike: 1
            })
          }
        );
        
        const data = await response.json();
        if (data.success) {
          if (replyId === currentReply.id) {
            setCurrentReply(prev => ({
              ...prev,
              like_count: data.data.like_count,
              dislike_count: data.data.dislike_count
            }));
          } else {
            setNestedReplies(prevReplies =>
              prevReplies.map(r =>
                r.id === replyId
                  ? { ...r, like_count: data.data.like_count, dislike_count: data.data.dislike_count }
                  : r
              )
            );
          }
        }
        await loadNestedReplies();
      } catch (err) {
        console.error('点赞失败:', err);
        showToast('Failed to like comment', 'error');
      }
    };

    const handleDislikeNestedReply = async (replyId: number) => {
      if (!user) {
        showToast('Please login first', 'warning');
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:5000/api/paragraph-comment/${replyId}/like`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              isLike: 0
            })
          }
        );
        
        const data = await response.json();
        if (data.success) {
          if (replyId === currentReply.id) {
            setCurrentReply(prev => ({
              ...prev,
              like_count: data.data.like_count,
              dislike_count: data.data.dislike_count
            }));
          } else {
            setNestedReplies(prevReplies =>
              prevReplies.map(r =>
                r.id === replyId
                  ? { ...r, like_count: data.data.like_count, dislike_count: data.data.dislike_count }
                  : r
              )
            );
          }
        }
        await loadNestedReplies();
      } catch (err) {
        console.error('点踩失败:', err);
        showToast('Failed to dislike comment', 'error');
      }
    };

    const handleEditNestedReply = (nestedReply: Comment) => {
      onEdit(nestedReply);
    };

    const handleSaveEditNestedReply = async (replyId: number) => {
      await onSaveEdit(replyId);
      await loadNestedReplies();
    };

    return (
      <>
        {/* 子评论的所有按钮 - 在同一行显示 */}
        <div className={styles.replyActionsInline}>
          <button 
            className={styles.actionButton}
            onClick={() => handleLikeNestedReply(currentReply.id)}
          >
            👍 {currentReply.like_count}
          </button>
          <button 
            className={styles.actionButton}
            onClick={() => handleDislikeNestedReply(currentReply.id)}
          >
            👎 {currentReply.dislike_count}
          </button>
          {(nestedReplyCount > 0 || nestedReplies.length > 0) && (
            <button 
              type="button"
              className={styles.toggleRepliesButton}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowNestedReplies(!showNestedReplies);
                if (!showNestedReplies && nestedReplies.length === 0) {
                  loadNestedReplies();
                }
              }}
            >
              {showNestedReplies ? 'Hide replies' : `View replies (${nestedReplies.length || nestedReplyCount || 0})`}
            </button>
          )}
          {user && currentReply.user_id && user.id === currentReply.user_id && (
            <button 
              className={styles.editButton}
              onClick={() => onEdit(currentReply)}
            >
              Edit
            </button>
          )}
          {user && !showReplyForm && (
            <button 
              className={styles.replyButton}
              onClick={() => setShowReplyForm(true)}
            >
              Reply
            </button>
          )}
          {user && (
            <ReportButton
              commentId={currentReply.id}
              commentType="paragraph_comment"
              commentAuthor={currentReply.username}
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
        {user && showReplyForm && (
          <div className={styles.replyFormContainerCompact}>
            <div className={styles.replyForm}>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className={styles.replyTextarea}
                rows={3}
              />
              <div className={styles.replyActions}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  className={styles.submitButton}
                  onClick={handleSubmitReply}
                  disabled={!replyContent.trim() || submitting || replyContent.length < 10}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
        {showNestedReplies && nestedReplies.length > 0 && (
          <div className={styles.repliesContainerCompact}>
            {nestedReplies.map((nestedReply) => (
              <div key={nestedReply.id} className={styles.replyItem}>
                <div className={styles.replyHeader}>
                  <img 
                    src={getAvatarUrl(nestedReply.avatar)} 
                    alt={nestedReply.username}
                    className={styles.avatar}
                  />
                  <div className={styles.replyInfo}>
                    <div className={styles.username}>{nestedReply.username}</div>
                    <div className={styles.replyDate}>{formatDate(nestedReply.created_at)}</div>
                  </div>
                </div>
                {editingReplyId === nestedReply.id ? (
                  <div className={styles.editForm}>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className={styles.replyTextarea}
                      rows={3}
                    />
                    <div className={styles.replyActions}>
                      <button 
                        className={styles.cancelButton}
                        onClick={onCancelEdit}
                      >
                        Cancel
                      </button>
                      <button 
                        className={styles.submitButton}
                        onClick={() => handleSaveEditNestedReply(nestedReply.id)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.replyContent}>{nestedReply.content}</div>
                    <NestedReplyItem
                      reply={nestedReply}
                      user={user}
                      getAvatarUrl={getAvatarUrl}
                      formatDate={formatDate}
                      onEdit={handleEditNestedReply}
                      onSaveEdit={handleSaveEditNestedReply}
                      onCancelEdit={onCancelEdit}
                      onLike={handleLikeNestedReply}
                      onDislike={handleDislikeNestedReply}
                      editingReplyId={editingReplyId}
                      editContent={editContent}
                      setEditContent={setEditContent}
                      onReplySubmit={onReplySubmit}
                      chapterId={chapterId}
                      paragraphIndex={paragraphIndex}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // 评论项组件
  const CommentItem: React.FC<{ comment: Comment }> = ({ comment }) => {
    const [replies, setReplies] = useState<Comment[]>([]);
    const [replyContent, setReplyContent] = useState('');

    // 加载回复
    const loadReplies = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/paragraph-comment/${comment.id}/replies`
        );
        const data = await response.json();
        if (data.success) {
          setReplies(data.data);
        }
      } catch (err) {
        console.error('Failed to load replies:', err);
      }
    };

    useEffect(() => {
      if (showRepliesMap[comment.id] && replies.length === 0) {
        loadReplies();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showRepliesMap[comment.id], comment.id]);

    const handleSubmitReply = async () => {
      if (!replyContent.trim() || replyContent.trim().length < 10) {
        showToast('Reply must be at least 10 characters long', 'warning');
        return;
      }
      await handleReplySubmit(comment.id, replyContent);
      setReplyContent('');
      await loadReplies();
    };

    return (
      <div className={styles.commentItem}>
        {/* 头像列 */}
        <div className={styles.avatarColumn}>
          <img 
            src={getAvatarUrl(comment.avatar)} 
            alt={comment.username} 
            className={styles.avatar} 
          />
        </div>
        
        {/* 内容列 */}
        <div className={styles.contentColumn}>
          <div className={styles.commentInfo}>
            <div className={styles.username}>{comment.username}</div>
            <div className={styles.commentDate}>{formatTime(comment.created_at)}</div>
          </div>
          
          {editingCommentId === comment.id ? (
            <div className={styles.editForm}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className={styles.replyTextarea}
                rows={3}
              />
              <div className={styles.replyActions}>
                <button 
                  className={styles.cancelButton}
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
                <button 
                  className={styles.submitButton}
                  onClick={() => handleSaveEdit(comment.id)}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.commentContent}>{comment.content}</div>
              
              {/* 所有按钮在同一行靠左排列 */}
              <div className={styles.commentActionsInline}>
                <button 
                  className={styles.actionButton}
                  onClick={() => handleLikeComment(comment.id, true)}
                  aria-label={`Like this comment (${comment.like_count || 0} likes)`}
                  title={`Like this comment (${comment.like_count || 0} likes)`}
                >
                  👍 {comment.like_count || 0}
                </button>
                <button 
                  className={styles.actionButton}
                  onClick={() => handleLikeComment(comment.id, false)}
                  aria-label={`Dislike this comment (${comment.dislike_count || 0} dislikes)`}
                  title={`Dislike this comment (${comment.dislike_count || 0} dislikes)`}
                >
                  👎 {comment.dislike_count || 0}
                </button>
                {(replyCountsMap[comment.id] ?? 0) > 0 && (
                  <button 
                    type="button"
                    className={styles.toggleRepliesButton}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newShowState = !showRepliesMap[comment.id];
                      setShowRepliesMap(prev => ({ ...prev, [comment.id]: newShowState }));
                      if (newShowState && replies.length === 0) {
                        loadReplies();
                      }
                    }}
                  >
                    {showRepliesMap[comment.id] ? 'Hide replies' : `View replies (${replyCountsMap[comment.id] ?? 0})`}
                  </button>
                )}
                {user && comment.user_id && user.id === comment.user_id && !editingCommentId && (
                  <button 
                    className={styles.editButton}
                    onClick={() => handleEditComment(comment)}
                  >
                    Edit
                  </button>
                )}
                {user && !showReplyFormMap[comment.id] && !editingCommentId && (
                  <button 
                    className={styles.replyButton}
                    onClick={() => setShowReplyFormMap(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                  >
                    Reply
                  </button>
                )}
                {user && (
                  <ReportButton
                    commentId={comment.id}
                    commentType="paragraph_comment"
                    commentAuthor={comment.username}
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
              {user && showReplyFormMap[comment.id] && !editingCommentId && (
                <div className={styles.replyFormContainerCompact}>
                  <div className={styles.replyForm}>
                    <textarea
                      className={styles.replyTextarea}
                      placeholder="Write a reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={3}
                    />
                    <div className={styles.replyActions}>
                      <button 
                        className={styles.cancelButton}
                        onClick={() => setShowReplyFormMap(prev => ({ ...prev, [comment.id]: false }))}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitReply}
                        disabled={!replyContent.trim() || submitting || replyContent.length < 10}
                        className={styles.submitButton}
                      >
                        {submitting ? 'Submitting...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 显示回复 */}
              {showRepliesMap[comment.id] && replies.length > 0 && (
                <div className={styles.repliesContainerCompact}>
                  {replies.map((reply) => (
                    <div key={reply.id} className={styles.replyItem}>
                      <div className={styles.replyHeader}>
                        <img 
                          src={getAvatarUrl(reply.avatar)} 
                          alt={reply.username}
                          className={styles.avatar}
                        />
                        <div className={styles.replyInfo}>
                          <div className={styles.username}>{reply.username}</div>
                          <div className={styles.replyDate}>{formatTime(reply.created_at)}</div>
                        </div>
                      </div>
                      {editingCommentId === reply.id ? (
                        <div className={styles.editForm}>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className={styles.replyTextarea}
                            rows={3}
                          />
                          <div className={styles.replyActions}>
                            <button 
                              className={styles.cancelButton}
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </button>
                            <button 
                              className={styles.submitButton}
                              onClick={() => handleSaveEdit(reply.id)}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={styles.replyContent}>{reply.content}</div>
                          <NestedReplyItem
                            reply={reply}
                            user={user}
                            getAvatarUrl={getAvatarUrl}
                            formatDate={formatTime}
                            onEdit={handleEditComment}
                            onSaveEdit={handleSaveEdit}
                            onCancelEdit={handleCancelEdit}
                            onLike={handleLikeComment}
                            onDislike={(replyId, isLike) => handleLikeComment(replyId, false)}
                            editingReplyId={editingCommentId}
                            editContent={editContent}
                            setEditContent={setEditContent}
                            onReplySubmit={handleReplySubmit}
                            chapterId={chapterId}
                            paragraphIndex={paragraphIndex}
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.paragraphComment}>
      {/* 评论数量按钮 */}
      <button
        className={`${styles.commentButton} ${commentCount > 0 ? styles.hasComments : ''}`}
        onClick={() => setShowComments(!showComments)}
        title={commentCount > 0 ? `${commentCount} 条评论` : '点击添加评论'}
      >
        <span className={styles.commentCount}>{commentCount}</span>
      </button>

      {/* 评论面板 */}
      {showComments && (
        <div className={styles.commentPanel}>
          <div className={styles.commentHeader}>
            <h4>{commentCount} Comments</h4>
            <div className={styles.headerActions}>
              <select 
                className={styles.sortSelect}
                value={sortOrder}
                onChange={handleSortChange}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
              <button
                className={styles.closeButton}
                onClick={() => setShowComments(false)}
              >
                ×
              </button>
            </div>
          </div>

          {/* 添加评论 */}
          {user && (
            <div className={styles.addComment}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment"
                className={styles.commentInput}
                rows={3}
              />
              <div className={styles.submitSection}>
                <button
                  onClick={() => submitComment()}
                  disabled={!newComment.trim() || submitting}
                  className={styles.submitButton}
                >
                  {submitting ? '提交中...' : 'Submit'}
                </button>
                <div className={styles.commentPolicy}>
                  By submitting this comment I confirm I have read and accepted the comment policy.
                </div>
              </div>
            </div>
          )}

          {/* 评论列表 */}
          <div className={styles.commentsList}>
            {loading ? (
              <div className={styles.loading}>加载中...</div>
            ) : comments.length > 0 ? (
              comments.map(comment => <CommentItem key={comment.id} comment={comment} />)
            ) : (
              <div className={styles.noComments}>暂无评论</div>
            )}
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default ParagraphComment;

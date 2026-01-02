import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../../config';
import chapterCommentService, { ChapterComment } from '../../services/chapterCommentService';
import ChapterCommentReplies from './ChapterCommentReplies';
import styles from './ChapterCommentSectionNew.module.css';
import ReportButton from '../ReportButton/ReportButton';
import reportService from '../../services/reportService';
import Toast from '../Toast/Toast';

interface ChapterCommentSectionNewProps {
  chapterId: number;
  user: any;
}

const ChapterCommentSectionNew: React.FC<ChapterCommentSectionNewProps> = ({ chapterId, user }) => {
  const [comments, setComments] = useState<ChapterComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showRepliesMap, setShowRepliesMap] = useState<Record<number, boolean>>({});
  const [showReplyFormMap, setShowReplyFormMap] = useState<Record<number, boolean>>({});
  const [replyCountsMap, setReplyCountsMap] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    loadComments();
  }, [chapterId]);

  // 加载每个评论的回复数量
  useEffect(() => {
    const loadReplyCounts = async () => {
      for (const comment of comments) {
        try {
          const replyData = await chapterCommentService.getCommentReplies(comment.id);
          setReplyCountsMap(prev => ({ ...prev, [comment.id]: replyData.length }));
        } catch (err) {
          console.error('Failed to load reply count:', err);
        }
      }
    };
    if (comments.length > 0) {
      loadReplyCounts();
    }
  }, [comments]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const data = await chapterCommentService.getChapterComments(chapterId);
      // 只显示主评论（没有parent_comment_id的评论）
      const mainComments = data.comments.filter((comment: any) => !comment.parent_comment_id);
      setComments(mainComments);
    } catch (err: any) {
      console.error('Failed to load comments:', err);
      setError(err.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      setError('Please login to post a comment.');
      showToast('Please login to post a comment.', 'warning');
      return;
    }
    if (commentContent.trim().length < 10) {
      setError('Comment must be at least 10 characters.');
      showToast('Comment must be at least 10 characters.', 'warning');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await chapterCommentService.submitChapterComment(chapterId, commentContent);
      setCommentContent('');
      await loadComments();
      showToast('Comment submitted successfully', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to submit comment.');
      showToast(err.message || 'Failed to submit comment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (commentId: number, content: string) => {
    console.log('🔍 handleReplySubmit called with:', { commentId, content });
    
    if (!user) {
      console.log('❌ User not logged in');
      setError('Please login to reply.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      console.log('📡 Calling replyToComment API...');
      await chapterCommentService.replyToComment(commentId, content);
      console.log('✅ Reply submitted successfully');
      await loadComments(); // 重新加载主评论
    } catch (err: any) {
      console.error('❌ Reply submission failed:', err);
      setError(err.message || 'Failed to submit reply.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: number) => {
    if (!user) {
      setError('Please login to like a comment.');
      return;
    }
    try {
      const result = await chapterCommentService.likeChapterComment(commentId);
      console.log('点赞结果 - 完整数据:', result);
      console.log('点赞结果 - result.data:', result.data);
      console.log('点赞结果 - result.action:', result.action);
      
      // 根据返回的action处理UI状态
      if (result.action === 'already_liked') {
        console.log('已经点赞过了');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.likes !== undefined) {
          console.log('使用后端返回的数据更新 (already_liked):', result.data);
          setComments(prevComments => 
            prevComments.map(comment => 
              comment.id === commentId 
                ? { ...comment, likes: result.data.likes, dislikes: result.data.dislikes }
                : comment
            )
          );
        } else {
          // 如果没有返回数据，重新加载
          await loadComments();
        }
      } else if (result.action === 'liked') {
        console.log('点赞成功');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.likes !== undefined) {
          console.log('使用后端返回的数据更新:', result.data);
          setComments(prevComments => {
            const updated = prevComments.map(comment => {
              if (comment.id === commentId) {
                console.log('更新前:', comment.likes, comment.dislikes);
                console.log('更新后:', result.data.likes, result.data.dislikes);
                return { ...comment, likes: result.data.likes, dislikes: result.data.dislikes };
              }
              return comment;
            });
            console.log('更新后的comments列表:', updated);
            return updated;
          });
        } else {
          console.log('后端未返回数据，重新加载列表');
          // 如果没有返回数据，重新加载
          await loadComments();
        }
      }
    } catch (err: any) {
      console.error('点赞失败:', err);
      setError(err.message || 'Failed to like comment.');
      // 出错时也重新加载以确保数据同步
      await loadComments();
    }
  };

  const handleDislikeComment = async (commentId: number) => {
    if (!user) {
      setError('Please login to dislike a comment.');
      return;
    }
    try {
      const result = await chapterCommentService.dislikeChapterComment(commentId);
      console.log('点踩结果 - 完整数据:', result);
      console.log('点踩结果 - result.data:', result.data);
      console.log('点踩结果 - result.action:', result.action);
      
      // 根据返回的action处理UI状态
      if (result.action === 'already_disliked') {
        console.log('已经点踩过了');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.dislikes !== undefined) {
          console.log('使用后端返回的数据更新 (already_disliked):', result.data);
          setComments(prevComments => 
            prevComments.map(comment => 
              comment.id === commentId 
                ? { ...comment, likes: result.data.likes, dislikes: result.data.dislikes }
                : comment
            )
          );
        } else {
          // 如果没有返回数据，重新加载
          await loadComments();
        }
      } else if (result.action === 'disliked') {
        console.log('点踩成功');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.dislikes !== undefined) {
          console.log('使用后端返回的数据更新:', result.data);
          setComments(prevComments => {
            const updated = prevComments.map(comment => {
              if (comment.id === commentId) {
                console.log('更新前:', comment.likes, comment.dislikes);
                console.log('更新后:', result.data.likes, result.data.dislikes);
                return { ...comment, likes: result.data.likes, dislikes: result.data.dislikes };
              }
              return comment;
            });
            console.log('更新后的comments列表:', updated);
            return updated;
          });
        } else {
          console.log('后端未返回数据，重新加载列表');
          // 如果没有返回数据，重新加载
          await loadComments();
        }
      }
    } catch (err: any) {
      console.error('点踩失败:', err);
      setError(err.message || 'Failed to dislike comment.');
      // 出错时也重新加载以确保数据同步
      await loadComments();
    }
  };

  const handleEditComment = (comment: ChapterComment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (commentId: number) => {
    if (!editContent.trim()) {
      setError('评论内容不能为空');
      return;
    }

    if (editContent.trim().length < 10) {
      setError('评论内容至少需要10个字符');
      return;
    }

    try {
      await chapterCommentService.updateChapterComment(commentId, editContent);
      setEditingCommentId(null);
      setEditContent('');
      await loadComments();
    } catch (err: any) {
      setError(err.message || '更新评论失败');
    }
  };


  const getAvatarUrl = (avatar?: string) => {
    if (!avatar) {
      return 'https://i.pravatar.cc/40?img=1';
    }
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    if (avatar.startsWith('/')) {
      return `${getApiBaseUrl()}${avatar}`;
    }
    return `${getApiBaseUrl()}/avatars/${avatar}`;
  };

  const formatDate = (dateString: string) => {
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
  };

  if (loading) {
    return (
      <div className={styles.commentSection}>
        <div className={styles.loading}>Loading comments...</div>
      </div>
    );
  }

  return (
    <div className={styles.commentSection}>
      {/* Toast 提示（风格参考段落评论） */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* 评论输入区域 */}
      <div className={styles.commentForm}>
        <div className={styles.formTitle}>Add a comment</div>
        <textarea
          className={styles.commentTextarea}
          placeholder="Add a comment"
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          aria-label="Comment text area"
          title="Enter your comment here"
        />
        <div className={styles.formFooter}>
          <div className={styles.leftSection}>
            {commentContent.length < 10 && (
              <div className={styles.validationError}>Comments must have a minimum of 10 words</div>
            )}
            <div className={styles.wordCount}>{commentContent.length} words</div>
          </div>
          <div className={styles.formActions}>
            <button 
              className={styles.submitButton}
              onClick={handleSubmitComment}
              disabled={submitting || commentContent.length < 10}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
        {error && <div className={styles.errorMessage}>{error}</div>}
      </div>

      {/* 评论列表 */}
      <div className={styles.commentsList}>
        {comments.length === 0 ? (
          <div className={styles.noComments}>No comments yet. Be the first to comment!</div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className={styles.commentItem}>
              <div className={styles.commentHeader}>
                <img 
                  src={getAvatarUrl(comment.avatar)} 
                  alt={comment.username} 
                  className={styles.avatar} 
                />
                <div className={styles.commentInfo}>
                  <div className={styles.username}>{comment.username}</div>
                  <div className={styles.commentDate}>{formatDate(comment.created_at)}</div>
                </div>
              </div>
              
              {editingCommentId === comment.id ? (
                <div className={styles.editForm}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className={styles.commentTextarea}
                    rows={6}
                  />
                  <div className={styles.formActions}>
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
                      onClick={() => handleLikeComment(comment.id)}
                      aria-label={`Like this comment (${comment.likes} likes)`}
                      title={`Like this comment (${comment.likes} likes)`}
                    >
                      👍 {comment.likes}
                    </button>
                    <button 
                      className={styles.actionButton}
                      onClick={() => handleDislikeComment(comment.id)}
                      aria-label={`Dislike this comment (${comment.dislikes} dislikes)`}
                      title={`Dislike this comment (${comment.dislikes} dislikes)`}
                    >
                      👎 {comment.dislikes}
                    </button>
                    {(replyCountsMap[comment.id] ?? 0) > 0 && (
                      <button 
                        className={styles.toggleRepliesButton}
                        onClick={() => setShowRepliesMap(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
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
                        commentType="comment"
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

                  {/* 回复功能 */}
                  <ChapterCommentReplies 
                    commentId={comment.id}
                    user={user}
                    onReplySubmit={handleReplySubmit}
                    editingCommentId={editingCommentId}
                    onEditComment={handleEditComment}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={handleSaveEdit}
                    comment={comment}
                    showReplies={showRepliesMap[comment.id] ?? false}
                    showReplyForm={showReplyFormMap[comment.id] ?? false}
                    onToggleReplies={(show) => setShowRepliesMap(prev => ({ ...prev, [comment.id]: show }))}
                    onToggleReplyForm={(show) => setShowReplyFormMap(prev => ({ ...prev, [comment.id]: show }))}
                  />
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChapterCommentSectionNew;

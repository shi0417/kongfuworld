import React, { useEffect, useState } from 'react';
import newsCommentService, { NewsComment } from '../../services/newsCommentService';
import NewsCommentReplies from './NewsCommentReplies';
import styles from './NewsCommentSectionNew.module.css';
import ReportButton from '../ReportButton/ReportButton';
import reportService from '../../services/reportService';

interface NewsCommentSectionNewProps {
  newsId: number;
  user: any;
}

const NewsCommentSectionNew: React.FC<NewsCommentSectionNewProps> = ({ newsId, user }) => {
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showRepliesMap, setShowRepliesMap] = useState<Record<number, boolean>>({});
  const [showReplyFormMap, setShowReplyFormMap] = useState<Record<number, boolean>>({});
  const [replyCountsMap, setReplyCountsMap] = useState<Record<number, number>>({});

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsId]);

  // 加载每个评论的回复数量（保持与章节评论一致：N+1）
  useEffect(() => {
    const loadReplyCounts = async () => {
      for (const comment of comments) {
        try {
          const replyData = await newsCommentService.getNewsCommentReplies(comment.id);
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
      const data = await newsCommentService.getNewsComments(newsId);
      // 只显示主评论（没有parent_comment_id的评论）
      const mainComments = (data.comments || []).filter((c: any) => !c.parent_comment_id);
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
      return;
    }
    if (commentContent.trim().length < 10) {
      setError('Comment must be at least 10 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await newsCommentService.submitNewsComment(newsId, commentContent);
      setCommentContent('');
      await loadComments();
    } catch (err: any) {
      setError(err.message || 'Failed to submit comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (commentId: number, content: string) => {
    if (!user) {
      setError('Please login to reply.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await newsCommentService.replyToNewsComment(commentId, content);
      await loadComments();
    } catch (err: any) {
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
      const result = await newsCommentService.likeNewsComment(commentId);
      if (result.data && result.data.likes !== undefined) {
        setComments(prev =>
          prev.map(c => (c.id === commentId ? { ...c, likes: result.data.likes, dislikes: result.data.dislikes } : c))
        );
      } else {
        await loadComments();
      }
    } catch (err: any) {
      console.error('点赞失败:', err);
      setError(err.message || 'Failed to like comment.');
      await loadComments();
    }
  };

  const handleDislikeComment = async (commentId: number) => {
    if (!user) {
      setError('Please login to dislike a comment.');
      return;
    }
    try {
      const result = await newsCommentService.dislikeNewsComment(commentId);
      if (result.data && result.data.dislikes !== undefined) {
        setComments(prev =>
          prev.map(c => (c.id === commentId ? { ...c, likes: result.data.likes, dislikes: result.data.dislikes } : c))
        );
      } else {
        await loadComments();
      }
    } catch (err: any) {
      console.error('点踩失败:', err);
      setError(err.message || 'Failed to dislike comment.');
      await loadComments();
    }
  };

  const handleEditComment = (comment: NewsComment) => {
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
      await newsCommentService.updateNewsComment(commentId, editContent);
      setEditingCommentId(null);
      setEditContent('');
      await loadComments();
    } catch (err: any) {
      setError(err.message || '更新评论失败');
    }
  };

  const getAvatarUrl = (avatar?: string) => {
    if (!avatar) return 'https://i.pravatar.cc/40?img=1';
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
    if (avatar.startsWith('/')) return `${(typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')}${avatar}`;
    return `http://localhost:5000/avatars/${avatar}`;
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
                <img src={getAvatarUrl(comment.avatar)} alt={comment.username} className={styles.avatar} />
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
                    <button className={styles.cancelButton} onClick={handleCancelEdit}>
                      Cancel
                    </button>
                    <button className={styles.submitButton} onClick={() => handleSaveEdit(comment.id)}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.commentContent}>{comment.content}</div>

                  <div className={styles.commentActionsInline}>
                    <button className={styles.actionButton} onClick={() => handleLikeComment(comment.id)}>
                      👍 {comment.likes}
                    </button>
                    <button className={styles.actionButton} onClick={() => handleDislikeComment(comment.id)}>
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
                      <button className={styles.editButton} onClick={() => handleEditComment(comment)}>
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
                          await reportService.submitReport({ commentId, commentType, reportReason });
                        }}
                      />
                    )}
                  </div>

                  <NewsCommentReplies
                    commentId={comment.id}
                    user={user}
                    onReplySubmit={handleReplySubmit}
                    editingCommentId={editingCommentId}
                    onEditComment={handleEditComment as any}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={handleSaveEdit as any}
                    comment={comment as any}
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

export default NewsCommentSectionNew;



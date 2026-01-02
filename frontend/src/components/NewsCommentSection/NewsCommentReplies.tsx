import React, { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../config';
import newsCommentService, { NewsComment } from '../../services/newsCommentService';
import styles from './NewsCommentSectionNew.module.css';
import ReportButton from '../ReportButton/ReportButton';
import reportService from '../../services/reportService';

interface NestedReplyItemProps {
  reply: NewsComment;
  user: any;
  getAvatarUrl: (avatar?: string) => string;
  formatDate: (dateString: string) => string;
  onEdit: (reply: NewsComment) => void;
  onSaveEdit: (replyId: number) => Promise<void>;
  onCancelEdit: () => void;
  editingReplyId: number | null;
  editContent: string;
  setEditContent: (content: string) => void;
  onReplySubmit: (commentId: number, content: string) => Promise<void>;
}

interface NewsCommentRepliesProps {
  commentId: number;
  user: any;
  onReplySubmit: (commentId: number, content: string) => Promise<void>;
  editingCommentId?: number | null;
  onEditComment?: (comment: NewsComment) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (commentId: number) => Promise<void>;
  comment?: NewsComment;
  showReplies?: boolean;
  showReplyForm?: boolean;
  onToggleReplies?: (show: boolean) => void;
  onToggleReplyForm?: (show: boolean) => void;
}

const NewsCommentReplies: React.FC<NewsCommentRepliesProps> = ({
  commentId,
  user,
  onReplySubmit,
  showReplies: externalShowReplies,
  showReplyForm: externalShowReplyForm,
  onToggleReplies,
  onToggleReplyForm
}) => {
  const [replies, setReplies] = useState<NewsComment[]>([]);
  const [showReplies, setShowReplies] = useState(externalShowReplies ?? false);
  const [showReplyForm, setShowReplyForm] = useState(externalShowReplyForm ?? false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');

  useEffect(() => {
    if (externalShowReplies !== undefined) setShowReplies(externalShowReplies);
  }, [externalShowReplies]);

  useEffect(() => {
    if (externalShowReplyForm !== undefined) setShowReplyForm(externalShowReplyForm);
  }, [externalShowReplyForm]);

  useEffect(() => {
    if (showReplies) loadReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReplies, commentId]);

  const handleToggleReplies = () => {
    const v = !showReplies;
    setShowReplies(v);
    onToggleReplies?.(v);
  };

  const handleToggleReplyForm = () => {
    const v = !showReplyForm;
    setShowReplyForm(v);
    onToggleReplyForm?.(v);
  };

  const loadReplies = async () => {
    try {
      const replyData = await newsCommentService.getNewsCommentReplies(commentId);
      setReplies(replyData);
    } catch (err) {
      console.error('Failed to load replies:', err);
    }
  };

  const handleSubmitReply = async () => {
    if (!user) {
      alert('Please login first');
      return;
    }
    if (!replyContent.trim() || replyContent.trim().length < 10) {
      alert('Reply must be at least 10 characters');
      return;
    }
    setSubmitting(true);
    try {
      await onReplySubmit(commentId, replyContent);
      setReplyContent('');
      handleToggleReplyForm();
      await loadReplies();
    } catch (err) {
      console.error('Failed to submit reply:', err);
      alert('Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeReply = async (replyId: number) => {
    if (!user) {
      alert('Please login first');
      return;
    }
    try {
      const result = await newsCommentService.likeNewsComment(replyId);
      if (result.data && result.data.likes !== undefined) {
        setReplies(prev => prev.map(r => (r.id === replyId ? { ...r, likes: result.data.likes, dislikes: result.data.dislikes } : r)));
      } else {
        await loadReplies();
      }
    } catch (err) {
      console.error('点赞失败:', err);
      await loadReplies();
    }
  };

  const handleDislikeReply = async (replyId: number) => {
    if (!user) {
      alert('Please login first');
      return;
    }
    try {
      const result = await newsCommentService.dislikeNewsComment(replyId);
      if (result.data && result.data.dislikes !== undefined) {
        setReplies(prev => prev.map(r => (r.id === replyId ? { ...r, likes: result.data.likes, dislikes: result.data.dislikes } : r)));
      } else {
        await loadReplies();
      }
    } catch (err) {
      console.error('点踩失败:', err);
      await loadReplies();
    }
  };

  const getAvatarUrl = (avatar?: string) => {
    if (!avatar) return 'https://i.pravatar.cc/40?img=1';
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
    if (avatar.startsWith('/')) return `${getApiBaseUrl()}${avatar}`;
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

  const handleEditReply = (reply: NewsComment) => {
    setEditingReplyId(reply.id);
    setEditReplyContent(reply.content);
  };

  const handleCancelEditReply = () => {
    setEditingReplyId(null);
    setEditReplyContent('');
  };

  const handleSaveEditReply = async (replyId: number) => {
    if (!editReplyContent.trim() || editReplyContent.trim().length < 10) {
      alert('回复内容至少需要10个字符');
      return;
    }
    try {
      await newsCommentService.updateNewsComment(replyId, editReplyContent);
      setEditingReplyId(null);
      setEditReplyContent('');
      await loadReplies();
    } catch (err) {
      alert('更新回复失败');
    }
  };

  return (
    <div className={styles.repliesSection}>
      {/* 回复输入表单 */}
      {showReplyForm && (
        <div className={styles.replyForm}>
          <textarea
            className={styles.replyTextarea}
            placeholder="Write your reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
          />
          <div className={styles.replyActions}>
            <button
              className={styles.cancelButton}
              onClick={() => {
                handleToggleReplyForm();
                setReplyContent('');
              }}
            >
              Cancel
            </button>
            <button
              className={styles.submitButton}
              onClick={handleSubmitReply}
              disabled={submitting || replyContent.length < 10}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* 显示回复列表 */}
      {showReplies && (
        <div className={styles.repliesList}>
          {replies.length === 0 ? (
            <div className={styles.noReplies}>No replies yet.</div>
          ) : (
            replies.map((reply) => (
              <div key={reply.id} className={styles.replyItem}>
                <div className={styles.replyHeader}>
                  <img src={getAvatarUrl(reply.avatar)} alt={reply.username} className={styles.avatar} />
                  <div className={styles.replyInfo}>
                    <div className={styles.username}>{reply.username}</div>
                    <div className={styles.replyDate}>{formatDate(reply.created_at)}</div>
                  </div>
                </div>

                {editingReplyId === reply.id ? (
                  <div className={styles.editForm}>
                    <textarea
                      value={editReplyContent}
                      onChange={(e) => setEditReplyContent(e.target.value)}
                      className={styles.replyTextarea}
                      rows={4}
                    />
                    <div className={styles.replyActions}>
                      <button className={styles.cancelButton} onClick={handleCancelEditReply}>
                        Cancel
                      </button>
                      <button className={styles.submitButton} onClick={() => handleSaveEditReply(reply.id)}>
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
                      formatDate={formatDate}
                      onEdit={handleEditReply}
                      onSaveEdit={handleSaveEditReply}
                      onCancelEdit={handleCancelEditReply}
                      editingReplyId={editingReplyId}
                      editContent={editReplyContent}
                      setEditContent={setEditReplyContent}
                      onReplySubmit={onReplySubmit}
                    />
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 小入口（与章评一致：按钮在父组件里，这里不重复加） */}
      {(!showReplies || replies.length === 0) && (
        <div style={{ display: 'none' }} />
      )}
    </div>
  );
};

// 递归嵌套回复组件（楼中楼）
const NestedReplyItem: React.FC<NestedReplyItemProps> = ({
  reply,
  user,
  getAvatarUrl,
  formatDate,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  editingReplyId,
  editContent,
  setEditContent,
  onReplySubmit
}) => {
  const [showNestedReplies, setShowNestedReplies] = useState(false);
  const [nestedReplies, setNestedReplies] = useState<NewsComment[]>([]);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentReply, setCurrentReply] = useState<NewsComment>(reply);
  const [nestedReplyCount, setNestedReplyCount] = useState(0);

  useEffect(() => {
    setCurrentReply(reply);
  }, [reply]);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const replyData = await newsCommentService.getNewsCommentReplies(currentReply.id);
        setNestedReplyCount(replyData.length);
      } catch (err) {
        console.error('Failed to load nested reply count:', err);
        setNestedReplyCount(0);
      }
    };
    loadCount();
  }, [currentReply.id]);

  const loadNestedReplies = async () => {
    try {
      const replyData = await newsCommentService.getNewsCommentReplies(currentReply.id);
      setNestedReplies(replyData);
      setNestedReplyCount(replyData.length);
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

  const handleSubmitNestedReply = async () => {
    if (!user) {
      alert('Please login first');
      return;
    }
    if (!replyContent.trim() || replyContent.trim().length < 10) {
      alert('回复内容至少需要10个字符');
      return;
    }
    setSubmitting(true);
    try {
      await onReplySubmit(currentReply.id, replyContent);
      setReplyContent('');
      setShowReplyForm(false);
      await loadNestedReplies();
    } catch (err) {
      console.error('Failed to submit reply:', err);
      alert('Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (replyId: number) => {
    if (!user) {
      alert('Please login first');
      return;
    }
    try {
      const result = await newsCommentService.likeNewsComment(replyId);
      if (result.data && result.data.likes !== undefined) {
        if (replyId === currentReply.id) {
          setCurrentReply(prev => ({ ...prev, likes: result.data.likes, dislikes: result.data.dislikes }));
        } else {
          setNestedReplies(prev => prev.map(r => (r.id === replyId ? { ...r, likes: result.data.likes, dislikes: result.data.dislikes } : r)));
        }
      } else {
        await loadNestedReplies();
      }
    } catch (err) {
      console.error('点赞失败:', err);
      alert('点赞失败');
    }
  };

  const handleDislike = async (replyId: number) => {
    if (!user) {
      alert('Please login first');
      return;
    }
    try {
      const result = await newsCommentService.dislikeNewsComment(replyId);
      if (result.data && result.data.dislikes !== undefined) {
        if (replyId === currentReply.id) {
          setCurrentReply(prev => ({ ...prev, likes: result.data.likes, dislikes: result.data.dislikes }));
        } else {
          setNestedReplies(prev => prev.map(r => (r.id === replyId ? { ...r, likes: result.data.likes, dislikes: result.data.dislikes } : r)));
        }
      } else {
        await loadNestedReplies();
      }
    } catch (err) {
      console.error('点踩失败:', err);
      alert('点踩失败');
    }
  };

  return (
    <>
      <div className={styles.replyActionsInline}>
        <button className={styles.actionButton} onClick={() => handleLike(currentReply.id)}>
          👍 {currentReply.likes}
        </button>
        <button className={styles.actionButton} onClick={() => handleDislike(currentReply.id)}>
          👎 {currentReply.dislikes}
        </button>
        {(nestedReplyCount > 0 || nestedReplies.length > 0) && (
          <button
            className={styles.toggleRepliesButton}
            onClick={() => {
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
          <button className={styles.editButton} onClick={() => onEdit(currentReply)}>
            Edit
          </button>
        )}
        {user && !showReplyForm && (
          <button className={styles.replyButton} onClick={() => setShowReplyForm(true)}>
            Reply
          </button>
        )}
        {user && (
          <ReportButton
            commentId={currentReply.id}
            commentType="comment"
            commentAuthor={currentReply.username}
            userId={user.id}
            onReportSubmit={async (commentId, commentType, reportReason) => {
              await reportService.submitReport({ commentId, commentType, reportReason });
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
                onClick={handleSubmitNestedReply}
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
                <img src={getAvatarUrl(nestedReply.avatar)} alt={nestedReply.username} className={styles.avatar} />
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
                    <button className={styles.cancelButton} onClick={onCancelEdit}>
                      Cancel
                    </button>
                    <button className={styles.submitButton} onClick={() => onSaveEdit(nestedReply.id)}>
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
                    onEdit={onEdit}
                    onSaveEdit={onSaveEdit}
                    onCancelEdit={onCancelEdit}
                    editingReplyId={editingReplyId}
                    editContent={editContent}
                    setEditContent={setEditContent}
                    onReplySubmit={onReplySubmit}
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

export default NewsCommentReplies;



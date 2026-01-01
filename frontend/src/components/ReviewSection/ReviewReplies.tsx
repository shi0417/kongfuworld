import React, { useState, useEffect } from 'react';
import styles from './ReviewSectionNew.module.css';
import ApiService from '../../services/ApiService';
import { useAuth } from '../../hooks/useAuth';
import ReportButton from '../ReportButton/ReportButton';
import reportService from '../../services/reportService';
import { toAssetUrl } from '../../config';

interface Reply {
  id: number;
  content: string;
  created_at: string;
  username: string;
  pen_name?: string | null; // 笔名
  is_author?: number; // 是否为作者
  avatar?: string;
  likes: number;
  dislikes: number;
  user_id: number;
  comments?: number; // 回复数量
}

interface ReviewRepliesProps {
  reviewId: number;
  user: any;
  onReplySubmit: (reviewId: number, content: string) => Promise<void>;
  compactMode?: boolean;
  showToggle?: boolean;
  editingReviewId?: number | null;
  onEditReview?: (review: any) => void;
  review?: any;
}

const ReviewReplies: React.FC<ReviewRepliesProps> = ({ reviewId, user, onReplySubmit, compactMode = false, showToggle = true, editingReviewId, onEditReview, review }) => {
  const { isAuthenticated } = useAuth();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  // 加载回复数据
  useEffect(() => {
    if (showReplies) {
      loadReplies();
    }
  }, [showReplies, reviewId]);

  const handleSubmitReply = async () => {
    if (!isAuthenticated) {
      alert('Please login first');
      return;
    }

    if (!replyContent.trim()) {
      alert('Please enter reply content');
      return;
    }

    setSubmitting(true);
    try {
      const response = await ApiService.request(`/review/${reviewId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ content: replyContent })
      });

      if (response.success) {
        setReplyContent('');
        setShowReplyForm(false);
        // 重新加载回复列表
        loadReplies();
      } else {
        alert(response.message || 'Failed to submit reply');
      }
    } catch (error) {
      console.error('Failed to submit reply:', error);
      alert('Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  const loadReplies = async () => {
    try {
      // 调用API加载回复
      const response = await ApiService.request(`/review/${reviewId}/comments`);
      if (response.success) {
        setReplies(response.data || []);
      } else {
        console.error('Failed to load replies:', response.message);
        setReplies([]);
      }
    } catch (error) {
      console.error('加载回复失败:', error);
      setReplies([]);
    }
  };

  const handleLikeReply = async (replyId: number) => {
    if (!isAuthenticated) {
      alert('Please login first');
      return;
    }

    try {
      const response = await ApiService.request(`/review/${replyId}/like`, {
        method: 'POST'
      }) as any;

      if (response.success) {
        console.log('点赞结果 - 完整数据:', response);
        console.log('点赞结果 - response.data:', response.data);
        console.log('点赞结果 - response.action:', response.action);
        
        // 根据返回的action处理UI状态
        if (response.action === 'already_liked') {
          console.log('已经点赞过了');
          // 如果后端返回了最新数据，直接更新本地状态
          if (response.data && response.data.likes !== undefined) {
            console.log('使用后端返回的数据更新 (already_liked):', response.data);
            setReplies(prevReplies => 
              prevReplies.map(reply => 
                reply.id === replyId 
                  ? { ...reply, likes: response.data.likes, dislikes: response.data.dislikes }
                  : reply
              )
            );
          } else {
            // 如果没有返回数据，重新加载
            await loadReplies();
          }
        } else if (response.action === 'liked') {
          console.log('点赞成功');
          // 如果后端返回了最新数据，直接更新本地状态
          if (response.data && response.data.likes !== undefined) {
            console.log('使用后端返回的数据更新:', response.data);
            setReplies(prevReplies => {
              const updated = prevReplies.map(reply => {
                if (reply.id === replyId) {
                  console.log('更新前:', reply.likes, reply.dislikes);
                  console.log('更新后:', response.data.likes, response.data.dislikes);
                  return { ...reply, likes: response.data.likes, dislikes: response.data.dislikes };
                }
                return reply;
              });
              console.log('更新后的replies列表:', updated);
              return updated;
            });
          } else {
            console.log('后端未返回数据，重新加载列表');
            // 如果没有返回数据，重新加载
            await loadReplies();
          }
        }
      } else {
        console.log('点赞结果:', response.message);
        // 即使失败也重新加载数据
        await loadReplies();
      }
    } catch (err) {
      console.error('点赞失败:', err);
      // 出错时也重新加载以确保数据同步
      await loadReplies();
    }
  };

  const handleDislikeReply = async (replyId: number) => {
    if (!isAuthenticated) {
      alert('Please login first');
      return;
    }

    try {
      const response = await ApiService.request(`/review/${replyId}/dislike`, {
        method: 'POST'
      }) as any;

      if (response.success) {
        console.log('点踩结果 - 完整数据:', response);
        console.log('点踩结果 - response.data:', response.data);
        console.log('点踩结果 - response.action:', response.action);
        
        // 根据返回的action处理UI状态
        if (response.action === 'already_disliked') {
          console.log('已经点踩过了');
          // 如果后端返回了最新数据，直接更新本地状态
          if (response.data && response.data.dislikes !== undefined) {
            console.log('使用后端返回的数据更新 (already_disliked):', response.data);
            setReplies(prevReplies => 
              prevReplies.map(reply => 
                reply.id === replyId 
                  ? { ...reply, likes: response.data.likes, dislikes: response.data.dislikes }
                  : reply
              )
            );
          } else {
            // 如果没有返回数据，重新加载
            await loadReplies();
          }
        } else if (response.action === 'disliked') {
          console.log('点踩成功');
          // 如果后端返回了最新数据，直接更新本地状态
          if (response.data && response.data.dislikes !== undefined) {
            console.log('使用后端返回的数据更新:', response.data);
            setReplies(prevReplies => {
              const updated = prevReplies.map(reply => {
                if (reply.id === replyId) {
                  console.log('更新前:', reply.likes, reply.dislikes);
                  console.log('更新后:', response.data.likes, response.data.dislikes);
                  return { ...reply, likes: response.data.likes, dislikes: response.data.dislikes };
                }
                return reply;
              });
              console.log('更新后的replies列表:', updated);
              return updated;
            });
          } else {
            console.log('后端未返回数据，重新加载列表');
            // 如果没有返回数据，重新加载
            await loadReplies();
          }
        }
      } else {
        console.log('点踩结果:', response.message);
        // 即使失败也重新加载数据
        await loadReplies();
      }
    } catch (err) {
      console.error('点踩失败:', err);
      // 出错时也重新加载以确保数据同步
      await loadReplies();
    }
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

  const handleEditReply = (reply: Reply) => {
    setEditingReplyId(reply.id);
    setEditContent(reply.content);
  };

  const handleCancelEdit = () => {
    setEditingReplyId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (replyId: number) => {
    if (!editContent.trim()) {
      alert('评论内容不能为空');
      return;
    }

    try {
      const response = await ApiService.request(`/review/${replyId}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editContent })
      });

      if (response.success) {
        setEditingReplyId(null);
        setEditContent('');
        // 重新加载回复列表
        loadReplies();
      } else {
        alert(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新回复失败:', error);
      alert('更新回复失败');
    }
  };

  const getAvatarUrl = (avatar?: string) => {
    if (!avatar) {
      return 'https://i.pravatar.cc/32?img=1';
    }
    
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    
    return toAssetUrl(avatar.startsWith('/') ? avatar : `/avatars/${avatar}`);
  };

  if (compactMode) {
    return (
      <div className={styles.repliesWrapperCompact}>
        <div className={styles.replyControls}>
          {showToggle && (
            <button 
              className={styles.toggleRepliesButtonCompact}
              onClick={() => setShowReplies(!showReplies)}
            >
              {showReplies ? 'Hide replies' : `View replies (${review?.comments ?? review?.reply_count ?? replies.length ?? 0})`}
            </button>
          )}
          {user && review && user.id === review.user_id && !editingReviewId && (
            <button 
              className={styles.editButton}
              onClick={() => onEditReview && onEditReview(review)}
            >
              Edit
            </button>
          )}
          {user && !showReplyForm && !editingReviewId && (
            <button 
              className={styles.addReplyButton}
              onClick={() => setShowReplyForm(true)}
            >
              Add a reply
            </button>
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
              <div className={styles.replyFormActions}>
                <button 
                  className={styles.cancelReplyButton}
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  className={styles.submitReplyButton}
                  onClick={handleSubmitReply}
                  disabled={!replyContent.trim() || submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
        {showReplies && (
          <div className={styles.repliesContainerCompact}>
            {replies.map((reply) => (
              <NestedReplyItem
                key={reply.id}
                reply={reply}
                user={user}
                getAvatarUrl={getAvatarUrl}
                formatDate={formatDate}
                onEdit={handleEditReply}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onLike={handleLikeReply}
                onDislike={handleDislikeReply}
                editingReplyId={editingReplyId}
                editContent={editContent}
                setEditContent={setEditContent}
                onUpdateNestedReply={(replyId, updatedData) => {
                  setReplies(prevReplies =>
                    prevReplies.map(r =>
                      r.id === replyId
                        ? { ...r, ...updatedData }
                        : r
                    )
                  );
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.repliesContainer}>
      {showToggle && (
        <button 
          className={styles.toggleRepliesButton}
          onClick={() => setShowReplies(!showReplies)}
        >
          {showReplies ? 'Hide replies' : `View replies (${review?.comments ?? review?.reply_count ?? replies.length ?? 0})`}
        </button>
      )}

      {showReplies && (
        <div className={styles.repliesList}>
          {replies.map((reply) => (
            <div key={reply.id} className={styles.replyItem}>
              <div className={styles.replyHeader}>
                <img 
                  src={getAvatarUrl(reply.avatar)} 
                  alt={reply.is_author && reply.pen_name ? reply.pen_name : reply.username}
                  className={styles.replyAvatar}
                />
                <span className={styles.replyUsername}>
                  {reply.is_author && reply.pen_name ? reply.pen_name : reply.username}
                  {reply.is_author && (
                    <span style={{ 
                      background: '#4a90e2', 
                      color: 'white', 
                      padding: '2px 6px', 
                      borderRadius: '3px', 
                      fontSize: '11px', 
                      fontWeight: 600,
                      marginLeft: '6px'
                    }}>作者</span>
                  )}
                </span>
                <span className={styles.replyDate}>{formatDate(reply.created_at)}</span>
                {user && user.id === reply.user_id && (
                  <button
                    className={styles.editButton}
                    onClick={() => handleEditReply(reply)}
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingReplyId === reply.id ? (
                <div className={styles.editForm}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className={styles.replyTextarea}
                    rows={3}
                  />
                  <div className={styles.replyFormActions}>
                    <button 
                      className={styles.cancelReplyButton}
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                    <button 
                      className={styles.submitReplyButton}
                      onClick={() => handleSaveEdit(reply.id)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.replyContent}>{reply.content}</div>
              )}
              {editingReplyId !== reply.id && (
                <div className={styles.replyActions}>
                  <button 
                    className={styles.replyLikeButton}
                    onClick={() => handleLikeReply(reply.id)}
                  >
                    👍 {reply.likes}
                  </button>
                  <button 
                    className={styles.replyDislikeButton}
                    onClick={() => handleDislikeReply(reply.id)}
                  >
                    👎 {reply.dislikes}
                  </button>
                  {user && (
                    <ReportButton
                      commentId={reply.id}
                      commentType="review"
                      commentAuthor={reply.is_author && reply.pen_name ? reply.pen_name : reply.username}
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
              )}
            </div>
          ))}

          {user && (
            <div className={styles.replyFormContainer}>
              {!showReplyForm ? (
                <button 
                  className={styles.addReplyButton}
                  onClick={() => setShowReplyForm(true)}
                >
                  Add Reply
                </button>
              ) : (
                <div className={styles.replyForm}>
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write your reply..."
                    className={styles.replyTextarea}
                    rows={3}
                  />
                  <div className={styles.replyFormActions}>
                    <button 
                      className={styles.cancelReplyButton}
                      onClick={() => {
                        setShowReplyForm(false);
                        setReplyContent('');
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      className={styles.submitReplyButton}
                      onClick={handleSubmitReply}
                      disabled={submitting || !replyContent.trim()}
                    >
                      {submitting ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 嵌套回复组件 - 递归显示回复及其子回复
interface NestedReplyItemProps {
  reply: Reply;
  user: any;
  getAvatarUrl: (avatar?: string) => string;
  formatDate: (dateString: string) => string;
  onEdit: (reply: Reply) => void;
  onSaveEdit: (replyId: number) => Promise<void>;
  onCancelEdit: () => void;
  onLike: (replyId: number) => Promise<void>;
  onDislike: (replyId: number) => Promise<void>;
  editingReplyId: number | null;
  editContent: string;
  setEditContent: (content: string) => void;
  onUpdateNestedReply?: (replyId: number, updatedData: { likes: number; dislikes: number }) => void;
}

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
  onUpdateNestedReply
}) => {
  const [showNestedReplies, setShowNestedReplies] = useState(false);
  const [nestedReplies, setNestedReplies] = useState<Reply[]>([]);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentReply, setCurrentReply] = useState<Reply>(reply);
  const { isAuthenticated } = useAuth();

  // 当reply prop更新时，同步更新currentReply
  useEffect(() => {
    setCurrentReply(reply);
  }, [reply]);

  // 加载嵌套回复
  const loadNestedReplies = async () => {
    try {
      const response = await ApiService.request(`/review/${currentReply.id}/comments`);
      if (response.success) {
        setNestedReplies(response.data || []);
      } else {
        console.error('Failed to load nested replies:', response.message);
        setNestedReplies([]);
      }
    } catch (error) {
      console.error('加载嵌套回复失败:', error);
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
    if (!isAuthenticated) {
      alert('Please login first');
      return;
    }

    if (!replyContent.trim()) {
      alert('Please enter reply content');
      return;
    }

    setSubmitting(true);
    try {
      const response = await ApiService.request(`/review/${currentReply.id}/comment`, {
        method: 'POST',
        body: JSON.stringify({ content: replyContent })
      });

      if (response.success) {
        setReplyContent('');
        setShowReplyForm(false);
        loadNestedReplies();
      } else {
        alert(response.message || 'Failed to submit reply');
      }
    } catch (error) {
      console.error('Failed to submit reply:', error);
      alert('Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  // 处理嵌套回复的点赞
  const handleLikeNestedReply = async (replyId: number) => {
    if (!isAuthenticated) {
      alert('Please login first');
      return;
    }

    try {
      const response = await ApiService.request(`/review/${replyId}/like`, {
        method: 'POST'
      }) as any;

      if (response.success) {
        // 更新当前回复的状态
        if (replyId === currentReply.id) {
          if (response.data && response.data.likes !== undefined) {
            setCurrentReply(prev => ({
              ...prev,
              likes: response.data.likes,
              dislikes: response.data.dislikes
            }));
            // 通知父组件更新
            if (onUpdateNestedReply) {
              onUpdateNestedReply(replyId, {
                likes: response.data.likes,
                dislikes: response.data.dislikes
              });
            }
          }
        } else {
          // 更新嵌套回复的状态
          setNestedReplies(prevReplies =>
            prevReplies.map(r =>
              r.id === replyId
                ? { ...r, likes: response.data.likes, dislikes: response.data.dislikes }
                : r
            )
          );
        }
      }
    } catch (err) {
      console.error('点赞失败:', err);
      alert('点赞失败');
    }
  };

  // 处理嵌套回复的点踩
  const handleDislikeNestedReply = async (replyId: number) => {
    if (!isAuthenticated) {
      alert('Please login first');
      return;
    }

    try {
      const response = await ApiService.request(`/review/${replyId}/dislike`, {
        method: 'POST'
      }) as any;

      if (response.success) {
        // 更新当前回复的状态
        if (replyId === currentReply.id) {
          if (response.data && response.data.dislikes !== undefined) {
            setCurrentReply(prev => ({
              ...prev,
              likes: response.data.likes,
              dislikes: response.data.dislikes
            }));
            // 通知父组件更新
            if (onUpdateNestedReply) {
              onUpdateNestedReply(replyId, {
                likes: response.data.likes,
                dislikes: response.data.dislikes
              });
            }
          }
        } else {
          // 更新嵌套回复的状态
          setNestedReplies(prevReplies =>
            prevReplies.map(r =>
              r.id === replyId
                ? { ...r, likes: response.data.likes, dislikes: response.data.dislikes }
                : r
            )
          );
        }
      }
    } catch (err) {
      console.error('点踩失败:', err);
      alert('点踩失败');
    }
  };

  return (
    <div className={styles.replyItem}>
      <div className={styles.replyHeader}>
        <img 
          src={getAvatarUrl(currentReply.avatar)} 
          alt={currentReply.is_author && currentReply.pen_name ? currentReply.pen_name : currentReply.username}
          className={styles.replyAvatar}
        />
        <span className={styles.replyUsername}>
          {currentReply.is_author && currentReply.pen_name ? currentReply.pen_name : currentReply.username}
          {currentReply.is_author && (
            <span style={{ 
              background: '#4a90e2', 
              color: 'white', 
              padding: '2px 6px', 
              borderRadius: '3px', 
              fontSize: '11px', 
              fontWeight: 600,
              marginLeft: '6px'
            }}>作者</span>
          )}
        </span>
        <span className={styles.replyDate}>{formatDate(currentReply.created_at)}</span>
      </div>
      {editingReplyId === currentReply.id ? (
        <div className={styles.editForm}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className={styles.replyTextarea}
            rows={3}
          />
          <div className={styles.replyFormActions}>
            <button 
              className={styles.cancelReplyButton}
              onClick={onCancelEdit}
            >
              Cancel
            </button>
            <button 
              className={styles.submitReplyButton}
              onClick={() => onSaveEdit(currentReply.id)}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.replyContent}>{currentReply.content}</div>
      )}
      {editingReplyId !== currentReply.id && (
        <>
          {/* 子评论的所有按钮 - 在同一行显示 */}
          <div className={styles.replyActionsInline}>
            <button 
              className={styles.replyLikeButton}
              onClick={() => handleLikeNestedReply(currentReply.id)}
            >
              👍 {currentReply.likes}
            </button>
            <button 
              className={styles.replyDislikeButton}
              onClick={() => handleDislikeNestedReply(currentReply.id)}
            >
              👎 {currentReply.dislikes}
            </button>
            {(nestedReplies.length > 0 || (currentReply.comments ?? 0) > 0) && (
              <button 
                className={styles.toggleRepliesButtonCompact}
                onClick={() => {
                  setShowNestedReplies(!showNestedReplies);
                  if (!showNestedReplies && nestedReplies.length === 0) {
                    loadNestedReplies();
                  }
                }}
              >
                {showNestedReplies ? 'Hide replies' : `View replies (${nestedReplies.length || currentReply.comments || 0})`}
              </button>
            )}
            {user && user.id === currentReply.user_id && (
              <button 
                className={styles.editButton}
                onClick={() => onEdit(currentReply)}
              >
                Edit
              </button>
            )}
            {user && !showReplyForm && (
              <button 
                className={styles.addReplyButton}
                onClick={() => setShowReplyForm(true)}
              >
                Add a reply
              </button>
            )}
            {user && (
              <ReportButton
                commentId={currentReply.id}
                commentType="review"
                commentAuthor={currentReply.is_author && currentReply.pen_name ? currentReply.pen_name : currentReply.username}
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
                <div className={styles.replyFormActions}>
                  <button 
                    className={styles.cancelReplyButton}
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyContent('');
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    className={styles.submitReplyButton}
                    onClick={handleSubmitReply}
                    disabled={!replyContent.trim() || submitting}
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
                <NestedReplyItem
                  key={nestedReply.id}
                  reply={nestedReply}
                  user={user}
                  getAvatarUrl={getAvatarUrl}
                  formatDate={formatDate}
                  onEdit={onEdit}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                  onLike={handleLikeNestedReply}
                  onDislike={handleDislikeNestedReply}
                  editingReplyId={editingReplyId}
                  editContent={editContent}
                  setEditContent={setEditContent}
                  onUpdateNestedReply={(replyId, updatedData) => {
                    setNestedReplies(prevReplies =>
                      prevReplies.map(r =>
                        r.id === replyId
                          ? { ...r, ...updatedData }
                          : r
                      )
                    );
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewReplies;

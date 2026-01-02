import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../../config';
import chapterCommentService, { ChapterComment } from '../../services/chapterCommentService';
import styles from './ChapterCommentSectionNew.module.css';
import ReportButton from '../ReportButton/ReportButton';
import reportService from '../../services/reportService';

interface NestedReplyItemProps {
  reply: ChapterComment;
  user: any;
  getAvatarUrl: (avatar?: string) => string;
  formatDate: (dateString: string) => string;
  onEdit: (reply: ChapterComment) => void;
  onSaveEdit: (replyId: number) => Promise<void>;
  onCancelEdit: () => void;
  onLike: (replyId: number) => Promise<void>;
  onDislike: (replyId: number) => Promise<void>;
  editingReplyId: number | null;
  editContent: string;
  setEditContent: (content: string) => void;
  onReplySubmit: (commentId: number, content: string) => Promise<void>;
}

interface ChapterCommentRepliesProps {
  commentId: number;
  user: any;
  onReplySubmit: (commentId: number, content: string) => Promise<void>;
  editingCommentId?: number | null;
  onEditComment?: (comment: ChapterComment) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (commentId: number) => Promise<void>;
  comment?: ChapterComment;
  showReplies?: boolean;
  showReplyForm?: boolean;
  onToggleReplies?: (show: boolean) => void;
  onToggleReplyForm?: (show: boolean) => void;
}

const ChapterCommentReplies: React.FC<ChapterCommentRepliesProps> = ({ 
  commentId, 
  user, 
  onReplySubmit,
  editingCommentId,
  onEditComment,
  onCancelEdit,
  onSaveEdit,
  comment,
  showReplies: externalShowReplies,
  showReplyForm: externalShowReplyForm,
  onToggleReplies,
  onToggleReplyForm
}) => {
  const [replies, setReplies] = useState<ChapterComment[]>([]);
  const [replyCount, setReplyCount] = useState(0); // 添加回复数量状态
  const [showReplies, setShowReplies] = useState(externalShowReplies ?? false);
  const [showReplyForm, setShowReplyForm] = useState(externalShowReplyForm ?? false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');

  // 同步外部状态
  useEffect(() => {
    if (externalShowReplies !== undefined) {
      setShowReplies(externalShowReplies);
    }
  }, [externalShowReplies]);

  useEffect(() => {
    if (externalShowReplyForm !== undefined) {
      setShowReplyForm(externalShowReplyForm);
    }
  }, [externalShowReplyForm]);

  // 组件初始化时获取回复数量
  useEffect(() => {
    loadReplyCount();
  }, [commentId]);

  // 加载回复数据
  useEffect(() => {
    if (showReplies) {
      loadReplies();
    }
  }, [showReplies, commentId]);

  const handleToggleReplies = () => {
    const newValue = !showReplies;
    setShowReplies(newValue);
    if (onToggleReplies) {
      onToggleReplies(newValue);
    }
  };

  const handleToggleReplyForm = () => {
    const newValue = !showReplyForm;
    setShowReplyForm(newValue);
    if (onToggleReplyForm) {
      onToggleReplyForm(newValue);
    }
  };

  const loadReplyCount = async () => {
    try {
      const replyData = await chapterCommentService.getCommentReplies(commentId);
      setReplyCount(replyData.length);
    } catch (err: any) {
      console.error('Failed to load reply count:', err);
      setReplyCount(0);
    }
  };

  const loadReplies = async () => {
    try {
      const replyData = await chapterCommentService.getCommentReplies(commentId);
      setReplies(replyData);
      setReplyCount(replyData.length); // 同时更新数量
    } catch (err: any) {
      console.error('Failed to load replies:', err);
    }
  };

  const handleSubmitReply = async () => {
    if (!user) {
      alert('Please login first');
      return;
    }

    if (!replyContent.trim()) {
      alert('Please enter reply content');
      return;
    }

    setSubmitting(true);
    try {
      await onReplySubmit(commentId, replyContent);
      setReplyContent('');
      handleToggleReplyForm();
      await loadReplies(); // 重新加载回复
      await loadReplyCount(); // 重新加载回复数量
    } catch (err: any) {
      console.error('Failed to submit reply:', err);
      alert('Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeReply = async (replyId: number) => {
    console.log('🔍 点赞回复被调用，回复ID:', replyId);
    
    if (!user) {
      console.log('❌ 用户未登录');
      alert('Please login first');
      return;
    }
    
    try {
      console.log('📡 调用点赞API...');
      const result = await chapterCommentService.likeChapterComment(replyId);
      console.log('点赞结果 - 完整数据:', result);
      console.log('点赞结果 - result.data:', result.data);
      console.log('点赞结果 - result.action:', result.action);
      
      // 根据返回的action处理UI状态
      if (result.action === 'already_liked') {
        console.log('已经点赞过了');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.likes !== undefined) {
          console.log('使用后端返回的数据更新 (already_liked):', result.data);
          setReplies(prevReplies => 
            prevReplies.map(reply => 
              reply.id === replyId 
                ? { ...reply, likes: result.data.likes, dislikes: result.data.dislikes }
                : reply
            )
          );
        } else {
          // 如果没有返回数据，重新加载
          await loadReplies();
        }
      } else if (result.action === 'liked') {
        console.log('点赞成功');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.likes !== undefined) {
          console.log('使用后端返回的数据更新:', result.data);
          setReplies(prevReplies => {
            const updated = prevReplies.map(reply => {
              if (reply.id === replyId) {
                console.log('更新前:', reply.likes, reply.dislikes);
                console.log('更新后:', result.data.likes, result.data.dislikes);
                return { ...reply, likes: result.data.likes, dislikes: result.data.dislikes };
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
    } catch (err: any) {
      console.error('❌ 点赞回复失败:', err);
      // 出错时也重新加载以确保数据同步
      await loadReplies();
    }
  };

  const handleDislikeReply = async (replyId: number) => {
    console.log('🔍 点踩回复被调用，回复ID:', replyId);
    
    if (!user) {
      console.log('❌ 用户未登录');
      alert('Please login first');
      return;
    }
    
    try {
      console.log('📡 调用点踩API...');
      const result = await chapterCommentService.dislikeChapterComment(replyId);
      console.log('点踩结果 - 完整数据:', result);
      console.log('点踩结果 - result.data:', result.data);
      console.log('点踩结果 - result.action:', result.action);
      
      // 根据返回的action处理UI状态
      if (result.action === 'already_disliked') {
        console.log('已经点踩过了');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.dislikes !== undefined) {
          console.log('使用后端返回的数据更新 (already_disliked):', result.data);
          setReplies(prevReplies => 
            prevReplies.map(reply => 
              reply.id === replyId 
                ? { ...reply, likes: result.data.likes, dislikes: result.data.dislikes }
                : reply
            )
          );
        } else {
          // 如果没有返回数据，重新加载
          await loadReplies();
        }
      } else if (result.action === 'disliked') {
        console.log('点踩成功');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.dislikes !== undefined) {
          console.log('使用后端返回的数据更新:', result.data);
          setReplies(prevReplies => {
            const updated = prevReplies.map(reply => {
              if (reply.id === replyId) {
                console.log('更新前:', reply.likes, reply.dislikes);
                console.log('更新后:', result.data.likes, result.data.dislikes);
                return { ...reply, likes: result.data.likes, dislikes: result.data.dislikes };
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
    } catch (err: any) {
      console.error('❌ 点踩回复失败:', err);
      // 出错时也重新加载以确保数据同步
      await loadReplies();
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

  const handleEditReply = (reply: ChapterComment) => {
    setEditingReplyId(reply.id);
    setEditReplyContent(reply.content);
  };

  const handleCancelEditReply = () => {
    setEditingReplyId(null);
    setEditReplyContent('');
  };

  const handleSaveEditReply = async (replyId: number) => {
    if (!editReplyContent.trim()) {
      alert('回复内容不能为空');
      return;
    }

    if (editReplyContent.trim().length < 10) {
      alert('回复内容至少需要10个字符');
      return;
    }

    try {
      await chapterCommentService.updateChapterComment(replyId, editReplyContent);
      setEditingReplyId(null);
      setEditReplyContent('');
      await loadReplies();
    } catch (err: any) {
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
            aria-label="Reply text area"
            title="Enter your reply here"
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
                  <img 
                    src={getAvatarUrl(reply.avatar)} 
                    alt={reply.username} 
                    className={styles.avatar} 
                  />
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
                      <button 
                        className={styles.cancelButton}
                        onClick={handleCancelEditReply}
                      >
                        Cancel
                      </button>
                      <button 
                        className={styles.submitButton}
                        onClick={() => handleSaveEditReply(reply.id)}
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
                      formatDate={formatDate}
                      onEdit={handleEditReply}
                      onSaveEdit={handleSaveEditReply}
                      onCancelEdit={handleCancelEditReply}
                      onLike={handleLikeReply}
                      onDislike={handleDislikeReply}
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
    </div>
  );
};

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
  onReplySubmit
}) => {
  const [showNestedReplies, setShowNestedReplies] = useState(false);
  const [nestedReplies, setNestedReplies] = useState<ChapterComment[]>([]);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentReply, setCurrentReply] = useState<ChapterComment>(reply);
  const [nestedReplyCount, setNestedReplyCount] = useState(0);

  // 当reply prop更新时，同步更新currentReply
  useEffect(() => {
    setCurrentReply(reply);
  }, [reply]);

  // 加载嵌套回复数量
  useEffect(() => {
    const loadNestedReplyCount = async () => {
      try {
        const replyData = await chapterCommentService.getCommentReplies(currentReply.id);
        setNestedReplyCount(replyData.length);
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
      const replyData = await chapterCommentService.getCommentReplies(currentReply.id);
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

  const handleSubmitReply = async () => {
    if (!user) {
      alert('Please login first');
      return;
    }

    if (!replyContent.trim()) {
      alert('Please enter reply content');
      return;
    }

    if (replyContent.trim().length < 10) {
      alert('回复内容至少需要10个字符');
      return;
    }

    setSubmitting(true);
    try {
      await onReplySubmit(currentReply.id, replyContent);
      setReplyContent('');
      setShowReplyForm(false);
      await loadNestedReplies();
    } catch (err: any) {
      console.error('Failed to submit reply:', err);
      alert('Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  // 处理嵌套回复的点赞
  const handleLikeNestedReply = async (replyId: number) => {
    if (!user) {
      alert('Please login first');
      return;
    }

    try {
      const result = await chapterCommentService.likeChapterComment(replyId);
      if (result.action === 'liked' || result.action === 'already_liked') {
        if (result.data && result.data.likes !== undefined) {
          if (replyId === currentReply.id) {
            setCurrentReply(prev => ({
              ...prev,
              likes: result.data.likes,
              dislikes: result.data.dislikes
            }));
          } else {
            setNestedReplies(prevReplies =>
              prevReplies.map(r =>
                r.id === replyId
                  ? { ...r, likes: result.data.likes, dislikes: result.data.dislikes }
                  : r
              )
            );
          }
        }
      }
    } catch (err) {
      console.error('点赞失败:', err);
      alert('点赞失败');
    }
  };

  // 处理嵌套回复的点踩
  const handleDislikeNestedReply = async (replyId: number) => {
    if (!user) {
      alert('Please login first');
      return;
    }

    try {
      const result = await chapterCommentService.dislikeChapterComment(replyId);
      if (result.action === 'disliked' || result.action === 'already_disliked') {
        if (result.data && result.data.dislikes !== undefined) {
          if (replyId === currentReply.id) {
            setCurrentReply(prev => ({
              ...prev,
              likes: result.data.likes,
              dislikes: result.data.dislikes
            }));
          } else {
            setNestedReplies(prevReplies =>
              prevReplies.map(r =>
                r.id === replyId
                  ? { ...r, likes: result.data.likes, dislikes: result.data.dislikes }
                  : r
              )
            );
          }
        }
      }
    } catch (err) {
      console.error('点踩失败:', err);
      alert('点踩失败');
    }
  };

  const handleEditNestedReply = (nestedReply: ChapterComment) => {
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
          👍 {currentReply.likes}
        </button>
        <button 
          className={styles.actionButton}
          onClick={() => handleDislikeNestedReply(currentReply.id)}
        >
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
            commentType="comment"
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

export default ChapterCommentReplies;

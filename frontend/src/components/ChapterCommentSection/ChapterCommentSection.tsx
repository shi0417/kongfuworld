import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import chapterCommentService, { ChapterComment, ChapterCommentStats } from '../../services/chapterCommentService';
import styles from './ChapterCommentSection.module.css';
import { toAssetUrl } from '../../config';

interface ChapterCommentSectionProps {
  chapterId: number;
  user: any;
}

const ChapterCommentSection: React.FC<ChapterCommentSectionProps> = ({ chapterId, user }) => {
  const navigate = useNavigate();
  const [comments, setComments] = useState<ChapterComment[]>([]);
  const [stats, setStats] = useState<ChapterCommentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 加载评论数据
  useEffect(() => {
    loadComments();
  }, [chapterId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await chapterCommentService.getChapterComments(chapterId);
      setComments(response.comments);
      setStats({
        total_comments: response.total,
        like_rate: response.like_rate,
        total_likes: response.total_likes
      });
    } catch (err: any) {
      console.error('加载章节评论失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      setError('Please login first');
      return;
    }

    if (!commentContent.trim() || commentContent.trim().length < 10) {
      setError('Comment content must be at least 10 characters');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await chapterCommentService.submitChapterComment(chapterId, commentContent);
      setCommentContent('');
      setShowCommentForm(false);
      await loadComments(); // 重新加载评论
    } catch (err: any) {
      setError(err.message || 'Failed to submit comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: number) => {
    if (!user) {
      setError('Please login first');
      return;
    }

    try {
      await chapterCommentService.likeChapterComment(commentId);
      await loadComments(); // 重新加载评论以更新点赞数
    } catch (err: any) {
      setError(err.message || 'Failed to like comment');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return `${Math.ceil(diffDays / 30)} months ago`;
  };

  const getAvatarUrl = (avatar?: string) => {
    if (!avatar) {
      return 'https://i.pravatar.cc/40?img=1';
    }
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    return toAssetUrl(avatar.startsWith('/') ? avatar : `/avatars/${avatar}`);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        Loading comments...
      </div>
    );
  }

  return (
    <div className={styles.commentSection}>
      <div className={styles.sectionTitle}>Comments</div>
      
      {/* 评论输入框 */}
      <div className={styles.commentFormContainer}>
        <div className={styles.commentForm}>
          <div className={styles.formHeader}>
            <span className={styles.formTitle}>Write a comment</span>
          </div>
          
          <textarea 
            className={styles.commentTextarea}
            placeholder="Add a Comment"
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
          />
          <div className={styles.formFooter}>
            <span className={styles.wordCount}>{commentContent.length} Words</span>
            <span className={styles.validationMessage}>
              Comments must have a minimum of 10 words
            </span>
          </div>
          <div className={styles.formActions}>
            <button 
              className={styles.cancelButton}
              onClick={() => setShowCommentForm(false)}
            >
              Cancel
            </button>
            <button 
              className={styles.submitButton}
              onClick={handleSubmitComment}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* 评论统计和列表 */}
      {stats && (
        <div className={styles.commentStats}>
          <span className={styles.likeRate}>👍 {stats.like_rate}%</span>
          <span className={styles.commentCount}>{stats.total_comments} Comments</span>
          <span className={styles.viewAll}>View All</span>
        </div>
      )}

      {/* 评论列表 */}
      <div className={styles.commentsList}>
        {comments.map((comment) => (
          <div key={comment.id} className={styles.commentItem}>
            <div className={styles.commentHeader}>
              <img 
                src={getAvatarUrl(comment.avatar)} 
                alt={comment.username}
                className={styles.avatar}
              />
              <span className={styles.username}>{comment.username}</span>
              {comment.is_vip && <span className={styles.vipBadge}>VIP</span>}
              <span className={styles.commentDate}>{formatDate(comment.created_at)}</span>
            </div>
            <div className={styles.commentContent}>{comment.content}</div>
            <div className={styles.commentActions}>
              <button 
                className={styles.actionButton}
                onClick={() => handleLikeComment(comment.id)}
              >
                👍 {comment.likes}
              </button>
              <span className={styles.actionButton}>💬 0</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChapterCommentSection;

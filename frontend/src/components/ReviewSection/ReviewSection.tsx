import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../../config';
import reviewService, { Review, ReviewStats } from '../../services/reviewService';
import styles from './ReviewSection.module.css';

interface ReviewSectionProps {
  novelId: number;
  user: any;
}

const ReviewSection: React.FC<ReviewSectionProps> = ({ novelId, user }) => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [isRecommended, setIsRecommended] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedReviews, setExpandedReviews] = useState<Set<number>>(new Set());
  const [showAllReviews, setShowAllReviews] = useState(false);

  // 加载评论数据
  useEffect(() => {
    loadReviews();
    loadStats();
  }, [novelId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const response = await reviewService.getNovelReviews(novelId, 1, 10);
      setReviews(response.data.reviews);
    } catch (err) {
      console.error('加载评论失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await reviewService.getNovelReviewStats(novelId);
      setStats(statsData);
    } catch (err) {
      console.error('加载评论统计失败:', err);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      setError('请先登录');
      return;
    }

    if (!reviewContent.trim() || reviewContent.trim().length < 100) {
      setError('评论内容至少需要100个字符');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await reviewService.submitReview(novelId, reviewContent, reviewRating, isRecommended);
      
      // 重新加载数据
      await loadReviews();
      await loadStats();
      
      // 重置表单
      setReviewContent('');
      setReviewRating(5);
      setIsRecommended(false);
      setShowReviewForm(false);
      
    } catch (err: any) {
      setError(err.message || '提交评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeReview = async (reviewId: number) => {
    if (!user) {
      setError('请先登录');
      return;
    }

    try {
      await reviewService.likeReview(reviewId);
      // 重新加载评论以更新点赞数
      await loadReviews();
    } catch (err: any) {
      setError(err.message || '点赞失败');
    }
  };

  const handleLoginRedirect = () => {
    navigate(`/login?redirect=/book/${novelId}`);
  };

  const toggleReviewExpansion = (reviewId: number) => {
    const newExpanded = new Set(expandedReviews);
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId);
    } else {
      newExpanded.add(reviewId);
    }
    setExpandedReviews(newExpanded);
  };

  const getTruncatedContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1天前';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)}周前`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)}个月前`;
    return `${Math.ceil(diffDays / 365)}年前`;
  };

  const getAvatarUrl = (avatar?: string) => {
    if (!avatar) {
      return 'https://i.pravatar.cc/40?img=1';
    }
    
    // 如果已经是完整URL，直接返回
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    
    // 如果是相对路径，添加API基础URL
    if (avatar.startsWith('/')) {
      return `${getApiBaseUrl()}${avatar}`;
    }
    
    // 如果是文件名，添加avatars路径
    return `${getApiBaseUrl()}/avatars/${avatar}`;
  };

  if (loading) {
    return (
      <div className={styles.reviewSection}>
        <div className={styles.loading}>加载评论中...</div>
      </div>
    );
  }

  return (
    <div className={styles.reviewSection}>
      <div className={styles.sectionTitle}>Reviews</div>
      
      {/* 评论统计 */}
      {stats && (
        <div className={styles.statsContainer}>
          <div className={styles.statsItem}>
            <span className={styles.statsValue}>👍 {stats.recommendation_rate}%</span>
            <span className={styles.statsLabel}>{stats.total_reviews} Reviews</span>
          </div>
        </div>
      )}

      {/* 评论输入框 */}
      {user && (
        <div className={styles.reviewFormContainer}>
          <div className={styles.reviewForm}>
            <div className={styles.formHeader}>
              <span className={styles.formTitle}>Write a review</span>
            </div>
            <div className={styles.formSubtitle}>Enjoy World's No. 1 Swordsman?</div>
            
            {/* 推荐按钮 */}
            <div className={styles.recommendButtons}>
              <button 
                className={`${styles.recommendButton} ${isRecommended ? styles.recommended : ''}`}
                onClick={() => setIsRecommended(true)}
              >
                👍
              </button>
              <button 
                className={`${styles.recommendButton} ${!isRecommended ? styles.notRecommended : ''}`}
                onClick={() => setIsRecommended(false)}
              >
                👎
              </button>
            </div>

            {/* 评分选择 */}
            <div className={styles.ratingContainer}>
              <label>评分:</label>
              <select 
                value={reviewRating} 
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className={styles.ratingSelect}
              >
                {[1, 2, 3, 4, 5].map(rating => (
                  <option key={rating} value={rating}>{rating}星</option>
                ))}
              </select>
            </div>

            <textarea 
              className={styles.reviewTextarea}
              placeholder="Add a Review"
              value={reviewContent}
              onChange={(e) => setReviewContent(e.target.value)}
              rows={4}
            />
            
            <div className={styles.formFooter}>
              <div className={styles.wordCount}>
                <span>{reviewContent.length} Words</span>
                {reviewContent.length < 100 && (
                  <span className={styles.errorText}>Reviews must have a minimum of 100 words</span>
                )}
              </div>
              <div className={styles.formActions}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowReviewForm(false)}
                >
                  Cancel
                </button>
                <button 
                  className={styles.submitButton}
                  onClick={handleSubmitReview}
                  disabled={submitting || reviewContent.length < 100}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 用户未登录时的提示 */}
      {!user && (
        <div className={styles.loginPrompt}>
          <div className={styles.loginMessage}>
            <p>请先登录才能发表评论</p>
            <button 
              className={styles.loginButton}
              onClick={handleLoginRedirect}
            >
              请先登录
            </button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className={styles.errorMessage}>{error}</div>
      )}

      {/* 评论列表 */}
      <div className={styles.reviewsList}>
        {reviews.map((review) => (
          <div key={review.id} className={styles.reviewItem}>
            <div className={styles.reviewHeader}>
              <img 
                src={getAvatarUrl(review.avatar)} 
                alt={review.username}
                className={styles.userAvatar}
              />
              <div className={styles.userInfo}>
                <span className={styles.username}>{review.username}</span>
                {review.is_vip && (
                  <span className={styles.vipBadge}>VIP</span>
                )}
                <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
              </div>
            </div>
            
            {review.is_recommended && (
              <div className={styles.recommendedBadge}>👍 Recommended</div>
            )}
            
            <div className={styles.reviewContent}>{review.content}</div>
            
            <div className={styles.reviewActions}>
              <button 
                className={styles.actionButton}
                onClick={() => handleLikeReview(review.id)}
              >
                👍 {review.likes}
              </button>
              <span className={styles.actionButton}>💬 {review.comments}</span>
              <span className={styles.actionButton}>👁️ {review.views}</span>
            </div>
          </div>
        ))}
      </div>

      {reviews.length === 0 && (
        <div className={styles.noReviews}>暂无评论，成为第一个评论者吧！</div>
      )}
    </div>
  );
};

export default ReviewSection;

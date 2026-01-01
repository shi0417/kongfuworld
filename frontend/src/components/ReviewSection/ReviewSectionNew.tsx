import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ReviewSectionNew.module.css';
import reviewService, { Review, ReviewStats } from '../../services/reviewService';
import ReviewReplies from './ReviewReplies';
import ReportButton from '../ReportButton/ReportButton';
import reportService from '../../services/reportService';
import Toast from '../Toast/Toast';
import { toAssetUrl } from '../../config';


interface ReviewSectionProps {
  novelId: number;
  user: any;
}

const ReviewSectionNew: React.FC<ReviewSectionProps> = ({ novelId, user }) => {
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
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
  };

  // 加载评论数据
  useEffect(() => {
    loadReviews();
    loadStats();
  }, [novelId]);

  const loadReviews = async () => {
    try {
      const response = await reviewService.getNovelReviews(novelId);
      setReviews(response.data.reviews);
    } catch (err: any) {
      console.error('加载评论失败:', err);
    }
  };

  const loadStats = async () => {
    try {
      console.log('🔍 开始加载统计数据，novelId:', novelId);
      const data = await reviewService.getNovelReviewStats(novelId);
      console.log('📊 获取到的统计数据:', data);
      setStats(data);
      setLoading(false);
    } catch (err: any) {
      console.error('❌ 加载统计失败:', err);
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      setError('Please login first');
      showToast('Please login first', 'warning');
      return;
    }

    if (!reviewContent.trim() || reviewContent.trim().length < 100) {
      setError('Review content must be at least 100 characters');
      showToast('Review content must be at least 100 characters', 'warning');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await reviewService.submitReview(novelId, reviewContent, reviewRating, isRecommended);
      setReviewContent('');
      setReviewRating(5);
      setIsRecommended(false);
      setShowReviewForm(false);
      await loadReviews();
      await loadStats();
      showToast('Review submitted successfully', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
      showToast(err.message || 'Failed to submit review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeReview = async (reviewId: number) => {
    if (!user) {
      setError('Please login first');
      return;
    }

    try {
      const result = await reviewService.likeReview(reviewId);
      console.log('点赞结果 - 完整数据:', result);
      console.log('点赞结果 - result.data:', result.data);
      console.log('点赞结果 - result.action:', result.action);
      
      // 根据返回的action处理UI状态
      if (result.action === 'already_liked') {
        console.log('已经点赞过了');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.likes !== undefined) {
          console.log('使用后端返回的数据更新 (already_liked):', result.data);
          setReviews(prevReviews => 
            prevReviews.map(review => 
              review.id === reviewId 
                ? { ...review, likes: result.data.likes, dislikes: result.data.dislikes }
                : review
            )
          );
        } else {
          // 如果没有返回数据，重新加载
          await loadReviews();
        }
      } else if (result.action === 'liked') {
        console.log('点赞成功');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.likes !== undefined) {
          console.log('使用后端返回的数据更新:', result.data);
          setReviews(prevReviews => {
            const updated = prevReviews.map(review => {
              if (review.id === reviewId) {
                console.log('更新前:', review.likes, review.dislikes);
                console.log('更新后:', result.data.likes, result.data.dislikes);
                return { ...review, likes: result.data.likes, dislikes: result.data.dislikes };
              }
              return review;
            });
            console.log('更新后的reviews列表:', updated);
            return updated;
          });
        } else {
          console.log('后端未返回数据，重新加载列表');
          // 如果没有返回数据，重新加载
          await loadReviews();
        }
      }
    } catch (err: any) {
      console.log('点赞失败:', err.message);
      setError(err.message || 'Failed to like review');
      // 出错时也重新加载以确保数据同步
      await loadReviews();
    }
  };

  const handleDislikeReview = async (reviewId: number) => {
    if (!user) {
      setError('Please login first');
      return;
    }

    try {
      const result = await reviewService.dislikeReview(reviewId);
      console.log('点踩结果 - 完整数据:', result);
      console.log('点踩结果 - result.data:', result.data);
      console.log('点踩结果 - result.action:', result.action);
      
      // 根据返回的action处理UI状态
      if (result.action === 'already_disliked') {
        console.log('已经点踩过了');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.dislikes !== undefined) {
          console.log('使用后端返回的数据更新 (already_disliked):', result.data);
          setReviews(prevReviews => 
            prevReviews.map(review => 
              review.id === reviewId 
                ? { ...review, likes: result.data.likes, dislikes: result.data.dislikes }
                : review
            )
          );
        } else {
          // 如果没有返回数据，重新加载
          await loadReviews();
        }
      } else if (result.action === 'disliked') {
        console.log('点踩成功');
        // 如果后端返回了最新数据，直接更新本地状态
        if (result.data && result.data.dislikes !== undefined) {
          console.log('使用后端返回的数据更新:', result.data);
          setReviews(prevReviews => {
            const updated = prevReviews.map(review => {
              if (review.id === reviewId) {
                console.log('更新前:', review.likes, review.dislikes);
                console.log('更新后:', result.data.likes, result.data.dislikes);
                return { ...review, likes: result.data.likes, dislikes: result.data.dislikes };
              }
              return review;
            });
            console.log('更新后的reviews列表:', updated);
            return updated;
          });
        } else {
          console.log('后端未返回数据，重新加载列表');
          // 如果没有返回数据，重新加载
          await loadReviews();
        }
      }
    } catch (err: any) {
      console.log('点踩失败:', err.message);
      setError(err.message || 'Failed to dislike review');
      // 出错时也重新加载以确保数据同步
      await loadReviews();
    }
  };

  const handleReplySubmit = async (reviewId: number, content: string) => {
    if (!user) {
      throw new Error('Please login first');
    }

    try {
      // 这里应该调用回复API
      // await reviewService.replyToReview(reviewId, content);
      console.log('Submit reply:', reviewId, content);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to submit reply');
    }
  };

  const handleEditReview = (review: Review) => {
    setEditingReviewId(review.id);
    setEditContent(review.content);
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (reviewId: number) => {
    if (!editContent.trim()) {
      setError('评论内容不能为空');
      return;
    }

    try {
      await reviewService.updateReview(reviewId, editContent);
      setEditingReviewId(null);
      setEditContent('');
      await loadReviews();
    } catch (err: any) {
      setError(err.message || '更新评论失败');
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

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={styles.star}>
          {i <= rating ? '⭐️' : '☆'}
        </span>
      );
    }
    return stars;
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
      <div className={styles.reviewSection}>
        <div className={styles.loading}>Loading reviews...</div>
      </div>
    );
  }

  // 调试信息
  console.log('🔍 渲染时的stats状态:', stats);
  console.log('🔍 渲染时的recommendation_rate:', stats?.recommendation_rate);

  return (
    <div className={styles.reviewSection}>
      {/* Toast 提示（风格参考段落评论） */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* 顶部统计和撰写评论按钮 */}
      <div className={styles.reviewHeader}>
        <div className={styles.reviewStats}>
          {stats && (
            <div className={styles.statsContainer}>
              <div className={styles.statsItem}>
                <span className={styles.statsValue}>👍 {stats.recommendation_rate}%</span>
                <span className={styles.statsLabel}>{stats.total_reviews} Reviews</span>
              </div>
            </div>
          )}
        </div>
        
        <div className={styles.reviewActions}>
          <button 
            className={styles.writeReviewButton}
            onClick={() => setShowReviewForm(!showReviewForm)}
          >
            Write a review
          </button>
        </div>
      </div>

      {/* 评论输入表单 */}
      {showReviewForm && (
        <div className={styles.reviewFormContainer}>
          {!user ? (
            <div className={styles.loginPrompt}>
              <div className={styles.loginMessage}>
                <p>Please login to write a review</p>
                <button 
                  className={styles.loginButton}
                  onClick={handleLoginRedirect}
                >
                  Login
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.reviewForm}>
              <div className={styles.recommendationSection}>
                <p>Enjoy this novel?</p>
                <div className={styles.recommendationRow}>
                  <div className={styles.recommendationButtons}>
                    <button
                      className={`${styles.recommendButton} ${isRecommended ? styles.selected : ''}`}
                      onClick={() => setIsRecommended(true)}
                    >
                      👍
                    </button>
                    <button
                      className={`${styles.recommendButton} ${!isRecommended ? styles.selected : ''}`}
                      onClick={() => setIsRecommended(false)}
                    >
                      👎
                    </button>
                  </div>
                  <div className={styles.ratingSectionInline}>
                    <label>Rating:</label>
                    <select 
                      value={reviewRating} 
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className={styles.ratingSelect}
                    >
                      <option value={1}>1 Star</option>
                      <option value={2}>2 Stars</option>
                      <option value={3}>3 Stars</option>
                      <option value={4}>4 Stars</option>
                      <option value={5}>5 Stars</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.contentSection}>
                <label>Add a Review</label>
                <textarea
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="Share your thoughts about this novel..."
                  className={styles.reviewTextarea}
                  rows={6}
                />
                <div className={styles.formFooter}>
                  <div className={styles.wordWarningContainer}>
                    {reviewContent.length < 100 && (
                      <div className={styles.wordWarning}>
                        Reviews must have a minimum of 100 words
                      </div>
                    )}
                  </div>
                  <div className={styles.wordCount}>
                    {reviewContent.length} Words
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

              {error && <div className={styles.errorMessage}>{error}</div>}
            </div>
          )}
        </div>
      )}

      {/* 评论列表 */}
      <div className={styles.reviewsList}>
        {reviews.slice(0, showAllReviews ? reviews.length : 3).map((review) => (
          <div key={review.id} className={styles.reviewItem}>
            <div className={styles.reviewHeader}>
              <div className={styles.avatarContainer}>
                <img 
                  src={getAvatarUrl(review.avatar)} 
                  alt={review.username}
                  className={styles.avatar}
                />
              </div>
              <div className={styles.userInfoRow}>
                <div className={styles.userInfoLeft}>
                  {/* 用户名 */}
                  <span className={styles.username}>{review.username}</span>
                  {/* VIP徽章 */}
                  {!!review.is_vip && <span className={styles.vipBadge}>VIP</span>}
                  {/* 评分 */}
                  {review.rating && review.rating > 0 && (
                    <div className={styles.ratingContainer}>
                      {renderStars(review.rating)}
                    </div>
                  )}
                  {/* Recommended按钮 */}
                  {!!review.is_recommended && (
                    <div className={styles.recommendedBadge}>👍 Recommended</div>
                  )}
                  {/* 时间戳 */}
                  <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
                </div>
                {/* 点赞、点踩、评论按钮 - 靠右放置 */}
                <div className={styles.reviewActions}>
                  <button 
                    className={styles.likeButton}
                    onClick={() => handleLikeReview(review.id)}
                  >
                    👍 {review.likes || 0}
                  </button>
                  <button 
                    className={styles.dislikeButton}
                    onClick={() => handleDislikeReview(review.id)}
                  >
                    👎 {review.dislikes || 0}
                  </button>
                  <button className={styles.commentButton}>
                    💬 {review.comments || 0}
                  </button>
                  {user && (
                    <ReportButton
                      commentId={review.id}
                      commentType="review"
                      commentAuthor={review.username}
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

            {editingReviewId === review.id ? (
              <div className={styles.editForm}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={styles.reviewTextarea}
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
                    onClick={() => handleSaveEdit(review.id)}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.reviewContent}>
                {expandedReviews.has(review.id) || review.content.length <= 200 
                  ? review.content 
                  : getTruncatedContent(review.content)
                }
                {review.content.length > 200 && (
                  <button 
                    className={styles.showMoreButton}
                    onClick={() => toggleReviewExpansion(review.id)}
                  >
                    {expandedReviews.has(review.id) ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            {/* View replies链接 */}
            <div className={styles.viewRepliesWrapper}>
              <ReviewReplies 
                reviewId={review.id}
                user={user}
                onReplySubmit={handleReplySubmit}
                compactMode={true}
                showToggle={true}
                editingReviewId={editingReviewId}
                onEditReview={handleEditReview}
                review={review}
              />
            </div>
          </div>
        ))}
        
        {reviews.length > 3 && (
          <div className={styles.viewAllContainer}>
            <button 
              className={styles.viewAllButton}
              onClick={() => setShowAllReviews(!showAllReviews)}
            >
              {showAllReviews ? 'Show less' : `View All (${reviews.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewSectionNew;

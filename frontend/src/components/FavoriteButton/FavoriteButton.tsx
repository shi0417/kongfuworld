import React, { useState, useEffect } from 'react';
import ApiService from '../../services/ApiService';
import styles from './FavoriteButton.module.css';

interface FavoriteButtonProps {
  userId: number;
  novelId: number;
  novelName: string;
  chapterId?: number;
  chapterName?: string;
  onFavoriteChange?: (isFavorite: boolean) => void;
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  userId,
  novelId,
  novelName,
  chapterId,
  chapterName,
  onFavoriteChange
}) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  // 检查收藏状态
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      try {
        const response = await ApiService.post('/favorite/check', {
          user_id: userId,
          novel_id: novelId,
          chapter_id: chapterId
        });
        
        if (response.success) {
          setIsFavorite((response as any).is_favorite);
        }
      } catch (error) {
        console.error('检查收藏状态失败:', error);
      }
    };

    if (userId && novelId) {
      checkFavoriteStatus();
    }
  }, [userId, novelId, chapterId]);

  // 切换收藏状态
  const handleToggleFavorite = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await ApiService.post('/favorite/toggle', {
        user_id: userId,
        novel_id: novelId,
        novel_name: novelName,
        chapter_id: chapterId,
        chapter_name: chapterName
      });

      if (response.success) {
        setIsFavorite((response as any).is_favorite);
        if (onFavoriteChange) {
          onFavoriteChange((response as any).is_favorite);
        }
      } else {
        console.error('收藏操作失败:', response.message);
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`${styles.favoriteButton} ${isFavorite ? styles.favorited : ''}`}
      onClick={handleToggleFavorite}
      disabled={loading}
      title={isFavorite ? '取消收藏' : '添加收藏'}
    >
      {loading ? (
        <span className={styles.loading}>...</span>
      ) : (
        <span className={styles.icon}>
          {isFavorite ? '★' : '☆'}
        </span>
      )}
      <span className={styles.text}>
        {isFavorite ? 'Favorited' : 'Favorite'}
      </span>
    </button>
  );
};

export default FavoriteButton;

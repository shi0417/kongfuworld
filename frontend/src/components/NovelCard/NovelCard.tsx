import React from 'react';
import styles from './NovelCard.module.css';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';

interface NovelCardProps {
  cover: string;
  title: string;
  author: string;
  progress?: string;
  id?: number;
  onClick?: () => void;
}

const NovelCard: React.FC<NovelCardProps> = ({ cover, title, author, progress, id, onClick }) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (id !== undefined) {
      navigate(`/book/${id}`);
    }
  };
  
  // 处理图片URL，确保使用完整的URL
  const getImageUrl = (coverPath: string) => {
    if (!coverPath) return '/default-cover.jpg'; // 默认封面
    
    // 如果已经是完整URL，直接返回
    if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) {
      return coverPath;
    }
    
    // 如果是相对路径，添加API基础URL
    if (coverPath.startsWith('/')) {
      return `${API_BASE_URL}${coverPath}`;
    }
    
    // 如果是其他情况，直接返回
    return coverPath;
  };
  
  return (
    <div className={styles.card} onClick={handleClick} style={{ cursor: 'pointer' }}>
      <img 
        src={getImageUrl(cover)} 
        alt={title} 
        className={styles.cover}
        onError={(e) => {
          // 图片加载失败时使用默认图片
          e.currentTarget.src = '/default-cover.jpg';
        }}
      />
      <div className={styles.info}>
        <div className={styles.title}>{title}</div>
        <div className={styles.author}>{author}</div>
        {progress && <div className={styles.progress}>{progress}</div>}
      </div>
    </div>
  );
};

export default NovelCard; 
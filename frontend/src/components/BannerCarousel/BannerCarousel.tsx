import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './BannerCarousel.module.css';

interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  image_url: string;
  link_url?: string;
  novel_id?: number;
  novel_title?: string;
}

interface BannerCarouselProps {
  banners?: Banner[];
}

const defaultBanners = [
  { id: 1, image_url: 'https://picsum.photos/800/200?1', title: '热门小说推荐1', subtitle: '精彩武侠世界等你探索' },
  { id: 2, image_url: 'https://picsum.photos/800/200?2', title: '热门小说推荐2', subtitle: '经典玄幻故事不容错过' },
  { id: 3, image_url: 'https://picsum.photos/800/200?3', title: '热门小说推荐3', subtitle: '热血冒险旅程即将开始' },
];

const BannerCarousel: React.FC<BannerCarouselProps> = ({ banners = defaultBanners }) => {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const total = banners.length;

  const goPrev = () => setCurrent((prev) => (prev - 1 + total) % total);
  const goNext = () => setCurrent((prev) => (prev + 1) % total);

  const handleBannerClick = (banner: Banner) => {
    if (banner.link_url) {
      window.open(banner.link_url, '_blank');
    } else if (banner.novel_id) {
      navigate(`/book/${banner.novel_id}`);
    }
  };

  if (banners.length === 0) {
    return null;
  }

  return (
    <div className={styles.carouselWrapper}>
      <div className={styles.bannerLeft}>
        <div 
          className={styles.banner}
          onClick={() => handleBannerClick(banners[current])}
          style={{ cursor: 'pointer' }}
        >
          <img
            key={banners[current].id}
            src={banners[current].image_url}
            alt={banners[current].title}
          />
          <div className={styles.title}>{banners[current].title}</div>
          {banners[current].subtitle && (
            <div className={styles.subtitle}>{banners[current].subtitle}</div>
          )}
        </div>
      </div>
      <div className={styles.controls}>
        <button className={styles.arrow} onClick={goPrev} aria-label="Previous banner">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill="#222"/>
            <path d="M19.5 10L13.5 16L19.5 22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.dots}>
          {banners.map((_, idx) => (
            <span
              key={idx}
              className={idx === current ? styles.dotActive : styles.dot}
              onClick={() => setCurrent(idx)}
            />
          ))}
        </div>
        <button className={styles.arrow} onClick={goNext} aria-label="Next banner">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill="#222"/>
            <path d="M12.5 10L18.5 16L12.5 22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BannerCarousel; 
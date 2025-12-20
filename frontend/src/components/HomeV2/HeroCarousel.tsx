import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { HomepageV2HeroItem } from '../../services/homepageService';
import { truncateText } from './utils';
import styles from './HeroCarousel.module.css';

type Props = {
  items: HomepageV2HeroItem[];
};

function toImg(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
}

export const HeroCarousel: React.FC<Props> = ({ items }) => {
  const navigate = useNavigate();
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const [idx, setIdx] = useState(0);
  const total = safeItems.length;

  const current = total > 0 ? safeItems[idx % total] : null;

  const goPrev = () => setIdx((v) => (v - 1 + total) % total);
  const goNext = () => setIdx((v) => (v + 1) % total);

  const handleClick = () => {
    if (!current) return;
    if (current.link_url) {
      window.open(current.link_url, '_blank');
      return;
    }
    if (current.novel_id) {
      navigate(`/book/${current.novel_id}`);
    }
  };

  if (!current) {
    return <div className={styles.wrap}><div className={styles.empty}>No hero data</div></div>;
  }

  return (
    <div className={styles.wrap} onClick={handleClick} style={{ cursor: current.link_url || current.novel_id ? 'pointer' : 'default' }}>
      <img className={styles.bg} src={toImg(current.image_url)} alt={current.banner_title || current.novel_title || 'hero'} />
      <div className={styles.overlay}>
        <img className={styles.cover} src={toImg(current.cover || '')} alt={current.novel_title || ''} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div className={styles.content}>
          <div className={styles.statusPill}>{current.status || 'Ongoing'}</div>
          <h3 className={styles.title}>{current.novel_title || current.banner_title || 'Untitled'}</h3>
          <p className={styles.desc}>
            {truncateText(current.description || current.banner_subtitle || '', 170)}
          </p>
          <div className={styles.meta}>
            <span>{current.author ? `Author: ${current.author}` : ''}</span>
            <span>{current.translator ? `Translator: ${current.translator}` : ''}</span>
            <span>{Number.isFinite(Number(current.chapters)) ? `${current.chapters} Chapters` : ''}</span>
            <span>{current.latest_chapter_number ? `Latest: Ch ${current.latest_chapter_number}` : ''}</span>
          </div>
        </div>
      </div>

      {total > 1 && (
        <div className={styles.controls} onClick={(e) => e.stopPropagation()}>
          <button className={styles.arrowBtn} onClick={goPrev} aria-label="prev">‹</button>
          <div className={styles.dots}>
            {safeItems.map((_, i) => (
              <span
                key={i}
                className={i === idx ? styles.dotActive : styles.dot}
                onClick={() => setIdx(i)}
              />
            ))}
          </div>
          <button className={styles.arrowBtn} onClick={goNext} aria-label="next">›</button>
        </div>
      )}
    </div>
  );
};



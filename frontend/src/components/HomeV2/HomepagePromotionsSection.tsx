import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { HomepageV2PromotionItem, Novel } from '../../services/homepageService';
import styles from './HomepagePromotionsSection.module.css';

type Props = {
  promotions?: {
    items: HomepageV2PromotionItem[];
    view_all_url?: string;
  };
  onNovelClick?: (novel: Novel) => void;
};

function toImg(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
}

function formatCountdown(ms: number) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const HomepagePromotionsSection: React.FC<Props> = ({ promotions, onNovelClick }) => {
  const navigate = useNavigate();
  const items = useMemo(() => {
    const list = promotions?.items && Array.isArray(promotions.items) ? promotions.items : [];
    return list.slice(0, 6);
  }, [promotions]);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const hasEnd = items.some((it) => Boolean(it?.promotion?.end_at));
    if (!hasEnd) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [items]);

  // 空态：无活动时不渲染
  if (!items || items.length === 0) return null;

  return (
    <section className={styles.wrap}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>Promotions</h2>
        <Link className={styles.viewAll} to="/series?promo=1">View All</Link>
      </div>

      <div className={styles.rail}>
        {items.map((it) => {
          const novelId = Number(it?.novel?.id);
          const title = it?.novel?.title || 'Untitled';
          const cover = toImg((it?.novel as any)?.cover ?? null);
          const pct = Number(it?.promotion?.discount_percentage) || 0;
          const endAt = it?.promotion?.end_at ? new Date(it.promotion.end_at).getTime() : null;
          const endsIn = endAt ? formatCountdown(endAt - now) : '';

          const handleGo = () => {
            if (!Number.isFinite(novelId) || novelId <= 0) return;

            // 允许上层复用既有点击逻辑（例如统计）
            if (onNovelClick) {
              onNovelClick(it.novel as unknown as Novel);
              return;
            }

            navigate(`/book/${novelId}?promo=1`);
          };

          return (
            <div key={`${it.promotion.id}-${novelId}`} className={styles.card}>
              <div className={styles.top} onClick={handleGo} style={{ cursor: 'pointer' }}>
                <img
                  className={styles.cover}
                  src={cover}
                  alt={title}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className={styles.info}>
                  <div className={styles.name} title={title}>{title}</div>
                  <div className={styles.metaRow}>
                    <span className={styles.badge}>{pct}% OFF</span>
                    {endAt ? <span className={styles.ends}>Ends in {endsIn}</span> : null}
                  </div>
                </div>
              </div>
              <div className={styles.ctaRow}>
                <button className={styles.cta} onClick={handleGo}>View Deal</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HomepagePromotionsSection;



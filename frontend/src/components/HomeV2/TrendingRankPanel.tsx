import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { HomepageV2GenreTab, Novel } from '../../services/homepageService';
import styles from './TrendingRankPanel.module.css';

type Props = {
  tabs: HomepageV2GenreTab[];
  itemsByTab: Record<string, Novel[]>;
  viewAllUrl: string;
};

function toImg(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
}

export const TrendingRankPanel: React.FC<Props> = ({ tabs, itemsByTab, viewAllUrl }) => {
  const navigate = useNavigate();
  const safeTabs = useMemo(() => (Array.isArray(tabs) ? tabs : []), [tabs]);
  const firstSlug = safeTabs[0]?.slug || '';
  const [activeSlug, setActiveSlug] = useState(firstSlug);

  const list = (activeSlug && itemsByTab && itemsByTab[activeSlug]) ? itemsByTab[activeSlug] : [];

  return (
    <div className={styles.wrap}>
      <div className={styles.titleRow}>
        <h4 className={styles.title}>Trending Novels</h4>
        <a className={styles.viewAll} href={viewAllUrl}>View All</a>
      </div>

      <div className={styles.tabs}>
        {safeTabs.length === 0 ? (
          <div className={styles.empty}>No genres</div>
        ) : (
          safeTabs.map((t) => (
            <button
              key={t.id}
              className={`${styles.tab} ${t.slug === activeSlug ? styles.tabActive : ''}`}
              onClick={() => setActiveSlug(t.slug)}
            >
              {t.name}
            </button>
          ))
        )}
      </div>

      {safeTabs.length > 0 && (!list || list.length === 0) ? (
        <div className={styles.empty}>No data</div>
      ) : (
        <div className={styles.list}>
          {(list || []).slice(0, 5).map((n, i) => (
            <div
              key={n.id}
              className={styles.row}
              onClick={() => navigate(`/book/${n.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.rank}>{i + 1}</div>
              <img className={styles.cover} src={toImg(n.cover)} alt={n.title} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div>
                <div className={styles.name}>{n.title}</div>
                <div className={styles.meta}>
                  {Number.isFinite(Number(n.chapters)) ? `${n.chapters} Chapters` : ''}
                  {Number.isFinite(Number((n as any).weekly_views)) ? ` · ${Number((n as any).weekly_views)} views (7d)` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};



import React from 'react';
import NovelCard from '../NovelCard/NovelCard';
import styles from './SeriesGrid.module.css';
import type { SeriesListItem } from '../../services/novelService';
import type { ViewMode } from './SeriesToolbar';

type Props = {
  items: SeriesListItem[];
  viewMode: ViewMode;
  loading?: boolean;
  genreLabelMap?: Record<string, string>; // chinese_name -> English label
};

function splitGenres(genreNames: string | null | undefined): string[] {
  if (!genreNames) return [];
  return String(genreNames)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function formatMeta(item: SeriesListItem) {
  const parts: string[] = [];
  if (item.status) parts.push(item.status);
  if (Number.isFinite(Number(item.chapters))) parts.push(`${item.chapters} ch`);
  if (Number.isFinite(Number(item.rating))) parts.push(`★ ${item.rating}`);
  if (Number.isFinite(Number(item.reviews))) parts.push(`(${item.reviews})`);
  return parts.join(' • ');
}

export default function SeriesGrid({ items, viewMode, loading, genreLabelMap }: Props) {
  if (loading) {
    const skeletons = Array.from({ length: 8 }).map((_, i) => i);
    if (viewMode === 'list') {
      return (
        <div className={styles.list}>
          {skeletons.map((i) => (
            <div key={`sk-list-${i}`} className={styles.listRow}>
              <div className={styles.listCover}>
                <div className={`${styles.skeletonCard} ${styles.shimmer}`}>
                  <div className={styles.skeletonCover} />
                  <div className={styles.skeletonInfo}>
                    <div className={styles.skeletonLineLg} />
                    <div className={styles.skeletonLineSm} />
                  </div>
                </div>
              </div>
              <div className={styles.listInfo}>
                <div className={`${styles.skeletonLineLg} ${styles.shimmer}`} />
                <div className={`${styles.skeletonLineSm} ${styles.shimmer}`} />
                <div className={`${styles.skeletonLineMd} ${styles.shimmer}`} />
                <div className={styles.listGenres}>
                  <span className={`${styles.skeletonBadge} ${styles.shimmer}`} />
                  <span className={`${styles.skeletonBadge} ${styles.shimmer}`} />
                  <span className={`${styles.skeletonBadge} ${styles.shimmer}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={styles.grid}>
        {skeletons.map((i) => (
          <div key={`sk-${i}`} className={styles.cardWrap}>
            <div className={`${styles.skeletonCard} ${styles.shimmer}`}>
              <div className={styles.skeletonCover} />
              <div className={styles.skeletonInfo}>
                <div className={styles.skeletonLineLg} />
                <div className={styles.skeletonLineSm} />
              </div>
            </div>
            <div className={`${styles.skeletonLineMd} ${styles.shimmer}`} />
            <div className={styles.genresRow}>
              <span className={`${styles.skeletonBadge} ${styles.shimmer}`} />
              <span className={`${styles.skeletonBadge} ${styles.shimmer}`} />
              <span className={`${styles.skeletonBadge} ${styles.shimmer}`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className={styles.list}>
        {items.map((n) => (
          <div key={n.id} className={styles.listRow}>
            <div className={styles.listCover}>
              <NovelCard
                id={n.id}
                cover={n.cover || ''}
                title={n.title}
                author={n.author || '—'}
              />
            </div>
            <div className={styles.listInfo}>
              <div className={styles.listTitle}>{n.title}</div>
              <div className={styles.listAuthor}>{n.author || '—'}</div>
              <div className={styles.listMeta}>{formatMeta(n)}</div>
              <div className={styles.listGenres}>
                {splitGenres(n.genre_names).map((g) => (
                  <span key={g} className={styles.badge}>{genreLabelMap?.[g] || g}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {items.map((n) => (
        <div key={n.id} className={styles.cardWrap}>
          <NovelCard
            id={n.id}
            cover={n.cover || ''}
            title={n.title}
            author={n.author || '—'}
          />
          <div className={styles.metaRow}>{formatMeta(n)}</div>
          <div className={styles.genresRow}>
            {splitGenres(n.genre_names).map((g) => (
              <span key={g} className={styles.badge}>{genreLabelMap?.[g] || g}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}



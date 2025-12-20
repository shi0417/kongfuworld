import React from 'react';
import styles from './Pagination.module.css';

type Props = {
  page: number;
  totalPages: number;
  onChange: (nextPage: number) => void;
};

function buildPages(page: number, totalPages: number) {
  const pages: Array<number | '...'> = [];
  const clamp = (n: number) => Math.max(1, Math.min(totalPages, n));
  const p = clamp(page);

  const windowSize = 2; // left/right
  const start = clamp(p - windowSize);
  const end = clamp(p + windowSize);

  pages.push(1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) {
    if (i !== 1 && i !== totalPages) pages.push(i);
  }
  if (end < totalPages - 1) pages.push('...');
  if (totalPages > 1) pages.push(totalPages);

  // 去重
  const out: Array<number | '...'> = [];
  for (const x of pages) {
    const last = out[out.length - 1];
    if (x === '...' && last === '...') continue;
    if (typeof x === 'number' && typeof last === 'number' && x === last) continue;
    out.push(x);
  }
  return out;
}

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const items = buildPages(page, totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className={styles.pagination}>
      <button className={styles.navBtn} disabled={!canPrev} onClick={() => onChange(page - 1)}>
        Prev
      </button>

      <div className={styles.pages}>
        {items.map((it, idx) => {
          if (it === '...') {
            return <span key={`dots-${idx}`} className={styles.dots}>…</span>;
          }
          const n = it;
          const active = n === page;
          return (
            <button
              key={n}
              className={`${styles.pageBtn} ${active ? styles.active : ''}`}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          );
        })}
      </div>

      <button className={styles.navBtn} disabled={!canNext} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}



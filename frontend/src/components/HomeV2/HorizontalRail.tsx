import React from 'react';
import { Novel } from '../../services/homepageService';
import NovelCard from '../NovelCard/NovelCard';
import styles from './HorizontalRail.module.css';

type Props = {
  title: string;
  viewAllUrl?: string;
  items: Novel[];
  onNovelClick?: (novel: Novel) => void;
};

export const HorizontalRail: React.FC<Props> = ({ title, viewAllUrl, items, onNovelClick }) => {
  const safe = Array.isArray(items) ? items : [];
  return (
    <section className={styles.wrap}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>{title}</h2>
        {viewAllUrl ? <a className={styles.viewAll} href={viewAllUrl}>View All</a> : <span />}
      </div>
      {safe.length === 0 ? (
        <div className={styles.empty}>No data</div>
      ) : (
        <div className={styles.rail}>
          {safe.map((n) => (
            <NovelCard
              key={n.id}
              id={n.id}
              cover={n.cover}
              title={n.title}
              author={n.author}
              progress={undefined}
              onClick={onNovelClick ? () => onNovelClick(n) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
};



import React from 'react';
import styles from './SeriesToolbar.module.css';

export type ViewMode = 'grid' | 'list';

type Props = {
  queryInput: string;
  onQueryInputChange: (v: string) => void;
  onSubmitSearch: () => void;

  sort: string;
  onSortChange: (v: string) => void;

  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;

  onOpenFilters: () => void;
};

export default function SeriesToolbar({
  queryInput,
  onQueryInputChange,
  onSubmitSearch,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  onOpenFilters
}: Props) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <div className={styles.search}>
          <input
            className={styles.searchInput}
            value={queryInput}
            placeholder="Search title or author"
            onChange={(e) => onQueryInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmitSearch();
            }}
          />
          <button className={styles.searchBtn} onClick={onSubmitSearch}>Search</button>
        </div>
      </div>

      <div className={styles.right}>
        <button className={styles.filtersBtn} onClick={onOpenFilters}>
          Filters
        </button>

        <select className={styles.sortSelect} value={sort} onChange={(e) => onSortChange(e.target.value)}>
          <option value="latest">Latest</option>
          <option value="rating">Rating</option>
          <option value="chapters">Chapters</option>
          <option value="alpha">A-Z</option>
        </select>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Grid"
          >
            Grid
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === 'list' ? styles.active : ''}`}
            onClick={() => onViewModeChange('list')}
            title="List"
          >
            List
          </button>
        </div>
      </div>
    </div>
  );
}



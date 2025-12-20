import React from 'react';
import styles from './SeriesFilters.module.css';
import type { GenreItem } from '../../services/novelService';
import PillSelect from './PillSelect';

export type FiltersValue = {
  genres: number[];
  status: string;
  lang: string;
};

type Props = {
  genres: GenreItem[];
  languages: string[];
  value: FiltersValue;
  onSetLang: (next: string | 'any') => void;
  onSetStatus: (next: 'ongoing' | 'completed' | 'hiatus' | 'any') => void;
  onToggleGenre: (id: number) => void;
  onClearAll: () => void;

  variant: 'sidebar' | 'drawer';
  isOpen?: boolean; // for drawer
  onClose?: () => void; // for drawer
};

const STATUS_OPTIONS: Array<{ value: 'any' | 'ongoing' | 'completed' | 'hiatus'; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' }
];

function PanelContent({
  genres,
  languages,
  value,
  onSetLang,
  onSetStatus,
  onToggleGenre,
  onClearAll
}: Omit<Props, 'variant' | 'isOpen' | 'onClose'>) {
  const getGenreLabel = (g: GenreItem) => {
    // 需求：Genres 筛选区用英文表示，优先使用 genre.name
    const name = (g.name || '').trim();
    if (name) return name;
    const slug = (g.slug || '').trim();
    if (slug) {
      // slug 转为 Title Case（例如 "action-adventure" -> "Action Adventure"）
      return slug
        .split(/[-_]/g)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    const cn = (g.chinese_name || '').trim();
    if (cn) return cn;
    return `#${g.id}`;
  };

  const langValue = (value.lang || '').trim() ? (value.lang || '').trim() : 'any';
  const statusValue = (() => {
    const s = (value.status || '').trim().toLowerCase();
    if (s === 'ongoing' || s === 'completed' || s === 'hiatus') return s;
    return 'any';
  })();

  const langOptions = (() => {
    const out: Array<{ value: string; label: string }> = [{ value: 'any', label: 'Any' }];
    for (const t of languages || []) {
      const token = String(t || '').trim().replace(/\s+/g, ' ');
      if (!token) continue;
      out.push({ value: token, label: token });
    }
    return out;
  })();

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <div className={styles.title}>Filters</div>
        <button className={styles.clearBtn} onClick={onClearAll}>Clear all</button>
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>Language</div>
        <PillSelect
          mode="single"
          value={langValue}
          onChange={(v) => onSetLang(v === 'any' ? 'any' : String(v))}
          options={langOptions}
        />
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>Status</div>
        <PillSelect
          mode="single"
          value={statusValue as any}
          onChange={(v) => onSetStatus(v as any)}
          options={STATUS_OPTIONS}
        />
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>Genres</div>
        {genres.length === 0 ? (
          <div className={styles.muted}>Genres unavailable</div>
        ) : (
          <PillSelect
            mode="multi"
            values={value.genres}
            onToggle={(id) => onToggleGenre(Number(id))}
            options={genres.map(g => ({
              value: Number(g.id),
              label: getGenreLabel(g)
            }))}
          />
        )}
      </div>
    </div>
  );
}

export default function SeriesFilters(props: Props) {
  if (props.variant === 'sidebar') {
    return (
      <div className={styles.sidebar}>
        <PanelContent
          genres={props.genres}
          languages={props.languages}
          value={props.value}
          onSetLang={props.onSetLang}
          onSetStatus={props.onSetStatus}
          onToggleGenre={props.onToggleGenre}
          onClearAll={props.onClearAll}
        />
      </div>
    );
  }

  // drawer
  const open = !!props.isOpen;
  return (
    <>
      {open && <div className={styles.backdrop} onClick={props.onClose} />}
      <div className={`${styles.drawer} ${open ? styles.open : ''}`}>
        <div className={styles.drawerTop}>
          <div className={styles.drawerTitle}>Filters</div>
          <button className={styles.closeBtn} onClick={props.onClose}>×</button>
        </div>
        <PanelContent
          genres={props.genres}
          languages={props.languages}
          value={props.value}
          onSetLang={props.onSetLang}
          onSetStatus={props.onSetStatus}
          onToggleGenre={props.onToggleGenre}
          onClearAll={props.onClearAll}
        />
      </div>
    </>
  );
}



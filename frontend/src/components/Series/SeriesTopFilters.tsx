import React, { useMemo } from 'react';
import type { GenreItem } from '../../services/novelService';
import PillSelect from './PillSelect';
import styles from './SeriesTopFilters.module.css';

type Props = {
  languages: string[];
  lang: string; // token or ''
  onSetLang: (next: string | 'any') => void;

  status: string; // ongoing/completed/hiatus or ''
  onSetStatus: (next: 'ongoing' | 'completed' | 'hiatus' | 'any') => void;

  genres: GenreItem[];
  selectedGenres: number[];
  onToggleGenre: (id: number) => void;

  onClearAll: () => void;
};

const STATUS_OPTIONS: Array<{ value: 'any' | 'ongoing' | 'completed' | 'hiatus'; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' }
];

function getGenreLabel(g: GenreItem) {
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
}

export default function SeriesTopFilters({
  languages,
  lang,
  onSetLang,
  status,
  onSetStatus,
  genres,
  selectedGenres,
  onToggleGenre,
  onClearAll
}: Props) {
  const langValue = (lang || '').trim() ? (lang || '').trim() : 'any';
  const statusValue = (status === 'ongoing' || status === 'completed' || status === 'hiatus') ? status : 'any';

  const langOptions = useMemo(() => {
    const out: Array<{ value: string; label: string }> = [{ value: 'any', label: 'Any' }];
    for (const t of languages || []) {
      const token = String(t || '').trim().replace(/\s+/g, ' ');
      if (!token) continue;
      out.push({ value: token, label: token });
    }
    return out;
  }, [languages]);

  const genreOptions = useMemo(() => {
    return (genres || []).map(g => ({
      value: Number(g.id),
      label: getGenreLabel(g)
    }));
  }, [genres]);

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <div className={styles.groups}>
          <div className={styles.group}>
            <div className={styles.label}>Languages</div>
            <PillSelect
              mode="single"
              value={langValue}
              onChange={(v) => onSetLang(v === 'any' ? 'any' : String(v))}
              options={langOptions}
            />
          </div>

          <div className={styles.group}>
            <div className={styles.label}>Status</div>
            <PillSelect
              mode="single"
              value={statusValue as any}
              onChange={(v) => onSetStatus(v as any)}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        <button type="button" className={styles.clearBtn} onClick={onClearAll}>
          Clear all
        </button>
      </div>

      <div className={styles.genresRow}>
        <div className={styles.label}>Genres</div>
        {genreOptions.length === 0 ? (
          <div className={styles.hint}>Genres unavailable</div>
        ) : (
          <PillSelect
            mode="multi"
            values={selectedGenres}
            onToggle={(id) => onToggleGenre(Number(id))}
            options={genreOptions}
          />
        )}
      </div>
    </div>
  );
}



import React, { useMemo, useState } from 'react';
import { HomepageV2GenreTab, Novel } from '../../services/homepageService';
import { HorizontalRail } from './HorizontalRail';

type Props = {
  tabs: HomepageV2GenreTab[];
  itemsByTab: Record<string, Novel[]>;
  onNovelClick?: (novel: Novel) => void;
};

export const PopularGenresTabs: React.FC<Props> = ({ tabs, itemsByTab, onNovelClick }) => {
  const safeTabs = useMemo(() => (Array.isArray(tabs) ? tabs : []), [tabs]);
  const firstSlug = safeTabs[0]?.slug || '';
  const [activeSlug, setActiveSlug] = useState(firstSlug);

  const list = activeSlug ? (itemsByTab[activeSlug] || []) : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 10 }}>
        {safeTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveSlug(t.slug)}
            style={{
              borderRadius: 10,
              padding: '8px 10px',
              border: t.slug === activeSlug ? '1px solid rgba(122,167,255,0.7)' : '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.25)',
              color: t.slug === activeSlug ? '#7aa7ff' : 'rgba(255,255,255,0.85)',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {t.name}
          </button>
        ))}
      </div>
      <HorizontalRail title="Popular Genres" items={list} onNovelClick={onNovelClick} />
    </div>
  );
};



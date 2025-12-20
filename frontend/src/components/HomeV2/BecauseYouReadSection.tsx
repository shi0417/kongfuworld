import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomepageV2ContinueReadingItem, Novel } from '../../services/homepageService';
import NovelCard from '../NovelCard/NovelCard';

type Props = {
  becauseYouRead?: {
    continue_reading: HomepageV2ContinueReadingItem[];
    recommendations: Novel[];
    view_all_url: string;
  } | null;
  onNovelClick?: (novel: Novel) => void;
};

export const BecauseYouReadSection: React.FC<Props> = ({ becauseYouRead, onNovelClick }) => {
  const navigate = useNavigate();
  const continueReading = useMemo(
    () => (becauseYouRead?.continue_reading && Array.isArray(becauseYouRead.continue_reading) ? becauseYouRead.continue_reading : []),
    [becauseYouRead]
  );
  const recommendations = useMemo(
    () => (becauseYouRead?.recommendations && Array.isArray(becauseYouRead.recommendations) ? becauseYouRead.recommendations : []),
    [becauseYouRead]
  );

  if (continueReading.length === 0 && recommendations.length === 0) return null;

  const handleContinueClick = (n: HomepageV2ContinueReadingItem) => {
    const chapterId = Number((n as any).last_read_chapter_id);
    if (Number.isFinite(chapterId) && chapterId > 0) {
      navigate(`/novel/${n.id}/chapter/${chapterId}`);
      return;
    }
    // 兜底：若缺少章节信息，则按普通小说跳转
    onNovelClick?.(n);
  };

  return (
    <section style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <h2 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Because You Read</h2>
        <a
          href={becauseYouRead?.view_all_url || '/series?sort=based_on_you'}
          style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontWeight: 800 }}
        >
          View All
        </a>
      </div>

      {continueReading.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Continue Reading</div>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 10 }}>
            {continueReading.slice(0, 6).map((n) => (
              <NovelCard
                key={`continue-${n.id}`}
                id={n.id}
                cover={n.cover}
                title={n.title}
                author={n.author}
                progress={undefined}
                onClick={() => handleContinueClick(n)}
              />
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Recommended</div>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 10 }}>
            {recommendations.slice(0, 12).map((n) => (
              <NovelCard
                key={`rec-${n.id}`}
                id={n.id}
                cover={n.cover}
                title={n.title}
                author={n.author}
                progress={undefined}
                onClick={() => onNovelClick?.(n)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};



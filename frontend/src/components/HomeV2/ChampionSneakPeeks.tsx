import React from 'react';
import { Novel } from '../../services/homepageService';
import { HorizontalRail } from './HorizontalRail';

type Props = {
  ctaUrl: string;
  items: Novel[];
};

export const ChampionSneakPeeks: React.FC<Props> = ({ ctaUrl, items }) => {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        background: 'linear-gradient(180deg, var(--bg-secondary), var(--bg-tertiary))',
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12
      }}>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Sneak Peeks</div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
          Become a Champion and get a preview of upcoming series!
        </div>
        <a href={ctaUrl} style={{ display: 'inline-block', background: '#2d6cdf', color: '#fff', padding: '10px 14px', borderRadius: 999, fontWeight: 900, textDecoration: 'none' }}>
          Subscribe
        </a>
      </div>

      <HorizontalRail title="Champion Sneak Peeks" items={items} viewAllUrl={ctaUrl} />
    </div>
  );
};



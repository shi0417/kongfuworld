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
      <div style={{ background: 'linear-gradient(180deg, rgba(20,20,22,1), rgba(10,10,12,1))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Sneak Peeks</div>
        <div style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 12 }}>
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



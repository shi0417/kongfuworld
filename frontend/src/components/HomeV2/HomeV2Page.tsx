import React from 'react';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import { HomepageV2, Novel } from '../../services/homepageService';
import { HeroCarousel } from './HeroCarousel';
import { AnnouncementsPanel } from './AnnouncementsPanel';
import { TrendingRankPanel } from './TrendingRankPanel';
import { HorizontalRail } from './HorizontalRail';
import { BecauseYouReadSection } from './BecauseYouReadSection';
import { HomepagePromotionsSection } from './HomepagePromotionsSection';
import { PopularGenresTabs } from './PopularGenresTabs';
import { ChampionSneakPeeks } from './ChampionSneakPeeks';
import { RecentUpdatesTable } from './RecentUpdatesTable';
import styles from './HomeV2.module.css';

type Props = {
  v2: HomepageV2;
  onNovelClick?: (novel: Novel) => void;
};

/**
 * Wuxiaworld 风格首页 V2（模块顺序）
 * Hero双列 -> Popular This Week -> New Books -> Popular Genres -> Champion -> Recent Updates -> Footer
 */
export const HomeV2Page: React.FC<Props> = ({ v2, onNovelClick }) => {
  return (
    <div className={styles.page}>
      <NavBar />
      <div className={styles.container}>
        {/* Hero 双列：左大卡轮播 + 右侧（公告 + Trending） */}
        <div className={styles.heroRow}>
          <HeroCarousel items={v2.hero?.items || []} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AnnouncementsPanel items={v2.announcements?.items || []} viewAllUrl={v2.announcements?.view_all_url || '/announcements'} />
            <TrendingRankPanel
              tabs={v2.trending?.tabs || []}
              itemsByTab={v2.trending?.items_by_tab || {}}
              viewAllUrl={v2.trending?.view_all_url || '/series?sort=trending'}
            />
          </div>
        </div>

        {/* Popular This Week */}
        <HorizontalRail
          title="Popular This Week"
          viewAllUrl={v2.popular_this_week?.view_all_url || '/series?sort=popular_week'}
          items={v2.popular_this_week?.items || []}
          onNovelClick={onNovelClick}
        />

        {/* Because You Read（个性化：未登录/空态不显示） */}
        <BecauseYouReadSection becauseYouRead={v2.because_you_read} onNovelClick={onNovelClick} />

        {/* Promotions（折扣小说，独立一行；无数据则不显示） */}
        <HomepagePromotionsSection promotions={v2.promotions} onNovelClick={onNovelClick} />

        {/* New Books（真正新书） */}
        <HorizontalRail
          title="New Releases"
          viewAllUrl={v2.new_books?.view_all_url || '/series?sort=new'}
          items={v2.new_books?.items || []}
          onNovelClick={onNovelClick}
        />

        {/* Popular Genres */}
        <div style={{ marginTop: 6 }}>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.h2}>Popular Genres</h2>
          </div>
          <div className={styles.mutedCard} style={{ padding: 12 }}>
            <PopularGenresTabs
              tabs={v2.popular_genres?.tabs || []}
              itemsByTab={v2.popular_genres?.items_by_tab || {}}
              onNovelClick={onNovelClick}
            />
          </div>
        </div>

        {/* Champion / Sneak Peeks */}
        <ChampionSneakPeeks ctaUrl={v2.champion?.cta_url || '/champion'} items={v2.champion?.items || []} />

        {/* Most Recently Updated */}
        <RecentUpdatesTable items={v2.recent_updates?.items || []} viewAllUrl={v2.recent_updates?.view_all_url || '/updates'} />
      </div>
      <Footer />
    </div>
  );
};



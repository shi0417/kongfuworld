import React from 'react';
import { Link } from 'react-router-dom';
import { HomepageV2Announcement } from '../../services/homepageService';
import { formatRelativeTime } from './utils';
import styles from './AnnouncementsPanel.module.css';

type Props = {
  items: HomepageV2Announcement[];
  viewAllUrl: string;
};

export const AnnouncementsPanel: React.FC<Props> = ({ items, viewAllUrl }) => {
  const safe = Array.isArray(items) ? items : [];
  return (
    <div className={styles.wrap}>
      <div className={styles.titleRow}>
        <h4 className={styles.title}>Announcements</h4>
        {/* 需求：View All 统一跳转到 /news */}
        <Link className={styles.viewAll} to="/news">View All</Link>
      </div>
      {safe.length === 0 ? (
        <div className={styles.empty}>No announcements</div>
      ) : (
        <div className={styles.list}>
          {safe.map((a, idx) => {
            const time = formatRelativeTime(a.created_at || '');
            // 需求：点击某一行必须跳转到 /news/:id
            const link = `/news/${a.id}`;
            return (
              <Link key={a.id} to={link} className={styles.item} style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className={styles.bullet}>{idx + 1}</div>
                <div className={styles.text}>
                  <div className={styles.headline}>{a.title}</div>
                  <div className={styles.time}>{time}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};



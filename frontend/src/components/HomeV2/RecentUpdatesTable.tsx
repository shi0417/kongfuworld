import React from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { HomepageV2RecentUpdateItem } from '../../services/homepageService';
import { formatRelativeTime } from './utils';
import styles from './RecentUpdatesTable.module.css';

type Props = {
  items: HomepageV2RecentUpdateItem[];
  viewAllUrl: string;
};

function toImg(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
}

export const RecentUpdatesTable: React.FC<Props> = ({ items, viewAllUrl }) => {
  const navigate = useNavigate();
  const safe = Array.isArray(items) ? items : [];

  return (
    <section className={styles.wrap}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>Most Recently Updated</h2>
        <a className={styles.viewAll} href={viewAllUrl}>Click Here For All Updates</a>
      </div>

      {safe.length === 0 ? (
        <div className={styles.empty}>No data</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Novel</th>
              <th className={styles.th}>Chapter</th>
              <th className={styles.th}>Translator</th>
              <th className={styles.th}>Time</th>
            </tr>
          </thead>
          <tbody>
            {safe.map((r) => (
              <tr key={`${r.novel_id}-${r.chapter_id}`} style={{ cursor: 'pointer' }} onClick={() => navigate(`/novel/${r.novel_id}/chapter/${r.chapter_id}`)}>
                <td className={styles.td}>
                  <div className={styles.novelCell}>
                    <img className={styles.cover} src={toImg(r.cover || '')} alt={r.novel_title} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div className={styles.novelTitle}>{r.novel_title}</div>
                  </div>
                </td>
                <td className={styles.td}>{`Chapter ${r.chapter_number}: ${r.chapter_title}`}</td>
                <td className={`${styles.td} ${styles.muted}`}>{r.translator || '-'}</td>
                <td className={`${styles.td} ${styles.muted}`}>{formatRelativeTime(r.chapter_created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};



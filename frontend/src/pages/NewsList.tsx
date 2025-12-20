import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import newsService, { NewsListItem } from '../services/newsService';
import styles from './NewsList.module.css';

function formatRelativeLong(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffSeconds = Math.floor(diffTime / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) === 1 ? 'month' : 'months'} ago`;
  return `${Math.floor(diffDays / 365)} ${Math.floor(diffDays / 365) === 1 ? 'year' : 'years'} ago`;
}

function toPlainText(input: string | null | undefined) {
  const s = String(input || '');
  // 去 HTML 标签
  const noHtml = s.replace(/<[^>]*>/g, ' ');
  // 粗略去 markdown 标记（不做解析，只做摘要用）
  const noMd = noHtml
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ') // image
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ') // link
    .replace(/[`*_>#-]/g, ' ') // markers
    .replace(/\s+/g, ' ')
    .trim();
  return noMd;
}

function truncate(s: string, maxLen: number) {
  if (!s) return '';
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

const NewsList: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<NewsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // 从 URL 查询参数获取 target_audience
        const targetAudience = searchParams.get('target_audience') as 'reader' | 'writer' | null;
        const data = await newsService.getNewsList(targetAudience || undefined);
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e: any) {
        setError(e?.message ? String(e.message) : 'Failed to load');
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchParams]);

  return (
    <div className={styles.page}>
      <NavBar />
      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link to="/">Home</Link> {'>'} <span>{searchParams.get('target_audience') === 'writer' ? 'Writer Announcements' : 'General Announcements'}</span>
        </div>
        <h1 className={styles.title}>{searchParams.get('target_audience') === 'writer' ? 'Writer Announcements' : 'General Announcements'}</h1>

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>No announcements</div>
        ) : (
          <div className={styles.list}>
            {items.map((it) => {
              const excerpt = truncate(toPlainText(it.content), 180);
              return (
                <div key={it.id} className={styles.card}>
                  <div className={styles.cardTitle}>
                    <Link to={`/news/${it.id}`}>{it.title}</Link>
                  </div>
                  <div className={styles.excerpt}>{excerpt || '—'}</div>
                  <div className={styles.meta}>{formatRelativeLong(it.created_at)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default NewsList;



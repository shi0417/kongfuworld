import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import ApiService from '../services/ApiService';
import { useAuth, useUser } from '../hooks/useAuth';
import NewsCommentSectionNew from '../components/NewsCommentSection/NewsCommentSectionNew';
import styles from './NewsDetail.module.css';

type NewsItem = {
  id: number;
  title: string;
  content: string | null;
  content_format: 'markdown' | 'html';
  created_at: string;
  updated_at: string;
  link_url?: string | null;
  target_audience?: 'reader' | 'writer';
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleString('zh-CN');
};

const NewsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const newsId = id ? Number(id) : NaN;

  const { user: authUser } = useAuth();
  const { user: userData } = useUser();
  const user = useMemo(() => authUser || userData, [authUser, userData]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id || Number.isNaN(newsId)) {
        setError('Not found');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const resp = await ApiService.get<{ item: NewsItem }>(`/news/${newsId}`);
        if (!resp.success || !resp.data?.item) {
          setError(resp.message || 'Not found');
          setNews(null);
          return;
        }
        setNews(resp.data.item);
      } catch (e: any) {
        setError(e?.message ? String(e.message) : 'Failed to load');
        setNews(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, newsId]);

  return (
    <div className={styles.page}>
      <NavBar />
      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link to="/">Home</Link> {'>'} <Link to={news?.target_audience === 'writer' ? '/news?target_audience=writer' : '/news'}>
            {news?.target_audience === 'writer' ? 'Writer Announcements' : 'General Announcements'}
          </Link>
          {news?.title ? <> {'>'} {news.title}</> : null}
        </div>

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : !news ? (
          <div className={styles.error}>Not found</div>
        ) : (
          <>
            <h1 className={styles.title}>{news.title}</h1>
            <div className={styles.meta}>
              <span>发布：{formatDate(news.created_at)}</span>
              {news.updated_at ? <span>{'  '}· 更新：{formatDate(news.updated_at)}</span> : null}
            </div>

            <div className={styles.contentCard}>
              <div className={styles.content}>
                {news.content_format === 'markdown' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children, ...props }) => {
                        const url = typeof href === 'string' ? href : '';
                        if (url.startsWith('/')) {
                          return (
                            <Link to={url}>
                              {children}
                            </Link>
                          );
                        }
                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      }
                    }}
                  >
                    {news.content || ''}
                  </ReactMarkdown>
                ) : (
                  // content_format=html：按需求先当纯文本显示（避免 XSS/报错）
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{news.content || ''}</pre>
                )}
              </div>
            </div>

            <div className={styles.divider} />

            {/* 公告评论区（复用章评 UI/交互） */}
            <NewsCommentSectionNew newsId={news.id} user={user} />
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default NewsDetail;



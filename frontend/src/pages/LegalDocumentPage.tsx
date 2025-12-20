import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import ApiService from '../services/ApiService';
import styles from './LegalDocumentPage.module.css';

type LegalDocData = {
  title: string;
  content_md: string;
  version: string;
  effective_at: string | null;
  updated_at: string;
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleString('zh-CN');
};

const getDocKeyLabel = (docKey: string | undefined): string => {
  const map: { [key: string]: string } = {
    'terms': 'Terms of Service',
    'privacy': 'Privacy Policy',
    'cookies': 'Cookie Policy',
    'cookie': 'Cookie Policy'
  };
  return map[docKey || ''] || 'Legal Document';
};

const LegalDocumentPage: React.FC = () => {
  const { docKey } = useParams<{ docKey: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<LegalDocData | null>(null);

  useEffect(() => {
    const loadDoc = async () => {
      if (!docKey) {
        setError('文档类型参数缺失');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // 固定使用 en 语言，后续可扩展 i18n
        const res = await ApiService.get(`/legal/${docKey}?lang=en`);
        
        if (res.success && res.data) {
          setDoc(res.data);
        } else {
          setError('文档未发布或未配置');
        }
      } catch (e: any) {
        console.error('加载政策文档失败:', e);
        setError(e?.message || '加载文档失败');
      } finally {
        setLoading(false);
      }
    };

    loadDoc();
  }, [docKey]);

  return (
    <div className={styles.page}>
      <NavBar />
      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link to="/">Home</Link> {'>'} <span>{getDocKeyLabel(docKey)}</span>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : !doc ? (
          <div className={styles.error}>Not found</div>
        ) : (
          <>
            <h1 className={styles.title}>{doc.title}</h1>
            <div className={styles.meta}>
              <span>版本：{doc.version}</span>
              {doc.effective_at && (
                <span>{'  '}· 生效时间：{formatDate(doc.effective_at)}</span>
              )}
              {doc.updated_at && (
                <span>{'  '}· 更新时间：{formatDate(doc.updated_at)}</span>
              )}
            </div>

            <div className={styles.contentCard}>
              <div className={styles.content}>
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
                  {doc.content_md || ''}
                </ReactMarkdown>
              </div>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default LegalDocumentPage;


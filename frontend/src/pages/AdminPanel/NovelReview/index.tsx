import React, { useState, useEffect } from 'react';
import styles from './NovelReview.module.css';

interface Novel {
  id: number;
  title: string;
  author: string;
  translator: string | null;
  description: string | null;
  recommendation: string | null;
  languages: string | null;
  cover: string | null;
  review_status: string;
  status: string;
  created_at: string;
  author_name?: string;
  pen_name?: string;
  genres?: string[] | { id: number; name: string; chinese_name: string }[];
  protagonists?: string[];
}

interface NovelReviewProps {
  onError?: (error: string) => void;
}

const NovelReview: React.FC<NovelReviewProps> = ({ onError }) => {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // 通用的管理员 API 请求函数
  const adminApiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('adminToken');
    
    // 检查是否是 FormData，如果是则不设置 Content-Type（让浏览器自动设置）
    const isFormData = options.body instanceof FormData;
    
    // 构建请求头
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };
    
    // 只有当不是 FormData 且没有指定 Content-Type 时才设置默认值
    if (!isFormData && !options.headers) {
      headers['Content-Type'] = 'application/json';
    } else if (!isFormData && options.headers) {
      // 如果已有 headers，合并它们
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }
    
    const response = await fetch(`http://localhost:5000/api${endpoint}`, {
      ...options,
      headers,
    });

    // 检查响应状态
    if (response.status === 403) {
      if (onError) {
        onError('Token无效或已过期，请重新登录');
      }
      throw new Error('Token无效或已过期');
    }

    const data = await response.json();

    // 如果返回的是 token 相关错误，也清除 token
    if (!data.success && data.message && 
        (data.message.includes('Token') || data.message.includes('token') || 
         data.message.includes('登录') || data.message.includes('无效') || 
         data.message.includes('过期'))) {
      if (onError) {
        onError('Token无效或已过期，请重新登录');
      }
      throw new Error(data.message || 'Token无效或已过期');
    }

    return { response, data };
  };

  // 加载小说列表
  const loadNovels = async () => {
    try {
      setLoading(true);
      const endpoint = filterStatus === 'all' 
        ? '/admin/pending-novels' 
        : `/admin/novels?status=${filterStatus}`;
      
      const { data } = await adminApiRequest(endpoint);
      
      if (data.success) {
        setNovels(data.data || []);
        if (onError) {
          onError(''); // 清除之前的错误
        }
      } else {
        if (onError) {
          onError(data.message || '加载失败');
        }
      }
    } catch (err: any) {
      // token 过期错误已经在 adminApiRequest 中处理了
      if (!err.message || !err.message.includes('Token')) {
        if (onError) {
          onError(err.message || '加载失败');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // 当筛选状态改变时重新加载
  useEffect(() => {
    loadNovels();
  }, [filterStatus]);

  // 查看小说详情
  const viewNovelDetail = async (novelId: number) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/novel/${novelId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setSelectedNovel(data.data);
      } else {
        if (onError) {
          onError(data.message || '获取详情失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '获取详情失败');
      }
    }
  };

  // 处理审批
  const handleReview = async (novelId: number, action: 'approve' | 'reject') => {
    if (!window.confirm(`确定要${action === 'approve' ? '批准' : '拒绝'}这本小说吗？`)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/review-novel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ novelId, action })
      });

      const data = await response.json();
      
      if (data.success) {
        if (onError) {
          onError('');
        }
        loadNovels();
        if (selectedNovel?.id === novelId) {
          setSelectedNovel(null);
        }
      } else {
        if (onError) {
          onError(data.message || '操作失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '操作失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={styles.tabContent}>
        <div className={styles.tabHeader}>
          <h2>小说审批</h2>
          <div className={styles.filterButtons}>
            <button
              className={filterStatus === 'all' ? styles.active : ''}
              onClick={() => setFilterStatus('all')}
            >
              全部待审批
            </button>
            <button
              className={filterStatus === 'submitted' ? styles.active : ''}
              onClick={() => setFilterStatus('submitted')}
            >
              已提交
            </button>
            <button
              className={filterStatus === 'reviewing' ? styles.active : ''}
              onClick={() => setFilterStatus('reviewing')}
            >
              审核中
            </button>
            <button
              className={filterStatus === 'approved' ? styles.active : ''}
              onClick={() => setFilterStatus('approved')}
            >
              已批准
            </button>
            <button
              className={filterStatus === 'rejected' ? styles.active : ''}
              onClick={() => setFilterStatus('rejected')}
            >
              已拒绝
            </button>
          </div>
        </div>

        {loading && novels.length === 0 ? (
          <div className={styles.loading}>加载中...</div>
        ) : novels.length === 0 ? (
          <div className={styles.emptyState}>暂无数据</div>
        ) : (
          <div className={styles.novelList}>
            {novels.map((novel) => (
              <div key={novel.id} className={styles.novelCard}>
                <div className={styles.novelInfo}>
                  {novel.cover ? (
                    <img 
                      src={
                        novel.cover.startsWith('http') 
                          ? novel.cover 
                          : novel.cover.startsWith('/')
                          ? `http://localhost:5000${novel.cover}`
                          : `http://localhost:5000/covers/${novel.cover}`
                      }
                      alt={novel.title}
                      className={styles.novelCover}
                      onError={(e) => {
                        // 如果图片加载失败，隐藏图片或显示占位符
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className={styles.novelCoverPlaceholder}>
                      <span>{novel.title}</span>
                    </div>
                  )}
                  <div className={styles.novelDetails}>
                    <div className={styles.novelHeader}>
                      <h3>{novel.title}</h3>
                      <span className={styles.bookNumber}>书号: {novel.id}</span>
                    </div>
                    <div className={styles.novelInfoGrid}>
                      <div><strong>作者:</strong> {novel.author_name || novel.pen_name || novel.author || '—'}</div>
                      <div><strong>翻译:</strong> {novel.translator || '无'}</div>
                      <div><strong>状态:</strong> 
                        <span className={`${styles.status} ${styles[novel.review_status]}`}>
                          {novel.review_status === 'submitted' ? '已提交' :
                           novel.review_status === 'reviewing' ? '审核中' :
                           novel.review_status === 'approved' ? '已批准' :
                           novel.review_status === 'rejected' ? '已拒绝' : novel.review_status}
                        </span>
                      </div>
                      <div><strong>作品状态:</strong> {novel.status === 'ongoing' ? '连载中' : novel.status === 'completed' ? '已完结' : novel.status || '—'}</div>
                      {novel.languages && (
                        <div><strong>语言:</strong> {novel.languages}</div>
                      )}
                    </div>
                    {novel.genres && novel.genres.length > 0 && (
                      <div className={styles.tagsSection}>
                        <strong>作品标签:</strong>
                        <div className={styles.tags}>
                          {novel.genres.map((genre, idx) => (
                            <span key={idx} className={styles.tag}>
                              {typeof genre === 'string' ? genre : genre.chinese_name || genre.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {novel.protagonists && novel.protagonists.length > 0 && (
                      <div className={styles.protagonistsSection}>
                        <strong>主角名:</strong>
                        <div className={styles.protagonists}>
                          {novel.protagonists.map((protagonist, idx) => (
                            <span key={idx} className={styles.protagonist}>
                              {protagonist}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {novel.recommendation && (
                      <div className={styles.recommendationSection}>
                        <strong>推荐语:</strong>
                        <p className={styles.recommendation}>{novel.recommendation}</p>
                      </div>
                    )}
                    {novel.description && (
                      <div className={styles.descriptionSection}>
                        <strong>作品简介:</strong>
                        <p className={styles.description}>{novel.description}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.novelActions}>
                  <button
                    onClick={() => viewNovelDetail(novel.id)}
                    className={styles.viewButton}
                  >
                    查看详情
                  </button>
                  {novel.review_status === 'submitted' || novel.review_status === 'reviewing' ? (
                    <>
                      <button
                        onClick={() => handleReview(novel.id, 'approve')}
                        className={styles.approveButton}
                        disabled={loading}
                      >
                        批准
                      </button>
                      <button
                        onClick={() => handleReview(novel.id, 'reject')}
                        className={styles.rejectButton}
                        disabled={loading}
                      >
                        拒绝
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 小说详情模态框 */}
      {selectedNovel && (
        <div className={styles.modal} onClick={() => setSelectedNovel(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{selectedNovel.title}</h2>
              <button onClick={() => setSelectedNovel(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalContentWrapper}>
                {selectedNovel.cover ? (
                  <img 
                    src={
                      selectedNovel.cover.startsWith('http') 
                        ? selectedNovel.cover 
                        : selectedNovel.cover.startsWith('/')
                        ? `http://localhost:5000${selectedNovel.cover}`
                        : `http://localhost:5000/covers/${selectedNovel.cover}`
                    }
                    alt={selectedNovel.title}
                    className={styles.modalCover}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className={styles.modalCoverPlaceholder}>
                    <span>{selectedNovel.title}</span>
                  </div>
                )}
                <div className={styles.modalDetails}>
                  <div className={styles.modalInfoGrid}>
                    <div><strong>书号:</strong> {selectedNovel.id}</div>
                    <div><strong>作品名称:</strong> {selectedNovel.title}</div>
                    <div><strong>作者:</strong> {selectedNovel.author_name || selectedNovel.pen_name || selectedNovel.author || '—'}</div>
                    <div><strong>翻译:</strong> {selectedNovel.translator || '无'}</div>
                    <div><strong>审核状态:</strong> 
                      <span className={`${styles.status} ${styles[selectedNovel.review_status]}`}>
                        {selectedNovel.review_status === 'submitted' ? '已提交' :
                         selectedNovel.review_status === 'reviewing' ? '审核中' :
                         selectedNovel.review_status === 'approved' ? '已批准' :
                         selectedNovel.review_status === 'rejected' ? '已拒绝' : selectedNovel.review_status}
                      </span>
                    </div>
                    <div><strong>作品状态:</strong> {selectedNovel.status === 'ongoing' ? '连载中' : selectedNovel.status === 'completed' ? '已完结' : selectedNovel.status || '—'}</div>
                    {selectedNovel.languages && (
                      <div><strong>语言:</strong> {selectedNovel.languages}</div>
                    )}
                    <div><strong>创建时间:</strong> {new Date(selectedNovel.created_at).toLocaleString('zh-CN')}</div>
                  </div>
                  
                  {selectedNovel.genres && selectedNovel.genres.length > 0 && (
                    <div className={styles.modalSection}>
                      <strong>作品标签:</strong>
                      <div className={styles.tags}>
                        {selectedNovel.genres.map((genre, idx) => (
                          <span key={idx} className={styles.tag}>
                            {typeof genre === 'string' ? genre : genre.chinese_name || genre.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedNovel.protagonists && selectedNovel.protagonists.length > 0 && (
                    <div className={styles.modalSection}>
                      <strong>主角名:</strong>
                      <div className={styles.protagonists}>
                        {selectedNovel.protagonists.map((protagonist, idx) => (
                          <span key={idx} className={styles.protagonist}>
                            {protagonist}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedNovel.recommendation && (
                    <div className={styles.modalSection}>
                      <strong>推荐语:</strong>
                      <p className={styles.recommendation}>{selectedNovel.recommendation}</p>
                    </div>
                  )}
                  
                  {selectedNovel.description && (
                    <div className={styles.modalSection}>
                      <strong>作品简介:</strong>
                      <p className={styles.modalDescription}>{selectedNovel.description}</p>
                    </div>
                  )}
                </div>
              </div>
              {(selectedNovel.review_status === 'submitted' || selectedNovel.review_status === 'reviewing') && (
                <div className={styles.modalActions}>
                  <button
                    onClick={() => {
                      handleReview(selectedNovel.id, 'approve');
                      setSelectedNovel(null);
                    }}
                    className={styles.approveButton}
                    disabled={loading}
                  >
                    批准
                  </button>
                  <button
                    onClick={() => {
                      handleReview(selectedNovel.id, 'reject');
                      setSelectedNovel(null);
                    }}
                    className={styles.rejectButton}
                    disabled={loading}
                  >
                    拒绝
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NovelReview;


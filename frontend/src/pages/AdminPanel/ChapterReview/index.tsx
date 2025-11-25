import React, { useState, useEffect, useCallback } from 'react';
import styles from './ChapterReview.module.css';

interface Chapter {
  id: number;
  novel_id: number;
  novel_title: string;
  author: string;
  chapter_number: number;
  title: string;
  content_preview?: string;
  content?: string;
  translator_note?: string;
  word_count: number;
  review_status: string;
  is_released: boolean;
  release_date: string | null;
  created_at: string;
}

interface ChapterReviewProps {
  onError?: (error: string) => void;
}

const ChapterReview: React.FC<ChapterReviewProps> = ({ onError }) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // 通用的管理员 API 请求函数
  const adminApiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('adminToken');
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };
    
    if (!(options.body instanceof FormData)) {
      if (!options.headers) {
        headers['Content-Type'] = 'application/json';
      } else if (typeof options.headers === 'object' && !(options.headers instanceof Headers)) {
        Object.assign(headers, options.headers);
      }
    }
    
    const response = await fetch(`http://localhost:5000/api${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 403) {
      if (onError) {
        onError('Token无效或已过期，请重新登录');
      }
      throw new Error('Token无效或已过期');
    }

    const data = await response.json();
    return { response, data };
  };

  // 加载章节列表
  const loadChapters = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = `/admin/pending-chapters?status=${filterStatus}&page=${page}&limit=20`;
      const { data } = await adminApiRequest(endpoint);
      
      if (data.success) {
        setChapters(data.data || []);
        setTotal(data.pagination?.total || 0);
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '加载失败');
        }
      }
    } catch (err: any) {
      if (!err.message || !err.message.includes('Token')) {
        if (onError) {
          onError(err.message || '加载失败');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [filterStatus, page, onError]);

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  // 查看章节详情
  const viewChapterDetail = async (chapterId: number) => {
    try {
      const { data } = await adminApiRequest(`/admin/chapter/${chapterId}`);
      
      if (data.success) {
        setSelectedChapter(data.data);
        setShowDetailDrawer(true);
        setRejectReason('');
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

  // 处理审核
  const handleReview = async (chapterId: number, action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectReason.trim()) {
      if (onError) {
        onError('拒绝时必须填写理由');
      }
      return;
    }

    if (!window.confirm(`确定要${action === 'approve' ? '批准' : '拒绝'}这个章节吗？`)) {
      return;
    }

    try {
      setSaving(true);
      const { data } = await adminApiRequest('/admin/review-chapter', {
        method: 'POST',
        body: JSON.stringify({
          chapterId,
          action,
          reason: action === 'reject' ? rejectReason : undefined
        })
      });
      
      if (data.success) {
        if (onError) {
          onError('');
        }
        await loadChapters();
        if (selectedChapter?.id === chapterId) {
          setShowDetailDrawer(false);
          setSelectedChapter(null);
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
      setSaving(false);
    }
  };

  // 获取状态显示文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'submitted': '已提交',
      'reviewing': '审核中',
      'approved': '已批准',
      'locked': '已拒绝',
      'draft': '草稿'
    };
    return statusMap[status] || status;
  };

  // 获取状态样式类
  const getStatusClass = (status: string) => {
    return styles[status] || '';
  };

  // 键盘快捷键处理
  useEffect(() => {
    if (!showDetailDrawer || !selectedChapter) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // 输入框内不处理快捷键
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleReview(selectedChapter.id, 'approve');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        const reason = prompt('请输入拒绝理由：');
        if (reason) {
          setRejectReason(reason);
          setTimeout(() => handleReview(selectedChapter.id, 'reject'), 100);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDetailDrawer(false);
        setSelectedChapter(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showDetailDrawer, selectedChapter]);

  return (
    <>
      <div className={styles.tabContent}>
        <div className={styles.tabHeader}>
          <h2>章节审核</h2>
          <div className={styles.filterButtons}>
            <button
              className={filterStatus === 'all' ? styles.active : ''}
              onClick={() => { setFilterStatus('all'); setPage(1); }}
            >
              全部待审核
            </button>
            <button
              className={filterStatus === 'submitted' ? styles.active : ''}
              onClick={() => { setFilterStatus('submitted'); setPage(1); }}
            >
              已提交
            </button>
            <button
              className={filterStatus === 'reviewing' ? styles.active : ''}
              onClick={() => { setFilterStatus('reviewing'); setPage(1); }}
            >
              审核中
            </button>
          </div>
        </div>

        {loading && chapters.length === 0 ? (
          <div className={styles.loading}>加载中...</div>
        ) : chapters.length === 0 ? (
          <div className={styles.emptyState}>暂无待审核章节</div>
        ) : (
          <>
            <div className={styles.chapterList}>
              {chapters.map((chapter) => (
                <div key={chapter.id} className={styles.chapterCard}>
                  <div className={styles.chapterInfo}>
                    <div className={styles.chapterHeader}>
                      <h3>{chapter.novel_title} - {chapter.title}</h3>
                      <span className={`${styles.status} ${getStatusClass(chapter.review_status)}`}>
                        {getStatusText(chapter.review_status)}
                      </span>
                    </div>
                    <div className={styles.chapterMeta}>
                      <span>作者: {chapter.author}</span>
                      <span>章节号: {chapter.chapter_number}</span>
                      <span>字数: {chapter.word_count}</span>
                      <span>创建时间: {new Date(chapter.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                    {chapter.content_preview && (
                      <p className={styles.preview}>{chapter.content_preview}...</p>
                    )}
                  </div>
                  <div className={styles.chapterActions}>
                    <button
                      onClick={() => viewChapterDetail(chapter.id)}
                      className={styles.viewButton}
                    >
                      查看全文
                    </button>
                    <button
                      onClick={() => handleReview(chapter.id, 'approve')}
                      className={styles.approveButton}
                      disabled={loading || saving}
                    >
                      批准
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('请输入拒绝理由：');
                        if (reason) {
                          setRejectReason(reason);
                          handleReview(chapter.id, 'reject');
                        }
                      }}
                      className={styles.rejectButton}
                      disabled={loading || saving}
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {total > 20 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </button>
                <span>第 {page} 页，共 {Math.ceil(total / 20)} 页</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / 20)}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 章节详情抽屉 */}
      {showDetailDrawer && selectedChapter && (
        <div className={styles.drawer} onClick={() => setShowDetailDrawer(false)}>
          <div className={styles.drawerContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2>{selectedChapter.novel_title} - {selectedChapter.title}</h2>
              <button onClick={() => setShowDetailDrawer(false)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.drawerBody}>
              <div className={styles.chapterMetaInfo}>
                <p><strong>作者:</strong> {selectedChapter.author}</p>
                <p><strong>章节号:</strong> {selectedChapter.chapter_number}</p>
                <p><strong>字数:</strong> {selectedChapter.word_count}</p>
                <p><strong>状态:</strong> 
                  <span className={`${styles.status} ${getStatusClass(selectedChapter.review_status)}`}>
                    {getStatusText(selectedChapter.review_status)}
                  </span>
                </p>
                <p><strong>创建时间:</strong> {new Date(selectedChapter.created_at).toLocaleString('zh-CN')}</p>
                {selectedChapter.translator_note && (
                  <div>
                    <strong>翻译备注:</strong>
                    <p className={styles.translatorNote}>{selectedChapter.translator_note}</p>
                  </div>
                )}
              </div>
              
              <div className={styles.chapterContent}>
                <h3>章节内容</h3>
                <div className={styles.contentText}>
                  {selectedChapter.content || selectedChapter.content_preview}
                </div>
              </div>

              {selectedChapter.review_status === 'submitted' || selectedChapter.review_status === 'reviewing' ? (
                <div className={styles.drawerActions}>
                  <div className={styles.rejectReasonInput}>
                    <label>拒绝理由（如拒绝）：</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="请输入拒绝理由..."
                      rows={3}
                    />
                  </div>
                  <div className={styles.actionButtons}>
                    <button
                      onClick={() => handleReview(selectedChapter.id, 'approve')}
                      className={styles.approveButton}
                      disabled={saving}
                    >
                      批准 (A)
                    </button>
                    <button
                      onClick={() => handleReview(selectedChapter.id, 'reject')}
                      className={styles.rejectButton}
                      disabled={saving || !rejectReason.trim()}
                    >
                      拒绝 (R)
                    </button>
                  </div>
                  <div className={styles.shortcutsHint}>
                    <small>快捷键: A=批准, R=拒绝, ESC=关闭</small>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChapterReview;


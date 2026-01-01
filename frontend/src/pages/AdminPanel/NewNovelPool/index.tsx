/**
 * 新小说池页面组件
 * 用于展示新申请、审核中、未分配编辑的小说列表
 * 编辑可以在此页面申请成为小说的责任编辑
 */

import React, { useState, useEffect, useCallback } from 'react';
import styles from './NewNovelPool.module.css';
import ApiService from '../../../services/ApiService';

interface Novel {
  id: number;
  title: string;
  author: string;
  author_name?: string;
  pen_name?: string;
  review_status: string;
  description: string | null;
  cover: string | null;
  created_at: string;
  pending_chapter_count: number;
  genres?: string[];
  application_status?: string | null; // 当前用户的申请状态：pending/approved/rejected/cancelled 或 null
}

interface Chapter {
  id: number;
  novel_id: number;
  volume_id: number | null;
  chapter_number: number;
  title: string;
  word_count: number;
  review_status: string;
  created_at: string;
  volume_name: string | null;
}

interface NovelDetail {
  novel: Novel;
  pendingChapters: Chapter[];
}

interface NewNovelPoolProps {
  onError?: (error: string) => void;
  onNavigateToChapter?: (chapterId: number) => void; // 用于跳转到章节审批页面
}

const NewNovelPool: React.FC<NewNovelPoolProps> = ({ onError, onNavigateToChapter }) => {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    keyword: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0
  });
  const [selectedNovelId, setSelectedNovelId] = useState<number | null>(null);
  const [novelDetail, setNovelDetail] = useState<NovelDetail | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyReason, setApplyReason] = useState('');
  const [applying, setApplying] = useState(false);

  // 通用的管理员 API 请求函数
  const adminApiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('adminToken');
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };
    
    if (!(options.body instanceof FormData) && !options.headers) {
      headers['Content-Type'] = 'application/json';
    } else if (!(options.body instanceof FormData) && options.headers) {
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
    
    const result = await ApiService.request(endpoint, {
      ...options,
      headers
    });

    if (result.status === 403) {
      if (onError) {
        onError('Token无效或已过期，请重新登录');
      }
      throw new Error('Token无效或已过期');
    }

    if (!result.success && result.message && 
        (result.message.includes('Token') || result.message.includes('token') || 
         result.message.includes('登录') || result.message.includes('无效') || 
         result.message.includes('过期'))) {
      if (onError) {
        onError('Token无效或已过期，请重新登录');
      }
      throw new Error(result.message || 'Token无效或已过期');
    }

    return result;
  };

  // 加载新小说池列表
  const loadNovels = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString()
      });
      
      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.keyword) {
        params.append('keyword', filters.keyword);
      }
      
      const result = await adminApiRequest(`/admin/new-novel-pool?${params.toString()}`);
      
      if (result.success) {
        setNovels(result.data?.list || []);
        setPagination(prev => ({
          ...prev,
          total: result.data?.total || 0
        }));
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
  }, [filters, pagination.page, pagination.pageSize, onError]);

  useEffect(() => {
    loadNovels();
  }, [loadNovels]);

  // 加载小说详情
  const loadNovelDetail = async (novelId: number) => {
    try {
      setLoadingDetail(true);
      const result = await adminApiRequest(`/admin/new-novel-pool/${novelId}`);
      
      if (result.success) {
        setNovelDetail(result.data);
        setShowDetailDrawer(true);
      } else {
        if (onError) {
          onError(data.message || '加载详情失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载详情失败');
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  // 打开详情抽屉
  const handleViewDetail = (novelId: number) => {
    setSelectedNovelId(novelId);
    loadNovelDetail(novelId);
  };

  // 打开申请弹窗
  const handleOpenApply = (novelId: number) => {
    setSelectedNovelId(novelId);
    setApplyReason('');
    setShowApplyModal(true);
  };

  // 提交申请
  const handleSubmitApply = async () => {
    if (!selectedNovelId) return;
    
    if (!applyReason.trim()) {
      if (onError) {
        onError('请填写申请理由');
      }
      return;
    }
    
    try {
      setApplying(true);
      const result = await adminApiRequest(`/admin/new-novel-pool/${selectedNovelId}/apply-editor`, {
        method: 'POST',
        body: JSON.stringify({ reason: applyReason.trim() })
      });
      
      if (result.success) {
        alert('申请已提交，等待后台审批');
        setShowApplyModal(false);
        setApplyReason('');
        // 刷新列表以更新申请状态
        loadNovels();
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '提交申请失败');
      }
    } finally {
      setApplying(false);
    }
  };

  // 获取审核状态文本和样式
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'created': '已创建',
      'submitted': '已提交',
      'reviewing': '审核中'
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status: string) => {
    const classMap: Record<string, string> = {
      'created': styles.statusCreated,
      'submitted': styles.statusSubmitted,
      'reviewing': styles.statusReviewing
    };
    return classMap[status] || '';
  };

  // 获取申请状态文本
  const getApplicationStatusText = (status: string | null | undefined) => {
    if (!status) return null;
    const statusMap: Record<string, string> = {
      'pending': '申请中',
      'approved': '已通过',
      'rejected': '已拒绝',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  };

  // 判断是否可以申请（没有申请或申请被拒绝/取消）
  const canApply = (novel: Novel) => {
    return !novel.application_status || 
           novel.application_status === 'rejected' || 
           novel.application_status === 'cancelled';
  };

      // 跳转到章节审批页面
  const handleGoToChapter = (chapterId: number) => {
    if (onNavigateToChapter) {
      onNavigateToChapter(chapterId);
    } else {
      // 如果没有传入导航函数，尝试通过其他方式跳转
      // 这里可以根据项目实际情况调整
            alert(`跳转到章节审批页面，章节ID: ${chapterId}`);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>新小说池</h2>
        <p className={styles.subtitle}>展示新申请、审核中、未分配编辑的小说</p>
      </div>

      {/* 筛选区 */}
      <div className={styles.filters}>
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters(prev => ({ ...prev, status: e.target.value }));
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
          className={styles.filterSelect}
        >
          <option value="all">全部状态</option>
          <option value="created">已创建</option>
          <option value="submitted">已提交</option>
          <option value="reviewing">审核中</option>
        </select>
        
        <input
          type="text"
          placeholder="搜索小说名/作者名/小说ID"
          value={filters.keyword}
          onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              setPagination(prev => ({ ...prev, page: 1 }));
              loadNovels();
            }
          }}
          className={styles.searchInput}
        />
        
        <button onClick={() => {
          setPagination(prev => ({ ...prev, page: 1 }));
          loadNovels();
        }} className={styles.searchButton}>
          搜索
        </button>
        
        <button onClick={() => {
          setFilters({ status: 'all', keyword: '' });
          setPagination(prev => ({ ...prev, page: 1 }));
        }} className={styles.resetButton}>
          重置
        </button>
      </div>

      {/* 列表表格 */}
      {loading && novels.length === 0 ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>小说ID</th>
                <th>小说名称</th>
                <th>作者</th>
                <th>审核状态</th>
                <th>待审章节数</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {novels.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    暂无符合条件的小说
                  </td>
                </tr>
              ) : (
                novels.map((novel) => (
                  <tr key={novel.id}>
                    <td>{novel.id}</td>
                    <td>{novel.title}</td>
                    <td>{novel.pen_name || novel.author_name || novel.author || '-'}</td>
                    <td>
                      <span className={`${styles.statusTag} ${getStatusClass(novel.review_status)}`}>
                        {getStatusText(novel.review_status)}
                      </span>
                    </td>
                    <td>{novel.pending_chapter_count}</td>
                    <td>{new Date(novel.created_at).toLocaleString('zh-CN')}</td>
                    <td>
                      <button
                        onClick={() => handleViewDetail(novel.id)}
                        className={styles.viewButton}
                      >
                        查看详情
                      </button>
                      {canApply(novel) ? (
                        <button
                          onClick={() => handleOpenApply(novel.id)}
                          className={styles.applyButton}
                        >
                          申请成为责任编辑
                        </button>
                      ) : (
                        <span className={styles.applicationStatus}>
                          {getApplicationStatusText(novel.application_status)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* 分页 */}
          {pagination.total > 0 && (
            <div className={styles.pagination}>
              <button
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                上一页
              </button>
              <span>
                第 {pagination.page} 页，共 {Math.ceil(pagination.total / pagination.pageSize)} 页
              </span>
              <button
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      {/* 详情抽屉 */}
      {showDetailDrawer && novelDetail && (
        <div className={styles.drawer} onClick={() => setShowDetailDrawer(false)}>
          <div className={styles.drawerContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h3>小说详情 - {novelDetail.novel.title}</h3>
              <button onClick={() => setShowDetailDrawer(false)} className={styles.closeButton}>×</button>
            </div>
            
            {loadingDetail ? (
              <div className={styles.loading}>加载中...</div>
            ) : (
              <div className={styles.drawerBody}>
                {/* 小说基本信息 */}
                <div className={styles.section}>
                  <h4>基本信息</h4>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <label>小说ID：</label>
                      <span>{novelDetail.novel.id}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <label>小说名称：</label>
                      <span>{novelDetail.novel.title}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <label>作者：</label>
                      <span>{novelDetail.novel.pen_name || novelDetail.novel.author_name || novelDetail.novel.author || '-'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <label>审核状态：</label>
                      <span className={`${styles.statusTag} ${getStatusClass(novelDetail.novel.review_status)}`}>
                        {getStatusText(novelDetail.novel.review_status)}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <label>创建时间：</label>
                      <span>{new Date(novelDetail.novel.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                    {novelDetail.novel.description && (
                      <div className={styles.infoItemFull}>
                        <label>简介：</label>
                        <p>{novelDetail.novel.description}</p>
                      </div>
                    )}
                    {novelDetail.novel.genres && novelDetail.novel.genres.length > 0 && (
                      <div className={styles.infoItemFull}>
                        <label>类型：</label>
                        <span>{novelDetail.novel.genres.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 待审章节列表 */}
                <div className={styles.section}>
                  <h4>待审章节列表（{novelDetail.pendingChapters.length} 个）</h4>
                  {novelDetail.pendingChapters.length === 0 ? (
                    <p className={styles.emptyText}>暂无待审章节</p>
                  ) : (
                    <div className={styles.chapterList}>
                      <table className={styles.chapterTable}>
                        <thead>
                          <tr>
                            <th>章节号</th>
                            <th>卷名</th>
                            <th>章节标题</th>
                            <th>字数</th>
                            <th>状态</th>
                            <th>提交时间</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {novelDetail.pendingChapters.map((chapter) => (
                            <tr key={chapter.id}>
                              <td>{chapter.chapter_number}</td>
                              <td>{chapter.volume_name || '-'}</td>
                              <td>{chapter.title}</td>
                              <td>{chapter.word_count}</td>
                              <td>
                                <span className={`${styles.statusTag} ${getStatusClass(chapter.review_status)}`}>
                                  {getStatusText(chapter.review_status)}
                                </span>
                              </td>
                              <td>{new Date(chapter.created_at).toLocaleString('zh-CN')}</td>
                              <td>
                                <button
                                  onClick={() => handleGoToChapter(chapter.id)}
                                  className={styles.goToChapterButton}
                                >
                                  去章节审批
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 申请成为责任编辑 */}
                <div className={styles.section}>
                  <h4>编辑申请</h4>
                  {canApply(novelDetail.novel) ? (
                    <button
                      onClick={() => handleOpenApply(novelDetail.novel.id)}
                      className={styles.applyButton}
                    >
                      申请成为本书责任编辑
                    </button>
                  ) : (
                    <div className={styles.applicationStatusInfo}>
                      <span className={styles.applicationStatus}>
                        申请状态：{getApplicationStatusText(novelDetail.novel.application_status)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 申请弹窗 */}
      {showApplyModal && (
        <div className={styles.modal} onClick={() => setShowApplyModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>申请成为责任编辑</h3>
            <div className={styles.formGroup}>
              <label>申请理由：</label>
              <textarea
                value={applyReason}
                onChange={(e) => setApplyReason(e.target.value)}
                placeholder="请填写申请理由，说明为什么想成为该小说的责任编辑..."
                rows={6}
                className={styles.textarea}
              />
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={handleSubmitApply}
                disabled={applying || !applyReason.trim()}
                className={styles.submitButton}
              >
                {applying ? '提交中...' : '提交申请'}
              </button>
              <button
                onClick={() => setShowApplyModal(false)}
                className={styles.cancelButton}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewNovelPool;


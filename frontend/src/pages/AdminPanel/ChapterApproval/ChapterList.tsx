import React, { useState } from 'react';
import styles from './ChapterApproval.module.css';

interface Chapter {
  id: number;
  novel_id: number;
  novel_title: string;
  novel_cover?: string;
  volume_id: number;
  volume_name: string;
  chapter_number: number;
  title: string;
  word_count: number;
  author: string;
  editor_admin_id?: number;
  editor_name?: string;
  chief_editor_admin_id?: number;
  chief_editor_name?: string;
  review_status: string;
  is_released: boolean;
  is_advance: boolean;
  unlock_price: number;
  key_cost: number;
  unlock_priority: string;
  release_date?: string;
  created_at: string;
  updated_at?: string;
}

interface ChapterListProps {
  chapters: Chapter[];
  loading: boolean;
  filters: {
    status: string;
    novel_id: string;
    search: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  selectedIds: number[];
  selectedChapterId?: number;
  onFilterChange: (filters: { status: string; novel_id: string; search: string }) => void;
  onPageChange: (page: number) => void;
  onChapterSelect: (chapter: Chapter) => void;
  onSelectIds: (ids: number[]) => void;
  onBatchReview: (result: string, comment: string) => void;
}

const ChapterList: React.FC<ChapterListProps> = ({
  chapters,
  loading,
  filters,
  pagination,
  selectedIds,
  selectedChapterId,
  onFilterChange,
  onPageChange,
  onChapterSelect,
  onSelectIds,
  onBatchReview
}) => {
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchResult, setBatchResult] = useState<'approved' | 'rejected'>('approved');
  const [batchComment, setBatchComment] = useState('');

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'submitted': '已提交',
      'reviewing': '审核中',
      'approved': '已批准',
      'rejected': '已拒绝',
      'draft': '草稿',
      'pending_chief': '等待主编终审'
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status: string) => {
    return styles[`status_${status}`] || '';
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectIds(chapters.map(ch => ch.id));
    } else {
      onSelectIds([]);
    }
  };

  const handleSelectChapter = (chapterId: number, checked: boolean) => {
    if (checked) {
      onSelectIds([...selectedIds, chapterId]);
    } else {
      onSelectIds(selectedIds.filter(id => id !== chapterId));
    }
  };

  const handleBatchSubmit = () => {
    if (selectedIds.length === 0) {
      alert('请先选择要审核的章节');
      return;
    }
    onBatchReview(batchResult, batchComment);
    setShowBatchModal(false);
    setBatchComment('');
  };

  return (
    <div className={styles.listContainer}>
      <div className={styles.listHeader}>
        <h2>章节审批</h2>
        
        {/* 筛选区域 */}
        <div className={styles.filters}>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className={styles.filterSelect}
          >
            <option value="all">全部状态</option>
            <option value="submitted">已提交</option>
            <option value="reviewing">审核中</option>
            <option value="pending_chief">等待主编终审</option>
            <option value="approved">已批准</option>
            <option value="rejected">已拒绝</option>
            <option value="draft">草稿</option>
          </select>
          
          <input
            type="text"
            placeholder="搜索小说名/章节标题/章节ID"
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className={styles.searchInput}
          />
          
          {selectedIds.length > 0 && (
            <div className={styles.batchActions}>
              <span>已选择 {selectedIds.length} 个章节</span>
              <button
                onClick={() => {
                  setBatchResult('approved');
                  setShowBatchModal(true);
                }}
                className={styles.batchApproveBtn}
              >
                批量通过
              </button>
              <button
                onClick={() => {
                  setBatchResult('rejected');
                  setShowBatchModal(true);
                }}
                className={styles.batchRejectBtn}
              >
                批量拒绝
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 章节列表 */}
      {loading && chapters.length === 0 ? (
        <div className={styles.loading}>加载中...</div>
      ) : chapters.length === 0 ? (
        <div className={styles.emptyState}>暂无章节</div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.chapterTable}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedIds.length === chapters.length && chapters.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th>小说名</th>
                  <th>卷名</th>
                  <th>章节号</th>
                  <th>标题</th>
                  <th>字数</th>
                  <th>作者</th>
                  <th>编辑配置</th>
                  <th>状态</th>
                  <th>发布</th>
                  <th>解锁方式</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((chapter) => (
                  <tr
                    key={chapter.id}
                    className={selectedChapterId === chapter.id ? styles.selectedRow : ''}
                    onClick={() => onChapterSelect(chapter)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(chapter.id)}
                        onChange={(e) => handleSelectChapter(chapter.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <span 
                        style={{ cursor: 'pointer', color: '#1976d2', textDecoration: 'underline' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/book/${chapter.novel_id}`, '_blank');
                        }}
                      >
                        {chapter.novel_title}
                      </span>
                    </td>
                    <td>{chapter.volume_name}</td>
                    <td>{chapter.chapter_number}</td>
                    <td>{chapter.title}</td>
                    <td>{chapter.word_count}</td>
                    <td>{chapter.author}</td>
                    <td>
                      {/* 根据 novel 当前配置显示主编/责任编辑，章节级别的最终归属由 chapter.editor_admin_id / chapter.chief_editor_admin_id 决定，用于结算 */}
                      {chapter.chief_editor_name && chapter.editor_name ? (
                        `主编：${chapter.chief_editor_name} / 责任编辑：${chapter.editor_name}`
                      ) : chapter.chief_editor_name ? (
                        `主编：${chapter.chief_editor_name}`
                      ) : chapter.editor_name ? (
                        `责任编辑：${chapter.editor_name}`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${getStatusClass(chapter.review_status)}`}>
                        {getStatusText(chapter.review_status)}
                      </span>
                    </td>
                    <td>{chapter.is_released ? '✓' : '✗'}</td>
                    <td>
                      {chapter.unlock_price > 0 
                        ? `钥匙${chapter.key_cost || chapter.unlock_price}` 
                        : '免费'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          onChapterSelect(chapter);
                          window.open(`/novel/${chapter.novel_id}/chapter/${chapter.id}`, '_blank');
                        }}
                        className={styles.viewBtn}
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                上一页
              </button>
              <span>
                第 {pagination.page} 页，共 {pagination.totalPages} 页（共 {pagination.total} 条）
              </span>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* 批量审核模态框 */}
      {showBatchModal && (
        <div className={styles.modal} onClick={() => setShowBatchModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>批量{batchResult === 'approved' ? '通过' : '拒绝'}</h3>
              <button onClick={() => setShowBatchModal(false)} className={styles.closeBtn}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p>确定要{batchResult === 'approved' ? '通过' : '拒绝'}选中的 {selectedIds.length} 个章节吗？</p>
              <div className={styles.formGroup}>
                <label>审核备注：</label>
                <textarea
                  value={batchComment}
                  onChange={(e) => setBatchComment(e.target.value)}
                  placeholder="请输入审核备注（可选）"
                  rows={4}
                  className={styles.textarea}
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button onClick={() => setShowBatchModal(false)} className={styles.cancelBtn}>
                取消
              </button>
              <button
                onClick={handleBatchSubmit}
                className={batchResult === 'approved' ? styles.approveBtn : styles.rejectBtn}
              >
                确认{batchResult === 'approved' ? '通过' : '拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChapterList;


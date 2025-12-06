import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import ApiService from '../../services/ApiService';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import styles from './DraftBoxTab.module.css';

interface Draft {
  id: number;
  chapter_number: number;
  title: string;
  word_count: number | null;
  created_at: string;
}

const DraftBoxTab: React.FC<{ novelId: number; novelTitle?: string }> = ({ novelId, novelTitle = '' }) => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [totalWords, setTotalWords] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; draft: Draft | null }>({
    isOpen: false,
    draft: null
  });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadDrafts();
  }, [novelId, sortOrder]);

  const loadDrafts = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/chapters/novel/${novelId}/drafts?sort=${sortOrder}`;
      const response = await ApiService.get(url);
      
      let draftsList: Draft[] = [];
      if (Array.isArray(response)) {
        draftsList = response;
      } else if (response && typeof response === 'object' && response.data) {
        draftsList = Array.isArray(response.data) ? response.data : [];
      }

      setDrafts(draftsList);
      const total = draftsList.reduce((sum, draft) => sum + (draft.word_count || 0), 0);
      setTotalWords(total);
    } catch (error) {
      console.error('加载草稿列表失败:', error);
      setError(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const formatWordCount = (count: number | null) => {
    if (!count) return '0';
    return count.toLocaleString();
  };

  // 打开删除确认对话框
  const handleDeleteClick = (draft: Draft) => {
    setDeleteDialog({ isOpen: true, draft });
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deleteDialog.draft) return;

    setIsDeleting(true);
    try {
      const response = await ApiService.request(`/chapter/${deleteDialog.draft.id}`, {
        method: 'DELETE'
      });

      if (response.success) {
        // 从列表中移除已删除的章节并重新计算总字数
        setDrafts(prevDrafts => {
          const updatedDrafts = prevDrafts.filter(d => d.id !== deleteDialog.draft!.id);
          const total = updatedDrafts.reduce((sum, draft) => sum + (draft.word_count || 0), 0);
          setTotalWords(total);
          return updatedDrafts;
        });

        // 关闭对话框
        setDeleteDialog({ isOpen: false, draft: null });
      } else {
        throw new Error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除章节失败:', error);
      alert(language === 'zh' 
        ? `删除失败: ${error instanceof Error ? error.message : '未知错误'}` 
        : `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // 取消删除
  const handleCancelDelete = () => {
    if (!isDeleting) {
      setDeleteDialog({ isOpen: false, draft: null });
    }
  };


  if (loading) {
    return <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>;
  }

  return (
    <div className={styles.container}>
      {/* Summary and Sort */}
      <div className={styles.summarySection}>
        <div className={styles.summaryText}>
          {language === 'zh' ? '当前草稿箱共计:' : 'Current drafts total:'}
          <span className={styles.wordCount}>{formatWordCount(totalWords)}{language === 'zh' ? '字' : ' words'}</span>
        </div>
        <div className={styles.sortButtons}>
          <button
            className={`${styles.sortBtn} ${sortOrder === 'desc' ? styles.active : ''}`}
            onClick={() => setSortOrder('desc')}
          >
            {language === 'zh' ? '倒序' : 'Desc'}
          </button>
          <button
            className={`${styles.sortBtn} ${sortOrder === 'asc' ? styles.active : ''}`}
            onClick={() => setSortOrder('asc')}
          >
            {language === 'zh' ? '正序' : 'Asc'}
          </button>
        </div>
      </div>

      {/* Drafts Table */}
      {error ? (
        <div className={styles.error}>{error}</div>
      ) : drafts.length === 0 ? (
        <div className={styles.noDrafts}>
          <p>{language === 'zh' ? '暂无草稿' : 'No drafts yet'}</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.draftsTable}>
            <thead>
              <tr>
                <th>{language === 'zh' ? '章节名称' : 'Chapter Name'}</th>
                <th>{language === 'zh' ? '字数' : 'Word Count'}</th>
                <th>{language === 'zh' ? '创建时间' : 'Creation Time'}</th>
                <th>{language === 'zh' ? '操作' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map(draft => {
                // 找到最大的chapter_number（最后一章）
                const maxChapterNumber = drafts.length > 0 
                  ? Math.max(...drafts.map(d => d.chapter_number))
                  : 0;
                // 判断是否是最后一章
                const isLastChapter = draft.chapter_number === maxChapterNumber;
                
                return (
                  <tr key={draft.id}>
                    <td>
                      第{draft.chapter_number}章 {draft.title}
                    </td>
                    <td>{formatWordCount(draft.word_count)}</td>
                    <td>{new Date(draft.created_at).toLocaleString('zh-CN', { 
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionLink}
                          onClick={() => navigate(`/novel/${novelId}/chapter/${draft.id}?draft=true`)}
                        >
                          {language === 'zh' ? '预览' : 'Preview'}
                        </button>
                        <button
                          className={styles.actionLink}
                          onClick={() => {
                            const titleParam = novelTitle ? `&title=${encodeURIComponent(novelTitle)}` : '';
                            navigate(`/novel-upload?novelId=${novelId}&chapterId=${draft.id}${titleParam}`);
                          }}
                        >
                          {language === 'zh' ? '编辑' : 'Edit'}
                        </button>
                        {/* 只有最后一章才显示删除按钮 */}
                        {isLastChapter && (
                          <button
                            className={`${styles.actionLink} ${styles.deleteBtn}`}
                            onClick={() => handleDeleteClick(draft)}
                          >
                            {language === 'zh' ? '删除' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title={language === 'zh' ? '确认删除章节' : 'Confirm Delete Chapter'}
        message={
          deleteDialog.draft
            ? (language === 'zh'
                ? `确定要删除"第${deleteDialog.draft.chapter_number}章 ${deleteDialog.draft.title}"吗？\n\n此操作无法恢复，请谨慎操作。`
                : `Are you sure you want to delete "Chapter ${deleteDialog.draft.chapter_number} ${deleteDialog.draft.title}"?\n\nThis action cannot be undone. Please proceed with caution.`)
            : ''
        }
        confirmText={language === 'zh' ? '确认删除' : 'Confirm Delete'}
        cancelText={language === 'zh' ? '取消' : 'Cancel'}
        confirmButtonStyle="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default DraftBoxTab;


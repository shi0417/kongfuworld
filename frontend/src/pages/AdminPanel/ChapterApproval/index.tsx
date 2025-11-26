import React, { useState, useEffect, useCallback } from 'react';
import ChapterList from './ChapterList';
import ChapterDetail from './ChapterDetail';
import styles from './ChapterApproval.module.css';

interface Chapter {
  id: number;
  novel_id: number;
  novel_title: string;
  novel_cover?: string;
  requires_chief_edit?: boolean;
  volume_id: number;
  volume_name: string;
  chapter_number: number;
  title: string;
  word_count: number;
  author: string;
  editor_admin_id?: number;
  editor_name?: string;
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

interface ChapterDetailData extends Chapter {
  content?: string;
  translator_note?: string;
  requires_chief_edit?: boolean;
}

interface ChapterApprovalProps {
  onError?: (error: string) => void;
}

const ChapterApproval: React.FC<ChapterApprovalProps> = ({ onError }) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<ChapterDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    novel_id: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentAdminRole, setCurrentAdminRole] = useState<string>('');

  // 获取当前管理员信息
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      try {
        // 解码 JWT token（简单解码，不验证签名）
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const decoded = JSON.parse(jsonPayload);
        setCurrentAdminRole(decoded.role || '');
      } catch (error) {
        console.error('解析 token 失败:', error);
      }
    }
  }, []);

  // API请求函数
  const adminApiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('adminToken');
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };
    
    if (!(options.body instanceof FormData) && !options.headers) {
      headers['Content-Type'] = 'application/json';
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

  // 加载章节列表
  const loadChapters = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.novel_id) {
        params.append('novel_id', filters.novel_id);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }
      
      const { data } = await adminApiRequest(`/admin/chapters?${params.toString()}`);
      
      if (data.success) {
        setChapters(data.data || []);
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0
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
  }, [filters, pagination.page, pagination.limit, onError]);

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  // 加载章节详情
  const loadChapterDetail = async (chapterId: number) => {
    try {
      const { data } = await adminApiRequest(`/admin/chapter/${chapterId}`);
      
      if (data.success) {
        setSelectedChapter(data.data);
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

  // 处理章节选择
  const handleChapterSelect = (chapter: Chapter) => {
    loadChapterDetail(chapter.id);
  };

  // 处理审核
  const handleReview = async (chapterId: number, result: string, comment: string) => {
    try {
      const { data } = await adminApiRequest('/admin/chapter/review', {
        method: 'POST',
        body: JSON.stringify({
          chapter_id: chapterId,
          result,
          comment
        })
      });
      
      if (data.success) {
        if (onError) {
          onError('');
        }
        await loadChapters();
        if (selectedChapter?.id === chapterId) {
          await loadChapterDetail(chapterId);
        }
      } else {
        if (onError) {
          onError(data.message || '审核失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '审核失败');
      }
    }
  };

  // 批量审核
  const handleBatchReview = async (result: string, comment: string) => {
    if (selectedIds.length === 0) {
      if (onError) {
        onError('请先选择要审核的章节');
      }
      return;
    }

    try {
      const { data } = await adminApiRequest('/admin/chapters/batch-review', {
        method: 'POST',
        body: JSON.stringify({
          chapter_ids: selectedIds,
          result,
          comment
        })
      });
      
      if (data.success) {
        if (onError) {
          onError('');
        }
        setSelectedIds([]);
        await loadChapters();
        if (selectedChapter && selectedIds.includes(selectedChapter.id)) {
          await loadChapterDetail(selectedChapter.id);
        }
      } else {
        if (onError) {
          onError(data.message || '批量审核失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '批量审核失败');
      }
    }
  };

  // 切换上一章/下一章
  const handleNavigateChapter = (direction: 'prev' | 'next') => {
    if (!selectedChapter) return;
    
    const currentIndex = chapters.findIndex(ch => ch.id === selectedChapter.id);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex >= 0 && targetIndex < chapters.length) {
      loadChapterDetail(chapters[targetIndex].id);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.leftPanel}>
        <ChapterList
          chapters={chapters}
          loading={loading}
          filters={filters}
          pagination={pagination}
          selectedIds={selectedIds}
          selectedChapterId={selectedChapter?.id}
          onFilterChange={setFilters}
          onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
          onChapterSelect={handleChapterSelect}
          onSelectIds={setSelectedIds}
          onBatchReview={handleBatchReview}
        />
      </div>
      
      <div className={styles.rightPanel}>
        {selectedChapter ? (
          <ChapterDetail
            chapter={selectedChapter}
            currentAdminRole={currentAdminRole}
            onReview={handleReview}
            onNavigate={handleNavigateChapter}
            onClose={() => setSelectedChapter(null)}
            canNavigatePrev={chapters.findIndex(ch => ch.id === selectedChapter.id) > 0}
            canNavigateNext={chapters.findIndex(ch => ch.id === selectedChapter.id) < chapters.length - 1}
          />
        ) : (
          <div className={styles.emptyDetail}>
            <p>请从左侧列表选择一个章节查看详情</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChapterApproval;


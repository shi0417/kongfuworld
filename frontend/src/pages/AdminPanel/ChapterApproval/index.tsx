import React, { useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '../../../config';
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
  can_review?: boolean;
  chief_editor_admin_id?: number;
  chief_editor_name?: string;
  novel_editor_admin_id?: number | null;
  novel_editor_name?: string | null;
  novel_chief_editor_admin_id?: number | null;
  novel_chief_editor_name?: string | null;
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
  const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);

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
        setCurrentAdminId(decoded.id ? parseInt(decoded.id) : null);
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
    
    const base = getApiBaseUrl();
    if (!base) {
      throw new Error('API base url is not configured');
    }
    
    const response = await fetch(`${base}${endpoint}`, {
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
        // 调试日志：检查后端返回的数据
        console.log('[index.tsx] 后端返回的完整响应:', data);
        console.log('[index.tsx] 后端返回的章节详情数据:', data.data);
        console.log('[index.tsx] 字段检查:', {
          'data.data.novel_editor_admin_id': data.data?.novel_editor_admin_id,
          'data.data.novel_editor_name': data.data?.novel_editor_name,
          'data.data.novel_chief_editor_admin_id': data.data?.novel_chief_editor_admin_id,
          'data.data.novel_chief_editor_name': data.data?.novel_chief_editor_name,
          'data.data.novel_id': data.data?.novel_id
        });
        console.log('[index.tsx] JSON字符串:', JSON.stringify(data.data, null, 2));
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
            currentAdminId={currentAdminId}
            onReview={handleReview}
            onClose={() => setSelectedChapter(null)}
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


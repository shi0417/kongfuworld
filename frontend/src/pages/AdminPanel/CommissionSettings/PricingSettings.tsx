import React, { useState, useEffect, useCallback } from 'react';
import styles from './CommissionSettings.module.css';

interface PricingSettingsProps {
  onError?: (error: string) => void;
}

const PricingSettings: React.FC<PricingSettingsProps> = ({ onError }) => {
  // 章节价格设置相关状态
  const [unlockpriceList, setUnlockpriceList] = useState<any[]>([]);
  const [unlockpriceLoading, setUnlockpriceLoading] = useState(false);
  const [unlockpricePage, setUnlockpricePage] = useState(1);
  const [unlockpriceTotal, setUnlockpriceTotal] = useState(0);
  const [unlockpriceSortBy, setUnlockpriceSortBy] = useState<string>('id');
  const [unlockpriceSortOrder, setUnlockpriceSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [expandedUnlockpriceIds, setExpandedUnlockpriceIds] = useState<Set<number>>(new Set());
  const [promotionsByNovelId, setPromotionsByNovelId] = useState<{ [key: number]: any[] }>({});
  const [promotionsLoading, setPromotionsLoading] = useState<{ [key: number]: boolean }>({});
  const [editingUnlockprice, setEditingUnlockprice] = useState<any>(null);
  const [editingPromotion, setEditingPromotion] = useState<any>(null);
  const [selectedNovelDetail, setSelectedNovelDetail] = useState<any>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [chapterList, setChapterList] = useState<any[]>([]);
  const [chapterListLoading, setChapterListLoading] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  // 搜索相关状态
  const [searchType, setSearchType] = useState<'author' | 'novel'>('author');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchUserId, setSelectedSearchUserId] = useState<number | null>(null);
  const [selectedSearchNovelId, setSelectedSearchNovelId] = useState<number | null>(null);
  // 章节价格设置子选项卡
  const [pricingSubTab, setPricingSubTab] = useState<'prices' | 'promotions'>('prices');
  // 促销审批列表
  const [allPromotions, setAllPromotions] = useState<any[]>([]);
  const [allPromotionsLoading, setAllPromotionsLoading] = useState(false);
  const [allPromotionsPage, setAllPromotionsPage] = useState(1);
  const [allPromotionsTotal, setAllPromotionsTotal] = useState(0);
  const [promotionStatusFilter, setPromotionStatusFilter] = useState<string>('all');
  // 加载状态
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // 加载unlockprice列表
  const loadUnlockpriceList = useCallback(async (userId?: number | null, novelId?: number | null) => {
    try {
      setUnlockpriceLoading(true);
      const token = localStorage.getItem('adminToken');
      let url = `http://localhost:5000/api/admin/unlockprice/list?page=${unlockpricePage}&limit=20&sort_by=${unlockpriceSortBy}&sort_order=${unlockpriceSortOrder}`;
      
      if (userId) {
        url += `&user_id=${userId}`;
      }
      if (novelId) {
        url += `&novel_id=${novelId}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUnlockpriceList(data.data);
        setUnlockpriceTotal(data.pagination.total);
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '加载失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载失败');
      }
    } finally {
      setUnlockpriceLoading(false);
    }
  }, [unlockpricePage, unlockpriceSortBy, unlockpriceSortOrder, onError]);

  // 搜索用户（用于章节价格设置）
  const searchUsersForPricing = useCallback(async (keyword: string) => {
    if (!keyword || keyword.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    try {
      setSearchLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `http://localhost:5000/api/admin/users/search?q=${encodeURIComponent(keyword)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.data);
        setShowSearchResults(true);
      } else {
        if (onError) {
          onError(data.message || '搜索失败');
        }
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '搜索失败');
      }
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearchLoading(false);
    }
  }, [onError]);

  // 搜索小说（用于章节价格设置）
  const searchNovelsForPricing = useCallback(async (keyword: string) => {
    if (!keyword || keyword.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    try {
      setSearchLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `http://localhost:5000/api/admin/novels/search?q=${encodeURIComponent(keyword)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.data);
        setShowSearchResults(true);
      } else {
        if (onError) {
          onError(data.message || '搜索失败');
        }
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '搜索失败');
      }
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearchLoading(false);
    }
  }, [onError]);

  // 处理搜索输入变化（防抖）
  useEffect(() => {
    if (searchKeyword.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      if (searchType === 'author') {
        searchUsersForPricing(searchKeyword);
      } else {
        searchNovelsForPricing(searchKeyword);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchKeyword, searchType, searchUsersForPricing, searchNovelsForPricing]);

  // 选择搜索结果
  const selectSearchResult = (result: any) => {
    if (searchType === 'author') {
      setSelectedSearchUserId(result.id);
      setSelectedSearchNovelId(null);
      setSearchKeyword(`${result.username || result.pen_name || ''} (ID: ${result.id})`);
    } else {
      setSelectedSearchNovelId(result.id);
      setSelectedSearchUserId(null);
      setSearchKeyword(`${result.title || ''} (ID: ${result.id})`);
    }
    setShowSearchResults(false);
    setSearchResults([]);
  };

  // 执行查询
  const executeSearch = () => {
    // 如果输入的是纯数字ID，直接使用
    if (/^\d+$/.test(searchKeyword.trim())) {
      const id = parseInt(searchKeyword.trim());
      if (searchType === 'author') {
        setUnlockpricePage(1);
        loadUnlockpriceList(id, null);
        return;
      } else {
        setUnlockpricePage(1);
        loadUnlockpriceList(null, id);
        return;
      }
    }
    
    // 否则使用选中的结果
    if (searchType === 'author' && selectedSearchUserId) {
      setUnlockpricePage(1);
      loadUnlockpriceList(selectedSearchUserId, null);
    } else if (searchType === 'novel' && selectedSearchNovelId) {
      setUnlockpricePage(1);
      loadUnlockpriceList(null, selectedSearchNovelId);
    } else {
      if (onError) {
        onError('请先选择要查询的用户或小说，或直接输入ID');
      }
    }
  };

  // 清除搜索
  const clearSearch = () => {
    setSearchKeyword('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSelectedSearchUserId(null);
    setSelectedSearchNovelId(null);
    setUnlockpricePage(1);
    loadUnlockpriceList(null, null);
  };

  // 更新小说章节价格
  const updateNovelChapterPrices = async () => {
    if (!editingUnlockprice) return;
    
    try {
      setUpdatingPrices(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `http://localhost:5000/api/admin/novels/${editingUnlockprice.novel_id}/recalc-chapter-prices`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        if (onError) {
          const freeInfo = data.data.freeChapters ? `（其中 ${data.data.freeChapters} 个免费章节）` : '';
          onError(`成功更新 ${data.data.updated} 个章节${freeInfo}，失败 ${data.data.failed} 个`);
        }
        // 刷新章节列表（如果已打开）
        if (showChapterList) {
          loadChapterList(editingUnlockprice.novel_id);
        }
      } else {
        if (onError) {
          onError(data.message || '更新失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '更新失败');
      }
    } finally {
      setUpdatingPrices(false);
    }
  };

  // 加载章节列表
  const loadChapterList = async (novelId: number) => {
    try {
      setChapterListLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `http://localhost:5000/api/admin/novels/${novelId}/chapters`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setChapterList(data.data || []);
        setShowChapterList(true);
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '加载章节列表失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载章节列表失败');
      }
    } finally {
      setChapterListLoading(false);
    }
  };

  // 加载所有促销活动列表（用于促销审批页面）
  const loadAllPromotions = useCallback(async (page: number = 1, status?: string) => {
    try {
      setAllPromotionsLoading(true);
      const token = localStorage.getItem('adminToken');
      let url = `http://localhost:5000/api/admin/pricing-promotions?page=${page}&page_size=20`;
      if (status && status !== 'all') {
        url += `&status=${status}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.data.list) {
          // 新格式：有分页信息
          setAllPromotions(data.data.list || []);
          setAllPromotionsTotal(data.data.total || 0);
        } else {
          // 旧格式：直接是数组
          setAllPromotions(data.data || []);
          setAllPromotionsTotal(data.data?.length || 0);
        }
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '加载失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载失败');
      }
    } finally {
      setAllPromotionsLoading(false);
    }
  }, [onError]);

  // 审批促销活动
  const approvePromotion = async (promotionId: number, approved: boolean, reviewNote?: string) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/pricing-promotions/${promotionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: approved ? 'approved' : 'rejected',
          review_note: reviewNote || ''
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadAllPromotions(allPromotionsPage, promotionStatusFilter !== 'all' ? promotionStatusFilter : undefined);
        if (onError) {
          onError('');
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

  // 加载促销活动列表（根据novel_id）
  const loadPromotionsByNovelId = async (novelId: number) => {
    try {
      setPromotionsLoading(prev => ({ ...prev, [novelId]: true }));
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `http://localhost:5000/api/admin/pricing-promotions?novel_id=${novelId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setPromotionsByNovelId(prev => ({ ...prev, [novelId]: data.data }));
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '加载失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载失败');
      }
    } finally {
      setPromotionsLoading(prev => ({ ...prev, [novelId]: false }));
    }
  };

  // 切换unlockprice行展开/折叠
  const toggleUnlockpriceExpand = async (novelId: number) => {
    const newExpanded = new Set(expandedUnlockpriceIds);
    if (newExpanded.has(novelId)) {
      newExpanded.delete(novelId);
    } else {
      newExpanded.add(novelId);
      // 如果还没有加载过促销活动数据，则加载
      if (!promotionsByNovelId[novelId]) {
        await loadPromotionsByNovelId(novelId);
      }
    }
    setExpandedUnlockpriceIds(newExpanded);
  };

  // 加载小说详情
  const loadNovelDetail = async (novelId: number) => {
    try {
      setDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/novel/${novelId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedNovelDetail(data.data);
      } else {
        if (onError) {
          onError(data.message || '加载小说详情失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载小说详情失败');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  // 加载用户详情
  const loadUserDetail = async (userId: number) => {
    try {
      setDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedUserDetail(data.data);
      } else {
        if (onError) {
          onError(data.message || '加载用户详情失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载用户详情失败');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  // 保存unlockprice修改
  const saveUnlockpriceEdit = async () => {
    if (!editingUnlockprice) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/novels/${editingUnlockprice.novel_id}/unlockprice`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          karma_per_1000: editingUnlockprice.karma_per_1000,
          min_karma: editingUnlockprice.min_karma,
          max_karma: editingUnlockprice.max_karma,
          default_free_chapters: editingUnlockprice.default_free_chapters
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadUnlockpriceList(selectedSearchUserId, selectedSearchNovelId);
        setEditingUnlockprice(null);
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '保存失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  // 保存促销活动修改
  const savePromotionEdit = async () => {
    if (!editingPromotion) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/pricing-promotions/${editingPromotion.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          discount_value: editingPromotion.discount_value,
          start_at: editingPromotion.start_at,
          end_at: editingPromotion.end_at,
          status: editingPromotion.status,
          remark: editingPromotion.remark,
          review_note: editingPromotion.review_note
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 重新加载该小说的促销活动列表
        await loadPromotionsByNovelId(editingPromotion.novel_id);
        // 如果在促销审批页面，也重新加载
        if (pricingSubTab === 'promotions') {
          await loadAllPromotions(allPromotionsPage, promotionStatusFilter !== 'all' ? promotionStatusFilter : undefined);
        }
        setEditingPromotion(null);
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '保存失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  // 提交促销活动（审批通过）
  const submitPromotion = async (promotion: any) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/pricing-promotions/${promotion.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'approved'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadPromotionsByNovelId(promotion.novel_id);
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '提交失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '提交失败');
      }
    } finally {
      setSaving(false);
    }
  };

  // 当切换到章节价格设置时加载数据
  useEffect(() => {
    if (pricingSubTab === 'prices') {
      loadUnlockpriceList(selectedSearchUserId, selectedSearchNovelId);
    } else if (pricingSubTab === 'promotions') {
      loadAllPromotions(1, promotionStatusFilter !== 'all' ? promotionStatusFilter : undefined);
    }
  }, [pricingSubTab, loadUnlockpriceList, loadAllPromotions, selectedSearchUserId, selectedSearchNovelId, promotionStatusFilter]);

  // 当分页、排序、搜索参数变化时加载数据
  useEffect(() => {
    if (pricingSubTab === 'prices') {
      loadUnlockpriceList(selectedSearchUserId, selectedSearchNovelId);
    }
  }, [unlockpricePage, unlockpriceSortBy, unlockpriceSortOrder, selectedSearchUserId, selectedSearchNovelId, pricingSubTab, loadUnlockpriceList]);

  // 当切换促销审批页面时加载数据
  useEffect(() => {
    if (pricingSubTab === 'promotions') {
      loadAllPromotions(allPromotionsPage, promotionStatusFilter !== 'all' ? promotionStatusFilter : undefined);
    }
  }, [allPromotionsPage, promotionStatusFilter, pricingSubTab, loadAllPromotions]);

  return (
    <>
      {/* 子选项卡 */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', borderBottom: '2px solid #e0e0e0' }}>
        <button
          onClick={() => {
            setPricingSubTab('prices');
            setUnlockpricePage(1);
          }}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            color: pricingSubTab === 'prices' ? '#007bff' : '#666',
            cursor: 'pointer',
            borderBottom: pricingSubTab === 'prices' ? '2px solid #007bff' : '2px solid transparent',
            marginBottom: '-2px',
            fontWeight: pricingSubTab === 'prices' ? 'bold' : 'normal',
            fontSize: '16px'
          }}
        >
          章节价格设置 (unlockprice)
        </button>
        <button
          onClick={() => {
            setPricingSubTab('promotions');
            setAllPromotionsPage(1);
          }}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            color: pricingSubTab === 'promotions' ? '#007bff' : '#666',
            cursor: 'pointer',
            borderBottom: pricingSubTab === 'promotions' ? '2px solid #007bff' : '2px solid transparent',
            marginBottom: '-2px',
            fontWeight: pricingSubTab === 'promotions' ? 'bold' : 'normal',
            fontSize: '16px'
          }}
        >
          促销审批 (pricing_promotion)
        </button>
      </div>

      {/* 章节价格设置子选项卡 */}
      {pricingSubTab === 'prices' && (
        <div className={styles.paymentTable}>
          <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #e0e0e0' }}>
            {/* 标题和搜索区域在同一行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'nowrap' }}>
              <h3 style={{ margin: 0, flexShrink: 0 }}>章节价格设置 (unlockprice)</h3>
              {/* 搜索区域 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap', flex: '1', justifyContent: 'flex-end' }}>
                {/* 搜索类型下拉框 */}
                <select
                  value={searchType}
                  onChange={(e) => {
                    setSearchType(e.target.value as 'author' | 'novel');
                    setSearchKeyword('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                    setSelectedSearchUserId(null);
                    setSelectedSearchNovelId(null);
                  }}
                  style={{
                    padding: '10px 15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: 'white',
                    cursor: 'pointer',
                    width: '140px',
                    flexShrink: 0,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  <option value="author">按作者信息</option>
                  <option value="novel">按小说信息</option>
                </select>
                
                {/* 搜索输入框 */}
                <div style={{ position: 'relative', flex: '1', minWidth: '250px', maxWidth: '400px', flexShrink: 0 }}>
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchKeyword(value);
                      // 如果输入的是纯ID格式，直接设置
                      if (/^\d+$/.test(value.trim())) {
                        if (searchType === 'author') {
                          setSelectedSearchUserId(parseInt(value.trim()));
                        } else {
                          setSelectedSearchNovelId(parseInt(value.trim()));
                        }
                      } else {
                        if (searchType === 'author') {
                          setSelectedSearchUserId(null);
                        } else {
                          setSelectedSearchNovelId(null);
                        }
                      }
                    }}
                    onFocus={() => {
                      if (searchKeyword.trim() !== '' && searchResults.length > 0) {
                        setShowSearchResults(true);
                      }
                    }}
                    placeholder={searchType === 'author' ? '输入作者ID、用户名、笔名、邮箱等...' : '输入小说ID、标题、作者等...'}
                    style={{
                      width: '100%',
                      padding: '10px 15px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'border-color 0.3s'
                    }}
                    onBlur={() => {
                      // 延迟隐藏，以便点击搜索结果
                      setTimeout(() => setShowSearchResults(false), 200);
                    }}
                  />
                  {/* 搜索结果下拉列表 */}
                  {showSearchResults && searchResults.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      marginTop: '4px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                      {searchLoading ? (
                        <div style={{ padding: '15px', textAlign: 'center', color: '#666' }}>搜索中...</div>
                      ) : searchResults.length === 0 ? (
                        <div style={{ padding: '15px', textAlign: 'center', color: '#999' }}>未找到结果</div>
                      ) : (
                        searchResults.map((result) => (
                          <div
                            key={result.id}
                            onClick={() => selectSearchResult(result)}
                            style={{
                              padding: '12px 15px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f0f0f0',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                          >
                            {searchType === 'author' ? (
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                                  {result.username || result.pen_name || `用户${result.id}`}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                  ID: {result.id}
                                  {result.email && ` | 邮箱: ${result.email}`}
                                  {result.pen_name && ` | 笔名: ${result.pen_name}`}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                                  {result.title || `小说${result.id}`}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                  ID: {result.id}
                                  {result.author && ` | 作者: ${result.author}`}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                
                {/* 查询按钮 */}
                <button
                  onClick={executeSearch}
                  disabled={searchLoading || (!selectedSearchUserId && !selectedSearchNovelId && !/^\d+$/.test(searchKeyword.trim()))}
                  style={{
                    padding: '10px 24px',
                    background: (!selectedSearchUserId && !selectedSearchNovelId && !/^\d+$/.test(searchKeyword.trim())) ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: (!selectedSearchUserId && !selectedSearchNovelId && !/^\d+$/.test(searchKeyword.trim())) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(0,123,255,0.3)',
                    transition: 'all 0.3s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    height: '42px',
                    marginLeft: '12px'
                  }}
                  onMouseEnter={(e) => {
                    if (!(!selectedSearchUserId && !selectedSearchNovelId && !/^\d+$/.test(searchKeyword.trim()))) {
                      e.currentTarget.style.background = '#0056b3';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,123,255,0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(!selectedSearchUserId && !selectedSearchNovelId && !/^\d+$/.test(searchKeyword.trim()))) {
                      e.currentTarget.style.background = '#007bff';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,123,255,0.3)';
                    }
                  }}
                >
                  {searchLoading ? '查询中...' : '查询'}
                </button>
                
                {/* 清除按钮 */}
                {(selectedSearchUserId || selectedSearchNovelId || searchKeyword) && (
                  <button
                    onClick={clearSearch}
                    style={{
                      padding: '10px 20px',
                      background: '#f8f9fa',
                      color: '#666',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      height: '42px',
                      marginLeft: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e9ecef';
                      e.currentTarget.style.borderColor = '#adb5bd';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f8f9fa';
                      e.currentTarget.style.borderColor = '#ddd';
                    }}
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    ID
                    <span
                      onClick={() => {
                        setUnlockpriceSortBy('id');
                        setUnlockpriceSortOrder(unlockpriceSortBy === 'id' && unlockpriceSortOrder === 'ASC' ? 'DESC' : 'ASC');
                      }}
                      style={{ cursor: 'pointer', fontSize: '12px' }}
                      title="点击排序"
                    >
                      {unlockpriceSortBy === 'id' ? (unlockpriceSortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                    </span>
                  </div>
                </th>
                <th>用户ID</th>
                <th>用户名称</th>
                <th>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    小说ID
                    <span
                      onClick={() => {
                        setUnlockpriceSortBy('novel_id');
                        setUnlockpriceSortOrder(unlockpriceSortBy === 'novel_id' && unlockpriceSortOrder === 'ASC' ? 'DESC' : 'ASC');
                      }}
                      style={{ cursor: 'pointer', fontSize: '12px' }}
                      title="点击排序"
                    >
                      {unlockpriceSortBy === 'novel_id' ? (unlockpriceSortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                    </span>
                  </div>
                </th>
                <th>小说标题</th>
                <th>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    每千字Karma
                    <span
                      onClick={() => {
                        setUnlockpriceSortBy('karma_per_1000');
                        setUnlockpriceSortOrder(unlockpriceSortBy === 'karma_per_1000' && unlockpriceSortOrder === 'ASC' ? 'DESC' : 'ASC');
                      }}
                      style={{ cursor: 'pointer', fontSize: '12px' }}
                      title="点击排序"
                    >
                      {unlockpriceSortBy === 'karma_per_1000' ? (unlockpriceSortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                    </span>
                  </div>
                </th>
                <th>最低Karma</th>
                <th>最高Karma</th>
                <th>默认免费章节数</th>
                <th>创建时间</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {unlockpriceLoading ? (
                <tr>
                  <td colSpan={11} className={styles.emptyCell}>加载中...</td>
                </tr>
              ) : unlockpriceList.length === 0 ? (
                <tr>
                  <td colSpan={11} className={styles.emptyCell}>暂无数据</td>
                </tr>
              ) : (
                unlockpriceList.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleUnlockpriceExpand(item.novel_id)}
                    >
                      <td>{item.id}</td>
                      <td>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            loadUserDetail(item.user_id);
                          }}
                          style={{
                            color: '#007bff',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                          title="点击查看用户详情"
                        >
                          {item.user_id}
                        </span>
                      </td>
                      <td>{item.user_username || item.user_pen_name || '—'}</td>
                      <td>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            loadNovelDetail(item.novel_id);
                          }}
                          style={{
                            color: '#007bff',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                          title="点击查看小说详情"
                        >
                          {item.novel_id}
                        </span>
                      </td>
                      <td>{item.novel_title || '—'}</td>
                      <td>{item.karma_per_1000}</td>
                      <td>{item.min_karma}</td>
                      <td>{item.max_karma}</td>
                      <td>{item.default_free_chapters}</td>
                      <td>{new Date(item.created_at).toLocaleString('zh-CN')}</td>
                      <td>{item.updated_at ? new Date(item.updated_at).toLocaleString('zh-CN') : '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEditingUnlockprice({ ...item })}
                          style={{
                            padding: '5px 10px',
                            fontSize: '12px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          修改
                        </button>
                      </td>
                    </tr>
                    {expandedUnlockpriceIds.has(item.novel_id) && (
                      <tr>
                        <td colSpan={11} style={{ padding: '20px', background: '#f9f9f9' }}>
                          <div style={{ marginLeft: '20px' }}>
                            <h4 style={{ margin: '0 0 15px 0', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>
                              优惠活动审批列表 (pricing_promotion)
                            </h4>
                            {promotionsLoading[item.novel_id] ? (
                              <div>加载中...</div>
                            ) : promotionsByNovelId[item.novel_id] && promotionsByNovelId[item.novel_id].length > 0 ? (
                              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                                <thead>
                                  <tr style={{ background: '#f0f0f0' }}>
                                    <th style={{ padding: '10px', border: '1px solid #ddd' }}>ID</th>
                                    <th style={{ padding: '10px', border: '1px solid #ddd' }}>活动类型</th>
                                    <th style={{ padding: '10px', border: '1px solid #ddd' }}>折扣值</th>
                                    <th style={{ padding: '10px', border: '1px solid #ddd' }}>开始时间</th>
                                    <th style={{ padding: '10px', border: '1px solid #ddd' }}>结束时间</th>
                                    <th style={{ padding: '10px', border: '1px solid #ddd' }}>状态</th>
                                    <th style={{ padding: '10px', border: '1px solid #ddd' }}>备注</th>
                                    <th style={{ padding: '10px', border: '1px solid #ddd' }}>操作</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {promotionsByNovelId[item.novel_id].map((promotion: any) => (
                                    <tr key={promotion.id}>
                                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>{promotion.id}</td>
                                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        {promotion.promotion_type === 'discount' ? '折扣' : promotion.promotion_type}
                                      </td>
                                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        {(promotion.discount_value * 100).toFixed(2)}%
                                      </td>
                                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        {new Date(promotion.start_at).toLocaleString('zh-CN')}
                                      </td>
                                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        {new Date(promotion.end_at).toLocaleString('zh-CN')}
                                      </td>
                                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        <span style={{
                                          color: promotion.status === 'approved' ? '#28a745' : 
                                                 promotion.status === 'rejected' ? '#dc3545' : 
                                                 promotion.status === 'active' ? '#007bff' : '#666'
                                        }}>
                                          {promotion.status === 'approved' ? '已批准' : 
                                           promotion.status === 'rejected' ? '已拒绝' : 
                                           promotion.status === 'active' ? '进行中' : 
                                           promotion.status === 'scheduled' ? '已安排' : promotion.status}
                                        </span>
                                      </td>
                                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        {promotion.remark || '—'}
                                      </td>
                                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        <button
                                          onClick={() => setEditingPromotion({ ...promotion })}
                                          style={{
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            background: '#007bff',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            marginRight: '5px'
                                          }}
                                        >
                                          修改
                                        </button>
                                        {promotion.status === 'pending' && (
                                          <button
                                            onClick={() => submitPromotion(promotion)}
                                            style={{
                                              padding: '4px 8px',
                                              fontSize: '12px',
                                              background: '#28a745',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '3px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            提交
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>暂无优惠活动</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
          {/* 分页 */}
          {unlockpriceTotal > 20 && (
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setUnlockpricePage(Math.max(1, unlockpricePage - 1))}
                disabled={unlockpricePage === 1}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  background: unlockpricePage === 1 ? '#f5f5f5' : 'white',
                  cursor: unlockpricePage === 1 ? 'not-allowed' : 'pointer',
                  borderRadius: '4px'
                }}
              >
                上一页
              </button>
              <span>
                第 {unlockpricePage} 页，共 {Math.ceil(unlockpriceTotal / 20)} 页（共 {unlockpriceTotal} 条）
              </span>
              <button
                onClick={() => setUnlockpricePage(Math.min(Math.ceil(unlockpriceTotal / 20), unlockpricePage + 1))}
                disabled={unlockpricePage >= Math.ceil(unlockpriceTotal / 20)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  background: unlockpricePage >= Math.ceil(unlockpriceTotal / 20) ? '#f5f5f5' : 'white',
                  cursor: unlockpricePage >= Math.ceil(unlockpriceTotal / 20) ? 'not-allowed' : 'pointer',
                  borderRadius: '4px'
                }}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      {/* 促销审批子选项卡 */}
      {pricingSubTab === 'promotions' && (
        <div className={styles.paymentTable}>
          <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #e0e0e0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'nowrap' }}>
              <h3 style={{ margin: 0, flexShrink: 0 }}>促销审批 (pricing_promotion)</h3>
              {/* 状态筛选 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <select
                  value={promotionStatusFilter}
                  onChange={(e) => {
                    setPromotionStatusFilter(e.target.value);
                    setAllPromotionsPage(1);
                  }}
                  style={{
                    padding: '10px 15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: 'white',
                    cursor: 'pointer',
                    height: '42px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="all">全部状态</option>
                  <option value="pending">待审核</option>
                  <option value="approved">已批准</option>
                  <option value="rejected">已拒绝</option>
                  <option value="scheduled">已安排</option>
                  <option value="active">进行中</option>
                  <option value="expired">已过期</option>
                </select>
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>小说ID</th>
                  <th>小说标题</th>
                  <th>活动类型</th>
                  <th>折扣值</th>
                  <th>开始时间</th>
                  <th>结束时间</th>
                  <th>状态</th>
                  <th>发起人</th>
                  <th>发起角色</th>
                  <th>审核人</th>
                  <th>审核时间</th>
                  <th>备注</th>
                  <th>平台回复</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {allPromotionsLoading ? (
                  <tr>
                    <td colSpan={16} className={styles.emptyCell}>加载中...</td>
                  </tr>
                ) : allPromotions.length === 0 ? (
                  <tr>
                    <td colSpan={16} className={styles.emptyCell}>暂无数据</td>
                  </tr>
                ) : (
                  allPromotions.map((promotion) => (
                    <tr key={promotion.id}>
                      <td>{promotion.id}</td>
                      <td>
                        <span
                          onClick={() => loadNovelDetail(promotion.novel_id)}
                          style={{ color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {promotion.novel_id}
                        </span>
                      </td>
                      <td>{promotion.novel_title || '—'}</td>
                      <td>{promotion.promotion_type === 'discount' ? '折扣' : promotion.promotion_type === 'free' ? '限时免费' : promotion.promotion_type}</td>
                      <td>{(promotion.discount_value * 100).toFixed(2)}%</td>
                      <td>{new Date(promotion.start_at).toLocaleString('zh-CN')}</td>
                      <td>{new Date(promotion.end_at).toLocaleString('zh-CN')}</td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: promotion.status === 'approved' ? '#d4edda' : 
                                     promotion.status === 'rejected' ? '#f8d7da' : 
                                     promotion.status === 'pending' ? '#fff3cd' : 
                                     promotion.status === 'active' ? '#d1ecf1' : 
                                     promotion.status === 'scheduled' ? '#e2e3e5' : '#f5c6cb',
                          color: promotion.status === 'approved' ? '#155724' : 
                                promotion.status === 'rejected' ? '#721c24' : 
                                promotion.status === 'pending' ? '#856404' : 
                                promotion.status === 'active' ? '#0c5460' : 
                                promotion.status === 'scheduled' ? '#383d41' : '#721c24'
                        }}>
                          {promotion.status === 'pending' ? '待审核' : 
                           promotion.status === 'approved' ? '已批准' : 
                           promotion.status === 'rejected' ? '已拒绝' : 
                           promotion.status === 'scheduled' ? '已安排' : 
                           promotion.status === 'active' ? '进行中' : 
                           promotion.status === 'expired' ? '已过期' : promotion.status}
                        </span>
                      </td>
                      <td>{promotion.author_username || promotion.author_pen_name || `用户${promotion.created_by}`}</td>
                      <td>{promotion.created_role === 'author' ? '作者' : '管理员'}</td>
                      <td>{promotion.approved_by ? `用户${promotion.approved_by}` : '—'}</td>
                      <td>{promotion.approved_at ? new Date(promotion.approved_at).toLocaleString('zh-CN') : '—'}</td>
                      <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={promotion.remark || ''}>
                        {promotion.remark || '—'}
                      </td>
                      <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={promotion.review_note || ''}>
                        {promotion.review_note || '—'}
                      </td>
                      <td>{new Date(promotion.created_at).toLocaleString('zh-CN')}</td>
                      <td>
                        <button
                          onClick={() => setEditingPromotion({ ...promotion })}
                          style={{
                            padding: '5px 10px',
                            fontSize: '12px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginRight: '5px'
                          }}
                        >
                          修改
                        </button>
                        {promotion.status === 'pending' && (
                          <>
                            <button
                              onClick={() => approvePromotion(promotion.id, true)}
                              disabled={saving}
                              style={{
                                padding: '5px 10px',
                                fontSize: '12px',
                                background: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                marginRight: '5px'
                              }}
                            >
                              批准
                            </button>
                            <button
                              onClick={() => approvePromotion(promotion.id, false)}
                              disabled={saving}
                              style={{
                                padding: '5px 10px',
                                fontSize: '12px',
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: saving ? 'not-allowed' : 'pointer'
                              }}
                            >
                              拒绝
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {allPromotionsTotal > 0 && (
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => {
                  const newPage = Math.max(1, allPromotionsPage - 1);
                  setAllPromotionsPage(newPage);
                }}
                disabled={allPromotionsPage === 1}
                style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: allPromotionsPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                上一页
              </button>
              <span style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                第 {allPromotionsPage} 页，共 {Math.ceil(allPromotionsTotal / 20)} 页
              </span>
              <button
                onClick={() => {
                  const newPage = allPromotionsPage + 1;
                  setAllPromotionsPage(newPage);
                }}
                disabled={allPromotionsPage >= Math.ceil(allPromotionsTotal / 20)}
                style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: allPromotionsPage >= Math.ceil(allPromotionsTotal / 20) ? 'not-allowed' : 'pointer' }}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      {/* 小说详情模态框 */}
      {selectedNovelDetail && (
        <div className={styles.modal} onClick={() => setSelectedNovelDetail(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className={styles.modalHeader}>
              <h2>小说详情</h2>
              <button onClick={() => setSelectedNovelDetail(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              {detailLoading ? (
                <div className={styles.loading}>加载中...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>基本信息</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#666' }}>小说ID:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedNovelDetail.id}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>标题:</strong>
                        <span style={{ marginLeft: '10px', color: '#333', fontWeight: 'bold' }}>{selectedNovelDetail.title}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>作者:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedNovelDetail.author_name || selectedNovelDetail.author || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>笔名:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedNovelDetail.pen_name || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>状态:</strong>
                        <span style={{ marginLeft: '10px', color: selectedNovelDetail.status === 'published' ? '#28a745' : '#666' }}>
                          {selectedNovelDetail.status === 'published' ? '已发布' : selectedNovelDetail.status === 'draft' ? '草稿' : selectedNovelDetail.status}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>审核状态:</strong>
                        <span style={{ marginLeft: '10px', color: selectedNovelDetail.review_status === 'approved' ? '#28a745' : '#666' }}>
                          {selectedNovelDetail.review_status === 'approved' ? '已通过' : selectedNovelDetail.review_status === 'pending' ? '待审核' : selectedNovelDetail.review_status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>其他信息</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {selectedNovelDetail.description && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong style={{ color: '#666' }}>简介:</strong>
                          <p style={{ marginLeft: '10px', marginTop: '5px', color: '#666', lineHeight: '1.6' }}>{selectedNovelDetail.description}</p>
                        </div>
                      )}
                      <div>
                        <strong style={{ color: '#666' }}>创建时间:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedNovelDetail.created_at ? new Date(selectedNovelDetail.created_at).toLocaleString('zh-CN') : '—'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>更新时间:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedNovelDetail.updated_at ? new Date(selectedNovelDetail.updated_at).toLocaleString('zh-CN') : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 用户详情模态框 */}
      {selectedUserDetail && (
        <div className={styles.modal} onClick={() => setSelectedUserDetail(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className={styles.modalHeader}>
              <h2>用户详情</h2>
              <button onClick={() => setSelectedUserDetail(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              {detailLoading ? (
                <div className={styles.loading}>加载中...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>基本信息</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#666' }}>用户ID:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.id}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>用户名:</strong>
                        <span style={{ marginLeft: '10px', color: '#333', fontWeight: 'bold' }}>{selectedUserDetail.username || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>邮箱:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.email || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>笔名:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.pen_name || '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>其他信息</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#666' }}>创建时间:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedUserDetail.created_at ? new Date(selectedUserDetail.created_at).toLocaleString('zh-CN') : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 编辑unlockprice模态框 */}
      {editingUnlockprice && (
        <div className={styles.modal} onClick={() => setEditingUnlockprice(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h2>修改章节价格设置</h2>
              <button onClick={() => setEditingUnlockprice(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#666' }}>记录ID:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>{editingUnlockprice.id}</span>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#666' }}>用户ID:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>{editingUnlockprice.user_id} (不可修改)</span>
                </div>
                <div>
                  <strong style={{ color: '#666' }}>小说ID:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>{editingUnlockprice.novel_id} (不可修改)</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    每千字Karma:
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingUnlockprice.karma_per_1000 || ''}
                    onChange={(e) => setEditingUnlockprice({ ...editingUnlockprice, karma_per_1000: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    最低Karma:
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingUnlockprice.min_karma || ''}
                    onChange={(e) => setEditingUnlockprice({ ...editingUnlockprice, min_karma: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    最高Karma:
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingUnlockprice.max_karma || ''}
                    onChange={(e) => setEditingUnlockprice({ ...editingUnlockprice, max_karma: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    默认免费章节数:
                  </label>
                  <input
                    type="number"
                    value={editingUnlockprice.default_free_chapters || ''}
                    onChange={(e) => setEditingUnlockprice({ ...editingUnlockprice, default_free_chapters: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  />
                </div>
              </div>

              {/* 操作按钮区域 */}
              <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #e0e0e0' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <button
                    onClick={updateNovelChapterPrices}
                    disabled={updatingPrices || saving}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      background: updatingPrices ? '#ccc' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: updatingPrices ? 'not-allowed' : 'pointer',
                      boxShadow: updatingPrices ? 'none' : '0 2px 4px rgba(40,167,69,0.3)',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      if (!updatingPrices && !saving) {
                        e.currentTarget.style.background = '#218838';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(40,167,69,0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!updatingPrices && !saving) {
                        e.currentTarget.style.background = '#28a745';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(40,167,69,0.3)';
                      }
                    }}
                  >
                    {updatingPrices ? '更新中...' : '更新小说价格'}
                  </button>
                  <button
                    onClick={() => loadChapterList(editingUnlockprice.novel_id)}
                    disabled={chapterListLoading || saving}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      background: chapterListLoading ? '#ccc' : '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: chapterListLoading ? 'not-allowed' : 'pointer',
                      boxShadow: chapterListLoading ? 'none' : '0 2px 4px rgba(23,162,184,0.3)',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      if (!chapterListLoading && !saving) {
                        e.currentTarget.style.background = '#138496';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(23,162,184,0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!chapterListLoading && !saving) {
                        e.currentTarget.style.background = '#17a2b8';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(23,162,184,0.3)';
                      }
                    }}
                  >
                    {chapterListLoading ? '加载中...' : '查看小说章节价格'}
                  </button>
                </div>
              </div>

              <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                <button
                  onClick={saveUnlockpriceEdit}
                  className={styles.approveButton}
                  disabled={saving || updatingPrices}
                  style={{ marginRight: '10px' }}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditingUnlockprice(null)}
                  className={styles.rejectButton}
                  disabled={saving || updatingPrices}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑促销活动模态框 */}
      {editingPromotion && (
        <div className={styles.modal} onClick={() => setEditingPromotion(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className={styles.modalHeader}>
              <h2>修改优惠活动</h2>
              <button onClick={() => setEditingPromotion(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#666' }}>活动ID:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>{editingPromotion.id}</span>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#666' }}>小说ID:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>{editingPromotion.novel_id}</span>
                </div>
                <div>
                  <strong style={{ color: '#666' }}>活动类型:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>
                    {editingPromotion.promotion_type === 'discount' ? '折扣' : editingPromotion.promotion_type}
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    折扣值 (0-1):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={editingPromotion.discount_value || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, discount_value: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  />
                  <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                    当前折扣: {(editingPromotion.discount_value * 100).toFixed(2)}%
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    开始时间:
                  </label>
                  <input
                    type="datetime-local"
                    value={editingPromotion.start_at ? new Date(editingPromotion.start_at).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, start_at: new Date(e.target.value).toISOString() })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    结束时间:
                  </label>
                  <input
                    type="datetime-local"
                    value={editingPromotion.end_at ? new Date(editingPromotion.end_at).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, end_at: new Date(e.target.value).toISOString() })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    状态:
                  </label>
                  <select
                    value={editingPromotion.status || 'pending'}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, status: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  >
                    <option value="pending">待审核</option>
                    <option value="approved">已批准</option>
                    <option value="rejected">已拒绝</option>
                    <option value="scheduled">已安排</option>
                    <option value="active">进行中</option>
                    <option value="expired">已过期</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    备注:
                  </label>
                  <textarea
                    value={editingPromotion.remark || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, remark: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', minHeight: '80px' }}
                    placeholder="可选备注信息"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    审核备注:
                  </label>
                  <textarea
                    value={editingPromotion.review_note || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, review_note: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', minHeight: '80px' }}
                    placeholder="审核备注信息"
                  />
                </div>
              </div>

              <div className={styles.modalActions} style={{ marginTop: '25px' }}>
                <button
                  onClick={savePromotionEdit}
                  className={styles.approveButton}
                  disabled={saving}
                  style={{ marginRight: '10px' }}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditingPromotion(null)}
                  className={styles.rejectButton}
                  disabled={saving}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 章节列表模态框 */}
      {showChapterList && editingUnlockprice && (
        <div className={styles.modal} onClick={() => setShowChapterList(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px', maxHeight: '90vh' }}>
            <div className={styles.modalHeader}>
              <h2>小说章节价格列表</h2>
              <button onClick={() => setShowChapterList(false)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody} style={{ maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '14px' }}>
                  <div>
                    <strong style={{ color: '#666' }}>小说ID:</strong>
                    <span style={{ marginLeft: '10px', color: '#333' }}>{editingUnlockprice.novel_id}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#666' }}>小说标题:</strong>
                    <span style={{ marginLeft: '10px', color: '#333' }}>{editingUnlockprice.novel_title || '—'}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#666' }}>总章节数:</strong>
                    <span style={{ marginLeft: '10px', color: '#333' }}>{chapterList.length}</span>
                  </div>
                </div>
              </div>

              {chapterListLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>加载中...</div>
              ) : chapterList.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>暂无章节数据</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 10 }}>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>卷轴号</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>章节号</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>章节名称</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold', color: '#333' }}>解锁价格</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>提前章节</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold', color: '#333' }}>字数</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>审核状态</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', color: '#333' }}>定时发布</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold', color: '#333' }}>发布时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chapterList.map((chapter, index) => (
                        <tr 
                          key={chapter.id}
                          style={{ 
                            background: index % 2 === 0 ? 'white' : '#f8f9fa',
                            transition: 'background-color 0.2s',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e7f3ff'}
                          onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#f8f9fa'}
                          onClick={() => {
                            // 在新标签页打开章节阅读页面
                            const url = `/novel/${editingUnlockprice.novel_id}/chapter/${chapter.id}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', color: '#333' }}>
                            {chapter.volume_id || '—'}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', color: '#333', fontWeight: '500' }}>
                            {chapter.chapter_number}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', color: '#333' }}>
                            {chapter.title}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right', color: '#28a745', fontWeight: 'bold' }}>
                            {chapter.unlock_price > 0 ? `${chapter.unlock_price} Karma` : '免费'}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500',
                              background: chapter.is_advance ? '#fff3cd' : '#d1ecf1',
                              color: chapter.is_advance ? '#856404' : '#0c5460'
                            }}>
                              {chapter.is_advance ? '是' : '否'}
                            </span>
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right', color: '#666' }}>
                            {chapter.word_count.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500',
                              background: chapter.review_status === 'approved' ? '#d4edda' : 
                                         chapter.review_status === 'rejected' ? '#f8d7da' : '#fff3cd',
                              color: chapter.review_status === 'approved' ? '#155724' : 
                                     chapter.review_status === 'rejected' ? '#721c24' : '#856404'
                            }}>
                              {chapter.review_status === 'approved' ? '已通过' : 
                               chapter.review_status === 'rejected' ? '已拒绝' : 
                               chapter.review_status === 'pending' ? '待审核' : chapter.review_status}
                            </span>
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500',
                              background: chapter.is_released ? '#d1ecf1' : '#f8d7da',
                              color: chapter.is_released ? '#0c5460' : '#721c24'
                            }}>
                              {chapter.is_released ? '是' : '否'}
                            </span>
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', color: '#666', fontSize: '13px' }}>
                            {chapter.release_date ? new Date(chapter.release_date).toLocaleString('zh-CN') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ padding: '15px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowChapterList(false)}
                style={{
                  padding: '10px 24px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#5a6268';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#6c757d';
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PricingSettings;


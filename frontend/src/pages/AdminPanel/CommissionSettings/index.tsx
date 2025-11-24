import React, { useState, useEffect, useCallback } from 'react';
import styles from './CommissionSettings.module.css';

interface CommissionSettingsProps {
  onError?: (error: string) => void;
}

// 辅助函数：将数据库日期格式转换为 datetime-local 输入框需要的格式
const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  
  // 如果已经是正确的格式，直接返回
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  try {
    // 处理 MySQL DATETIME 格式 (2025-01-01 00:00:00) 或 ISO 格式
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // 获取本地时间的各个部分
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // 返回 datetime-local 需要的格式: YYYY-MM-DDTHH:mm
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error('日期格式转换错误:', error);
    return '';
  }
};

const CommissionSettings: React.FC<CommissionSettingsProps> = ({ onError }) => {
  const [commissionSettingsTab, setCommissionSettingsTab] = useState<'plans' | 'karma' | 'author'>('plans');
  const [promotionSubTab, setPromotionSubTab] = useState<'plans' | 'referrals'>('plans'); // 推广分成方案子选项卡
  const [commissionPlans, setCommissionPlans] = useState<any[]>([]);
  const [commissionPlansLoading, setCommissionPlansLoading] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsPage, setReferralsPage] = useState(1);
  const [referralsTotal, setReferralsTotal] = useState(0);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [selectedPlanDetail, setSelectedPlanDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<number>>(new Set());
  const [planLevels, setPlanLevels] = useState<{ [key: number]: any[] }>({});
  const [planLevelsLoading, setPlanLevelsLoading] = useState<{ [key: number]: boolean }>({});
  const [editingLevel, setEditingLevel] = useState<{ id: number; percent: number } | null>(null);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [creatingPlan, setCreatingPlan] = useState<any>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [karmaRates, setKarmaRates] = useState<any[]>([]);
  const [karmaRatesLoading, setKarmaRatesLoading] = useState(false);
  const [authorRoyaltyPlans, setAuthorRoyaltyPlans] = useState<any[]>([]);
  const [authorRoyaltyPlansLoading, setAuthorRoyaltyPlansLoading] = useState(false);
  const [selectedAuthorPlan, setSelectedAuthorPlan] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // 加载推广分成方案列表
  const loadCommissionPlans = async () => {
    try {
      setCommissionPlansLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/commission-plans', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCommissionPlans(data.data);
        if (onError) {
          onError(''); // 清除错误
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
      setCommissionPlansLoading(false);
    }
  };

  // 加载方案层级数据
  const loadPlanLevels = async (planId: number) => {
    try {
      setPlanLevelsLoading(prev => ({ ...prev, [planId]: true }));
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/commission-plans/${planId}/levels`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPlanLevels(prev => ({ ...prev, [planId]: data.data }));
        if (onError) {
          onError(''); // 清除错误
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
      setPlanLevelsLoading(prev => ({ ...prev, [planId]: false }));
    }
  };

  // 切换行展开/折叠
  const togglePlanExpand = async (planId: number) => {
    const newExpanded = new Set(expandedPlanIds);
    if (newExpanded.has(planId)) {
      newExpanded.delete(planId);
    } else {
      newExpanded.add(planId);
      // 如果还没有加载过层级数据，则加载
      if (!planLevels[planId]) {
        await loadPlanLevels(planId);
      }
    }
    setExpandedPlanIds(newExpanded);
  };

  // 更新层级比例
  const updateLevelPercent = async (levelId: number, percent: number) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/commission-plan-levels/${levelId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ percent })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 更新本地状态
        const planId = Object.keys(planLevels).find(key => 
          planLevels[parseInt(key)].some((l: any) => l.id === levelId)
        );
        if (planId) {
          const updatedLevels = planLevels[parseInt(planId)].map((l: any) =>
            l.id === levelId ? { ...l, percent } : l
          );
          setPlanLevels(prev => ({ ...prev, [parseInt(planId)]: updatedLevels }));
        }
        setEditingLevel(null);
        if (onError) {
          onError('');
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
    }
  };

  // 创建新层级
  const createLevel = async (planId: number, planMaxLevel: number) => {
    try {
      // 获取当前已有的层级
      const currentLevels = planLevels[planId] || [];
      const existingLevels = currentLevels.map((l: any) => l.level).sort((a: number, b: number) => a - b);
      
      // 找到下一个应该添加的层级（从1开始，找到第一个缺失的）
      let nextLevel = 1;
      for (let i = 1; i <= planMaxLevel; i++) {
        if (!existingLevels.includes(i)) {
          nextLevel = i;
          break;
        }
      }
      
      // 如果所有层级都已存在，则不再添加
      if (nextLevel > planMaxLevel) {
        if (onError) {
          onError(`已达到最大层级 ${planMaxLevel}`);
        }
        return;
      }
      
      // 默认比例为0.01 (1%)
      const defaultPercent = 0.01;
      
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/commission-plan-levels', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_id: planId,
          level: nextLevel,
          percent: defaultPercent
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 重新加载层级列表
        await loadPlanLevels(planId);
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '创建失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '创建失败');
      }
    }
  };

  // 保存方案修改
  const savePlanEdit = async () => {
    if (!editingPlan) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/commission-plans', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingPlan)
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadCommissionPlans();
        setEditingPlan(null);
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

  // 搜索用户
  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.trim() === '') {
      setUserSearchResults([]);
      return;
    }
    
    try {
      setUserSearchLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserSearchResults(data.data);
      } else {
        if (onError) {
          onError(data.message || '搜索失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '搜索失败');
      }
    } finally {
      setUserSearchLoading(false);
    }
  }, [onError]);

  // 处理用户搜索输入
  const handleUserSearchChange = (value: string) => {
    setUserSearchQuery(value);
    if (value.trim() !== '') {
      setShowUserSearch(true);
    } else {
      setShowUserSearch(false);
      setUserSearchResults([]);
      if (creatingPlan) {
        setCreatingPlan({ ...creatingPlan, owner_user_id: null });
      }
    }
  };

  // 延迟搜索用户（防抖）
  useEffect(() => {
    if (userSearchQuery.trim() === '') {
      setUserSearchResults([]);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      if (userSearchQuery.trim() !== '') {
        searchUsers(userSearchQuery);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [userSearchQuery, searchUsers]);

  // 选择用户
  const selectUser = (user: any) => {
    if (creatingPlan) {
      setCreatingPlan({ ...creatingPlan, owner_user_id: user.id });
    }
    setUserSearchQuery(`${user.username} (ID: ${user.id})`);
    setShowUserSearch(false);
    setUserSearchResults([]);
  };

  // 保存新建方案
  const saveNewPlan = async () => {
    if (!creatingPlan) return;
    
    if (!creatingPlan.name || !creatingPlan.plan_type) {
      if (onError) {
        onError('请填写方案名称和类型');
      }
      return;
    }
    
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/commission-plans', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(creatingPlan)
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadCommissionPlans();
        setCreatingPlan(null);
        setUserSearchQuery('');
        setUserSearchResults([]);
        setShowUserSearch(false);
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '创建失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '创建失败');
      }
    } finally {
      setSaving(false);
    }
  };

  // 加载Karma汇率列表
  const loadKarmaRates = async () => {
    try {
      setKarmaRatesLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/karma-rates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setKarmaRates(data.data);
        if (onError) {
          onError(''); // 清除错误
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
      setKarmaRatesLoading(false);
    }
  };

  // 加载作者分成方案列表
  const loadAuthorRoyaltyPlans = async () => {
    try {
      setAuthorRoyaltyPlansLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/author-royalty-plans', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAuthorRoyaltyPlans(data.data);
        if (onError) {
          onError(''); // 清除错误
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
      setAuthorRoyaltyPlansLoading(false);
    }
  };

  // 加载推广关系列表
  const loadReferrals = async (page: number = 1) => {
    try {
      setReferralsLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/referrals?page=${page}&page_size=20`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setReferrals(data.data.list || []);
        setReferralsTotal(data.data.total || 0);
        if (onError) {
          onError(''); // 清除错误
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
      setReferralsLoading(false);
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

  // 加载方案详情（包含层级信息）
  const loadPlanDetail = async (planId: number) => {
    try {
      setDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/commission-plans/${planId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedPlanDetail(data.data);
      } else {
        if (onError) {
          onError(data.message || '加载方案详情失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载方案详情失败');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    loadCommissionPlans();
    loadKarmaRates();
    loadAuthorRoyaltyPlans();
  }, []);

  // 当切换到推广关系列表时加载数据
  useEffect(() => {
    if (commissionSettingsTab === 'plans' && promotionSubTab === 'referrals') {
      loadReferrals(referralsPage);
    }
  }, [commissionSettingsTab, promotionSubTab, referralsPage]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>提成设置</h2>
      </div>

      {/* 操作栏 - 所有Tab共用 */}
      <div style={{ marginTop: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {commissionSettingsTab === 'plans' && (
            <button
              onClick={() => {
                setCreatingPlan({ 
                  plan_type: 'reader_promoter', 
                  max_level: 3, 
                  levels: [],
                  is_custom: 0,
                  start_date: new Date().toISOString().slice(0, 16)
                });
                setUserSearchQuery('');
                setUserSearchResults([]);
                setShowUserSearch(false);
              }}
              style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              新建方案
            </button>
          )}
          {commissionSettingsTab === 'karma' && (
            <button
              onClick={() => {
                // TODO: 打开新增汇率弹窗
                alert('新增汇率功能待实现');
              }}
              style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              新增汇率
            </button>
          )}
          {commissionSettingsTab === 'author' && (
            <button
              onClick={() => {
                setSelectedAuthorPlan({ is_default: false });
              }}
              style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              新建方案
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setCommissionSettingsTab('plans')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: commissionSettingsTab === 'plans' ? '#007bff' : '#f0f0f0',
              color: commissionSettingsTab === 'plans' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            推广分成方案
          </button>
          <button
            onClick={() => setCommissionSettingsTab('karma')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: commissionSettingsTab === 'karma' ? '#007bff' : '#f0f0f0',
              color: commissionSettingsTab === 'karma' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            Karma汇率
          </button>
          <button
            onClick={() => setCommissionSettingsTab('author')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: commissionSettingsTab === 'author' ? '#007bff' : '#f0f0f0',
              color: commissionSettingsTab === 'author' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            作者分成方案
          </button>
        </div>
      </div>

      {/* 推广分成方案Tab */}
      {commissionSettingsTab === 'plans' && (
        <>
          {/* 子选项卡 */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', borderBottom: '2px solid #e0e0e0' }}>
            <button
              onClick={() => setPromotionSubTab('plans')}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'transparent',
                color: promotionSubTab === 'plans' ? '#007bff' : '#666',
                cursor: 'pointer',
                borderBottom: promotionSubTab === 'plans' ? '2px solid #007bff' : '2px solid transparent',
                marginBottom: '-2px',
                fontWeight: promotionSubTab === 'plans' ? 'bold' : 'normal',
                fontSize: '16px'
              }}
            >
              推广分成方案列表
            </button>
            <button
              onClick={() => setPromotionSubTab('referrals')}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'transparent',
                color: promotionSubTab === 'referrals' ? '#007bff' : '#666',
                cursor: 'pointer',
                borderBottom: promotionSubTab === 'referrals' ? '2px solid #007bff' : '2px solid transparent',
                marginBottom: '-2px',
                fontWeight: promotionSubTab === 'referrals' ? 'bold' : 'normal',
                fontSize: '16px'
              }}
            >
              推广关系列表
            </button>
          </div>

          {/* 推广分成方案列表 */}
          {promotionSubTab === 'plans' && (
            <div className={styles.paymentTable}>
              <h3>推广分成方案列表</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>方案名称</th>
                  <th>类型</th>
                  <th>最大层级</th>
                  <th>是否定制</th>
                  <th>拥有者用户ID</th>
                  <th>备注</th>
                  <th>状态</th>
                  <th>生效时间</th>
                  <th>结束时间</th>
                  <th>使用中关系数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {commissionPlansLoading ? (
                  <tr>
                    <td colSpan={12} className={styles.emptyCell}>加载中...</td>
                  </tr>
                ) : commissionPlans.length === 0 ? (
                  <tr>
                    <td colSpan={12} className={styles.emptyCell}>暂无数据</td>
                  </tr>
                ) : (
                  commissionPlans.map((plan) => (
                    <React.Fragment key={plan.id}>
                      <tr 
                        style={{ cursor: 'pointer' }}
                        onClick={() => togglePlanExpand(plan.id)}
                      >
                        <td>{plan.id}</td>
                        <td>{plan.name}</td>
                        <td>{plan.plan_type === 'reader_promoter' ? '读者推广' : '作者推广'}</td>
                        <td>{plan.max_level}</td>
                        <td>{plan.is_custom === 1 || plan.is_custom === true ? '是' : '否'}</td>
                        <td>{plan.owner_user_id || '—'}</td>
                        <td>{plan.remark || '—'}</td>
                        <td>
                          {plan.end_date ? '历史' : '当前生效'}
                        </td>
                        <td>{new Date(plan.start_date).toLocaleString('zh-CN')}</td>
                        <td>{plan.end_date ? new Date(plan.end_date).toLocaleString('zh-CN') : '—'}</td>
                        <td>
                          {plan.plan_type === 'reader_promoter' 
                            ? (parseInt(plan.reader_referral_count || 0) + parseInt(plan.author_referral_count || 0))
                            : parseInt(plan.author_referral_count || 0)}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setEditingPlan({ ...plan })}
                            style={{ padding: '5px 10px', fontSize: '12px', marginRight: '5px' }}
                          >
                            修改
                          </button>
                        </td>
                      </tr>
                      {expandedPlanIds.has(plan.id) && (
                        <tr>
                          <td colSpan={12} style={{ padding: '10px', background: '#f9f9f9' }}>
                            <div style={{ marginLeft: '20px' }}>
                              <h4 style={{ margin: '0 0 10px 0' }}>层级比例列表</h4>
                              {planLevelsLoading[plan.id] ? (
                                <div>加载中...</div>
                              ) : planLevels[plan.id] && planLevels[plan.id].length > 0 ? (
                                <>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ padding: '8px', border: '1px solid #ddd', background: '#f0f0f0' }}>层级</th>
                                        <th style={{ padding: '8px', border: '1px solid #ddd', background: '#f0f0f0' }}>比例 (%)</th>
                                        <th style={{ padding: '8px', border: '1px solid #ddd', background: '#f0f0f0' }}>操作</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {planLevels[plan.id].map((level: any) => (
                                        <tr key={level.id}>
                                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>第{level.level}层</td>
                                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            {editingLevel?.id === level.id && editingLevel ? (
                                              <input
                                                type="number"
                                                step="0.0001"
                                                value={editingLevel.percent * 100}
                                                onChange={(e) => setEditingLevel({ id: editingLevel.id, percent: parseFloat(e.target.value) / 100 })}
                                                style={{ width: '100px', padding: '4px' }}
                                                autoFocus
                                              />
                                            ) : (
                                              `${(level.percent * 100).toFixed(4)}%`
                                            )}
                                          </td>
                                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            {editingLevel?.id === level.id && editingLevel ? (
                                              <>
                                                <button
                                                  onClick={() => updateLevelPercent(level.id, editingLevel.percent)}
                                                  style={{ padding: '4px 8px', fontSize: '12px', marginRight: '5px', background: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                                >
                                                  保存
                                                </button>
                                                <button
                                                  onClick={() => setEditingLevel(null)}
                                                  style={{ padding: '4px 8px', fontSize: '12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                                >
                                                  取消
                                                </button>
                                              </>
                                            ) : (
                                              <button
                                                onClick={() => setEditingLevel({ id: level.id, percent: level.percent })}
                                                style={{ padding: '4px 8px', fontSize: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                              >
                                                修改
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {planLevels[plan.id].length < plan.max_level && (
                                    <button
                                      onClick={() => createLevel(plan.id, plan.max_level)}
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: '14px',
                                        background: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                      }}
                                    >
                                      <span style={{ fontSize: '18px', lineHeight: '1' }}>+</span>
                                      <span>添加层级</span>
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span>暂无层级数据</span>
                                  <button
                                    onClick={() => createLevel(plan.id, plan.max_level)}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '14px',
                                      background: '#28a745',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px'
                                    }}
                                  >
                                    <span style={{ fontSize: '18px', lineHeight: '1' }}>+</span>
                                    <span>添加层级</span>
                                  </button>
                                </div>
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
          </div>
          )}

          {/* 推广关系列表 */}
          {promotionSubTab === 'referrals' && (
            <div className={styles.paymentTable}>
              <h3>推广关系列表</h3>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>用户ID</th>
                    <th>用户名称</th>
                    <th>推荐人ID</th>
                    <th>推荐人名称</th>
                    <th>读者推广方案ID</th>
                    <th>读者推广方案名称</th>
                    <th>作者推广方案ID</th>
                    <th>作者推广方案名称</th>
                    <th>创建时间</th>
                    <th>更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {referralsLoading ? (
                    <tr>
                      <td colSpan={11} className={styles.emptyCell}>加载中...</td>
                    </tr>
                  ) : referrals.length === 0 ? (
                    <tr>
                      <td colSpan={11} className={styles.emptyCell}>暂无数据</td>
                    </tr>
                  ) : (
                    referrals.map((referral) => (
                      <tr key={referral.id}>
                        <td>{referral.id}</td>
                        <td>
                          <span
                            onClick={() => loadUserDetail(referral.user_id)}
                            style={{
                              color: '#007bff',
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                            title="点击查看用户详情"
                          >
                            {referral.user_id}
                          </span>
                        </td>
                        <td>{referral.user_name}</td>
                        <td>
                          {referral.referrer_id ? (
                            <span
                              onClick={() => loadUserDetail(referral.referrer_id)}
                              style={{
                                color: '#007bff',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              title="点击查看推荐人详情"
                            >
                              {referral.referrer_id}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{referral.referrer_name || '—'}</td>
                        <td>
                          {referral.promoter_plan_id ? (
                            <span
                              onClick={() => loadPlanDetail(referral.promoter_plan_id)}
                              style={{
                                color: '#007bff',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              title="点击查看方案详情"
                            >
                              {referral.promoter_plan_id}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{referral.promoter_plan_name || '—'}</td>
                        <td>
                          {referral.author_plan_id ? (
                            <span
                              onClick={() => loadPlanDetail(referral.author_plan_id)}
                              style={{
                                color: '#007bff',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              title="点击查看方案详情"
                            >
                              {referral.author_plan_id}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{referral.author_plan_name || '—'}</td>
                        <td>{new Date(referral.created_at).toLocaleString('zh-CN')}</td>
                        <td>{referral.updated_at ? new Date(referral.updated_at).toLocaleString('zh-CN') : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {/* 分页 */}
              {referralsTotal > 20 && (
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => setReferralsPage(Math.max(1, referralsPage - 1))}
                    disabled={referralsPage === 1}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #ddd',
                      background: referralsPage === 1 ? '#f5f5f5' : 'white',
                      cursor: referralsPage === 1 ? 'not-allowed' : 'pointer',
                      borderRadius: '4px'
                    }}
                  >
                    上一页
                  </button>
                  <span>
                    第 {referralsPage} 页，共 {Math.ceil(referralsTotal / 20)} 页（共 {referralsTotal} 条）
                  </span>
                  <button
                    onClick={() => setReferralsPage(Math.min(Math.ceil(referralsTotal / 20), referralsPage + 1))}
                    disabled={referralsPage >= Math.ceil(referralsTotal / 20)}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #ddd',
                      background: referralsPage >= Math.ceil(referralsTotal / 20) ? '#f5f5f5' : 'white',
                      cursor: referralsPage >= Math.ceil(referralsTotal / 20) ? 'not-allowed' : 'pointer',
                      borderRadius: '4px'
                    }}
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Karma汇率Tab */}
      {commissionSettingsTab === 'karma' && (
        <>
          <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
            <p>说明：所有章节解锁消费将按解锁时刻对应的汇率计算。调整汇率仅影响未来消费，历史已结算数据不会被回算。</p>
          </div>
          <div className={styles.paymentTable}>
            <h3>Karma汇率列表</h3>
            <table>
              <thead>
                <tr>
                  <th>生效开始时间</th>
                  <th>生效结束时间</th>
                  <th>1 Karma = 美元</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {karmaRatesLoading ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyCell}>加载中...</td>
                  </tr>
                ) : karmaRates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyCell}>暂无数据</td>
                  </tr>
                ) : (
                  karmaRates.map((rate) => (
                    <tr key={rate.id}>
                      <td>{new Date(rate.effective_from).toLocaleString('zh-CN')}</td>
                      <td>{rate.effective_to ? new Date(rate.effective_to).toLocaleString('zh-CN') : '— (当前生效)'}</td>
                      <td>{rate.usd_per_karma.toFixed(10)}</td>
                      <td>{new Date(rate.created_at).toLocaleString('zh-CN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 作者分成方案Tab */}
      {commissionSettingsTab === 'author' && (
        <>
          <div className={styles.paymentTable}>
            <h3>作者分成方案列表</h3>
            <table>
              <thead>
                <tr>
                  <th>方案名称</th>
                  <th>分成比例</th>
                  <th>是否默认</th>
                  <th>生效时间</th>
                  <th>结束时间</th>
                  <th>使用小说数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {authorRoyaltyPlansLoading ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyCell}>加载中...</td>
                  </tr>
                ) : authorRoyaltyPlans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyCell}>暂无数据</td>
                  </tr>
                ) : (
                  authorRoyaltyPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td>{plan.name}</td>
                      <td>{(plan.royalty_percent * 100).toFixed(2)}%</td>
                      <td>{plan.is_default ? '是' : '否'}</td>
                      <td>{new Date(plan.start_date).toLocaleString('zh-CN')}</td>
                      <td>{plan.end_date ? new Date(plan.end_date).toLocaleString('zh-CN') : '—'}</td>
                      <td>{plan.novel_count || 0}</td>
                      <td>
                        <button
                          onClick={() => setSelectedAuthorPlan(plan)}
                          style={{ padding: '5px 10px', fontSize: '12px', marginRight: '5px' }}
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 编辑方案模态框 */}
      {editingPlan && (
        <div className={styles.modal} onClick={() => setEditingPlan(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h2>修改推广分成方案</h2>
              <button onClick={() => setEditingPlan(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>方案名称:</label>
                  <input
                    type="text"
                    value={editingPlan.name || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>方案类型:</label>
                  <select
                    value={editingPlan.plan_type || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, plan_type: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="reader_promoter">读者推广</option>
                    <option value="author_promoter">作者推广</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>最大层级:</label>
                  <input
                    type="number"
                    value={editingPlan.max_level || 3}
                    onChange={(e) => setEditingPlan({ ...editingPlan, max_level: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>生效时间:</label>
                  <input
                    type="datetime-local"
                    value={formatDateForInput(editingPlan.start_date)}
                    onChange={(e) => setEditingPlan({ ...editingPlan, start_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>结束时间 (可选):</label>
                  <input
                    type="datetime-local"
                    value={formatDateForInput(editingPlan.end_date)}
                    onChange={(e) => setEditingPlan({ ...editingPlan, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <input
                      type="checkbox"
                      checked={editingPlan.is_custom === 1 || editingPlan.is_custom === true}
                      onChange={(e) => setEditingPlan({ ...editingPlan, is_custom: e.target.checked ? 1 : 0 })}
                    />
                    <span style={{ fontWeight: 'bold' }}>是否定制方案</span>
                  </label>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>拥有者用户ID (可选):</label>
                  <input
                    type="number"
                    value={editingPlan.owner_user_id || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, owner_user_id: e.target.value ? parseInt(e.target.value) : null })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>备注:</label>
                  <textarea
                    value={editingPlan.remark || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, remark: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '80px' }}
                  />
                </div>
              </div>
              <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                <button
                  onClick={savePlanEdit}
                  className={styles.approveButton}
                  disabled={saving}
                  style={{ marginRight: '10px' }}
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingPlan(null)}
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

      {/* 新建方案模态框 */}
      {creatingPlan && (
        <div className={styles.modal} onClick={() => { setCreatingPlan(null); setShowUserSearch(false); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h2>新建推广分成方案</h2>
              <button onClick={() => { setCreatingPlan(null); setShowUserSearch(false); }} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>方案名称 <span style={{ color: 'red' }}>*</span>:</label>
                  <input
                    type="text"
                    value={creatingPlan.name || ''}
                    onChange={(e) => setCreatingPlan({ ...creatingPlan, name: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="例如：2025 Reader 8/3/2"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>方案类型 <span style={{ color: 'red' }}>*</span>:</label>
                  <select
                    value={creatingPlan.plan_type || 'reader_promoter'}
                    onChange={(e) => setCreatingPlan({ ...creatingPlan, plan_type: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="reader_promoter">读者推广</option>
                    <option value="author_promoter">作者推广</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>最大层级:</label>
                  <input
                    type="number"
                    value={creatingPlan.max_level || 3}
                    onChange={(e) => setCreatingPlan({ ...creatingPlan, max_level: parseInt(e.target.value) || 3 })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>生效时间:</label>
                  <input
                    type="datetime-local"
                    value={creatingPlan.start_date ? new Date(creatingPlan.start_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setCreatingPlan({ ...creatingPlan, start_date: new Date(e.target.value).toISOString() })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>结束时间 (可选):</label>
                  <input
                    type="datetime-local"
                    value={creatingPlan.end_date ? new Date(creatingPlan.end_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setCreatingPlan({ ...creatingPlan, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <input
                      type="checkbox"
                      checked={creatingPlan.is_custom === 1 || creatingPlan.is_custom === true}
                      onChange={(e) => setCreatingPlan({ ...creatingPlan, is_custom: e.target.checked ? 1 : 0 })}
                    />
                    <span style={{ fontWeight: 'bold' }}>是否定制方案</span>
                  </label>
                </div>
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>拥有者用户 (可选):</label>
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => handleUserSearchChange(e.target.value)}
                    onFocus={() => {
                      if (userSearchQuery.trim() !== '') {
                        setShowUserSearch(true);
                      }
                    }}
                    placeholder="搜索用户（ID、用户名、邮箱、笔名等）"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  {showUserSearch && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      marginTop: '4px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                      {userSearchLoading ? (
                        <div style={{ padding: '10px', textAlign: 'center' }}>搜索中...</div>
                      ) : userSearchResults.length === 0 ? (
                        <div style={{ padding: '10px', textAlign: 'center', color: '#999' }}>未找到用户</div>
                      ) : (
                        userSearchResults.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => selectUser(user)}
                            style={{
                              padding: '10px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #eee',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                          >
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{user.username}</div>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                ID: {user.id} | {user.email && `邮箱: ${user.email}`} {user.pen_name && `| 笔名: ${user.pen_name}`}
                              </div>
                            </div>
                            {user.is_author === 1 && (
                              <span style={{ fontSize: '12px', color: '#007bff', background: '#e7f3ff', padding: '2px 6px', borderRadius: '3px' }}>作者</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>备注:</label>
                  <textarea
                    value={creatingPlan.remark || ''}
                    onChange={(e) => setCreatingPlan({ ...creatingPlan, remark: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '80px' }}
                    placeholder="可选备注信息"
                  />
                </div>
              </div>
              <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                <button
                  onClick={saveNewPlan}
                  className={styles.approveButton}
                  disabled={saving}
                  style={{ marginRight: '10px' }}
                >
                  创建
                </button>
                <button
                  onClick={() => { setCreatingPlan(null); setShowUserSearch(false); setUserSearchQuery(''); }}
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
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.username || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>笔名:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.pen_name || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>邮箱:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.email || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>确认邮箱:</strong>
                        <span style={{ marginLeft: '10px', color: selectedUserDetail.confirmed_email ? '#28a745' : '#dc3545' }}>
                          {selectedUserDetail.confirmed_email ? '是' : '否'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>手机号:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.phone_number || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>QQ号:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.qq_number || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>微信号:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.wechat_number || '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>账户信息</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#666' }}>是否作者:</strong>
                        <span style={{ marginLeft: '10px', color: selectedUserDetail.is_author ? '#28a745' : '#666' }}>
                          {selectedUserDetail.is_author ? '是' : '否'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>是否VIP:</strong>
                        <span style={{ marginLeft: '10px', color: selectedUserDetail.is_vip ? '#ffc107' : '#666' }}>
                          {selectedUserDetail.is_vip ? '是' : '否'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>实名认证:</strong>
                        <span style={{ marginLeft: '10px', color: selectedUserDetail.is_real_name_verified ? '#28a745' : '#666' }}>
                          {selectedUserDetail.is_real_name_verified ? '是' : '否'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>账户余额:</strong>
                        <span style={{ marginLeft: '10px', color: '#333', fontWeight: 'bold' }}>${selectedUserDetail.balance?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>积分:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.points || 0}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>金色Karma:</strong>
                        <span style={{ marginLeft: '10px', color: '#ffc107', fontWeight: 'bold' }}>{selectedUserDetail.golden_karma || 0}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>VIP到期时间:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedUserDetail.vip_expire_at ? new Date(selectedUserDetail.vip_expire_at).toLocaleString('zh-CN') : '—'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>最后登录:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedUserDetail.last_login_at ? new Date(selectedUserDetail.last_login_at).toLocaleString('zh-CN') : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedUserDetail.bio && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>个人简介</h3>
                      <p style={{ color: '#666', lineHeight: '1.6' }}>{selectedUserDetail.bio}</p>
                    </div>
                  )}
                  <div style={{ gridColumn: '1 / -1', marginTop: '10px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', color: '#666' }}>
                      <div>
                        <strong>创建时间:</strong> {new Date(selectedUserDetail.created_at).toLocaleString('zh-CN')}
                      </div>
                      <div>
                        <strong>更新时间:</strong> {selectedUserDetail.updated_at ? new Date(selectedUserDetail.updated_at).toLocaleString('zh-CN') : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 方案详情模态框 */}
      {selectedPlanDetail && (
        <div className={styles.modal} onClick={() => setSelectedPlanDetail(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className={styles.modalHeader}>
              <h2>推广分成方案详情</h2>
              <button onClick={() => setSelectedPlanDetail(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              {detailLoading ? (
                <div className={styles.loading}>加载中...</div>
              ) : (
                <>
                  <div style={{ marginBottom: '25px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>方案基本信息</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div>
                        <strong style={{ color: '#666' }}>方案ID:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedPlanDetail.plan.id}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>方案名称:</strong>
                        <span style={{ marginLeft: '10px', color: '#333', fontWeight: 'bold' }}>{selectedPlanDetail.plan.name}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>方案类型:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedPlanDetail.plan.plan_type === 'reader_promoter' ? '读者推广' : '作者推广'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>最大层级:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedPlanDetail.plan.max_level}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>是否定制:</strong>
                        <span style={{ marginLeft: '10px', color: selectedPlanDetail.plan.is_custom ? '#28a745' : '#666' }}>
                          {selectedPlanDetail.plan.is_custom ? '是' : '否'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>拥有者用户ID:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedPlanDetail.plan.owner_user_id || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>生效时间:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {new Date(selectedPlanDetail.plan.start_date).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>结束时间:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedPlanDetail.plan.end_date ? new Date(selectedPlanDetail.plan.end_date).toLocaleString('zh-CN') : '—'}
                        </span>
                      </div>
                      {selectedPlanDetail.plan.remark && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong style={{ color: '#666' }}>备注:</strong>
                          <p style={{ marginLeft: '10px', marginTop: '5px', color: '#666' }}>{selectedPlanDetail.plan.remark}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>层级比例设置</h3>
                    {selectedPlanDetail.levels && selectedPlanDetail.levels.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                          <tr style={{ background: '#f8f9fa' }}>
                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>层级</th>
                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>分成比例</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPlanDetail.levels.map((level: any, index: number) => (
                            <tr key={level.level} style={{ background: index % 2 === 0 ? 'white' : '#f8f9fa' }}>
                              <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                <strong style={{ color: '#007bff' }}>第 {level.level} 层</strong>
                              </td>
                              <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '16px' }}>
                                  {(level.percent * 100).toFixed(4)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>暂无层级数据</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionSettings;


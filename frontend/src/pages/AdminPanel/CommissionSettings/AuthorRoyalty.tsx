import React, { useState, useEffect } from 'react';
import styles from './CommissionSettings.module.css';
import Toast from '../../../components/Toast/Toast';

interface AuthorRoyaltyProps {
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

// 将datetime-local格式转换为MySQL DATETIME格式
const convertToMySQLDateTime = (dateTimeLocal: string | null | undefined): string | null => {
  if (!dateTimeLocal) return null;
  
  // 如果已经是MySQL格式 (YYYY-MM-DD HH:mm:ss)，直接返回
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateTimeLocal.trim())) {
    return dateTimeLocal.trim();
  }
  
  try {
    // 统一使用 Date 对象解析，然后格式化为 MySQL 格式
    // 处理 datetime-local 格式 (YYYY-MM-DDTHH:mm)
    let dateStr = dateTimeLocal.trim();
    
    // 如果是 datetime-local 格式，需要转换为 Date 对象
    if (dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+')) {
      // datetime-local 格式: YYYY-MM-DDTHH:mm
      // 直接格式化为 MySQL 格式，不需要时区转换
      const [datePart, timePart] = dateStr.split('T');
      if (datePart && timePart) {
        return `${datePart} ${timePart}:00`;
      }
    }
    
    // 对于其他格式（ISO、MySQL等），使用 Date 对象解析
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.error('无法解析日期:', dateStr);
      return null;
    }
    
    // 格式化为 MySQL DATETIME 格式: YYYY-MM-DD HH:mm:ss
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('日期转换错误:', error, dateTimeLocal);
    return null;
  }
};

const AuthorRoyalty: React.FC<AuthorRoyaltyProps> = ({ onError }) => {
  const [authorRoyaltyPlans, setAuthorRoyaltyPlans] = useState<any[]>([]);
  const [authorRoyaltyPlansLoading, setAuthorRoyaltyPlansLoading] = useState(false);
  const [selectedAuthorPlan, setSelectedAuthorPlan] = useState<any>(null);
  const [authorRoyaltySubTab, setAuthorRoyaltySubTab] = useState<'plans' | 'contracts'>('plans');
  const [royaltyContracts, setRoyaltyContracts] = useState<any[]>([]);
  const [royaltyContractsLoading, setRoyaltyContractsLoading] = useState(false);
  const [royaltyContractsPage, setRoyaltyContractsPage] = useState(1);
  const [royaltyContractsTotal, setRoyaltyContractsTotal] = useState(0);
  const [editingRoyaltyContract, setEditingRoyaltyContract] = useState<any>(null);
  const [editingAuthorPlan, setEditingAuthorPlan] = useState<any>(null);
  const [royaltyPercentInput, setRoyaltyPercentInput] = useState<string>('');
  const [creatingAuthorPlan, setCreatingAuthorPlan] = useState<any>(null);
  const [creatingAuthorPlanPercentInput, setCreatingAuthorPlanPercentInput] = useState<string>('');
  const [selectedContractNovelDetail, setSelectedContractNovelDetail] = useState<any>(null);
  const [selectedContractAuthorDetail, setSelectedContractAuthorDetail] = useState<any>(null);
  const [selectedContractPlanDetail, setSelectedContractPlanDetail] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  // 合同搜索相关状态
  const [contractSearchType, setContractSearchType] = useState<'author' | 'novel'>('author');
  const [contractSearchKeyword, setContractSearchKeyword] = useState('');
  const [contractSearchLoading, setContractSearchLoading] = useState(false);
  const [contractSearchResults, setContractSearchResults] = useState<any[]>([]);
  const [showContractSearchResults, setShowContractSearchResults] = useState(false);
  const [selectedContractSearchUserId, setSelectedContractSearchUserId] = useState<number | null>(null);
  const [selectedContractSearchNovelId, setSelectedContractSearchNovelId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // 加载作者分成方案列表
  const loadAuthorRoyaltyPlans = async () => {
    try {
      setAuthorRoyaltyPlansLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await const apiBase = typeof window !== 'undefined' && window.location?.origin 
      ? `${window.location.origin}/api` 
      : (process.env.REACT_APP_API_URL || '');
    if (!apiBase) {
      throw new Error('API base url is not configured');
    }
    fetch('${apiBase}/admin/author-royalty-plans', {
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

  // 加载分成方案明细列表
  const loadRoyaltyContracts = async (page: number = 1, novelId?: number | null, authorId?: number | null) => {
    try {
      setRoyaltyContractsLoading(true);
      const token = localStorage.getItem('adminToken');
      
      let url = `http://localhost:5000/api/admin/novel-royalty-contracts?page=${page}&page_size=20`;
      if (novelId) {
        url += `&novel_id=${novelId}`;
      }
      if (authorId) {
        url += `&author_id=${authorId}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRoyaltyContracts(data.data.list || []);
        setRoyaltyContractsTotal(data.data.total || 0);
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
      setRoyaltyContractsLoading(false);
    }
  };

  // 保存分成方案明细修改
  const saveRoyaltyContractEdit = async () => {
    if (!editingRoyaltyContract) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      
      // 构建请求体，只包含有值的字段
      const requestBody: any = {};
      if (editingRoyaltyContract.plan_id !== undefined && editingRoyaltyContract.plan_id !== null) {
        requestBody.plan_id = editingRoyaltyContract.plan_id;
      }
      if (editingRoyaltyContract.effective_from !== undefined) {
        requestBody.effective_from = editingRoyaltyContract.effective_from;
      }
      if (editingRoyaltyContract.effective_to !== undefined) {
        requestBody.effective_to = editingRoyaltyContract.effective_to || null;
      }
      
      const response = await fetch(`http://localhost:5000/api/admin/novel-royalty-contracts/${editingRoyaltyContract.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadRoyaltyContracts(royaltyContractsPage, selectedContractSearchNovelId, selectedContractSearchUserId);
        setEditingRoyaltyContract(null);
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
    } finally {
      setSaving(false);
    }
  };

  const saveAuthorPlanEdit = async () => {
    if (!editingAuthorPlan) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      
      // 转换日期格式
      const startDate = convertToMySQLDateTime(editingAuthorPlan.start_date);
      const endDate = convertToMySQLDateTime(editingAuthorPlan.end_date);
      
      const response = await fetch(`http://localhost:5000/api/admin/author-royalty-plans/${editingAuthorPlan.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingAuthorPlan.name,
          royalty_percent: editingAuthorPlan.royalty_percent,
          is_default: editingAuthorPlan.is_default,
          owner_user_id: editingAuthorPlan.owner_user_id || null,
          start_date: startDate,
          end_date: endDate,
          remark: editingAuthorPlan.remark || null
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadAuthorRoyaltyPlans();
        setEditingAuthorPlan(null);
        setRoyaltyPercentInput('');
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
    } finally {
      setSaving(false);
    }
  };

  // 搜索用户（用于合同搜索）
  const searchUsersForContract = async (keyword: string) => {
    if (!keyword || keyword.trim() === '') {
      setContractSearchResults([]);
      setShowContractSearchResults(false);
      return;
    }
    
    try {
      setContractSearchLoading(true);
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
        setContractSearchResults(data.data);
        setShowContractSearchResults(true);
      } else {
        if (onError) {
          onError(data.message || '搜索失败');
        }
        setContractSearchResults([]);
        setShowContractSearchResults(false);
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '搜索失败');
      }
      setContractSearchResults([]);
      setShowContractSearchResults(false);
    } finally {
      setContractSearchLoading(false);
    }
  };

  // 搜索小说（用于合同搜索）
  const searchNovelsForContract = async (keyword: string) => {
    if (!keyword || keyword.trim() === '') {
      setContractSearchResults([]);
      setShowContractSearchResults(false);
      return;
    }
    
    try {
      setContractSearchLoading(true);
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
        setContractSearchResults(data.data);
        setShowContractSearchResults(true);
      } else {
        if (onError) {
          onError(data.message || '搜索失败');
        }
        setContractSearchResults([]);
        setShowContractSearchResults(false);
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '搜索失败');
      }
      setContractSearchResults([]);
      setShowContractSearchResults(false);
    } finally {
      setContractSearchLoading(false);
    }
  };

  // 选择合同搜索结果
  const selectContractSearchResult = (result: any) => {
    if (contractSearchType === 'author') {
      setSelectedContractSearchUserId(result.id);
      setContractSearchKeyword(`${result.username || result.pen_name || `用户${result.id}`} (ID: ${result.id})`);
    } else {
      setSelectedContractSearchNovelId(result.id);
      setContractSearchKeyword(`${result.title || `小说${result.id}`} (ID: ${result.id})`);
    }
    setShowContractSearchResults(false);
    setContractSearchResults([]);
  };

  // 执行合同搜索
  const executeContractSearch = () => {
    if (contractSearchType === 'author' && selectedContractSearchUserId) {
      setRoyaltyContractsPage(1);
      loadRoyaltyContracts(1, null, selectedContractSearchUserId);
    } else if (contractSearchType === 'novel' && selectedContractSearchNovelId) {
      setRoyaltyContractsPage(1);
      loadRoyaltyContracts(1, selectedContractSearchNovelId, null);
    } else {
      if (onError) {
        onError('请先选择要查询的用户或小说，或直接输入ID');
      }
    }
  };

  // 清除合同搜索
  const clearContractSearch = () => {
    setContractSearchKeyword('');
    setContractSearchResults([]);
    setShowContractSearchResults(false);
    setSelectedContractSearchUserId(null);
    setSelectedContractSearchNovelId(null);
    setRoyaltyContractsPage(1);
    loadRoyaltyContracts(1);
  };

  // 保存新建作者分成方案
  const saveNewAuthorPlan = async () => {
    if (!creatingAuthorPlan) return;
    
    // 验证必填字段
    if (!creatingAuthorPlan.name || creatingAuthorPlan.royalty_percent === undefined || !creatingAuthorPlan.start_date) {
      const missingFields = [];
      if (!creatingAuthorPlan.name) missingFields.push('方案名称 / Plan Name');
      if (creatingAuthorPlan.royalty_percent === undefined) missingFields.push('分成比例 / Royalty Ratio');
      if (!creatingAuthorPlan.start_date) missingFields.push('生效时间 / Effective Date');
      
      const errorMessage = `请填写必填字段 / Please fill in required fields: ${missingFields.join(', ')}`;
      setToast({
        message: errorMessage,
        type: 'error'
      });
      if (onError) {
        onError('请填写所有必填字段');
      }
      return;
    }
    
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      
      // 转换日期格式
      const startDate = convertToMySQLDateTime(creatingAuthorPlan.start_date);
      const endDate = convertToMySQLDateTime(creatingAuthorPlan.end_date);
      
      // 再次验证转换后的日期
      if (!startDate) {
        setToast({
          message: '生效时间格式不正确 / Invalid effective date format',
          type: 'error'
        });
        setSaving(false);
        return;
      }
      
      const response = await const apiBase = typeof window !== 'undefined' && window.location?.origin 
      ? `${window.location.origin}/api` 
      : (process.env.REACT_APP_API_URL || '');
    if (!apiBase) {
      throw new Error('API base url is not configured');
    }
    fetch('${apiBase}/admin/author-royalty-plans', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: creatingAuthorPlan.name,
          royalty_percent: creatingAuthorPlan.royalty_percent,
          is_default: creatingAuthorPlan.is_default || false,
          owner_user_id: creatingAuthorPlan.owner_user_id || null,
          start_date: startDate,
          end_date: endDate,
          remark: creatingAuthorPlan.remark || null
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadAuthorRoyaltyPlans();
        setCreatingAuthorPlan(null);
        setCreatingAuthorPlanPercentInput('');
        if (onError) {
          onError('');
        }
        // 显示成功提示
        setToast({
          message: data.message || '创建成功 / Created successfully',
          type: 'success'
        });
      } else {
        // 显示错误提示（中英文双语）
        const errorMessage = data.messageEn 
          ? `${data.message} / ${data.messageEn}`
          : (data.message || '创建失败 / Creation failed');
        setToast({
          message: errorMessage,
          type: 'error'
        });
        if (onError) {
          onError(data.message || '创建失败');
        }
      }
    } catch (err: any) {
      // 显示错误提示（中英文双语）
      const errorMessage = err.message 
        ? `${err.message} / ${err.message}`
        : '创建失败 / Creation failed';
      setToast({
        message: errorMessage,
        type: 'error'
      });
      if (onError) {
        onError(err.message || '创建失败');
      }
    } finally {
      setSaving(false);
    }
  };

  // 加载合同相关的小说详情
  const loadContractNovelDetail = async (novelId: number) => {
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
        setSelectedContractNovelDetail(data.data);
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
      setDetailLoading(false);
    }
  };

  // 加载合同相关的作者详情
  const loadContractAuthorDetail = async (authorId: number) => {
    try {
      setDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/user/${authorId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedContractAuthorDetail(data.data);
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
      setDetailLoading(false);
    }
  };

  // 加载合同相关的方案详情
  const loadContractPlanDetail = async (planId: number) => {
    try {
      setDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/author-royalty-plans/${planId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedContractPlanDetail(data.data);
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
      setDetailLoading(false);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    loadAuthorRoyaltyPlans();
  }, []);

  // 合同搜索防抖
  useEffect(() => {
    if (contractSearchKeyword.trim() === '' || /^\d+$/.test(contractSearchKeyword.trim())) {
      return;
    }
    
    const timeoutId = setTimeout(() => {
      if (contractSearchType === 'author') {
        searchUsersForContract(contractSearchKeyword);
      } else {
        searchNovelsForContract(contractSearchKeyword);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [contractSearchKeyword, contractSearchType]);

  // 当切换到合同列表时加载数据
  useEffect(() => {
    if (authorRoyaltySubTab === 'contracts') {
      loadRoyaltyContracts(royaltyContractsPage, selectedContractSearchNovelId, selectedContractSearchUserId);
    }
  }, [authorRoyaltySubTab, royaltyContractsPage, selectedContractSearchNovelId, selectedContractSearchUserId]);

  return (
    <>
      {/* 子选项卡 */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', borderBottom: '2px solid #e0e0e0' }}>
        <button
          onClick={() => {
            setAuthorRoyaltySubTab('plans');
            loadAuthorRoyaltyPlans();
          }}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            color: authorRoyaltySubTab === 'plans' ? '#007bff' : '#666',
            cursor: 'pointer',
            borderBottom: authorRoyaltySubTab === 'plans' ? '2px solid #007bff' : '2px solid transparent',
            marginBottom: '-2px',
            fontWeight: authorRoyaltySubTab === 'plans' ? 'bold' : 'normal',
            fontSize: '16px'
          }}
        >
          作者分成方案列表 (author_royalty_plan)
        </button>
        <button
          onClick={() => {
            setAuthorRoyaltySubTab('contracts');
            setRoyaltyContractsPage(1);
            loadRoyaltyContracts(1, selectedContractSearchNovelId, selectedContractSearchUserId);
          }}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            color: authorRoyaltySubTab === 'contracts' ? '#007bff' : '#666',
            cursor: 'pointer',
            borderBottom: authorRoyaltySubTab === 'contracts' ? '2px solid #007bff' : '2px solid transparent',
            marginBottom: '-2px',
            fontWeight: authorRoyaltySubTab === 'contracts' ? 'bold' : 'normal',
            fontSize: '16px'
          }}
        >
          分成方案明细 (novel_royalty_contract)
        </button>
      </div>

      {/* 作者分成方案列表 */}
      {authorRoyaltySubTab === 'plans' && (
        <div className={styles.paymentTable}>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>作者分成方案列表 (author_royalty_plan)</h3>
            <button
              onClick={() => setCreatingAuthorPlan({
                name: '',
                royalty_percent: undefined,
                is_default: false,
                owner_user_id: null,
                start_date: '',
                end_date: null,
                remark: ''
              })}
              style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              新建方案
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>方案名称</th>
                  <th>分成比例</th>
                  <th>是否默认</th>
                  <th>拥有者ID</th>
                  <th>生效时间</th>
                  <th>结束时间</th>
                  <th>备注</th>
                  <th>创建时间</th>
                  <th>使用小说数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {authorRoyaltyPlansLoading ? (
                  <tr>
                    <td colSpan={11} className={styles.emptyCell}>加载中...</td>
                  </tr>
                ) : authorRoyaltyPlans.length === 0 ? (
                  <tr>
                    <td colSpan={11} className={styles.emptyCell}>暂无数据</td>
                  </tr>
                ) : (
                  authorRoyaltyPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td>{plan.id}</td>
                      <td>{plan.name}</td>
                      <td>{(plan.royalty_percent * 100).toFixed(2)}%</td>
                      <td>{plan.is_default ? '是' : '否'}</td>
                      <td>{plan.owner_user_id || '—'}</td>
                      <td>{new Date(plan.start_date).toLocaleString('zh-CN')}</td>
                      <td>{plan.end_date ? new Date(plan.end_date).toLocaleString('zh-CN') : '—'}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={plan.remark || ''}>
                        {plan.remark || '—'}
                      </td>
                      <td>{plan.created_at ? new Date(plan.created_at).toLocaleString('zh-CN') : '—'}</td>
                      <td>{plan.novel_count || 0}</td>
                      <td>
                        <button
                          onClick={() => {
                            setEditingAuthorPlan({ ...plan });
                            setRoyaltyPercentInput(''); // 清空临时输入
                          }}
                          style={{ padding: '5px 10px', fontSize: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          修改
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 分成方案明细列表 */}
      {authorRoyaltySubTab === 'contracts' && (
        <div className={styles.paymentTable}>
          <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #e0e0e0' }}>
            {/* 标题和搜索区域在同一行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'nowrap' }}>
              <h3 style={{ margin: 0, flexShrink: 0 }}>分成方案明细 (novel_royalty_contract)</h3>
              {/* 搜索区域 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap', flex: '1', justifyContent: 'flex-end' }}>
              {/* 搜索类型下拉框 */}
              <select
                value={contractSearchType}
                onChange={(e) => {
                  setContractSearchType(e.target.value as 'author' | 'novel');
                  setContractSearchKeyword('');
                  setContractSearchResults([]);
                  setShowContractSearchResults(false);
                  setSelectedContractSearchUserId(null);
                  setSelectedContractSearchNovelId(null);
                }}
                style={{
                  padding: '10px 15px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                  cursor: 'pointer',
                  width: '140px',
                  height: '42px',
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  boxSizing: 'border-box'
                }}
              >
                <option value="author">按作者信息</option>
                <option value="novel">按小说信息</option>
              </select>
              
              {/* 搜索输入框 */}
              <div style={{ position: 'relative', flex: '1', minWidth: '250px', maxWidth: '400px', flexShrink: 0 }}>
                <input
                  type="text"
                  value={contractSearchKeyword}
                  onChange={(e) => {
                    const value = e.target.value;
                    setContractSearchKeyword(value);
                    // 如果输入的是纯ID格式，直接设置
                    if (/^\d+$/.test(value.trim())) {
                      if (contractSearchType === 'author') {
                        setSelectedContractSearchUserId(parseInt(value.trim()));
                      } else {
                        setSelectedContractSearchNovelId(parseInt(value.trim()));
                      }
                    } else {
                      if (contractSearchType === 'author') {
                        setSelectedContractSearchUserId(null);
                      } else {
                        setSelectedContractSearchNovelId(null);
                      }
                    }
                  }}
                  onFocus={() => {
                    if (contractSearchKeyword.trim() !== '' && contractSearchResults.length > 0) {
                      setShowContractSearchResults(true);
                    }
                  }}
                  placeholder={contractSearchType === 'author' ? '输入作者ID、用户名、笔名、邮箱等...' : '输入小说ID、标题、作者等...'}
                  style={{
                    width: '100%',
                    padding: '10px 15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    transition: 'border-color 0.3s',
                    height: '42px',
                    boxSizing: 'border-box'
                  }}
                  onBlur={() => {
                    // 延迟隐藏，以便点击搜索结果
                    setTimeout(() => setShowContractSearchResults(false), 200);
                  }}
                />
                {/* 搜索结果下拉列表 */}
                {showContractSearchResults && contractSearchResults.length > 0 && (
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
                    {contractSearchLoading ? (
                      <div style={{ padding: '15px', textAlign: 'center', color: '#666' }}>搜索中...</div>
                    ) : contractSearchResults.length === 0 ? (
                      <div style={{ padding: '15px', textAlign: 'center', color: '#999' }}>未找到结果</div>
                    ) : (
                      contractSearchResults.map((result) => (
                        <div
                          key={result.id}
                          onClick={() => selectContractSearchResult(result)}
                          style={{
                            padding: '12px 15px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          {contractSearchType === 'author' ? (
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
                onClick={executeContractSearch}
                disabled={contractSearchLoading || (!selectedContractSearchUserId && !selectedContractSearchNovelId && !/^\d+$/.test(contractSearchKeyword.trim()))}
                style={{
                  padding: '10px 24px',
                  background: (!selectedContractSearchUserId && !selectedContractSearchNovelId && !/^\d+$/.test(contractSearchKeyword.trim())) ? '#ccc' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: (!selectedContractSearchUserId && !selectedContractSearchNovelId && !/^\d+$/.test(contractSearchKeyword.trim())) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(0,123,255,0.3)',
                  transition: 'all 0.3s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  height: '42px',
                  boxSizing: 'border-box',
                  marginLeft: '12px'
                }}
                onMouseEnter={(e) => {
                  if (!(!selectedContractSearchUserId && !selectedContractSearchNovelId && !/^\d+$/.test(contractSearchKeyword.trim()))) {
                    e.currentTarget.style.background = '#0056b3';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,123,255,0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(!selectedContractSearchUserId && !selectedContractSearchNovelId && !/^\d+$/.test(contractSearchKeyword.trim()))) {
                    e.currentTarget.style.background = '#007bff';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,123,255,0.3)';
                  }
                }}
              >
                {contractSearchLoading ? '查询中...' : '查询'}
              </button>
              
              {/* 清除按钮 */}
              {(selectedContractSearchUserId || selectedContractSearchNovelId || contractSearchKeyword) && (
                <button
                  onClick={clearContractSearch}
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
                    boxSizing: 'border-box',
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
                <th>ID</th>
                <th>小说ID</th>
                <th>小说标题</th>
                <th>作者ID</th>
                <th>作者名称</th>
                <th>方案ID</th>
                <th>方案名称</th>
                <th>分成比例</th>
                <th>生效时间</th>
                <th>结束时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {royaltyContractsLoading ? (
                <tr>
                  <td colSpan={11} className={styles.emptyCell}>加载中...</td>
                </tr>
              ) : royaltyContracts.length === 0 ? (
                <tr>
                  <td colSpan={11} className={styles.emptyCell}>暂无数据</td>
                </tr>
              ) : (
                royaltyContracts.map((contract) => (
                  <tr key={contract.id}>
                    <td>{contract.id}</td>
                    <td>
                      <span
                        onClick={() => loadContractNovelDetail(contract.novel_id)}
                        style={{ color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {contract.novel_id}
                      </span>
                    </td>
                    <td>{contract.novel_title || '—'}</td>
                    <td>
                      <span
                        onClick={() => loadContractAuthorDetail(contract.author_id)}
                        style={{ color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {contract.author_id}
                      </span>
                    </td>
                    <td>{contract.author_username || contract.author_pen_name || '—'}</td>
                    <td>
                      <span
                        onClick={() => loadContractPlanDetail(contract.plan_id)}
                        style={{ color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {contract.plan_id}
                      </span>
                    </td>
                    <td>{contract.plan_name || '—'}</td>
                    <td>{contract.royalty_percent ? (contract.royalty_percent * 100).toFixed(2) + '%' : '—'}</td>
                    <td>{new Date(contract.effective_from).toLocaleString('zh-CN')}</td>
                    <td>{contract.effective_to ? new Date(contract.effective_to).toLocaleString('zh-CN') : '—'}</td>
                    <td>
                      <button
                        onClick={() => setEditingRoyaltyContract({ ...contract })}
                        style={{ padding: '5px 10px', fontSize: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        修改
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {/* 分页 */}
          {royaltyContractsTotal > 20 && (
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                onClick={() => {
                  const newPage = Math.max(1, royaltyContractsPage - 1);
                  setRoyaltyContractsPage(newPage);
                  loadRoyaltyContracts(newPage, selectedContractSearchNovelId, selectedContractSearchUserId);
                }}
                disabled={royaltyContractsPage === 1}
                style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: royaltyContractsPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                上一页
              </button>
              <span style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                第 {royaltyContractsPage} 页，共 {Math.ceil(royaltyContractsTotal / 20)} 页
              </span>
              <button
                onClick={() => {
                  const newPage = royaltyContractsPage + 1;
                  setRoyaltyContractsPage(newPage);
                  loadRoyaltyContracts(newPage, selectedContractSearchNovelId, selectedContractSearchUserId);
                }}
                disabled={royaltyContractsPage >= Math.ceil(royaltyContractsTotal / 20)}
                style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: royaltyContractsPage >= Math.ceil(royaltyContractsTotal / 20) ? 'not-allowed' : 'pointer' }}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      {/* 修改分成方案明细模态框 */}
      {editingRoyaltyContract && (
        <div className={styles.modal} onClick={() => setEditingRoyaltyContract(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h2>修改分成方案明细</h2>
              <button onClick={() => setEditingRoyaltyContract(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#666' }}>合同ID:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>{editingRoyaltyContract.id}</span>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#666' }}>小说:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>{editingRoyaltyContract.novel_title || '—'} (ID: {editingRoyaltyContract.novel_id})</span>
                </div>
                <div>
                  <strong style={{ color: '#666' }}>作者:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>
                    {editingRoyaltyContract.author_username || editingRoyaltyContract.author_pen_name || '—'} (ID: {editingRoyaltyContract.author_id})
                  </span>
                </div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                  分成方案
                </label>
                <select
                  value={editingRoyaltyContract.plan_id || ''}
                  onChange={(e) => setEditingRoyaltyContract({ 
                    ...editingRoyaltyContract, 
                    plan_id: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ddd', 
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">请选择方案</option>
                  {authorRoyaltyPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({(plan.royalty_percent * 100).toFixed(2)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                  生效时间 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formatDateForInput(editingRoyaltyContract.effective_from)}
                  onChange={(e) => {
                    const value = e.target.value;
                    // datetime-local 格式是 YYYY-MM-DDTHH:mm，直接转换为 MySQL DATETIME 格式 YYYY-MM-DD HH:mm:ss
                    const mysqlDateTime = value ? value.replace('T', ' ') + ':00' : null;
                    setEditingRoyaltyContract({ 
                      ...editingRoyaltyContract, 
                      effective_from: mysqlDateTime 
                    });
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ddd', 
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                  结束时间
                </label>
                <input
                  type="datetime-local"
                  value={editingRoyaltyContract.effective_to ? formatDateForInput(editingRoyaltyContract.effective_to) : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    // datetime-local 格式是 YYYY-MM-DDTHH:mm，直接转换为 MySQL DATETIME 格式 YYYY-MM-DD HH:mm:ss
                    // 如果为空则设为 null
                    const mysqlDateTime = value ? value.replace('T', ' ') + ':00' : null;
                    setEditingRoyaltyContract({ 
                      ...editingRoyaltyContract, 
                      effective_to: mysqlDateTime 
                    });
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ddd', 
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                  留空表示合同持续有效
                </div>
              </div>

              <div className={styles.modalActions} style={{ marginTop: '25px' }}>
                <button
                  onClick={saveRoyaltyContractEdit}
                  className={styles.approveButton}
                  disabled={saving || !editingRoyaltyContract.effective_from}
                  style={{ marginRight: '10px' }}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditingRoyaltyContract(null)}
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

      {/* 修改作者分成方案模态框 */}
      {editingAuthorPlan && (
        <div className={styles.modal} onClick={() => {
          setEditingAuthorPlan(null);
          setRoyaltyPercentInput(''); // 清空临时输入
        }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className={styles.modalHeader}>
              <h2>修改作者分成方案</h2>
              <button onClick={() => {
                setEditingAuthorPlan(null);
                setRoyaltyPercentInput(''); // 清空临时输入
              }} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    方案名称 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editingAuthorPlan.name || ''}
                    onChange={(e) => setEditingAuthorPlan({ ...editingAuthorPlan, name: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                    placeholder="请输入方案名称"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    分成比例 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={royaltyPercentInput !== '' ? royaltyPercentInput : (editingAuthorPlan.royalty_percent !== undefined && editingAuthorPlan.royalty_percent !== null ? editingAuthorPlan.royalty_percent.toString() : '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      // 保存原始输入字符串
                      setRoyaltyPercentInput(value);
                      
                      // 允许空值
                      if (value === '') {
                        setEditingAuthorPlan({ ...editingAuthorPlan, royalty_percent: undefined });
                        return;
                      }
                      
                      // 允许输入数字和小数点，不做任何限制
                      // 只允许数字和小数点，允许多个小数点会被onBlur处理
                      if (/^[\d.]*$/.test(value)) {
                        const numValue = parseFloat(value);
                        // 如果解析成功，更新数值；如果解析失败（如只有小数点），保持undefined
                        if (!isNaN(numValue)) {
                          setEditingAuthorPlan({ ...editingAuthorPlan, royalty_percent: numValue });
                        } else {
                          setEditingAuthorPlan({ ...editingAuthorPlan, royalty_percent: undefined });
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // 失焦时验证并规范化值
                      const value = royaltyPercentInput.trim();
                      setRoyaltyPercentInput(''); // 清空临时输入
                      
                      if (value === '' || value === '.') {
                        setEditingAuthorPlan({ ...editingAuthorPlan, royalty_percent: undefined });
                        return;
                      }
                      
                      const numValue = parseFloat(value);
                      if (isNaN(numValue)) {
                        setEditingAuthorPlan({ ...editingAuthorPlan, royalty_percent: undefined });
                      } else {
                        // 确保值在0-1范围内
                        const clampedValue = Math.max(0, Math.min(1, numValue));
                        setEditingAuthorPlan({ ...editingAuthorPlan, royalty_percent: clampedValue });
                      }
                    }}
                    onFocus={(e) => {
                      // 聚焦时，如果有值，将其设置为临时输入
                      if (editingAuthorPlan.royalty_percent !== undefined && editingAuthorPlan.royalty_percent !== null) {
                        setRoyaltyPercentInput(editingAuthorPlan.royalty_percent.toString());
                      }
                    }}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                    placeholder="0.50 表示 50%"
                  />
                  <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                    当前: {editingAuthorPlan.royalty_percent !== undefined ? (editingAuthorPlan.royalty_percent * 100).toFixed(2) + '%' : '—'}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#333' }}>
                    <input
                      type="checkbox"
                      checked={editingAuthorPlan.is_default || false}
                      onChange={(e) => setEditingAuthorPlan({ ...editingAuthorPlan, is_default: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    设为默认方案
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    生效时间 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formatDateForInput(editingAuthorPlan.start_date)}
                    onChange={(e) => setEditingAuthorPlan({ ...editingAuthorPlan, start_date: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    结束时间
                  </label>
                  <input
                    type="datetime-local"
                    value={editingAuthorPlan.end_date ? formatDateForInput(editingAuthorPlan.end_date) : ''}
                    onChange={(e) => setEditingAuthorPlan({ ...editingAuthorPlan, end_date: e.target.value || null })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    备注
                  </label>
                  <textarea
                    value={editingAuthorPlan.remark || ''}
                    onChange={(e) => setEditingAuthorPlan({ ...editingAuthorPlan, remark: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', minHeight: '80px' }}
                    placeholder="请输入备注信息"
                  />
                </div>
              </div>

              <div className={styles.modalActions} style={{ marginTop: '25px' }}>
                <button
                  onClick={saveAuthorPlanEdit}
                  className={styles.approveButton}
                  disabled={saving || !editingAuthorPlan.name || editingAuthorPlan.royalty_percent === undefined}
                  style={{ marginRight: '10px' }}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => {
                    setEditingAuthorPlan(null);
                    setRoyaltyPercentInput(''); // 清空临时输入
                  }}
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

      {/* 新建作者分成方案模态框 */}
      {creatingAuthorPlan && (
        <div className={styles.modal} onClick={() => {
          setCreatingAuthorPlan(null);
          setCreatingAuthorPlanPercentInput('');
        }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className={styles.modalHeader}>
              <h2>新建作者分成方案</h2>
              <button onClick={() => {
                setCreatingAuthorPlan(null);
                setCreatingAuthorPlanPercentInput('');
              }} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    方案名称 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={creatingAuthorPlan.name || ''}
                    onChange={(e) => setCreatingAuthorPlan({ ...creatingAuthorPlan, name: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                    placeholder="请输入方案名称，如：Default 50%"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    分成比例 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={creatingAuthorPlanPercentInput !== '' ? creatingAuthorPlanPercentInput : (creatingAuthorPlan.royalty_percent !== undefined && creatingAuthorPlan.royalty_percent !== null ? creatingAuthorPlan.royalty_percent.toString() : '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCreatingAuthorPlanPercentInput(value);
                      
                      if (value === '') {
                        setCreatingAuthorPlan({ ...creatingAuthorPlan, royalty_percent: undefined });
                        return;
                      }
                      
                      if (/^[\d.]*$/.test(value)) {
                        const numValue = parseFloat(value);
                        if (value === '' || value === '.' || isNaN(numValue)) {
                          setCreatingAuthorPlan({ ...creatingAuthorPlan, royalty_percent: undefined });
                        } else {
                          setCreatingAuthorPlan({ ...creatingAuthorPlan, royalty_percent: numValue });
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const value = creatingAuthorPlanPercentInput.trim();
                      setCreatingAuthorPlanPercentInput('');
                      
                      if (value === '' || value === '.') {
                        setCreatingAuthorPlan({ ...creatingAuthorPlan, royalty_percent: undefined });
                        return;
                      }
                      
                      const numValue = parseFloat(value);
                      if (isNaN(numValue)) {
                        setCreatingAuthorPlan({ ...creatingAuthorPlan, royalty_percent: undefined });
                      } else {
                        const clampedValue = Math.max(0, Math.min(1, numValue));
                        setCreatingAuthorPlan({ ...creatingAuthorPlan, royalty_percent: clampedValue });
                      }
                    }}
                    onFocus={(e) => {
                      if (creatingAuthorPlan.royalty_percent !== undefined && creatingAuthorPlan.royalty_percent !== null) {
                        setCreatingAuthorPlanPercentInput(creatingAuthorPlan.royalty_percent.toString());
                      }
                    }}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                    placeholder="0.50 表示 50%"
                  />
                  <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                    当前: {creatingAuthorPlan.royalty_percent !== undefined ? (creatingAuthorPlan.royalty_percent * 100).toFixed(2) + '%' : '—'}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#333' }}>
                    <input
                      type="checkbox"
                      checked={creatingAuthorPlan.is_default || false}
                      onChange={(e) => setCreatingAuthorPlan({ ...creatingAuthorPlan, is_default: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    设为默认方案
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    拥有者ID（可选，定制方案时填写）
                  </label>
                  <input
                    type="number"
                    value={creatingAuthorPlan.owner_user_id || ''}
                    onChange={(e) => setCreatingAuthorPlan({ 
                      ...creatingAuthorPlan, 
                      owner_user_id: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                    placeholder="留空表示通用方案"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    生效时间 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formatDateForInput(creatingAuthorPlan.start_date)}
                    onChange={(e) => setCreatingAuthorPlan({ ...creatingAuthorPlan, start_date: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    结束时间
                  </label>
                  <input
                    type="datetime-local"
                    value={creatingAuthorPlan.end_date ? formatDateForInput(creatingAuthorPlan.end_date) : ''}
                    onChange={(e) => setCreatingAuthorPlan({ ...creatingAuthorPlan, end_date: e.target.value || null })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    备注
                  </label>
                  <textarea
                    value={creatingAuthorPlan.remark || ''}
                    onChange={(e) => setCreatingAuthorPlan({ ...creatingAuthorPlan, remark: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', minHeight: '80px' }}
                    placeholder="请输入备注信息"
                  />
                </div>
              </div>

              <div className={styles.modalActions} style={{ marginTop: '25px' }}>
                <button
                  onClick={saveNewAuthorPlan}
                  className={styles.approveButton}
                  disabled={saving || !creatingAuthorPlan.name || creatingAuthorPlan.royalty_percent === undefined}
                  style={{ marginRight: '10px' }}
                >
                  {saving ? '创建中...' : '创建'}
                </button>
                <button
                  onClick={() => {
                    setCreatingAuthorPlan(null);
                    setCreatingAuthorPlanPercentInput('');
                  }}
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

      {/* 合同小说详情模态框 */}
      {selectedContractNovelDetail && (
        <div className={styles.modal} onClick={() => setSelectedContractNovelDetail(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className={styles.modalHeader}>
              <h2>小说详情</h2>
              <button onClick={() => setSelectedContractNovelDetail(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              {detailLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>加载中...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div><strong>ID:</strong> {selectedContractNovelDetail.id}</div>
                  <div><strong>标题:</strong> {selectedContractNovelDetail.title || '—'}</div>
                  <div><strong>作者:</strong> {selectedContractNovelDetail.author || '—'}</div>
                  <div><strong>状态:</strong> {selectedContractNovelDetail.status || '—'}</div>
                  <div><strong>审核状态:</strong> {selectedContractNovelDetail.review_status || '—'}</div>
                  <div><strong>章节数:</strong> {selectedContractNovelDetail.chapters || 0}</div>
                  <div><strong>评分:</strong> {selectedContractNovelDetail.rating || 0}</div>
                  <div><strong>评论数:</strong> {selectedContractNovelDetail.reviews || 0}</div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>描述:</strong>
                    <div style={{ marginTop: '5px', padding: '10px', background: '#f8f9fa', borderRadius: '6px', fontSize: '14px' }}>
                      {selectedContractNovelDetail.description || '—'}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '15px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedContractNovelDetail(null)}
                style={{
                  padding: '10px 24px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 合同作者详情模态框 */}
      {selectedContractAuthorDetail && (
        <div className={styles.modal} onClick={() => setSelectedContractAuthorDetail(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className={styles.modalHeader}>
              <h2>用户详情</h2>
              <button onClick={() => setSelectedContractAuthorDetail(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              {detailLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>加载中...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div><strong>ID:</strong> {selectedContractAuthorDetail.id}</div>
                  <div><strong>用户名:</strong> {selectedContractAuthorDetail.username || '—'}</div>
                  <div><strong>笔名:</strong> {selectedContractAuthorDetail.pen_name || '—'}</div>
                  <div><strong>邮箱:</strong> {selectedContractAuthorDetail.email || '—'}</div>
                  <div><strong>是否作者:</strong> {selectedContractAuthorDetail.is_author ? '是' : '否'}</div>
                  <div><strong>状态:</strong> {selectedContractAuthorDetail.status || '—'}</div>
                  <div><strong>余额:</strong> {selectedContractAuthorDetail.balance || 0}</div>
                  <div><strong>积分:</strong> {selectedContractAuthorDetail.points || 0}</div>
                </div>
              )}
            </div>
            <div style={{ padding: '15px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedContractAuthorDetail(null)}
                style={{
                  padding: '10px 24px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 合同方案详情模态框 */}
      {selectedContractPlanDetail && (
        <div className={styles.modal} onClick={() => setSelectedContractPlanDetail(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className={styles.modalHeader}>
              <h2>分成方案详情</h2>
              <button onClick={() => setSelectedContractPlanDetail(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              {detailLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>加载中...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div><strong>ID:</strong> {selectedContractPlanDetail.id}</div>
                  <div><strong>方案名称:</strong> {selectedContractPlanDetail.name || '—'}</div>
                  <div><strong>分成比例:</strong> {(selectedContractPlanDetail.royalty_percent * 100).toFixed(2)}%</div>
                  <div><strong>是否默认:</strong> {selectedContractPlanDetail.is_default ? '是' : '否'}</div>
                  <div><strong>生效时间:</strong> {new Date(selectedContractPlanDetail.start_date).toLocaleString('zh-CN')}</div>
                  <div><strong>结束时间:</strong> {selectedContractPlanDetail.end_date ? new Date(selectedContractPlanDetail.end_date).toLocaleString('zh-CN') : '—'}</div>
                  {selectedContractPlanDetail.remark && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>备注:</strong>
                      <div style={{ marginTop: '5px', padding: '10px', background: '#f8f9fa', borderRadius: '6px', fontSize: '14px' }}>
                        {selectedContractPlanDetail.remark}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '15px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedContractPlanDetail(null)}
                style={{
                  padding: '10px 24px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast 提示 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={5000}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
};

export default AuthorRoyalty;


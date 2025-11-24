import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../services/ApiService';
import styles from './AdminPanel.module.css';
import NovelReview from './AdminPanel/NovelReview';
import PaymentStats from './AdminPanel/PaymentStats';
import AuthorIncome from './AdminPanel/AuthorIncome';
import ReaderIncome from './AdminPanel/ReaderIncome';
import BaseIncome from './AdminPanel/BaseIncome';
import AuthorRoyalty from './AdminPanel/AuthorRoyalty';
import CommissionTransaction from './AdminPanel/CommissionTransaction';
import CommissionSettings from './AdminPanel/CommissionSettings';

interface Novel {
  id: number;
  title: string;
  author: string;
  translator: string | null;
  description: string | null;
  cover: string | null;
  review_status: string;
  status: string;
  created_at: string;
  author_name?: string;
  pen_name?: string;
}

interface PaymentRecord {
  id: number;
  user_id: number;
  amount: number;
  payment_method: string;
  status: string;
  type: string;
  created_at: string;
  description: string | null;
  username?: string;
}

interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  todayRevenue: number;
  todayTransactions: number;
  monthlyRevenue: number;
  monthlyTransactions: number;
  byMethod: { [key: string]: number };
  byType: { [key: string]: number };
}

type TabType = 'novel-review' | 'payment-stats' | 'author-income' | 'reader-income' | 'base-income' | 'author-royalty' | 'commission-transaction' | 'commission-settings' | 'settlement-overview';

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

const AdminPanel: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('novel-review');
  
  // 小说审批相关状态
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // 费用统计相关状态
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // 新的费用统计状态（基于订阅和Karma）
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [karmaPurchases, setKarmaPurchases] = useState<any[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [karmaPurchasesLoading, setKarmaPurchasesLoading] = useState(false);
  const [paymentFilters, setPaymentFilters] = useState({
    start_date: '',
    end_date: '',
    payment_method: '',
    payment_status: 'completed',
    user_id: '',
    novel_id: ''
  });
  const [activePaymentTab, setActivePaymentTab] = useState<'subscriptions' | 'karma'>('subscriptions');
  const [subscriptionsPage, setSubscriptionsPage] = useState(1);
  const [karmaPurchasesPage, setKarmaPurchasesPage] = useState(1);
  const [subscriptionsTotal, setSubscriptionsTotal] = useState(0);
  const [karmaPurchasesTotal, setKarmaPurchasesTotal] = useState(0);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [selectedKarmaPurchase, setSelectedKarmaPurchase] = useState<any>(null);
  
  // 提成设置相关状态
  
  // 作者收入统计相关状态
  const [authorIncomeMonth, setAuthorIncomeMonth] = useState('');
  const [authorIncomeData, setAuthorIncomeData] = useState<any>(null);
  const [authorIncomeLoading, setAuthorIncomeLoading] = useState(false);
  
  // 读者收入统计相关状态
  const [readerIncomeMonth, setReaderIncomeMonth] = useState('');
  const [readerIncomeData, setReaderIncomeData] = useState<any>(null);
  const [readerIncomeLoading, setReaderIncomeLoading] = useState(false);
  



  // 结算总览相关状态
  const [settlementMonth, setSettlementMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [settlementStatus, setSettlementStatus] = useState<string>('all');
  const [settlementRole, setSettlementRole] = useState<string>('all'); // 'all' | 'author_only' | 'promoter_only'
  const [settlementUserId, setSettlementUserId] = useState<string>('');
  const [settlementData, setSettlementData] = useState<any[]>([]);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [showUserDetailModal, setShowUserDetailModal] = useState<boolean>(false);
  const [selectedSettlementDetail, setSelectedSettlementDetail] = useState<any>(null);
  const [showSettlementDetailModal, setShowSettlementDetailModal] = useState<boolean>(false);
  
  // 表格行展开状态（存储每行的详情数据）
  const [expandedRows, setExpandedRows] = useState<{ [key: number]: any }>({});
  const [loadingRows, setLoadingRows] = useState<{ [key: number]: boolean }>({});
  
  // 发起支付相关状态
  const [showCreatePayoutModal, setShowCreatePayoutModal] = useState(false);
  const [selectedIncomeMonthly, setSelectedIncomeMonthly] = useState<any>(null); // 选中的月度收入记录
  const [payoutForm, setPayoutForm] = useState({
    method: 'paypal',
    account_id: '',
    payout_currency: 'USD',
    fx_rate: '1.0',
    note: ''
  });
  const [creatingPayout, setCreatingPayout] = useState(false);
  
  // 支付确认相关状态
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [pendingPayoutId, setPendingPayoutId] = useState<number | null>(null);
  const [pendingPaymentInfo, setPendingPaymentInfo] = useState<any>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Toast提示状态
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // 查询PayPal状态相关状态
  const [checkingPayoutStatus, setCheckingPayoutStatus] = useState<number | null>(null);
  
  // 标记已支付相关状态
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedPayoutId, setSelectedPayoutId] = useState<number | null>(null);
  const [markPaidForm, setMarkPaidForm] = useState({
    provider: 'bank_manual',
    provider_tx_id: '',
  });
  const [markingPaid, setMarkingPaid] = useState(false);

  const navigate = useNavigate();

  // 处理 token 过期
  const handleTokenExpired = () => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
    setIsAuthenticated(false);
    setError('Token无效或已过期，请重新登录');
  };

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
      handleTokenExpired();
      throw new Error('Token无效或已过期');
    }

    const data = await response.json();

    // 如果返回的是 token 相关错误，也清除 token
    if (!data.success && data.message && 
        (data.message.includes('Token') || data.message.includes('token') || 
         data.message.includes('登录') || data.message.includes('无效') || 
         data.message.includes('过期'))) {
      handleTokenExpired();
      throw new Error(data.message || 'Token无效或已过期');
    }

    return { response, data };
  };

  // 检查是否已登录
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setAdminToken(token);
      setIsAuthenticated(true);
      if (activeTab === 'novel-review') {
        loadNovels();
      } else if (activeTab === 'payment-stats') {
        // 设置默认日期范围（当前自然月）
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        setPaymentFilters(prev => ({
          ...prev,
          start_date: prev.start_date || monthStart,
          end_date: prev.end_date || monthEnd
        }));
        setTimeout(() => loadAllPaymentData(), 100);
      }
    }
  }, []);

  // 当选项卡切换时加载相应数据
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'novel-review') {
        loadNovels();
      } else if (activeTab === 'payment-stats') {
        // 设置默认日期范围（当前自然月）
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        setPaymentFilters(prev => ({
          ...prev,
          start_date: prev.start_date || monthStart,
          end_date: prev.end_date || monthEnd
        }));
        setTimeout(() => loadAllPaymentData(), 100);
      } else if (activeTab === 'author-income') {
        if (authorIncomeMonth) {
          loadAuthorIncomeStats();
        }
      } else if (activeTab === 'reader-income') {
        if (readerIncomeMonth) {
          loadReaderIncomeStats();
        }
      } else if (activeTab === 'settlement-overview') {
        loadSettlementOverview();
      }
    }
  }, [activeTab, isAuthenticated]);
  
  // 初始化月份为当前月份
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setAuthorIncomeMonth(currentMonth);
    setReaderIncomeMonth(currentMonth);
  }, []);

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
        setError(''); // 清除之前的错误
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      // token 过期错误已经在 adminApiRequest 中处理了
      if (!err.message || !err.message.includes('Token')) {
        setError(err.message || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 当筛选状态改变时重新加载
  useEffect(() => {
    if (isAuthenticated && activeTab === 'novel-review') {
      loadNovels();
    }
  }, [filterStatus]);

  // 加载作者收入统计
  const loadAuthorIncomeStats = async () => {
    if (!authorIncomeMonth) return;
    
    try {
      setAuthorIncomeLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/author-income-stats?month=${authorIncomeMonth}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAuthorIncomeData(data.data);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setAuthorIncomeLoading(false);
    }
  };
  
  // 加载读者收入统计
  const loadReaderIncomeStats = async () => {
    if (!readerIncomeMonth) return;
    
    try {
      setReaderIncomeLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/reader-income-stats?month=${readerIncomeMonth}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setReaderIncomeData(data.data);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setReaderIncomeLoading(false);
    }
  };
  
  // 加载结算总览
  const loadSettlementOverview = async () => {
    try {
      setSettlementLoading(true);
      const token = localStorage.getItem('adminToken');
      let url = `http://localhost:5000/api/admin/user-settlement/overview?month=${settlementMonth}`;
      if (settlementStatus !== 'all') {
        url += `&status=${settlementStatus}`;
      }
      if (settlementRole !== 'all') {
        url += `&role=${settlementRole}`;
      }
      if (settlementUserId) {
        url += `&userId=${settlementUserId}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSettlementData(data.data || []);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setSettlementLoading(false);
    }
  };

  // 加载结算详情（根据incomeMonthlyId）
  // 切换表格行的展开/折叠状态
  const toggleRowExpansion = async (incomeMonthlyId: number) => {
    if (!incomeMonthlyId) {
      setError('该用户该月的收入记录ID不存在');
      return;
    }
    
    // 如果已经展开，则折叠
    if (expandedRows[incomeMonthlyId]) {
      const newExpandedRows = { ...expandedRows };
      delete newExpandedRows[incomeMonthlyId];
      setExpandedRows(newExpandedRows);
      return;
    }
    
    // 如果正在加载，则不重复加载
    if (loadingRows[incomeMonthlyId]) {
      return;
    }
    
    // 加载详情数据
    try {
      setLoadingRows({ ...loadingRows, [incomeMonthlyId]: true });
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/settlements/${incomeMonthlyId}/detail`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setExpandedRows({
          ...expandedRows,
          [incomeMonthlyId]: data.data
        });
      } else {
        setError('加载支付详情失败：' + (data.message || '未知错误'));
      }
    } catch (err: any) {
      setError('加载支付详情失败：' + (err.message || '未知错误'));
    } finally {
      const newLoadingRows = { ...loadingRows };
      delete newLoadingRows[incomeMonthlyId];
      setLoadingRows(newLoadingRows);
    }
  };
  
  const loadSettlementDetail = async (incomeMonthlyId: number) => {
    try {
      setUserDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/settlements/${incomeMonthlyId}/detail`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedSettlementDetail(data.data);
        setShowSettlementDetailModal(true);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setUserDetailLoading(false);
    }
  };

  // 同步PayPal支付状态（通过incomeMonthlyId）
  const syncPayPalStatusByIncomeMonthlyId = async (incomeMonthlyId: number) => {
    try {
      setUserDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/settlements/${incomeMonthlyId}/sync-paypal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 刷新结算总览列表
        await loadSettlementOverview();
        setError(''); // 清除错误
        alert(data.message || '同步成功');
      } else {
        setError(data.message || '同步失败');
      }
    } catch (err: any) {
      setError(err.message || '同步失败');
    } finally {
      setUserDetailLoading(false);
    }
  };

  // 发起支付（通过incomeMonthlyId）
  const initiatePayment = async (incomeMonthlyId: number, accountId: number, method: string = 'paypal', payoutCurrency: string = 'USD', fxRate: string = '1.0', note: string = '') => {
    try {
      setUserDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/settlements/${incomeMonthlyId}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          account_id: accountId,
          method: method,
          payout_currency: payoutCurrency,
          fx_rate: fxRate,
          note: note
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 刷新结算总览列表
        await loadSettlementOverview();
        setError(''); // 清除错误
        alert(data.message || '支付已发起');
      } else {
        setError(data.message || '发起支付失败');
      }
    } catch (err: any) {
      setError(err.message || '发起支付失败');
    } finally {
      setUserDetailLoading(false);
    }
  };

  // 同步PayPal支付状态
  const syncPayPalStatus = async (payoutId: number) => {
    try {
      setUserDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/payouts/${payoutId}/sync-gateway`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 刷新结算详情
        if (selectedSettlementDetail?.income_monthly?.id) {
          await loadSettlementDetail(selectedSettlementDetail.income_monthly.id);
        }
        setError(''); // 清除错误
        // 可以显示成功消息
        alert(data.message || '同步成功');
      } else {
        setError(data.message || '同步失败');
      }
    } catch (err: any) {
      setError(err.message || '同步失败');
    } finally {
      setUserDetailLoading(false);
    }
  };

  // 加载用户结算详情（只加载当月数据）
  const loadUserDetail = async (userId: number, showModal: boolean = true) => {
    try {
      setUserDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const monthParam = settlementMonth + '-01';
      const response = await fetch(`http://localhost:5000/api/admin/user-settlement/detail/${userId}?months=1`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 只保留当月的月度收入数据
        const currentMonthData = {
          ...data.data,
          monthly_incomes: data.data.monthly_incomes?.filter((income: any) => {
            const incomeMonth = income.month ? income.month.toString().substring(0, 7) : '';
            return incomeMonth === settlementMonth;
          }) || [],
          payouts: data.data.payouts?.filter((payout: any) => {
            const payoutMonth = payout.month ? payout.month.toString().substring(0, 7) : '';
            return payoutMonth === settlementMonth;
          }) || []
        };
        setSelectedUserDetail(currentMonthData);
        setShowUserDetailModal(showModal); // 控制是否显示对话框
        return currentMonthData; // 返回数据以便调用者使用
      } else {
        setError(data.message || '加载失败');
        return null;
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
      return null;
    } finally {
      setUserDetailLoading(false);
    }
  };
  
  // 创建支付订单（基于月度收入记录，支持汇率）
  const createPayout = async () => {
    if (!selectedIncomeMonthly) {
      setError('请选择要支付的月度收入记录');
      return;
    }
    
    if (!selectedIncomeMonthly.id) {
      setError(`该用户 ${selectedIncomeMonthly.month || settlementMonth} 的月度收入记录尚未生成，请先点击"生成月度汇总"按钮生成该月的收入记录`);
      return;
    }
    
    if (!payoutForm.account_id) {
      setError('请选择收款账户');
      return;
    }
    
    const fxRate = parseFloat(payoutForm.fx_rate);
    if (isNaN(fxRate) || fxRate <= 0) {
      setError('请输入有效的汇率');
      return;
    }
    
    // 如果币种是USD，汇率必须是1.0
    if (payoutForm.payout_currency === 'USD' && fxRate !== 1.0) {
      setError('USD支付的汇率必须为1.0');
      return;
    }
    
    try {
      setCreatingPayout(true);
      
      // 获取选中的账户信息用于确认弹窗
      const selectedAccount = selectedUserDetail.all_accounts?.find((acc: any) => acc.id.toString() === payoutForm.account_id);
      
      // 计算支付金额
      const baseAmountUsd = selectedIncomeMonthly.total_income_usd || 0;
      const payoutAmount = Math.round(baseAmountUsd * fxRate * 100) / 100;
      const method = payoutForm.method.toLowerCase();
      
      // 准备支付确认信息（先不调用接口，等用户确认后再调用）
      const paymentInfo = {
        income_monthly_id: selectedIncomeMonthly.id,
        account_id: parseInt(payoutForm.account_id),
        method: method,
        method_display: method === 'paypal' ? 'PayPal' : 
                       method === 'alipay' ? '支付宝' : 
                       method === 'wechat' ? '微信' : 
                       method === 'bank_transfer' ? '银行转账' : '手动',
        account_label: selectedAccount?.account_label || '',
        account_data: selectedAccount?.account_data || {},
        user_name: selectedUserDetail.user?.pen_name || selectedUserDetail.user?.username || `用户${selectedIncomeMonthly.user_id}`,
        user_id: selectedIncomeMonthly.user_id,
        month: settlementMonth,
        base_amount_usd: baseAmountUsd,
        payout_currency: payoutForm.payout_currency,
        payout_amount: payoutAmount,
        fx_rate: fxRate,
        note: payoutForm.note || ''
      };
      
      // 关闭创建支付弹窗
      setShowCreatePayoutModal(false);
      
      // 显示支付确认弹窗
      setPendingPaymentInfo(paymentInfo);
      setShowPaymentConfirmModal(true);
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setCreatingPayout(false);
    }
  };
  
  // 确认并执行支付（使用新的接口，带防重复支付逻辑）
  const confirmAndExecutePayment = async () => {
    if (!pendingPaymentInfo || !pendingPaymentInfo.income_monthly_id) {
      setError('支付信息不完整');
      return;
    }
    
    try {
      setProcessingPayment(true);
      setError('');
      
      const method = pendingPaymentInfo.method;
      
      // 使用新的支付接口（带防重复支付逻辑）
      if (method === 'paypal' || method === 'alipay' || method === 'wechat') {
        // PayPal/支付宝/微信：调用新的支付接口
        const token = localStorage.getItem('adminToken');
        const payResponse = await fetch(`http://localhost:5000/api/admin/settlements/${pendingPaymentInfo.income_monthly_id}/pay`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            account_id: pendingPaymentInfo.account_id,
            method: method,
            payout_currency: pendingPaymentInfo.payout_currency,
            fx_rate: pendingPaymentInfo.fx_rate.toString(),
            note: pendingPaymentInfo.note || ''
          })
        });
        
        const payData = await payResponse.json();
        
        if (payData.success) {
          // 支付成功
          setShowPaymentConfirmModal(false);
          setPendingPayoutId(null);
          setPendingPaymentInfo(null);
          setSelectedIncomeMonthly(null);
          setSelectedUserDetail(null);
          setPayoutForm({
            method: 'paypal',
            account_id: '',
            payout_currency: 'USD',
            fx_rate: '1.0',
            note: ''
          });
          
          // 显示成功提示
          setToast({
            message: `${pendingPaymentInfo.method_display}支付已${payData.data.gateway_tx_id ? '发起' : '完成'}！${payData.message || ''}`,
            type: 'success'
          });
          
          // 3秒后自动关闭toast
          setTimeout(() => setToast(null), 5000);
          
          // 重新加载结算总览
          await loadSettlementOverview();
        } else {
          setError('支付失败：' + (payData.message || '未知错误'));
        }
      } else {
        // 银行转账或手动支付：使用旧的创建支付订单接口
        const token = localStorage.getItem('adminToken');
        const createResponse = await fetch(`http://localhost:5000/api/admin/user-settlement/create-payout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            income_monthly_id: pendingPaymentInfo.income_monthly_id,
            method: method,
            account_id: pendingPaymentInfo.account_id,
            payout_currency: pendingPaymentInfo.payout_currency,
            fx_rate: pendingPaymentInfo.fx_rate,
            note: pendingPaymentInfo.note || ''
          })
        });
        
        const createData = await createResponse.json();
        
        if (createData.success) {
          setShowPaymentConfirmModal(false);
          setPendingPayoutId(null);
          setPendingPaymentInfo(null);
          setSelectedIncomeMonthly(null);
          setSelectedUserDetail(null);
          setPayoutForm({
            method: 'paypal',
            account_id: '',
            payout_currency: 'USD',
            fx_rate: '1.0',
            note: ''
          });
          
          // 显示提示
          setToast({
            message: `支付订单已创建（ID: ${createData.data.payout_id}），请手动完成${pendingPaymentInfo.method_display}支付`,
            type: 'info'
          });
          
          setTimeout(() => setToast(null), 5000);
          
          await loadSettlementOverview();
        } else {
          setError('创建支付订单失败：' + (createData.message || '未知错误'));
        }
      }
    } catch (err: any) {
      setError('支付失败：' + (err.message || '未知错误'));
      setToast({
        message: '支付失败：' + (err.message || '未知错误'),
        type: 'error'
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setProcessingPayment(false);
    }
  };
  
  // 查询PayPal支付状态
  const checkPayoutStatus = async (payoutId: number) => {
    try {
      setCheckingPayoutStatus(payoutId);
      setError('');
      
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/payouts/${payoutId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 显示成功提示
        setToast({
          message: `PayPal状态查询成功！批次ID: ${data.data.batch_id}, PayPal状态: ${data.data.paypal_status}, 数据库状态: ${data.data.db_status}`,
          type: 'success'
        });
        setTimeout(() => setToast(null), 5000);
        
        // 重新加载用户详情以更新显示
        if (selectedUserDetail) {
          await loadUserDetail(selectedUserDetail.user.id);
        }
        
        // 重新加载结算总览
        await loadSettlementOverview();
      } else {
        setError('查询状态失败：' + (data.message || '未知错误'));
        setToast({
          message: '查询状态失败：' + (data.message || '未知错误'),
          type: 'error'
        });
        setTimeout(() => setToast(null), 5000);
      }
    } catch (err: any) {
      const errorMsg = err.message || '查询失败';
      setError('查询状态失败：' + errorMsg);
      setToast({
        message: '查询状态失败：' + errorMsg,
        type: 'error'
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setCheckingPayoutStatus(null);
    }
  };
  
  // 标记支付成功
  const markPayoutAsPaid = async () => {
    if (!selectedPayoutId) return;
    
    if (!markPaidForm.provider_tx_id) {
      setError('请输入第三方交易号');
      return;
    }
    
    try {
      setMarkingPaid(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/user-settlement/mark-paid', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payout_id: selectedPayoutId,
          provider: markPaidForm.provider,
          provider_tx_id: markPaidForm.provider_tx_id,
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowMarkPaidModal(false);
        setSelectedPayoutId(null);
        setError('');
        // 重新加载用户详情
        if (selectedUserDetail) {
          await loadUserDetail(selectedUserDetail.user.id);
        }
        alert('支付已成功标记');
      } else {
        setError(data.message || '标记失败');
      }
    } catch (err: any) {
      setError(err.message || '标记失败');
    } finally {
      setMarkingPaid(false);
    }
  };

  // 生成月度收入汇总
  const generateMonthlyIncome = async () => {
    if (!settlementMonth) {
      setError('请选择月份');
      return;
    }
    
    if (!window.confirm(`确定要生成 ${settlementMonth} 月的月度收入汇总吗？`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/user-settlement/generate-monthly', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          month: `${settlementMonth}-01`
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(data.message || '生成成功');
        loadSettlementOverview();
      } else {
        setError(data.message || '生成失败');
      }
    } catch (err: any) {
      setError(err.message || '生成失败');
    }
  };



  
  // 加载费用统计汇总
  const loadPaymentSummary = async () => {
    try {
      setStatsLoading(true);
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams();
      if (paymentFilters.start_date) params.append('start_date', paymentFilters.start_date);
      if (paymentFilters.end_date) params.append('end_date', paymentFilters.end_date);
      if (paymentFilters.payment_method) params.append('payment_method', paymentFilters.payment_method);
      if (paymentFilters.payment_status) params.append('payment_status', paymentFilters.payment_status);
      if (paymentFilters.user_id) params.append('user_id', paymentFilters.user_id);
      
      const response = await fetch(`http://localhost:5000/api/admin/payments/summary?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPaymentSummary(data.data);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setStatsLoading(false);
    }
  };
  
  // 加载订阅收入明细
  const loadSubscriptions = async () => {
    try {
      setSubscriptionsLoading(true);
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams();
      if (paymentFilters.start_date) params.append('start_date', paymentFilters.start_date);
      if (paymentFilters.end_date) params.append('end_date', paymentFilters.end_date);
      if (paymentFilters.payment_method) params.append('payment_method', paymentFilters.payment_method);
      if (paymentFilters.payment_status) params.append('payment_status', paymentFilters.payment_status);
      if (paymentFilters.user_id) params.append('user_id', paymentFilters.user_id);
      if (paymentFilters.novel_id) params.append('novel_id', paymentFilters.novel_id);
      params.append('page', subscriptionsPage.toString());
      params.append('page_size', '20');
      
      const response = await fetch(`http://localhost:5000/api/admin/subscriptions?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSubscriptions(data.data.items);
        setSubscriptionsTotal(data.data.total);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setSubscriptionsLoading(false);
    }
  };
  
  // 加载Karma购买明细
  const loadKarmaPurchases = async () => {
    try {
      setKarmaPurchasesLoading(true);
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams();
      if (paymentFilters.start_date) params.append('start_date', paymentFilters.start_date);
      if (paymentFilters.end_date) params.append('end_date', paymentFilters.end_date);
      if (paymentFilters.payment_method) params.append('payment_method', paymentFilters.payment_method);
      if (paymentFilters.payment_status) params.append('status', paymentFilters.payment_status);
      if (paymentFilters.user_id) params.append('user_id', paymentFilters.user_id);
      params.append('page', karmaPurchasesPage.toString());
      params.append('page_size', '20');
      
      const response = await fetch(`http://localhost:5000/api/admin/karma-purchases?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setKarmaPurchases(data.data.items);
        setKarmaPurchasesTotal(data.data.total);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setKarmaPurchasesLoading(false);
    }
  };
  
  // 加载所有费用统计数据
  const loadAllPaymentData = async () => {
    await Promise.all([
      loadPaymentSummary(),
      loadSubscriptions(),
      loadKarmaPurchases()
    ]);
  };
  
  // 旧的费用统计函数（保留兼容）
  const loadPaymentStats = async () => {
    await loadAllPaymentData();
  };


  // 管理员登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, password })
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const token = data.data.token;
        localStorage.setItem('adminToken', token);
        setAdminToken(token);
        setIsAuthenticated(true);
        if (activeTab === 'novel-review') {
          loadNovels();
        } else if (activeTab === 'payment-stats') {
          // 设置默认日期范围（当前自然月）
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
          setPaymentFilters({
            ...paymentFilters,
            start_date: monthStart,
            end_date: monthEnd
          });
          setTimeout(() => loadAllPaymentData(), 100);
        }
      } else {
        setError(data.message || '登录失败');
      }
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 审批小说
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
        setError('');
        loadNovels();
        if (selectedNovel?.id === novelId) {
          setSelectedNovel(null);
        }
      } else {
        setError(data.message || '操作失败');
      }
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
    setIsAuthenticated(false);
    setNovels([]);
    setSelectedNovel(null);
    setPaymentRecords([]);
    setPaymentStats(null);
  };

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
        setError(data.message || '获取详情失败');
      }
    } catch (err: any) {
      setError(err.message || '获取详情失败');
    }
  };

  // 如果未登录，显示登录界面
  if (!isAuthenticated) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <h2 className={styles.loginTitle}>后台管理系统</h2>
          <p className={styles.loginSubtitle}>管理员登录</p>
          <form onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label>用户名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="请输入用户名"
              />
            </div>
            <div className={styles.formGroup}>
              <label>密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="请输入密码"
              />
            </div>
            {error && <div className={styles.errorMessage}>{error}</div>}
            <button type="submit" disabled={loading} className={styles.loginButton}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 已登录，显示管理界面
  return (
    <div className={styles.adminContainer}>
      <header className={styles.header}>
        <h1>后台管理系统</h1>
        <button onClick={handleLogout} className={styles.logoutButton}>
          退出登录
        </button>
      </header>

      <div className={styles.mainLayout}>
        {/* 左侧选项卡导航 */}
        <div className={styles.sidebar}>
          <div className={styles.navItem} onClick={() => setActiveTab('novel-review')}>
            <div className={`${styles.navIcon} ${activeTab === 'novel-review' ? styles.active : ''}`}>
              📚
            </div>
            <span className={activeTab === 'novel-review' ? styles.active : ''}>小说审批</span>
          </div>
          <div className={styles.navItem} onClick={() => setActiveTab('payment-stats')}>
            <div className={`${styles.navIcon} ${activeTab === 'payment-stats' ? styles.active : ''}`}>
              💰
            </div>
            <span className={activeTab === 'payment-stats' ? styles.active : ''}>费用统计</span>
          </div>
          <div className={styles.navItem} onClick={() => setActiveTab('author-income')}>
            <div className={`${styles.navIcon} ${activeTab === 'author-income' ? styles.active : ''}`}>
              ✍️
            </div>
            <span className={activeTab === 'author-income' ? styles.active : ''}>作者收入统计</span>
          </div>
          <div className={styles.navItem} onClick={() => setActiveTab('reader-income')}>
            <div className={`${styles.navIcon} ${activeTab === 'reader-income' ? styles.active : ''}`}>
              👥
            </div>
            <span className={activeTab === 'reader-income' ? styles.active : ''}>读者收入统计</span>
          </div>
          <div className={styles.navItem} onClick={() => setActiveTab('settlement-overview')}>
            <div className={`${styles.navIcon} ${activeTab === 'settlement-overview' ? styles.active : ''}`}>
              💳
            </div>
            <span className={activeTab === 'settlement-overview' ? styles.active : ''}>结算总览</span>
          </div>
          <div className={styles.navItem} onClick={() => setActiveTab('base-income')}>
            <div className={`${styles.navIcon} ${activeTab === 'base-income' ? styles.active : ''}`}>
              📊
            </div>
            <span className={activeTab === 'base-income' ? styles.active : ''}>基础收入统计-1</span>
          </div>
          <div className={styles.navItem} onClick={() => setActiveTab('author-royalty')}>
            <div className={`${styles.navIcon} ${activeTab === 'author-royalty' ? styles.active : ''}`}>
              💵
            </div>
            <span className={activeTab === 'author-royalty' ? styles.active : ''}>作者基础收入表-2</span>
          </div>
          <div className={styles.navItem} onClick={() => setActiveTab('commission-transaction')}>
            <div className={`${styles.navIcon} ${activeTab === 'commission-transaction' ? styles.active : ''}`}>
              💰
            </div>
            <span className={activeTab === 'commission-transaction' ? styles.active : ''}>推广佣金明细-3</span>
          </div>
          <div className={styles.navItem} onClick={() => setActiveTab('commission-settings')}>
            <div className={`${styles.navIcon} ${activeTab === 'commission-settings' ? styles.active : ''}`}>
              ⚙️
            </div>
            <span className={activeTab === 'commission-settings' ? styles.active : ''}>提成设置</span>
          </div>
        </div>

        {/* 右侧内容区域 */}
          <div className={styles.contentArea}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          
          {/* 小说审批选项卡 */}
          {activeTab === 'novel-review' && (
            <NovelReview onError={setError} />
          )}

          {/* 费用统计选项卡 */}
          {activeTab === 'payment-stats' && (
            <PaymentStats onError={setError} />
          )}

          {/* 作者收入统计选项卡 */}
          {activeTab === 'author-income' && (
            <AuthorIncome onError={setError} />
          )}

          {/* 读者收入统计选项卡 */}
          {activeTab === 'reader-income' && (
            <ReaderIncome onError={setError} />
          )}

          {/* 结算总览选项卡 */}
          {activeTab === 'settlement-overview' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2>结算总览</h2>
                <div className={styles.dateFilter}>
                  <input
                    type="month"
                    value={settlementMonth}
                    onChange={(e) => setSettlementMonth(e.target.value)}
                  />
                  <select
                    value={settlementStatus}
                    onChange={(e) => setSettlementStatus(e.target.value)}
                    style={{ marginLeft: '10px', padding: '5px' }}
                  >
                    <option value="all">全部状态</option>
                    <option value="unpaid">未支付</option>
                    <option value="paid">已支付</option>
                  </select>
                  <select
                    value={settlementRole}
                    onChange={(e) => setSettlementRole(e.target.value)}
                    style={{ marginLeft: '10px', padding: '5px' }}
                  >
                    <option value="all">全部用户</option>
                    <option value="author_only">仅作者</option>
                    <option value="promoter_only">仅推广者</option>
                  </select>
                  <input
                    type="text"
                    placeholder="用户ID"
                    value={settlementUserId}
                    onChange={(e) => setSettlementUserId(e.target.value)}
                    style={{ marginLeft: '10px', padding: '5px', width: '100px' }}
                  />
                  <button onClick={loadSettlementOverview} className={styles.searchButton} disabled={settlementLoading}>
                    查询
                  </button>
                  <button 
                    onClick={generateMonthlyIncome} 
                    className={styles.generateButton}
                    style={{ marginLeft: '10px' }}
                  >
                    生成月度汇总
                  </button>
                </div>
              </div>

              {settlementLoading ? (
                <div className={styles.loading}>加载中...</div>
              ) : (
                <>
                  <div className={styles.paymentTable}>
                    <h3>用户结算列表（作者+推广者）</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>用户</th>
                          <th>作者作品收入(USD)</th>
                          <th>读者推广收入(USD)</th>
                          <th>作者推广收入(USD)</th>
                          <th>当月总收入(USD)</th>
                          <th>支付状态</th>
                          <th>支付方式</th>
                          <th>支付币种</th>
                          <th>支付金额</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settlementData.length === 0 ? (
                          <tr>
                            <td colSpan={10} className={styles.emptyCell}>暂无数据</td>
                          </tr>
                        ) : (
                          settlementData.map((item: any) => {
                            // 只显示当月有收入的用户
                            if (!item.month_total_income || item.month_total_income <= 0) {
                              return null;
                            }
                            
                            const isExpanded = expandedRows[item.income_monthly_id];
                            const isLoading = loadingRows[item.income_monthly_id];
                            const rowDetail = expandedRows[item.income_monthly_id];
                            
                            return (
                            <React.Fragment key={item.user_id}>
                            <tr 
                              onClick={(e) => {
                                // 如果点击的是按钮或链接，不触发行的展开
                                const target = e.target as HTMLElement;
                                if (target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'A' || target.closest('a')) {
                                  return;
                                }
                                // 点击行时展开/折叠
                                if (item.income_monthly_id) {
                                  toggleRowExpansion(item.income_monthly_id);
                                }
                              }}
                              style={{ 
                                cursor: item.income_monthly_id ? 'pointer' : 'default',
                                backgroundColor: isExpanded ? '#f0f8ff' : 'transparent'
                              }}
                              title={item.income_monthly_id ? '点击展开/折叠查看支付详情' : ''}
                            >
                              <td>{item.pen_name || item.username || `用户${item.user_id}`}</td>
                              <td>${(item.month_author_base_income || 0).toFixed(2)}</td>
                              <td>${(item.month_reader_referral_income || 0).toFixed(2)}</td>
                              <td>${(item.month_author_referral_income || 0).toFixed(2)}</td>
                              <td><strong>${(item.month_total_income || 0).toFixed(2)}</strong></td>
                              <td>
                                <span 
                                  className={`${styles.status} ${
                                    item.month_status === 'paid' ? styles.completed :
                                    item.month_status === 'processing' ? styles.pending :
                                    item.month_status === 'failed' ? styles.error :
                                    styles.pending
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // 只有已支付状态才能点击查看详情（弹窗方式）
                                    if (item.month_status === 'paid' && item.income_monthly_id) {
                                      loadSettlementDetail(item.income_monthly_id);
                                    } else if (item.month_status === 'paid' && !item.income_monthly_id) {
                                      setError('该用户该月的收入记录ID不存在');
                                    }
                                  }}
                                  style={{
                                    cursor: item.month_status === 'paid' && item.income_monthly_id ? 'pointer' : 'default',
                                    textDecoration: item.month_status === 'paid' && item.income_monthly_id ? 'underline' : 'none',
                                    userSelect: 'none'
                                  }}
                                  title={item.month_status === 'paid' && item.income_monthly_id ? '点击查看支付详情（弹窗）' : ''}
                                >
                                  {item.month_status === 'paid' ? '已支付' :
                                   item.month_status === 'processing' ? '处理中' :
                                   item.month_status === 'failed' ? '失败' :
                                   '未支付'}
                                </span>
                              </td>
                              <td 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // 只有PayPal支付方式才能点击同步状态
                                  if (item.payout_method === 'paypal' && item.income_monthly_id) {
                                    syncPayPalStatusByIncomeMonthlyId(item.income_monthly_id);
                                  }
                                }}
                                style={{
                                  cursor: item.payout_method === 'paypal' && item.income_monthly_id ? 'pointer' : 'default',
                                  textDecoration: item.payout_method === 'paypal' && item.income_monthly_id ? 'underline' : 'none',
                                  color: item.payout_method === 'paypal' && item.income_monthly_id ? '#007bff' : 'inherit',
                                  userSelect: 'none'
                                }}
                                title={item.payout_method === 'paypal' && item.income_monthly_id ? '点击同步PayPal状态（只查询状态，不会重复扣款）' : ''}
                              >
                                {item.payout_method ? (item.payout_method === 'paypal' ? 'PayPal' : item.payout_method === 'alipay' ? '支付宝' : item.payout_method === 'wechat' ? '微信' : item.payout_method) : '-'}
                              </td>
                              <td>{item.payout_currency || '-'}</td>
                              <td>{item.payout_amount ? (item.payout_currency ? `${item.payout_currency} ${parseFloat(item.payout_amount).toFixed(2)}` : parseFloat(item.payout_amount).toFixed(2)) : '-'}</td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {/* 发起支付按钮 */}
                                  <button
                                    onClick={async () => {
                                      if (!item.income_monthly_id) {
                                        setError('该用户该月的收入记录ID不存在');
                                        return;
                                      }
                                      
                                      try {
                                        // 只加载用户收款账户信息，不显示用户结算详情对话框
                                        const token = localStorage.getItem('adminToken');
                                        const response = await fetch(`http://localhost:5000/api/admin/user-settlement/detail/${item.user_id}?months=1`, {
                                          headers: {
                                            'Authorization': `Bearer ${token}`
                                          }
                                        });
                                        
                                        const data = await response.json();
                                        
                                        if (!data.success || !data.data) {
                                          setError('加载用户账户信息失败');
                                          return;
                                        }
                                        
                                        const userDetailData = data.data;
                                        
                                        // 找到对应的月度收入记录
                                        let incomeMonthlyId = item.income_monthly_id || null;
                                        if (!incomeMonthlyId && userDetailData.monthly_incomes && userDetailData.monthly_incomes.length > 0) {
                                          const monthStr = settlementMonth + '-01';
                                          const matchingIncome = userDetailData.monthly_incomes.find((income: any) => {
                                            const incomeMonth = income.month ? income.month.toString().substring(0, 10) : '';
                                            return incomeMonth === monthStr || incomeMonth.startsWith(settlementMonth);
                                          });
                                          if (matchingIncome) {
                                            incomeMonthlyId = matchingIncome.id;
                                          }
                                        }
                                        
                                        const incomeMonthly = {
                                          id: incomeMonthlyId,
                                          user_id: item.user_id,
                                          month: settlementMonth + '-01',
                                          total_income_usd: item.month_total_income,
                                          author_base_income_usd: item.month_author_base_income || 0,
                                          reader_referral_income_usd: item.month_reader_referral_income || 0,
                                          author_referral_income_usd: item.month_author_referral_income || 0
                                        };
                                        
                                        // 如果还是没有 id，说明这个月的记录可能还没有生成，需要先提示用户生成月度汇总
                                        if (!incomeMonthlyId) {
                                          setError(`该用户 ${settlementMonth} 的月度收入记录尚未生成，请先点击"生成月度汇总"按钮`);
                                          return;
                                        }
                                        
                                        setSelectedIncomeMonthly(incomeMonthly);
                                        
                                        // 初始化支付表单（根据默认账户设置，使用返回的数据）
                                        if (userDetailData.default_account) {
                                          const defaultAccount = userDetailData.default_account;
                                          setPayoutForm({
                                            method: defaultAccount.method || 'paypal',
                                            account_id: defaultAccount.id.toString(),
                                            payout_currency: defaultAccount.method === 'alipay' || defaultAccount.method === 'wechat' ? 'CNY' : 'USD',
                                            fx_rate: defaultAccount.method === 'alipay' || defaultAccount.method === 'wechat' ? '7.20' : '1.0',
                                            note: ''
                                          });
                                        } else if (userDetailData.all_accounts && userDetailData.all_accounts.length > 0) {
                                          // 如果没有默认账户，使用第一个账户
                                          const firstAccount = userDetailData.all_accounts[0];
                                          setPayoutForm({
                                            method: firstAccount.method || 'paypal',
                                            account_id: firstAccount.id.toString(),
                                            payout_currency: firstAccount.method === 'alipay' || firstAccount.method === 'wechat' ? 'CNY' : 'USD',
                                            fx_rate: firstAccount.method === 'alipay' || firstAccount.method === 'wechat' ? '7.20' : '1.0',
                                            note: ''
                                          });
                                        } else {
                                          // 如果没有账户，使用默认值
                                          setPayoutForm({
                                            method: 'paypal',
                                            account_id: '',
                                            payout_currency: 'USD',
                                            fx_rate: '1.0',
                                            note: ''
                                          });
                                        }
                                        
                                        // 保存用户详情数据（用于创建支付弹窗显示），但不显示用户结算详情对话框
                                        setSelectedUserDetail(userDetailData);
                                        setShowUserDetailModal(false); // 不显示用户结算详情对话框
                                        
                                        // 显示创建支付弹窗
                                        setShowCreatePayoutModal(true);
                                      } catch (err: any) {
                                        setError('加载用户信息失败：' + (err.message || '未知错误'));
                                      }
                                    }}
                                    className={styles.searchButton}
                                    disabled={userDetailLoading || item.month_status === 'paid' || item.month_status === 'processing'}
                                    title={item.month_status === 'paid' ? '已支付' : item.month_status === 'processing' ? '处理中，请点击支付方式列同步PayPal状态' : '发起新的打款请求'}
                                    style={{ 
                                      opacity: (item.month_status === 'paid' || item.month_status === 'processing') ? 0.5 : 1,
                                      cursor: (item.month_status === 'paid' || item.month_status === 'processing') ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    {item.month_status === 'processing' ? '处理中' : '发起支付'}
                                  </button>
                                        </div>
                                </td>
                              </tr>
                            </React.Fragment>
                            );
                          }).filter(Boolean)
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 用户详情模态框 */}
                  {selectedUserDetail && (
                    <div className={styles.modal} onClick={() => setSelectedUserDetail(null)}>
                      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                          <h3>用户结算详情 - {selectedUserDetail.user.pen_name || selectedUserDetail.user.username}</h3>
                          <button onClick={() => setSelectedUserDetail(null)} className={styles.closeButton}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                          {userDetailLoading ? (
                            <div className={styles.loading}>加载中...</div>
                          ) : (
                            <>
                              {/* 顶部：基本信息 */}
                              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                                <h4 style={{ marginTop: 0 }}>基本信息</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                  <p><strong>用户:</strong> {selectedUserDetail.user?.pen_name || selectedUserDetail.user?.username || `用户${selectedUserDetail.user?.id}`}</p>
                                  <p><strong>用户ID:</strong> {selectedUserDetail.user?.id}</p>
                                  <p><strong>邮箱:</strong> {selectedUserDetail.user?.email || '-'}</p>
                                  <p><strong>月份:</strong> {settlementMonth}</p>
                                  <p><strong>是否作者:</strong> {selectedUserDetail.user?.is_author ? '是' : '否'}</p>
                                  <p><strong>是否推广者:</strong> {selectedUserDetail.user?.is_promoter ? '是' : '否'}</p>
                                  {selectedUserDetail.default_account && (
                                    <p><strong>默认收款账户:</strong> {selectedUserDetail.default_account.account_label} ({selectedUserDetail.default_account.method})</p>
                                  )}
                                </div>
                              </div>

                              {/* 当月收入信息 */}
                              {selectedUserDetail.monthly_incomes && selectedUserDetail.monthly_incomes.length > 0 && (
                                <div className={styles.paymentTable} style={{ marginBottom: '20px' }}>
                                  <h4>本月收入（USD）</h4>
                                  {selectedUserDetail.monthly_incomes.map((income: any) => {
                                    const formatMonth = (monthStr: string) => {
                                      try {
                                        const date = new Date(monthStr);
                                        const year = date.getFullYear();
                                        const month = date.getMonth() + 1;
                                        return `${year}年${month}月`;
                                      } catch (e) {
                                        return monthStr;
                                      }
                                    };
                                    
                                    return (
                                      <div key={income.month} style={{ padding: '15px', backgroundColor: '#fff', borderRadius: '4px', marginBottom: '10px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '10px' }}>
                                          <div>
                                            <strong>月份:</strong> {formatMonth(income.month)}
                                          </div>
                                          <div>
                                            <strong>作者基础收入:</strong> ${(income.author_base_income_usd || 0).toFixed(2)}
                                          </div>
                                          <div>
                                            <strong>读者推广:</strong> ${(income.reader_referral_income_usd || 0).toFixed(2)}
                                          </div>
                                          <div>
                                            <strong>作者推广:</strong> ${(income.author_referral_income_usd || 0).toFixed(2)}
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                                          <div>
                                            <strong>总收入:</strong> <span style={{ fontSize: '18px', color: '#e74c3c' }}>${(income.total_income_usd || 0).toFixed(2)}</span>
                                          </div>
                                          <div>
                                            <span className={`${styles.status} ${
                                              income.payout_status === 'paid' ? styles.completed : styles.pending
                                            }`}>
                                              {income.payout_status === 'paid' ? '已支付' : '未支付'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* 支付订单信息（user_payout） */}
                              {selectedUserDetail.payouts && selectedUserDetail.payouts.length > 0 && (
                                <div className={styles.paymentTable} style={{ marginBottom: '20px' }}>
                                  <h4>支付订单</h4>
                                <table>
                                  <thead>
                                    <tr>
                                      <th>支付单ID</th>
                                      <th>月份</th>
                                      <th>记账金额(USD)</th>
                                      <th>实付金额(币种)</th>
                                      <th>汇率</th>
                                      <th>方式</th>
                                      <th>状态</th>
                                      <th>申请时间</th>
                                      <th>支付时间</th>
                                      <th>备注</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedUserDetail.payouts.length === 0 ? (
                                      <tr>
                                        <td colSpan={10} className={styles.emptyCell}>暂无支付记录</td>
                                      </tr>
                                    ) : (
                                      selectedUserDetail.payouts.map((payout: any) => {
                                        const baseAmount = payout.base_amount_usd || 0;
                                        const payoutAmount = payout.payout_amount || 0;
                                        const payoutCurrency = payout.payout_currency || 'USD';
                                        const fxRate = payout.fx_rate || (payoutCurrency === 'USD' ? 1.0 : 0);
                                        
                                        // 格式化金额显示
                                        const amountDisplay = payoutCurrency === 'USD' 
                                          ? `$${payoutAmount.toFixed(2)}`
                                          : `¥${payoutAmount.toFixed(2)} ${payoutCurrency}`;
                                        
                                        const formatMonth = (monthStr: string) => {
                                          if (!monthStr) return '-';
                                          try {
                                            const date = new Date(monthStr);
                                            const year = date.getFullYear();
                                            const month = date.getMonth() + 1;
                                            return `${year}年${month}月`;
                                          } catch (e) {
                                            return monthStr;
                                          }
                                        };
                                        
                                        return (
                                        <tr key={payout.id}>
                                          <td>{payout.id}</td>
                                          <td>{payout.month ? formatMonth(payout.month) : '-'}</td>
                                          <td>${baseAmount.toFixed(2)}</td>
                                          <td>{amountDisplay}</td>
                                          <td>{fxRate > 0 ? fxRate.toFixed(4) : '-'}</td>
                                          <td>{payout.method}</td>
                                          <td>
                                            <span className={`${styles.status} ${
                                              payout.status === 'paid' ? styles.completed :
                                              payout.status === 'processing' ? styles.pending :
                                              payout.status === 'approved' ? styles.pending :
                                              payout.status === 'failed' ? styles.error :
                                              styles.pending
                                            }`}>
                                              {payout.status === 'paid' ? '已支付' :
                                               payout.status === 'processing' ? '处理中' :
                                               payout.status === 'approved' ? '已审核' :
                                               payout.status === 'pending' ? '待审核' :
                                               payout.status === 'failed' ? '失败' :
                                               payout.status === 'cancelled' ? '已取消' : payout.status}
                                            </span>
                                          </td>
                                          <td>{new Date(payout.requested_at).toLocaleString('zh-CN')}</td>
                                          <td>{payout.paid_at ? new Date(payout.paid_at).toLocaleString('zh-CN') : '-'}</td>
                                          <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                              <div>{payout.note || '-'}</div>
                                              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                {/* PayPal支付且状态为processing时，显示查询状态按钮 */}
                                                {payout.method === 'paypal' && payout.status === 'processing' && (
                                                  <button
                                                    onClick={() => checkPayoutStatus(payout.id)}
                                                    className={styles.generateButton}
                                                    disabled={checkingPayoutStatus === payout.id}
                                                    style={{ padding: '4px 8px', fontSize: '12px', minWidth: 'auto' }}
                                                  >
                                                    {checkingPayoutStatus === payout.id ? '查询中...' : '查询PayPal状态'}
                                                  </button>
                                                )}
                                                {/* 手动标记已支付按钮 */}
                                                {(payout.status === 'pending' || payout.status === 'processing') && (
                                                  <button
                                                    onClick={() => {
                                                      setSelectedPayoutId(payout.id);
                                                      setMarkPaidForm({
                                                        provider: 'bank_manual',
                                                        provider_tx_id: '',
                                                      });
                                                      setShowMarkPaidModal(true);
                                                    }}
                                                    className={styles.searchButton}
                                                    style={{ padding: '4px 8px', fontSize: '12px', minWidth: 'auto' }}
                                                  >
                                                    标记已支付
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                                
                                {/* 网关流水（payout_gateway_transaction）嵌套显示 */}
                                {selectedUserDetail.payouts.map((payout: any) => {
                                  if (!payout.gateway_tx_id) return null;
                                  
                                  return (
                                    <div key={`gateway-${payout.id}`} style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                                      <h5 style={{ marginTop: 0 }}>支付单 #{payout.id} - 网关流水</h5>
                                      {payout.gateway_transaction ? (
                                        <table style={{ width: '100%', fontSize: '14px' }}>
                                          <tbody>
                                            <tr>
                                              <td style={{ padding: '8px', fontWeight: 'bold', width: '150px' }}>第三方交易号:</td>
                                              <td style={{ padding: '8px' }}>{payout.gateway_transaction.provider_tx_id || '-'}</td>
                                            </tr>
                                            <tr>
                                              <td style={{ padding: '8px', fontWeight: 'bold' }}>支付网关:</td>
                                              <td style={{ padding: '8px' }}>{payout.gateway_transaction.provider || '-'}</td>
                                            </tr>
                                            <tr>
                                              <td style={{ padding: '8px', fontWeight: 'bold' }}>状态:</td>
                                              <td style={{ padding: '8px' }}>
                                                <span className={`${styles.status} ${
                                                  payout.gateway_transaction.status === 'succeeded' ? styles.completed :
                                                  payout.gateway_transaction.status === 'failed' ? styles.error :
                                                  styles.pending
                                                }`}>
                                                  {payout.gateway_transaction.status === 'succeeded' ? '成功' :
                                                   payout.gateway_transaction.status === 'failed' ? '失败' :
                                                   payout.gateway_transaction.status === 'processing' ? '处理中' :
                                                   payout.gateway_transaction.status === 'created' ? '已创建' : payout.gateway_transaction.status}
                                                </span>
                                              </td>
                                            </tr>
                                            {payout.gateway_transaction.error_message && (
                                              <tr>
                                                <td style={{ padding: '8px', fontWeight: 'bold' }}>错误信息:</td>
                                                <td style={{ padding: '8px', color: '#c62828' }}>{payout.gateway_transaction.error_message}</td>
                                              </tr>
                                            )}
                                            {payout.gateway_transaction.request_payload && (
                                              <tr>
                                                <td style={{ padding: '8px', fontWeight: 'bold', verticalAlign: 'top' }}>请求数据:</td>
                                                <td style={{ padding: '8px' }}>
                                                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '150px', overflow: 'auto' }}>
                                                    {typeof payout.gateway_transaction.request_payload === 'string' 
                                                      ? payout.gateway_transaction.request_payload 
                                                      : JSON.stringify(payout.gateway_transaction.request_payload, null, 2)}
                                                  </pre>
                                                </td>
                                              </tr>
                                            )}
                                            {payout.gateway_transaction.response_payload && (
                                              <tr>
                                                <td style={{ padding: '8px', fontWeight: 'bold', verticalAlign: 'top' }}>返回数据:</td>
                                                <td style={{ padding: '8px' }}>
                                                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '150px', overflow: 'auto' }}>
                                                    {typeof payout.gateway_transaction.response_payload === 'string' 
                                                      ? payout.gateway_transaction.response_payload 
                                                      : JSON.stringify(payout.gateway_transaction.response_payload, null, 2)}
                                                  </pre>
                                                </td>
                                              </tr>
                                            )}
                                            <tr>
                                              <td style={{ padding: '8px', fontWeight: 'bold' }}>创建时间:</td>
                                              <td style={{ padding: '8px' }}>
                                                {payout.gateway_transaction.created_at 
                                                  ? new Date(payout.gateway_transaction.created_at).toLocaleString('zh-CN')
                                                  : '-'}
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      ) : (
                                        <p style={{ color: '#666' }}>暂无网关流水信息</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 结算详情模态框（新版本，显示完整信息） */}
          {showSettlementDetailModal && selectedSettlementDetail && (
            <div className={styles.modal} onClick={() => setShowSettlementDetailModal(false)}>
              <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
                <div className={styles.modalHeader}>
                  <h3>
                    用户结算详情 - {selectedSettlementDetail.user.name} ({selectedSettlementDetail.income_monthly.month ? new Date(selectedSettlementDetail.income_monthly.month).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' }) : ''})
                  </h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {selectedSettlementDetail.payout && selectedSettlementDetail.payout.method === 'paypal' && selectedSettlementDetail.payout.gateway_tx_id && (
                      <button
                        onClick={() => syncPayPalStatus(selectedSettlementDetail.payout.id)}
                        className={styles.generateButton}
                        disabled={userDetailLoading}
                        style={{ padding: '6px 12px', fontSize: '14px' }}
                      >
                        {userDetailLoading ? '同步中...' : '同步PayPal支付状态'}
                      </button>
                    )}
                    <button onClick={() => setShowSettlementDetailModal(false)} className={styles.closeButton}>×</button>
                  </div>
                </div>
                <div className={styles.modalBody}>
                  {userDetailLoading ? (
                    <div className={styles.loading}>加载中...</div>
                  ) : (
                    <>
                      {/* 顶部汇总状态条 */}
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <strong>本月总收入:</strong> <span style={{ fontSize: '18px', color: '#e74c3c', fontWeight: 'bold' }}>${(selectedSettlementDetail.income_monthly.total_income_usd || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <strong>已结算金额:</strong> <span style={{ fontSize: '16px', color: '#27ae60' }}>${(selectedSettlementDetail.income_monthly.paid_amount_usd || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <strong>结算状态:</strong> <span className={`${styles.status} ${
                            selectedSettlementDetail.income_monthly.payout_status === 'paid' ? styles.completed : styles.pending
                          }`}>
                            {selectedSettlementDetail.income_monthly.payout_status === 'paid' ? '已支付' : '未支付'}
                          </span>
                        </div>
                        <div>
                          <strong>网关状态:</strong> {selectedSettlementDetail.gateway_tx ? (
                            <span className={`${styles.status} ${
                              selectedSettlementDetail.gateway_tx.status === 'succeeded' ? styles.completed :
                              selectedSettlementDetail.gateway_tx.status === 'failed' ? styles.error :
                              styles.pending
                            }`}>
                              {selectedSettlementDetail.gateway_tx.status === 'succeeded' ? '成功' :
                               selectedSettlementDetail.gateway_tx.status === 'failed' ? '失败' :
                               selectedSettlementDetail.gateway_tx.status === 'processing' ? '处理中' :
                               selectedSettlementDetail.gateway_tx.status}
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>未发起</span>
                          )}
                        </div>
                      </div>

                      {/* 区块一：基本信息 */}
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <h4 style={{ marginTop: 0 }}>基本信息</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <p><strong>用户:</strong> {selectedSettlementDetail.user.name}</p>
                          <p><strong>用户ID:</strong> {selectedSettlementDetail.user.id}</p>
                          <p><strong>邮箱:</strong> {selectedSettlementDetail.user.email || '-'}</p>
                          <p><strong>月份:</strong> {selectedSettlementDetail.income_monthly.month ? new Date(selectedSettlementDetail.income_monthly.month).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' }) : '-'}</p>
                          <p><strong>是否作者:</strong> {selectedSettlementDetail.user.is_author ? '是' : '否'}</p>
                          <p><strong>是否推广者:</strong> {selectedSettlementDetail.user.is_promoter ? '是' : '否'}</p>
                          {selectedSettlementDetail.user.default_payout_account_label && (
                            <p><strong>默认收款账户:</strong> {selectedSettlementDetail.user.default_payout_account_label}</p>
                          )}
                        </div>
                      </div>

                      {/* 区块二：本月收入情况 */}
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <h4 style={{ marginTop: 0 }}>本月收入明细（USD）</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <p><strong>作者基础收入:</strong> ${(selectedSettlementDetail.income_monthly.author_base_income_usd || 0).toFixed(2)}</p>
                          <p><strong>读者推荐收入:</strong> ${(selectedSettlementDetail.income_monthly.reader_referral_income_usd || 0).toFixed(2)}</p>
                          <p><strong>作者推荐收入:</strong> ${(selectedSettlementDetail.income_monthly.author_referral_income_usd || 0).toFixed(2)}</p>
                          <p><strong style={{ fontSize: '16px', color: '#e74c3c' }}>总收入:</strong> <span style={{ fontSize: '18px', color: '#e74c3c', fontWeight: 'bold' }}>${(selectedSettlementDetail.income_monthly.total_income_usd || 0).toFixed(2)}</span></p>
                          <p><strong>已支付金额:</strong> ${(selectedSettlementDetail.income_monthly.paid_amount_usd || 0).toFixed(2)}</p>
                          <p><strong>结算状态:</strong> <span className={`${styles.status} ${
                            selectedSettlementDetail.income_monthly.payout_status === 'paid' ? styles.completed : styles.pending
                          }`}>
                            {selectedSettlementDetail.income_monthly.payout_status === 'paid' ? '已支付' : '未支付'}
                          </span></p>
                          <p><strong>创建时间:</strong> {selectedSettlementDetail.income_monthly.created_at ? new Date(selectedSettlementDetail.income_monthly.created_at).toLocaleString('zh-CN') : '-'}</p>
                          <p><strong>最近更新时间:</strong> {selectedSettlementDetail.income_monthly.updated_at ? new Date(selectedSettlementDetail.income_monthly.updated_at).toLocaleString('zh-CN') : '-'}</p>
                        </div>
                      </div>

                      {/* 区块三：结算/打款记录 */}
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <h4 style={{ marginTop: 0 }}>结算与打款记录</h4>
                        {!selectedSettlementDetail.payout ? (
                          <p style={{ color: '#999', fontStyle: 'italic' }}>尚未生成结算记录</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <p><strong>结算单ID:</strong> {selectedSettlementDetail.payout.id}</p>
                            <p><strong>结算月份:</strong> {selectedSettlementDetail.payout.month ? new Date(selectedSettlementDetail.payout.month).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' }) : '-'}</p>
                            <p><strong>关联收入记录ID:</strong> {selectedSettlementDetail.payout.income_monthly_id || '-'}</p>
                            <p><strong>结算基准金额（USD）:</strong> ${(selectedSettlementDetail.payout.base_amount_usd || 0).toFixed(2)}</p>
                            <p><strong>结算币种:</strong> {selectedSettlementDetail.payout.payout_currency || 'USD'}</p>
                            <p><strong>实际打款金额:</strong> {selectedSettlementDetail.payout.payout_currency === 'USD' ? '$' : '¥'}{(selectedSettlementDetail.payout.payout_amount || 0).toFixed(2)}</p>
                            <p><strong>汇率:</strong> {(selectedSettlementDetail.payout.fx_rate || 0).toFixed(6)}</p>
                            <p><strong>结算状态:</strong> <span className={`${styles.status} ${
                              selectedSettlementDetail.payout.status === 'paid' ? styles.completed :
                              selectedSettlementDetail.payout.status === 'processing' ? styles.pending :
                              selectedSettlementDetail.payout.status === 'failed' ? styles.error :
                              styles.pending
                            }`}>
                              {selectedSettlementDetail.payout.status === 'paid' ? '已支付' :
                               selectedSettlementDetail.payout.status === 'processing' ? '处理中' :
                               selectedSettlementDetail.payout.status === 'pending' ? '待审核' :
                               selectedSettlementDetail.payout.status === 'failed' ? '失败' :
                               selectedSettlementDetail.payout.status === 'cancelled' ? '已取消' : selectedSettlementDetail.payout.status}
                            </span></p>
                            <p><strong>打款方式:</strong> {selectedSettlementDetail.payout.method || '-'}</p>
                            {selectedSettlementDetail.payout.account_info && (
                              <>
                                <p><strong>收款账户:</strong> {selectedSettlementDetail.payout.account_info.account_label || '-'}</p>
                                {selectedSettlementDetail.payout.account_info.account_data?.email && (
                                  <p><strong>收款邮箱:</strong> {selectedSettlementDetail.payout.account_info.account_data.email}</p>
                                )}
                              </>
                            )}
                            <p><strong>发起时间:</strong> {selectedSettlementDetail.payout.requested_at ? new Date(selectedSettlementDetail.payout.requested_at).toLocaleString('zh-CN') : '-'}</p>
                            <p><strong>完成时间:</strong> {selectedSettlementDetail.payout.paid_at ? new Date(selectedSettlementDetail.payout.paid_at).toLocaleString('zh-CN') : '-'}</p>
                            {selectedSettlementDetail.payout.admin_id && (
                              <p><strong>操作管理员ID:</strong> {selectedSettlementDetail.payout.admin_id}</p>
                            )}
                            {selectedSettlementDetail.payout.note && (
                              <p><strong>备注:</strong> {selectedSettlementDetail.payout.note}</p>
                            )}
                            <p><strong>网关交易记录ID:</strong> {selectedSettlementDetail.payout.gateway_tx_id || '-'}</p>
                          </div>
                        )}
                      </div>

                      {/* 区块四：支付网关结果 */}
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <h4 style={{ marginTop: 0 }}>支付网关交易信息</h4>
                        {!selectedSettlementDetail.gateway_tx ? (
                          <p style={{ color: '#999', fontStyle: 'italic' }}>暂无网关交易记录（可能尚未发起或发起失败）</p>
                        ) : (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                              <p><strong>网关记录ID:</strong> {selectedSettlementDetail.gateway_tx.id}</p>
                              <p><strong>支付提供方:</strong> {selectedSettlementDetail.gateway_tx.provider || '-'}</p>
                              <p><strong>网关交易号:</strong> {selectedSettlementDetail.gateway_tx.provider_tx_id || '-'}</p>
                              <p><strong>网关状态:</strong> <span className={`${styles.status} ${
                                selectedSettlementDetail.gateway_tx.status === 'succeeded' ? styles.completed :
                                selectedSettlementDetail.gateway_tx.status === 'failed' ? styles.error :
                                styles.pending
                              }`}>
                                {selectedSettlementDetail.gateway_tx.status === 'succeeded' ? '成功' :
                                 selectedSettlementDetail.gateway_tx.status === 'failed' ? '失败' :
                                 selectedSettlementDetail.gateway_tx.status === 'processing' ? '处理中' :
                                 selectedSettlementDetail.gateway_tx.status}
                              </span></p>
                              <p><strong>基准金额（USD）:</strong> ${(selectedSettlementDetail.gateway_tx.base_amount_usd || 0).toFixed(2)}</p>
                              <p><strong>币种:</strong> {selectedSettlementDetail.gateway_tx.payout_currency || 'USD'}</p>
                              <p><strong>打款金额:</strong> {selectedSettlementDetail.gateway_tx.payout_currency === 'USD' ? '$' : '¥'}{(selectedSettlementDetail.gateway_tx.payout_amount || 0).toFixed(2)}</p>
                              <p><strong>汇率:</strong> {(selectedSettlementDetail.gateway_tx.fx_rate || 0).toFixed(6)}</p>
                              <p><strong>创建时间:</strong> {selectedSettlementDetail.gateway_tx.created_at ? new Date(selectedSettlementDetail.gateway_tx.created_at).toLocaleString('zh-CN') : '-'}</p>
                              <p><strong>更新时间:</strong> {selectedSettlementDetail.gateway_tx.updated_at ? new Date(selectedSettlementDetail.gateway_tx.updated_at).toLocaleString('zh-CN') : '-'}</p>
                              {selectedSettlementDetail.gateway_tx.error_code && (
                                <p><strong>错误代码:</strong> <span style={{ color: '#e74c3c' }}>{selectedSettlementDetail.gateway_tx.error_code}</span></p>
                              )}
                              {selectedSettlementDetail.gateway_tx.error_message && (
                                <p><strong>错误信息:</strong> <span style={{ color: '#e74c3c' }}>{selectedSettlementDetail.gateway_tx.error_message}</span></p>
                              )}
                            </div>
                            
                            {/* 可展开的JSON区块 */}
                            {selectedSettlementDetail.gateway_tx.request_payload && (
                              <details style={{ marginBottom: '10px' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 'bold', padding: '5px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>查看原始请求数据</summary>
                                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', marginTop: '5px' }}>
                                  {typeof selectedSettlementDetail.gateway_tx.request_payload === 'string' 
                                    ? selectedSettlementDetail.gateway_tx.request_payload 
                                    : JSON.stringify(selectedSettlementDetail.gateway_tx.request_payload, null, 2)}
                                </pre>
                              </details>
                            )}
                            
                            {selectedSettlementDetail.gateway_tx.response_payload && (
                              <details>
                                <summary style={{ cursor: 'pointer', fontWeight: 'bold', padding: '5px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>查看原始响应数据</summary>
                                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', marginTop: '5px' }}>
                                  {typeof selectedSettlementDetail.gateway_tx.response_payload === 'string' 
                                    ? selectedSettlementDetail.gateway_tx.response_payload 
                                    : JSON.stringify(selectedSettlementDetail.gateway_tx.response_payload, null, 2)}
                                </pre>
                              </details>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* 支付确认弹窗 */}
          {showPaymentConfirmModal && pendingPaymentInfo && (
            <div className={styles.modal} onClick={() => {
              if (!processingPayment) {
                setShowPaymentConfirmModal(false);
                setPendingPayoutId(null);
                setPendingPaymentInfo(null);
              }
            }}>
              <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className={styles.modalHeader}>
                  <h3>确认支付</h3>
                  <button 
                    onClick={() => {
                      if (!processingPayment) {
                        setShowPaymentConfirmModal(false);
                        setPendingPayoutId(null);
                        setPendingPaymentInfo(null);
                      }
                    }} 
                    className={styles.closeButton}
                    disabled={processingPayment}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <div style={{ 
                    padding: '20px', 
                    backgroundColor: '#fff3cd', 
                    borderRadius: '8px', 
                    marginBottom: '20px',
                    border: '2px solid #ffc107'
                  }}>
                    <h4 style={{ marginTop: 0, color: '#856404' }}>⚠️ 请仔细核对以下信息</h4>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>支付对象:</strong></label>
                    <p style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      {pendingPaymentInfo.user_name} (ID: {pendingPaymentInfo.user_id})
                    </p>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>月份:</strong></label>
                    <p>{pendingPaymentInfo.month}</p>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>支付方式:</strong></label>
                    <p style={{ fontSize: '16px', fontWeight: 'bold' }}>{pendingPaymentInfo.method_display}</p>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>收款账户:</strong></label>
                    <p style={{ fontSize: '16px', fontWeight: 'bold' }}>{pendingPaymentInfo.account_label}</p>
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>
                        {JSON.stringify(pendingPaymentInfo.account_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>记账金额（USD）:</strong></label>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                      ${pendingPaymentInfo.base_amount_usd.toFixed(2)}
                    </p>
                  </div>
                  
                  {pendingPaymentInfo.payout_currency !== 'USD' && (
                    <>
                      <div style={{ marginBottom: '15px' }}>
                        <label><strong>汇率:</strong></label>
                        <p>1 USD = {pendingPaymentInfo.fx_rate.toFixed(4)} {pendingPaymentInfo.payout_currency}</p>
                      </div>
                    </>
                  )}
                  
                  <div style={{ 
                    marginBottom: '20px', 
                    padding: '15px', 
                    backgroundColor: '#d4edda', 
                    borderRadius: '8px',
                    border: '2px solid #28a745'
                  }}>
                    <label><strong>实际支付金额:</strong></label>
                    <p style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold', 
                      color: '#155724',
                      margin: '10px 0 0 0'
                    }}>
                      {pendingPaymentInfo.payout_currency === 'USD' ? '$' : '¥'}
                      {pendingPaymentInfo.payout_amount.toFixed(2)} {pendingPaymentInfo.payout_currency}
                    </p>
                  </div>
                  
                  {pendingPaymentInfo.note && (
                    <div style={{ marginBottom: '15px' }}>
                      <label><strong>备注:</strong></label>
                      <p>{pendingPaymentInfo.note}</p>
                    </div>
                  )}
                  
                  {error && (
                    <div style={{ 
                      padding: '10px', 
                      backgroundColor: '#f8d7da', 
                      color: '#721c24', 
                      borderRadius: '4px',
                      marginBottom: '15px'
                    }}>
                      {error}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button 
                      onClick={() => {
                        if (!processingPayment) {
                          setShowPaymentConfirmModal(false);
                          setPendingPayoutId(null);
                          setPendingPaymentInfo(null);
                        }
                      }} 
                      className={styles.searchButton}
                      disabled={processingPayment}
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmAndExecutePayment}
                      className={styles.generateButton}
                      disabled={processingPayment}
                      style={{ 
                        backgroundColor: processingPayment ? '#ccc' : '#28a745',
                        minWidth: '120px'
                      }}
                    >
                      {processingPayment ? '处理中...' : '确认支付'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 发起支付弹窗（基于月度收入记录，支持汇率） */}
          {showCreatePayoutModal && selectedIncomeMonthly && selectedUserDetail && (
            <div className={styles.modal} onClick={() => {
              setShowCreatePayoutModal(false);
              setSelectedIncomeMonthly(null);
            }}>
              <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className={styles.modalHeader}>
                  <h3>发起支付</h3>
                  <button onClick={() => {
                    setShowCreatePayoutModal(false);
                    setSelectedIncomeMonthly(null);
                  }} className={styles.closeButton}>×</button>
                </div>
                <div className={styles.modalBody}>
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>支付对象:</strong></label>
                    <p>{selectedUserDetail.user?.pen_name || selectedUserDetail.user?.username || `用户${selectedIncomeMonthly.user_id}`} (ID: {selectedIncomeMonthly.user_id})</p>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>月份:</strong></label>
                    <p>{settlementMonth}</p>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>本月收入（USD）:</strong></label>
                    <p style={{ color: '#e74c3c', fontSize: '18px' }}>${(selectedIncomeMonthly.total_income_usd || 0).toFixed(2)}</p>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>支付方式:</strong></label>
                    <select
                      value={payoutForm.method}
                      onChange={(e) => {
                        const newMethod = e.target.value.toLowerCase();
                        // 根据支付方式自动设置币种和汇率
                        let newCurrency = 'USD';
                        let newFxRate = '1.0';
                        if (newMethod === 'alipay' || newMethod === 'wechat') {
                          newCurrency = 'CNY';
                          newFxRate = '7.20';
                        }
                        setPayoutForm({ 
                          ...payoutForm, 
                          method: newMethod,
                          payout_currency: newCurrency,
                          fx_rate: newFxRate
                        });
                      }}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    >
                      <option value="paypal">PayPal</option>
                      <option value="alipay">支付宝</option>
                      <option value="wechat">微信</option>
                      <option value="bank_transfer">银行转账</option>
                      <option value="manual">手动</option>
                    </select>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>收款账户:</strong></label>
                    {selectedUserDetail.all_accounts && selectedUserDetail.all_accounts.length > 0 ? (
                      <>
                        <select
                          value={payoutForm.account_id}
                          onChange={(e) => {
                            const accountId = e.target.value;
                            const selectedAccount = selectedUserDetail.all_accounts.find((acc: any) => acc.id.toString() === accountId);
                            setPayoutForm({ 
                              ...payoutForm, 
                              account_id: accountId,
                              // 根据账户的支付方式自动设置币种
                              payout_currency: selectedAccount?.method === 'alipay' || selectedAccount?.method === 'wechat' ? 'CNY' : 'USD',
                              fx_rate: selectedAccount?.method === 'alipay' || selectedAccount?.method === 'wechat' ? '7.20' : '1.0'
                            });
                          }}
                          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        >
                          {selectedUserDetail.all_accounts.map((acc: any) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.account_label} ({acc.method}) {acc.is_default ? '(默认)' : ''}
                            </option>
                          ))}
                        </select>
                        {payoutForm.account_id && (() => {
                          const selectedAccount = selectedUserDetail.all_accounts.find((acc: any) => acc.id.toString() === payoutForm.account_id.toString());
                          return selectedAccount && (
                            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                              <p><strong>账户详情:</strong></p>
                              <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(selectedAccount.account_data, null, 2)}
                              </pre>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <p style={{ color: '#e74c3c', marginTop: '5px' }}>该用户尚未设置收款账户</p>
                    )}
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>支付币种:</strong></label>
                    <select
                      value={payoutForm.payout_currency}
                      onChange={(e) => {
                        const newCurrency = e.target.value;
                        setPayoutForm({ 
                          ...payoutForm, 
                          payout_currency: newCurrency,
                          fx_rate: newCurrency === 'USD' ? '1.0' : payoutForm.fx_rate
                        });
                      }}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    >
                      <option value="USD">USD（美元）</option>
                      <option value="CNY">CNY（人民币）</option>
                    </select>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>汇率 (1 USD = ? {payoutForm.payout_currency}):</strong></label>
                    <input
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      value={payoutForm.fx_rate}
                      onChange={(e) => setPayoutForm({ ...payoutForm, fx_rate: e.target.value })}
                      disabled={payoutForm.payout_currency === 'USD'}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', backgroundColor: payoutForm.payout_currency === 'USD' ? '#f5f5f5' : 'white' }}
                    />
                    {payoutForm.payout_currency === 'USD' && (
                      <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>USD支付的汇率固定为1.0</p>
                    )}
                  </div>
                  
                  <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
                    <label><strong>预计支付金额:</strong></label>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#2e7d32', marginTop: '5px' }}>
                      {payoutForm.payout_currency === 'USD' 
                        ? `$${((selectedIncomeMonthly.total_income_usd || 0) * parseFloat(payoutForm.fx_rate || '1')).toFixed(2)}`
                        : `¥${((selectedIncomeMonthly.total_income_usd || 0) * parseFloat(payoutForm.fx_rate || '1')).toFixed(2)} ${payoutForm.payout_currency}`
                      }
                    </p>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                      记账金额: ${(selectedIncomeMonthly.total_income_usd || 0).toFixed(2)} USD × 汇率 {payoutForm.fx_rate} = {payoutForm.payout_currency === 'USD' ? '$' : '¥'}{((selectedIncomeMonthly.total_income_usd || 0) * parseFloat(payoutForm.fx_rate || '1')).toFixed(2)}
                    </p>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>备注 (可选):</strong></label>
                    <textarea
                      value={payoutForm.note}
                      onChange={(e) => setPayoutForm({ ...payoutForm, note: e.target.value })}
                      placeholder={`例如：结算${settlementMonth}收入`}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '60px' }}
                    />
                  </div>
                  
                  {error && (
                    <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px' }}>
                      {error}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button onClick={() => {
                      setShowCreatePayoutModal(false);
                      setSelectedIncomeMonthly(null);
                    }} className={styles.searchButton}>
                      取消
                    </button>
                    <button
                      onClick={createPayout}
                      className={styles.generateButton}
                      disabled={creatingPayout || !payoutForm.account_id}
                    >
                      {creatingPayout ? '创建中...' : '确认创建支付订单'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 标记已支付弹窗 */}
          {showMarkPaidModal && selectedPayoutId && (
            <div className={styles.modal} onClick={() => setShowMarkPaidModal(false)}>
              <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className={styles.modalHeader}>
                  <h3>标记支付成功</h3>
                  <button onClick={() => setShowMarkPaidModal(false)} className={styles.closeButton}>×</button>
                </div>
                <div className={styles.modalBody}>
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>支付单ID:</strong></label>
                    <p>{selectedPayoutId}</p>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>支付提供商:</strong></label>
                    <select
                      value={markPaidForm.provider}
                      onChange={(e) => setMarkPaidForm({ ...markPaidForm, provider: e.target.value })}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    >
                      <option value="bank_manual">银行转账（人工）</option>
                      <option value="alipay">支付宝</option>
                      <option value="paypal">PayPal</option>
                      <option value="wechat">微信</option>
                      <option value="stripe">Stripe</option>
                    </select>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>第三方交易号 *:</strong></label>
                    <input
                      type="text"
                      value={markPaidForm.provider_tx_id}
                      onChange={(e) => setMarkPaidForm({ ...markPaidForm, provider_tx_id: e.target.value })}
                      placeholder="请输入银行流水号或交易号"
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button onClick={() => setShowMarkPaidModal(false)} className={styles.searchButton}>
                      取消
                    </button>
                    <button
                      onClick={markPayoutAsPaid}
                      className={styles.generateButton}
                      disabled={markingPaid || !markPaidForm.provider_tx_id}
                    >
                      {markingPaid ? '处理中...' : '确认标记已支付'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 基础收入统计选项卡 */}
          {activeTab === 'base-income' && (
            <BaseIncome onError={setError} />
          )}

          {/* 作者基础收入表选项卡 */}
          {activeTab === 'author-royalty' && (
            <AuthorRoyalty onError={setError} />
          )}

          {/* 推广佣金明细选项卡 */}
          {activeTab === 'commission-transaction' && (
            <CommissionTransaction onError={setError} />
          )}

          {/* 提成设置选项卡 */}
          {activeTab === 'commission-settings' && (
            <CommissionSettings onError={setError} />
                  )}
                </div>
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
              {selectedNovel.cover && (
                <img 
                  src={selectedNovel.cover.startsWith('http') ? selectedNovel.cover : `http://localhost:5000/covers/${selectedNovel.cover}`}
                  alt={selectedNovel.title}
                  className={styles.modalCover}
                />
              )}
              <div className={styles.modalDetails}>
                <p><strong>作者:</strong> {selectedNovel.author_name || selectedNovel.pen_name || selectedNovel.author}</p>
                <p><strong>翻译:</strong> {selectedNovel.translator || '无'}</p>
                <p><strong>状态:</strong> 
                  <span className={`${styles.status} ${styles[selectedNovel.review_status]}`}>
                    {selectedNovel.review_status === 'submitted' ? '已提交' :
                     selectedNovel.review_status === 'reviewing' ? '审核中' :
                     selectedNovel.review_status === 'approved' ? '已批准' :
                     selectedNovel.review_status === 'rejected' ? '已拒绝' : selectedNovel.review_status}
                                </span>
                </p>
                <p><strong>创建时间:</strong> {new Date(selectedNovel.created_at).toLocaleString('zh-CN')}</p>
                {selectedNovel.description && (
                  <div>
                    <strong>描述:</strong>
                    <p className={styles.modalDescription}>{selectedNovel.description}</p>
                                  </div>
                                )}
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

      
      {/* Toast提示 */}
      {toast && (
                    <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '15px 20px',
          backgroundColor: toast.type === 'success' ? '#28a745' : 
                          toast.type === 'error' ? '#dc3545' : '#17a2b8',
          color: 'white',
                      borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 10000,
          minWidth: '300px',
          maxWidth: '500px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{toast.message}</span>
                      <button
              onClick={() => setToast(null)}
                        style={{
                background: 'none',
                          border: 'none',
                          color: 'white',
                fontSize: '20px',
                          cursor: 'pointer',
                marginLeft: '15px',
                padding: '0',
                width: '24px',
                height: '24px',
                                                display: 'flex',
                                                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
                                          </button>
                                        </div>
                                    </div>
      )}
      
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminPanel;

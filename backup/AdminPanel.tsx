import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../services/ApiService';
import styles from './AdminPanel.module.css';

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
  
  // 如果已经是正确的格式，直接返�?
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  try {
    // 处理 MySQL DATETIME 格式 (2025-01-01 00:00:00) �?ISO 格式
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // 获取本地时间的各个部�?
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

// 辅助函数：获取头像完整URL
const getAvatarUrl = (avatar?: string | null): string => {
  if (!avatar) {
    // 返回默认头像（可以使用一个占位图�?
    return 'https://i.pravatar.cc/60?img=1';
  }
  
  // 如果已经是完整URL，直接返�?
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  
  // 如果是相对路径，添加API基础URL
  if (avatar.startsWith('/')) {
    return `http://localhost:5000${avatar}`;
  }
  
  // 如果是文件名，添加avatars路径
  return `http://localhost:5000/avatars/${avatar}`;
};

const AdminPanel: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('novel-review');
  
  // 小说审批相关状�?
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // 费用统计相关状�?
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // 新的费用统计状态（基于订阅和Karma�?
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
  
  // 提成设置相关状�?
  const [commissionSettingsTab, setCommissionSettingsTab] = useState<'chapter-pricing' | 'plans' | 'karma' | 'author'>('chapter-pricing');
  const [plansSubTab, setPlansSubTab] = useState<'plans-list' | 'referrals'>('plans-list'); // 推广分成方案二级Tab
  const [commissionPlans, setCommissionPlans] = useState<any[]>([]);
  const [commissionPlansLoading, setCommissionPlansLoading] = useState(false);
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
  
  // 用户绑定关系相关状�?
  const [referralsData, setReferralsData] = useState<any[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsTotal, setReferralsTotal] = useState(0);
  const [referralsPage, setReferralsPage] = useState(1);
  const [referralsPageSize, setReferralsPageSize] = useState(20);
  // unlockprice列表相关状�?
  const [unlockpriceList, setUnlockpriceList] = useState<any[]>([]);
  const [unlockpriceLoading, setUnlockpriceLoading] = useState(false);
  const [unlockpricePagination, setUnlockpricePagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [unlockpriceFilters, setUnlockpriceFilters] = useState({ novel_id: '', user_id: '' });
  const [unlockpriceSort, setUnlockpriceSort] = useState({ sort_by: 'id', sort_order: 'DESC' });
  const [editingUnlockpriceItem, setEditingUnlockpriceItem] = useState<any>(null);
  
  // unlockprice查询搜索选择相关状态（使用不同的变量名避免冲突�?
  const [unlockpriceUserSearchQuery, setUnlockpriceUserSearchQuery] = useState('');
  const [unlockpriceUserSearchResults, setUnlockpriceUserSearchResults] = useState<any[]>([]);
  const [unlockpriceUserSearchOpen, setUnlockpriceUserSearchOpen] = useState(false);
  const [selectedUserForPricing, setSelectedUserForPricing] = useState<any>(null);
  
  const [unlockpriceNovelSearchQuery, setUnlockpriceNovelSearchQuery] = useState('');
  const [unlockpriceNovelSearchResults, setUnlockpriceNovelSearchResults] = useState<any[]>([]);
  const [unlockpriceNovelSearchOpen, setUnlockpriceNovelSearchOpen] = useState(false);
  const [selectedNovelForPricing, setSelectedNovelForPricing] = useState<any>(null);
  
  // 加载unlockprice列表
  const loadUnlockpriceList = useCallback(async (page?: number, resetPage?: boolean) => {
    setUnlockpriceLoading(true);
    try {
      const currentPage = page !== undefined ? page : (resetPage ? 1 : unlockpricePagination.page);
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', unlockpricePagination.limit.toString());
      params.append('sort_by', unlockpriceSort.sort_by);
      params.append('sort_order', unlockpriceSort.sort_order);
      if (unlockpriceFilters.novel_id) params.append('novel_id', unlockpriceFilters.novel_id);
      if (unlockpriceFilters.user_id) params.append('user_id', unlockpriceFilters.user_id);
      
      const response = await ApiService.get(`/admin/unlockprice/list?${params.toString()}`);
      if (response.success) {
        setUnlockpriceList(response.data || []);
        if (response.pagination) {
          // 后端返回�?pagination 使用 limit，�?PaginationInfo 使用 pageSize
          const pagination = response.pagination as any;
          setUnlockpricePagination({
            page: pagination.page || currentPage,
            limit: pagination.limit || pagination.pageSize || unlockpricePagination.limit,
            total: pagination.total || 0,
            totalPages: pagination.totalPages || 0
          });
        }
      } else {
        window.alert(response.message || '查询失败');
      }
    } catch (error: any) {
      console.error('查询失败:', error);
      window.alert('查询失败: ' + (error.message || '未知错误'));
    } finally {
      setUnlockpriceLoading(false);
    }
  }, [unlockpricePagination.limit, unlockpriceSort.sort_by, unlockpriceSort.sort_order, unlockpriceFilters.novel_id, unlockpriceFilters.user_id]);

  // 当切换到定价配置管理标签时，自动加载列表
  useEffect(() => {
    if (commissionSettingsTab === 'chapter-pricing') {
      loadUnlockpriceList(1, true);
    }
  }, [commissionSettingsTab]);
  
  // 当排序或筛选条件改变时重新加载（重置到第一页）
  useEffect(() => {
    if (commissionSettingsTab === 'chapter-pricing') {
      loadUnlockpriceList(1, true);
    }
  }, [unlockpriceSort.sort_by, unlockpriceSort.sort_order, unlockpriceFilters.novel_id, unlockpriceFilters.user_id]);
  
  // 当页码改变时重新加载
  useEffect(() => {
    if (commissionSettingsTab === 'chapter-pricing' && unlockpricePagination.page > 0) {
      loadUnlockpriceList(unlockpricePagination.page, false);
    }
  }, [unlockpricePagination.page]);
  
  // 搜索用户（用于unlockprice查询�?
  const searchUsersForPricing = useCallback(async (query: string) => {
    if (!query || query.trim() === '') {
      setUnlockpriceUserSearchResults([]);
      return;
    }
    
    try {
      const response = await ApiService.get(`/admin/users/search?q=${encodeURIComponent(query)}`);
      if (response.success) {
        setUnlockpriceUserSearchResults(response.data || []);
      }
    } catch (error: any) {
      console.error('搜索用户失败:', error);
      setUnlockpriceUserSearchResults([]);
    }
  }, []);
  
  // 搜索小说（用于unlockprice查询�?
  const searchNovelsForPricing = useCallback(async (query: string) => {
    if (!query || query.trim() === '') {
      setUnlockpriceNovelSearchResults([]);
      return;
    }
    
    try {
      const response = await ApiService.get(`/admin/novels/search?q=${encodeURIComponent(query)}`);
      if (response.success) {
        setUnlockpriceNovelSearchResults(response.data || []);
      }
    } catch (error: any) {
      console.error('搜索小说失败:', error);
      setUnlockpriceNovelSearchResults([]);
    }
  }, []);
  
  const [referralsFilters, setReferralsFilters] = useState({
    user_id: '',
    referrer_id: '',
    promoter_plan_id: '',
    author_plan_id: '',
    created_from: '',
    created_to: ''
  });
  const [promoterPlanOptions, setPromoterPlanOptions] = useState<any[]>([]);
  const [authorPlanOptions, setAuthorPlanOptions] = useState<any[]>([]);
  
  // 用户详情对话框相关状�?
  const [userDialogVisible, setUserDialogVisible] = useState(false);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  
  // 方案详情对话框相关状�?
  const [planDialogVisible, setPlanDialogVisible] = useState(false);
  const [planDetail, setPlanDetail] = useState<any>(null);
  const [planDetailLoading, setPlanDetailLoading] = useState(false);
  
  // 编辑推广方案对话框相关状�?
  const [editReferralDialogVisible, setEditReferralDialogVisible] = useState(false);
  const [editingReferral, setEditingReferral] = useState<any>(null);
  const [editPromoterPlanId, setEditPromoterPlanId] = useState<string>('');
  const [editAuthorPlanId, setEditAuthorPlanId] = useState<string>('');
  const [savingReferral, setSavingReferral] = useState(false);
  
  // 作者收入统计相关状�?
  const [authorIncomeMonth, setAuthorIncomeMonth] = useState('');
  const [authorIncomeData, setAuthorIncomeData] = useState<any>(null);
  const [authorIncomeLoading, setAuthorIncomeLoading] = useState(false);
  
  // 读者收入统计相关状�?
  const [readerIncomeMonth, setReaderIncomeMonth] = useState('');
  const [readerIncomeData, setReaderIncomeData] = useState<any>(null);
  const [readerIncomeLoading, setReaderIncomeLoading] = useState(false);
  
  // 基础收入统计相关状�?
  const [baseIncomeMonth, setBaseIncomeMonth] = useState('');
  const [baseIncomeData, setBaseIncomeData] = useState<any>(null);
  const [baseIncomeLoading, setBaseIncomeLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // 作者基础收入表相关状�?
  const [authorRoyaltyMonth, setAuthorRoyaltyMonth] = useState('');
  const [authorRoyaltyData, setAuthorRoyaltyData] = useState<any>(null);
  const [authorRoyaltyLoading, setAuthorRoyaltyLoading] = useState(false);
  const [authorRoyaltyGenerating, setAuthorRoyaltyGenerating] = useState(false);
  const [authorRoyaltySearchQuery, setAuthorRoyaltySearchQuery] = useState('');

  // 推广佣金明细相关状�?
  const [commissionMonth, setCommissionMonth] = useState('');
  const [commissionData, setCommissionData] = useState<any>(null);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionGenerating, setCommissionGenerating] = useState(false);
  const [commissionSearchQuery, setCommissionSearchQuery] = useState('');
  const [commissionTypeFilter, setCommissionTypeFilter] = useState<string>('all'); // 'all', 'reader_referral', 'author_referral'

  // 结算总览相关状�?
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
  const [showUserDetailModal, setShowUserDetailModal] = useState<boolean>(false);
  const [selectedSettlementDetail, setSelectedSettlementDetail] = useState<any>(null);
  const [showSettlementDetailModal, setShowSettlementDetailModal] = useState<boolean>(false);
  
  // 表格行展开状态（存储每行的详情数据）
  const [expandedRows, setExpandedRows] = useState<{ [key: number]: any }>({});
  const [loadingRows, setLoadingRows] = useState<{ [key: number]: boolean }>({});
  
  // 发起支付相关状�?
  const [showCreatePayoutModal, setShowCreatePayoutModal] = useState(false);
  const [selectedIncomeMonthly, setSelectedIncomeMonthly] = useState<any>(null); // 选中的月度收入记�?
  const [payoutForm, setPayoutForm] = useState({
    method: 'paypal',
    account_id: '',
    payout_currency: 'USD',
    fx_rate: '1.0',
    note: ''
  });
  const [creatingPayout, setCreatingPayout] = useState(false);
  
  // 支付确认相关状�?
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [pendingPayoutId, setPendingPayoutId] = useState<number | null>(null);
  const [pendingPaymentInfo, setPendingPaymentInfo] = useState<any>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Toast提示状�?
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // 查询PayPal状态相关状�?
  const [checkingPayoutStatus, setCheckingPayoutStatus] = useState<number | null>(null);
  
  // 标记已支付相关状�?
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
    
    // 构建请求�?
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };
    
    // 只有当不�?FormData 且没有指�?Content-Type 时才设置默认�?
    if (!isFormData && !options.headers) {
      headers['Content-Type'] = 'application/json';
    } else if (!isFormData && options.headers) {
      // 如果已有 headers，合并它�?
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

    // 检查响应状�?
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
        // 设置默认日期范围（当前自然月�?
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
        // 设置默认日期范围（当前自然月�?
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        setPaymentFilters(prev => ({
          ...prev,
          start_date: prev.start_date || monthStart,
          end_date: prev.end_date || monthEnd
        }));
        setTimeout(() => loadAllPaymentData(), 100);
      } else if (activeTab === 'commission-settings') {
        loadCommissionPlans();
        loadKarmaRates();
        loadAuthorRoyaltyPlans();
        loadPlanOptions();
        if (plansSubTab === 'referrals') {
          loadReferralsData();
        }
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
      } else if (activeTab === 'base-income') {
        if (baseIncomeMonth) {
          loadBaseIncomeData();
        }
      } else if (activeTab === 'author-royalty') {
        if (authorRoyaltyMonth) {
          loadAuthorRoyaltyData();
        }
      } else if (activeTab === 'commission-transaction') {
        if (commissionMonth) {
          loadCommissionData();
        }
      }
    }
  }, [activeTab, isAuthenticated]);

  // 当切换到referrals Tab时加载数�?
  useEffect(() => {
    if (isAuthenticated && activeTab === 'commission-settings' && plansSubTab === 'referrals') {
      loadReferralsData();
    }
  }, [plansSubTab, isAuthenticated, activeTab]);

  // ESC键关闭对话框
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (userDialogVisible) {
          setUserDialogVisible(false);
        }
        if (planDialogVisible) {
          setPlanDialogVisible(false);
        }
        if (editReferralDialogVisible) {
          setEditReferralDialogVisible(false);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [userDialogVisible, planDialogVisible, editReferralDialogVisible]);
  
  // 初始化月份为当前月份
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setAuthorIncomeMonth(currentMonth);
    setReaderIncomeMonth(currentMonth);
    setBaseIncomeMonth(currentMonth);
    setAuthorRoyaltyMonth(currentMonth);
    setCommissionMonth(currentMonth);
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
        setError(''); // 清除之前的错�?
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      // token 过期错误已经�?adminApiRequest 中处理了
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

  // 加载作者收入统�?
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
  
  // 加载读者收入统�?
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

  // 加载结算详情（根据incomeMonthlyId�?
  // 切换表格行的展开/折叠状�?
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
    
    // 如果正在加载，则不重复加�?
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
        setError('加载支付详情失败: ' + (data.message || '未知错误'));
      }
    } catch (err: any) {
      setError('加载支付详情失败: ' + (err.message || '未知错误'));
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

  // 同步PayPal支付状态（通过incomeMonthlyId�?
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

  // 发起支付（通过incomeMonthlyId�?
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

  // 同步PayPal支付状�?
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

  // 加载用户结算详情（只加载当月数据�?
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
        setShowUserDetailModal(showModal); // 控制是否显示对话�?
        return currentMonthData; // 返回数据以便调用者使�?
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
  
  // 创建支付订单（基于月度收入记录，支持汇率�?
  const createPayout = async () => {
    if (!selectedIncomeMonthly) {
      setError('请选择要支付的月度收入记录');
      return;
    }
    
    if (!selectedIncomeMonthly.id) {
      setError(`该用�?${selectedIncomeMonthly.month || settlementMonth} 的月度收入记录尚未生成，请先点击"生成月度汇�?按钮生成该月的收入记录`);
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
      
      // 获取选中的账户信息用于确认弹�?
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
  
  // 确认并执行支付（使用新的接口，带防重复支付逻辑�?
  const confirmAndExecutePayment = async () => {
    if (!pendingPaymentInfo || !pendingPaymentInfo.income_monthly_id) {
      setError('支付信息不完整');
      return;
    }
    
    try {
      setProcessingPayment(true);
      setError('');
      
      const method = pendingPaymentInfo.method;
      
      // 使用新的支付接口（带防重复支付逻辑�?
      if (method === 'paypal' || method === 'alipay' || method === 'wechat') {
        // PayPal/支付�?微信：调用新的支付接�?
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
            message: `${pendingPaymentInfo.method_display}支付�?{payData.data.gateway_tx_id ? '发起' : '完成'}�?{payData.message || ''}`,
            type: 'success'
          });
          
          // 3秒后自动关闭toast
          setTimeout(() => setToast(null), 5000);
          
          // 重新加载结算总览
          await loadSettlementOverview();
        } else {
          setError('支付失败: ' + (payData.message || '未知错误'));
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
            message: `支付订单已创建（ID: ${createData.data.payout_id}），请手动完�?{pendingPaymentInfo.method_display}支付`,
            type: 'info'
          });
          
          setTimeout(() => setToast(null), 5000);
          
          await loadSettlementOverview();
        } else {
          setError('创建支付订单失败: ' + (createData.message || '未知错误'));
        }
      }
    } catch (err: any) {
      setError('支付失败: ' + (err.message || '未知错误'));
      setToast({
        message: '支付失败: ' + (err.message || '未知错误'),
        type: 'error'
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setProcessingPayment(false);
    }
  };
  
  // 查询PayPal支付状�?
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
          message: `PayPal状态查询成功！批次ID: ${data.data.batch_id}, PayPal状�? ${data.data.paypal_status}, 数据库状�? ${data.data.db_status}`,
          type: 'success'
        });
        setTimeout(() => setToast(null), 5000);
        
        // 重新加载用户详情以更新显�?
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
      setError('请输入第三方交易ID');
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

  // 生成月度收入汇�?
  const generateMonthlyIncome = async () => {
    if (!settlementMonth) {
      setError('请选择月份');
      return;
    }
    
    if (!window.confirm(`确定要生�?${settlementMonth} 月的月度收入汇总吗？`)) {
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

  // 加载基础收入数据
  const loadBaseIncomeData = async () => {
    if (!baseIncomeMonth) return;
    
    try {
      setBaseIncomeLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/reader-spending?month=${baseIncomeMonth}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBaseIncomeData(data.data);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setBaseIncomeLoading(false);
    }
  };
  
  // 生成基础收入数据
  const generateBaseIncomeData = async () => {
    if (!baseIncomeMonth) {
      setError('请选择月份');
      return;
    }
    
    if (!window.confirm(`确定要生�?${baseIncomeMonth} 月的基础收入数据吗？`)) {
      return;
    }
    
    try {
      setGenerating(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/generate-reader-spending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ month: baseIncomeMonth })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setError('');
        alert(data.message || '生成成功');
        // 重新加载数据
        loadBaseIncomeData();
      } else {
        setError(data.message || '生成失败');
      }
    } catch (err: any) {
      setError(err.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };
  
  // 删除基础收入数据
  const deleteBaseIncomeData = async () => {
    if (!baseIncomeMonth) {
      setError('请选择月份');
      return;
    }
    
    if (!window.confirm(`确定要删�?${baseIncomeMonth} 月的基础收入数据吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      setBaseIncomeLoading(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/reader-spending?month=${baseIncomeMonth}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setError('');
        alert(data.message || '删除成功');
        setBaseIncomeData(null);
      } else {
        setError(data.message || '删除失败');
      }
    } catch (err: any) {
      setError(err.message || '删除失败');
    } finally {
      setBaseIncomeLoading(false);
    }
  };

  // 加载作者基础收入数据
  const loadAuthorRoyaltyData = async () => {
    if (!authorRoyaltyMonth) return;
    
    try {
      setAuthorRoyaltyLoading(true);
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams();
      params.append('month', authorRoyaltyMonth);
      if (authorRoyaltySearchQuery) {
        params.append('search', authorRoyaltySearchQuery);
      }
      
      const response = await fetch(`http://localhost:5000/api/admin/author-royalty?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAuthorRoyaltyData(data.data);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setAuthorRoyaltyLoading(false);
    }
  };

  // 生成作者基础收入数据
  const generateAuthorRoyaltyData = async () => {
    if (!authorRoyaltyMonth) {
      setError('请选择月份');
      return;
    }
    
    if (!window.confirm(`确定要生�?${authorRoyaltyMonth} 月的作者基础收入数据吗？`)) {
      return;
    }
    
    try {
      setAuthorRoyaltyGenerating(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/author-royalty/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ month: authorRoyaltyMonth })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setError('');
        alert(data.message || '生成成功');
        // 重新加载数据
        loadAuthorRoyaltyData();
      } else {
        setError(data.message || '生成失败');
      }
    } catch (err: any) {
      setError(err.message || '生成失败');
    } finally {
      setAuthorRoyaltyGenerating(false);
    }
  };

  // 删除作者基础收入数据
  const deleteAuthorRoyaltyData = async () => {
    if (!authorRoyaltyMonth) {
      setError('请选择月份');
      return;
    }
    
    if (!window.confirm(`确定要删�?${authorRoyaltyMonth} 月的作者基础收入数据吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      setAuthorRoyaltyLoading(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/author-royalty?month=${authorRoyaltyMonth}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setError('');
        alert(data.message || '删除成功');
        setAuthorRoyaltyData(null);
      } else {
        setError(data.message || '删除失败');
      }
    } catch (err: any) {
      setError(err.message || '删除失败');
    } finally {
      setAuthorRoyaltyLoading(false);
    }
  };

  // 加载推广佣金明细数据
  const loadCommissionData = async () => {
    if (!commissionMonth) return;
    
    try {
      setCommissionLoading(true);
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams();
      params.append('month', commissionMonth);
      if (commissionSearchQuery) {
        params.append('search', commissionSearchQuery);
      }
      if (commissionTypeFilter !== 'all') {
        params.append('type', commissionTypeFilter);
      }
      
      const response = await fetch(`http://localhost:5000/api/admin/commission-transaction?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCommissionData(data.data);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setCommissionLoading(false);
    }
  };

  // 生成推广佣金明细数据
  const generateCommissionData = async () => {
    if (!commissionMonth) {
      setError('请选择月份');
      return;
    }
    
    if (!window.confirm(`确定要生�?${commissionMonth} 月的推广佣金明细数据吗？`)) {
      return;
    }
    
    try {
      setCommissionGenerating(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/commission-transaction/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ month: commissionMonth })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setError('');
        alert(data.message || '生成成功');
        // 重新加载数据
        loadCommissionData();
      } else {
        setError(data.message || '生成失败');
      }
    } catch (err: any) {
      setError(err.message || '生成失败');
    } finally {
      setCommissionGenerating(false);
    }
  };

  // 删除推广佣金明细数据
  const deleteCommissionData = async () => {
    if (!commissionMonth) {
      setError('请选择月份');
      return;
    }
    
    if (!window.confirm(`确定要删�?${commissionMonth} 月的推广佣金明细数据吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      setCommissionLoading(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/commission-transaction?month=${commissionMonth}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setError('');
        alert(data.message || '删除成功');
        setCommissionData(null);
      } else {
        setError(data.message || '删除失败');
      }
    } catch (err: any) {
      setError(err.message || '删除失败');
    } finally {
      setCommissionLoading(false);
    }
  };
  
  // 加载费用统计汇�?
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
  
  // 加载所有费用统计数�?
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
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
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
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
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
        // 更新本地状�?
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
        setError('');
      } else {
        setError(data.message || '更新失败');
      }
    } catch (err: any) {
      setError(err.message || '更新失败');
    }
  };

  // 创建新层�?
  const createLevel = async (planId: number, planMaxLevel: number) => {
    try {
      // 获取当前已有的层�?
      const currentLevels = planLevels[planId] || [];
      const existingLevels = currentLevels.map((l: any) => l.level).sort((a: number, b: number) => a - b);
      
      // 找到下一个应该添加的层级（从1开始，找到第一个缺失的�?
      let nextLevel = 1;
      for (let i = 1; i <= planMaxLevel; i++) {
        if (!existingLevels.includes(i)) {
          nextLevel = i;
          break;
        }
      }
      
      // 如果所有层级都已存在，则不再添�?
      if (nextLevel > planMaxLevel) {
        setError(`已达到最大层�?${planMaxLevel}`);
        return;
      }
      
      // 默认比例�?.01 (1%)
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
        setError('');
      } else {
        setError(data.message || '创建失败');
      }
    } catch (err: any) {
      setError(err.message || '创建失败');
    }
  };

  // 保存方案修改
  const savePlanEdit = async () => {
    if (!editingPlan) return;
    
    try {
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
        setError('');
      } else {
        setError(data.message || '保存失败');
      }
    } catch (err: any) {
      setError(err.message || '保存失败');
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
        setError(data.message || '搜索失败');
      }
    } catch (err: any) {
      setError(err.message || '搜索失败');
    } finally {
      setUserSearchLoading(false);
    }
  }, []);

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
      setError('请填写方案名称和类型');
      return;
    }
    
    try {
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
        setError('');
      } else {
        setError(data.message || '创建失败');
      }
    } catch (err: any) {
      setError(err.message || '创建失败');
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
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setKarmaRatesLoading(false);
    }
  };

  // 加载作者分成方案列�?
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
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setAuthorRoyaltyPlansLoading(false);
    }
  };

  // 加载推广方案选项（用于referrals筛选）
  const loadPlanOptions = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/commission-plans', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        const plans = data.data || [];
        setPromoterPlanOptions(plans.filter((p: any) => p.plan_type === 'reader_promoter'));
        setAuthorPlanOptions(plans.filter((p: any) => p.plan_type === 'author_promoter'));
      }
    } catch (err: any) {
      console.error('加载方案选项失败:', err);
    }
  };

  // 打开用户详情对话�?
  const openUserDialog = async (userId: number) => {
    if (!userId) return;
    
    try {
      setUserDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserDetail(data.data);
        setUserDialogVisible(true);
      } else {
        setError(data.message || '加载用户详情失败');
      }
    } catch (err: any) {
      setError(err.message || '加载用户详情失败');
    } finally {
      setUserDetailLoading(false);
    }
  };

  // 打开方案详情对话�?
  const openPlanDialog = async (planId: number) => {
    if (!planId) return;
    
    try {
      setPlanDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/commission-plans/${planId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPlanDetail(data.data);
        setPlanDialogVisible(true);
      } else {
        setError(data.message || '加载方案详情失败');
      }
    } catch (err: any) {
      setError(err.message || '加载方案详情失败');
    } finally {
      setPlanDetailLoading(false);
    }
  };

  // 加载用户绑定关系数据
  const loadReferralsData = async () => {
    try {
      setReferralsLoading(true);
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams();
      
      if (referralsFilters.user_id) {
        params.append('user_id', referralsFilters.user_id);
      }
      if (referralsFilters.referrer_id) {
        params.append('referrer_id', referralsFilters.referrer_id);
      }
      if (referralsFilters.promoter_plan_id) {
        params.append('promoter_plan_id', referralsFilters.promoter_plan_id);
      }
      if (referralsFilters.author_plan_id) {
        params.append('author_plan_id', referralsFilters.author_plan_id);
      }
      if (referralsFilters.created_from) {
        params.append('created_from', referralsFilters.created_from);
      }
      if (referralsFilters.created_to) {
        params.append('created_to', referralsFilters.created_to);
      }
      params.append('page', referralsPage.toString());
      params.append('page_size', referralsPageSize.toString());
      
      const response = await fetch(`http://localhost:5000/api/admin/referrals?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setReferralsData(data.data.list || []);
        setReferralsTotal(data.data.total || 0);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setReferralsLoading(false);
    }
  };

  // 打开编辑推广方案对话�?
  const openEditReferralDialog = async (item: any) => {
    // 确保方案选项已加�?
    if (promoterPlanOptions.length === 0 || authorPlanOptions.length === 0) {
      await loadPlanOptions();
    }
    setEditingReferral(item);
    setEditPromoterPlanId(item.promoter_plan_id ? String(item.promoter_plan_id) : '');
    setEditAuthorPlanId(item.author_plan_id ? String(item.author_plan_id) : '');
    setEditReferralDialogVisible(true);
  };

  // 保存推广方案修改
  const saveReferralPlan = async () => {
    if (!editingReferral) return;
    
    try {
      setSavingReferral(true);
      const token = localStorage.getItem('adminToken');
      
      const response = await fetch(`http://localhost:5000/api/admin/referrals/${editingReferral.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          promoter_plan_id: editPromoterPlanId ? parseInt(editPromoterPlanId) : null,
          author_plan_id: editAuthorPlanId ? parseInt(editAuthorPlanId) : null
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('修改成功');
        setEditReferralDialogVisible(false);
        setEditingReferral(null);
        // 刷新列表
        loadReferralsData();
      } else {
        alert(data.message || '修改失败');
      }
    } catch (err: any) {
      alert(err.message || '修改失败');
    } finally {
      setSavingReferral(false);
    }
  };

  // 管理员登�?
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
          // 设置默认日期范围（当前自然月�?
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
    if (!window.confirm(`确定�?{action === 'approve' ? '批准' : '拒绝'}这本小说吗？`)) {
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

  // 退出登�?
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
                placeholder="请输入密�?
              />
            </div>
            {error && <div className={styles.errorMessage}>{error}</div>}
            <button type="submit" disabled={loading} className={styles.loginButton}>
              {loading ? '登录中..' : '登录'}
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
          退出登�?
        </button>
      </header>

      <div className={styles.mainLayout}>
        {/* 左侧选项卡导�?- 暂时隐藏 */}
        {false && (
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
            <span className={activeTab === 'author-income' ? styles.active : ''}>作者收入统�?/span>
          </div>
          <div className={styles.navItem} onClick={() => setActiveTab('reader-income')}>
            <div className={`${styles.navIcon} ${activeTab === 'reader-income' ? styles.active : ''}`}>
              👥
            </div>
            <span className={activeTab === 'reader-income' ? styles.active : ''}>读者收入统�?/span>
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
            <span className={activeTab === 'author-royalty' ? styles.active : ''}>作者基础收入�?2</span>
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
        )}

        {/* 右侧内容区域 - 暂时隐藏所有控�?*/}
        <div className={styles.contentArea}>
          <div className={styles.tabContent}>
            <h2>后台管理系统</h2>
            <p>页面正在维护中，所有功能暂时关闭�?/p>
          </div>
        </div>
        {/* 以下所有内容暂时注释掉 */}
        {false && (
          <div className={styles.contentArea}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          
          {/* 小说审批选项�?*/}
          {activeTab === 'novel-review' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2>小说审批</h2>
                <div className={styles.filterButtons}>
                  <button
                    className={filterStatus === 'all' ? styles.active : ''}
                    onClick={() => setFilterStatus('all')}
                  >
                    全部
                  </button>
                  <button
                    className={filterStatus === 'created' ? styles.active : ''}
                    onClick={() => setFilterStatus('created')}
                  >
                    草稿
                  </button>
                  <button
                    className={filterStatus === 'submitted' ? styles.active : ''}
                    onClick={() => setFilterStatus('submitted')}
                  >
                    已提�?
                  </button>
                  <button
                    className={filterStatus === 'reviewing' ? styles.active : ''}
                    onClick={() => setFilterStatus('reviewing')}
                  >
                    审核�?
                  </button>
                  <button
                    className={filterStatus === 'approved' ? styles.active : ''}
                    onClick={() => setFilterStatus('approved')}
                  >
                    审核通过
                  </button>
                  <button
                    className={filterStatus === 'published' ? styles.active : ''}
                    onClick={() => setFilterStatus('published')}
                  >
                    已上�?
                  </button>
                  <button
                    className={filterStatus === 'unlisted' ? styles.active : ''}
                    onClick={() => setFilterStatus('unlisted')}
                  >
                    已下�?
                  </button>
                  <button
                    className={filterStatus === 'archived' ? styles.active : ''}
                    onClick={() => setFilterStatus('archived')}
                  >
                    已归�?
                  </button>
                  <button
                    className={filterStatus === 'locked' ? styles.active : ''}
                    onClick={() => setFilterStatus('locked')}
                  >
                    已锁�?
                  </button>
                </div>
              </div>

              {loading && novels.length === 0 ? (
                <div className={styles.loading}>加载�?..</div>
              ) : novels.length === 0 ? (
                <div className={styles.emptyState}>暂无数据</div>
              ) : (
                <div className={styles.novelList}>
                  {novels.map((novel) => (
                    <div key={novel.id} className={styles.novelCard}>
                      <div className={styles.novelInfo}>
                        {novel.cover && (
                          <img 
                            src={novel.cover.startsWith('http') ? novel.cover : `http://localhost:5000/covers/${novel.cover}`}
                            alt={novel.title}
                            className={styles.novelCover}
                          />
                        )}
                        <div className={styles.novelDetails}>
                          <h3>{novel.title}</h3>
                          <p><strong>作�?</strong> {novel.author_name || novel.pen_name || novel.author}</p>
                          <p><strong>翻译:</strong> {novel.translator || '�?}</p>
                          <p><strong>状�?</strong> 
                            <span className={`${styles.status} ${styles[novel.review_status]}`}>
                              {novel.review_status === 'created' ? '草稿' :
                               novel.review_status === 'submitted' ? '已提�? :
                               novel.review_status === 'reviewing' ? '审核�? :
                               novel.review_status === 'approved' ? '审核通过' :
                               novel.review_status === 'published' ? '已上�? :
                               novel.review_status === 'unlisted' ? '已下�? :
                               novel.review_status === 'archived' ? '已归�? :
                               novel.review_status === 'locked' ? '已锁�? : novel.review_status}
                            </span>
                          </p>
                          {novel.description && (
                            <p className={styles.description}>{novel.description.substring(0, 100)}...</p>
                          )}
                        </div>
                      </div>
                      <div className={styles.novelActions}>
                        <button
                          onClick={() => viewNovelDetail(novel.id)}
                          className={styles.viewButton}
                        >
                          查看详情
                        </button>
                        {novel.review_status === 'submitted' || novel.review_status === 'reviewing' ? (
                          <>
                            <button
                              onClick={() => handleReview(novel.id, 'approve')}
                              className={styles.approveButton}
                              disabled={loading}
                            >
                              批准
                            </button>
                            <button
                              onClick={() => handleReview(novel.id, 'reject')}
                              className={styles.rejectButton}
                              disabled={loading}
                            >
                              拒绝
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 费用统计选项�?*/}
          {activeTab === 'payment-stats' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2>费用统计</h2>
                <div className={styles.dateFilter}>
                  <input
                    type="date"
                    value={paymentFilters.start_date}
                    onChange={(e) => setPaymentFilters({ ...paymentFilters, start_date: e.target.value })}
                    placeholder="开始日�?
                  />
                  <span>�?/span>
                  <input
                    type="date"
                    value={paymentFilters.end_date}
                    onChange={(e) => setPaymentFilters({ ...paymentFilters, end_date: e.target.value })}
                    placeholder="结束日期"
                  />
                  <select
                    value={paymentFilters.payment_method}
                    onChange={(e) => setPaymentFilters({ ...paymentFilters, payment_method: e.target.value })}
                    style={{ marginLeft: '10px', padding: '5px' }}
                  >
                    <option value="">全部支付方式</option>
                    <option value="stripe">Stripe</option>
                    <option value="paypal">PayPal</option>
                  </select>
                  <select
                    value={paymentFilters.payment_status}
                    onChange={(e) => setPaymentFilters({ ...paymentFilters, payment_status: e.target.value })}
                    style={{ marginLeft: '10px', padding: '5px' }}
                  >
                    <option value="">全部状�?/option>
                    <option value="completed">已完�?/option>
                    <option value="pending">待处�?/option>
                    <option value="failed">失败</option>
                    <option value="refunded">已退�?/option>
                  </select>
                  <input
                    type="text"
                    value={paymentFilters.user_id}
                    onChange={(e) => setPaymentFilters({ ...paymentFilters, user_id: e.target.value })}
                    placeholder="用户ID"
                    style={{ marginLeft: '10px', padding: '5px', width: '100px' }}
                  />
                  <button onClick={loadAllPaymentData} className={styles.searchButton}>
                    查询
                  </button>
                </div>
              </div>

              {statsLoading ? (
                <div className={styles.loading}>加载�?..</div>
              ) : paymentSummary ? (
                <>
                  {/* 汇总统计卡�?*/}
                  <div className={styles.statsCards}>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>总收�?/div>
                      <div className={styles.statValue}>${paymentSummary.totalIncome.toFixed(2)}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>总交易数</div>
                      <div className={styles.statValue}>{paymentSummary.totalTransactions}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>今日收入</div>
                      <div className={styles.statValue}>${paymentSummary.todayIncome.toFixed(2)}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>今日交易</div>
                      <div className={styles.statValue}>{paymentSummary.todayTransactions}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>本月收入</div>
                      <div className={styles.statValue}>${paymentSummary.monthlyIncome.toFixed(2)}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>本月交易</div>
                      <div className={styles.statValue}>{paymentSummary.monthlyTransactions}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>订阅收入</div>
                      <div className={styles.statValue}>${paymentSummary.subscriptionIncome.toFixed(2)}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>Karma收入</div>
                      <div className={styles.statValue}>${paymentSummary.karmaIncome.toFixed(2)}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>付费用户�?/div>
                      <div className={styles.statValue}>{paymentSummary.paidUserCount}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>ARPPU</div>
                      <div className={styles.statValue}>${paymentSummary.arppu.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Tab切换 */}
                  <div style={{ marginTop: '24px', borderBottom: '1px solid #ddd' }}>
                    <button
                      onClick={() => {
                        setActivePaymentTab('subscriptions');
                        setSubscriptionsPage(1);
                      }}
                      style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activePaymentTab === 'subscriptions' ? '#007bff' : 'transparent',
                        color: activePaymentTab === 'subscriptions' ? 'white' : '#333',
                        cursor: 'pointer',
                        borderBottom: activePaymentTab === 'subscriptions' ? '2px solid #007bff' : 'none'
                      }}
                    >
                      订阅收入
                    </button>
                    <button
                      onClick={() => {
                        setActivePaymentTab('karma');
                        setKarmaPurchasesPage(1);
                      }}
                      style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activePaymentTab === 'karma' ? '#007bff' : 'transparent',
                        color: activePaymentTab === 'karma' ? 'white' : '#333',
                        cursor: 'pointer',
                        borderBottom: activePaymentTab === 'karma' ? '2px solid #007bff' : 'none'
                      }}
                    >
                      Karma购买
                    </button>
                  </div>

                  {/* 订阅收入Tab */}
                  {activePaymentTab === 'subscriptions' && (
                    <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
                      <h3>订阅收入明细</h3>
                      {subscriptionsLoading ? (
                        <div className={styles.loading}>加载�?..</div>
                      ) : (
                        <>
                          <table>
                            <thead>
                              <tr>
                                <th>时间</th>
                                <th>用户</th>
                                <th>小说</th>
                                <th>订阅等级</th>
                                <th>类型</th>
                                <th>订阅时长(�?</th>
                                <th>月价�?/th>
                                <th>实际支付金额(USD)</th>
                                <th>支付方式</th>
                                <th>状�?/th>
                                <th>自动续费</th>
                                <th>生效时间</th>
                                <th>结束时间</th>
                                <th>操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subscriptions.length === 0 ? (
                                <tr>
                                  <td colSpan={14} className={styles.emptyCell}>暂无数据</td>
                                </tr>
                              ) : (
                                subscriptions.map((item) => (
                                  <tr key={item.id}>
                                    <td>{new Date(item.created_at).toLocaleString('zh-CN')}</td>
                                    <td>{item.user_name}</td>
                                    <td>{item.novel_title}</td>
                                    <td>{item.tier_name} ({item.tier_level})</td>
                                    <td>{item.subscription_type}</td>
                                    <td>{item.subscription_duration_months}</td>
                                    <td>${item.monthly_price.toFixed(2)}</td>
                                    <td><strong>${item.payment_amount.toFixed(2)}</strong></td>
                                    <td>{item.payment_method}</td>
                                    <td>
                                      <span className={`${styles.status} ${styles[item.payment_status]}`}>
                                        {item.payment_status === 'completed' ? '已完�? :
                                         item.payment_status === 'pending' ? '待处�? :
                                         item.payment_status === 'failed' ? '失败' :
                                         item.payment_status === 'refunded' ? '已退�? : item.payment_status}
                                      </span>
                                    </td>
                                    <td>{item.auto_renew ? '�? : '�?}</td>
                                    <td>{new Date(item.start_date).toLocaleString('zh-CN')}</td>
                                    <td>{new Date(item.end_date).toLocaleString('zh-CN')}</td>
                                    <td>
                                      <button
                                        onClick={() => setSelectedSubscription(item)}
                                        style={{ padding: '5px 10px', fontSize: '12px' }}
                                      >
                                        详情
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                          {/* 分页 */}
                          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                            <button
                              onClick={() => {
                                if (subscriptionsPage > 1) {
                                  setSubscriptionsPage(subscriptionsPage - 1);
                                  setTimeout(() => loadSubscriptions(), 100);
                                }
                              }}
                              disabled={subscriptionsPage === 1}
                            >
                              上一�?
                            </button>
                            <span>�?{subscriptionsPage} 页，�?{Math.ceil(subscriptionsTotal / 20)} �?/span>
                            <button
                              onClick={() => {
                                if (subscriptionsPage < Math.ceil(subscriptionsTotal / 20)) {
                                  setSubscriptionsPage(subscriptionsPage + 1);
                                  setTimeout(() => loadSubscriptions(), 100);
                                }
                              }}
                              disabled={subscriptionsPage >= Math.ceil(subscriptionsTotal / 20)}
                            >
                              下一�?
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Karma购买Tab */}
                  {activePaymentTab === 'karma' && (
                    <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
                      <h3>Karma购买明细</h3>
                      {karmaPurchasesLoading ? (
                        <div className={styles.loading}>加载�?..</div>
                      ) : (
                        <>
                          <table>
                            <thead>
                              <tr>
                                <th>时间</th>
                                <th>用户</th>
                                <th>交易类型</th>
                                <th>套餐名称</th>
                                <th>Karma类型</th>
                                <th>Karma数量</th>
                                <th>支付金额(USD)</th>
                                <th>支付方式</th>
                                <th>状�?/th>
                                <th>余额变化</th>
                                <th>操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {karmaPurchases.length === 0 ? (
                                <tr>
                                  <td colSpan={11} className={styles.emptyCell}>暂无数据</td>
                                </tr>
                              ) : (
                                karmaPurchases.map((item) => (
                                  <tr key={item.id}>
                                    <td>{new Date(item.created_at).toLocaleString('zh-CN')}</td>
                                    <td>{item.user_name}</td>
                                    <td>{item.transaction_type}</td>
                                    <td>{item.description || '未知'}</td>
                                    <td>{item.karma_type}</td>
                                    <td>{item.karma_amount}</td>
                                    <td><strong>${item.amount_paid.toFixed(2)}</strong></td>
                                    <td>{item.payment_method || '未知'}</td>
                                    <td>
                                      <span className={`${styles.status} ${styles[item.status]}`}>
                                        {item.status === 'completed' ? '已完�? :
                                         item.status === 'pending' ? '待处�? :
                                         item.status === 'failed' ? '失败' : item.status}
                                      </span>
                                    </td>
                                    <td>{item.balance_before} �?{item.balance_after}</td>
                                    <td>
                                      <button
                                        onClick={() => setSelectedKarmaPurchase(item)}
                                        style={{ padding: '5px 10px', fontSize: '12px' }}
                                      >
                                        详情
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                          {/* 分页 */}
                          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                            <button
                              onClick={() => {
                                if (karmaPurchasesPage > 1) {
                                  setKarmaPurchasesPage(karmaPurchasesPage - 1);
                                  setTimeout(() => loadKarmaPurchases(), 100);
                                }
                              }}
                              disabled={karmaPurchasesPage === 1}
                            >
                              上一�?
                            </button>
                            <span>�?{karmaPurchasesPage} 页，�?{Math.ceil(karmaPurchasesTotal / 20)} �?/span>
                            <button
                              onClick={() => {
                                if (karmaPurchasesPage < Math.ceil(karmaPurchasesTotal / 20)) {
                                  setKarmaPurchasesPage(karmaPurchasesPage + 1);
                                  setTimeout(() => loadKarmaPurchases(), 100);
                                }
                              }}
                              disabled={karmaPurchasesPage >= Math.ceil(karmaPurchasesTotal / 20)}
                            >
                              下一�?
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 订阅详情侧边�?*/}
                  {selectedSubscription && (
                    <div style={{
                      position: 'fixed',
                      right: 0,
                      top: 0,
                      width: '400px',
                      height: '100vh',
                      background: 'white',
                      boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
                      padding: '20px',
                      overflowY: 'auto',
                      zIndex: 1000
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3>订阅详情</h3>
                        <button onClick={() => setSelectedSubscription(null)}>关闭</button>
                      </div>
                      <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                        <p><strong>ID:</strong> {selectedSubscription.id}</p>
                        <p><strong>用户ID:</strong> {selectedSubscription.user_id}</p>
                        <p><strong>用户�?</strong> {selectedSubscription.user_name}</p>
                        <p><strong>小说ID:</strong> {selectedSubscription.novel_id}</p>
                        <p><strong>小说�?</strong> {selectedSubscription.novel_title}</p>
                        <p><strong>订阅等级:</strong> {selectedSubscription.tier_name} (Level {selectedSubscription.tier_level})</p>
                        <p><strong>订阅类型:</strong> {selectedSubscription.subscription_type}</p>
                        <p><strong>订阅时长:</strong> {selectedSubscription.subscription_duration_months} �?/p>
                        <p><strong>月价�?</strong> ${selectedSubscription.monthly_price.toFixed(2)}</p>
                        <p><strong>支付金额:</strong> ${selectedSubscription.payment_amount.toFixed(2)}</p>
                        <p><strong>货币:</strong> {selectedSubscription.currency}</p>
                        {selectedSubscription.local_amount && (
                          <p><strong>本地金额:</strong> {selectedSubscription.local_amount.toFixed(2)} {selectedSubscription.local_currency}</p>
                        )}
                        {selectedSubscription.exchange_rate && (
                          <p><strong>汇率:</strong> {selectedSubscription.exchange_rate}</p>
                        )}
                        <p><strong>支付方式:</strong> {selectedSubscription.payment_method}</p>
                        <p><strong>支付状�?</strong> {selectedSubscription.payment_status}</p>
                        <p><strong>自动续费:</strong> {selectedSubscription.auto_renew ? '�? : '�?}</p>
                        <p><strong>生效时间:</strong> {new Date(selectedSubscription.start_date).toLocaleString('zh-CN')}</p>
                        <p><strong>结束时间:</strong> {new Date(selectedSubscription.end_date).toLocaleString('zh-CN')}</p>
                        {selectedSubscription.stripe_payment_intent_id && (
                          <p><strong>Stripe PaymentIntent ID:</strong> {selectedSubscription.stripe_payment_intent_id}</p>
                        )}
                        {selectedSubscription.paypal_order_id && (
                          <p><strong>PayPal Order ID:</strong> {selectedSubscription.paypal_order_id}</p>
                        )}
                        {selectedSubscription.stripe_customer_id && (
                          <p><strong>Stripe Customer ID:</strong> {selectedSubscription.stripe_customer_id}</p>
                        )}
                        {selectedSubscription.paypal_payer_id && (
                          <p><strong>PayPal Payer ID:</strong> {selectedSubscription.paypal_payer_id}</p>
                        )}
                        {selectedSubscription.card_brand && (
                          <p><strong>卡品�?</strong> {selectedSubscription.card_brand} ****{selectedSubscription.card_last4}</p>
                        )}
                        {selectedSubscription.discount_amount > 0 && (
                          <p><strong>折扣金额:</strong> ${selectedSubscription.discount_amount.toFixed(2)} ({selectedSubscription.discount_code})</p>
                        )}
                        {selectedSubscription.tax_amount > 0 && (
                          <p><strong>税费:</strong> ${selectedSubscription.tax_amount.toFixed(2)}</p>
                        )}
                        {selectedSubscription.fee_amount > 0 && (
                          <p><strong>手续�?</strong> ${selectedSubscription.fee_amount.toFixed(2)}</p>
                        )}
                        {selectedSubscription.refund_amount > 0 && (
                          <p><strong>退款金�?</strong> ${selectedSubscription.refund_amount.toFixed(2)} ({selectedSubscription.refund_reason})</p>
                        )}
                        {selectedSubscription.ip_address && (
                          <p><strong>IP地址:</strong> {selectedSubscription.ip_address}</p>
                        )}
                        {selectedSubscription.notes && (
                          <p><strong>备注:</strong> {selectedSubscription.notes}</p>
                        )}
                        <p><strong>创建时间:</strong> {new Date(selectedSubscription.created_at).toLocaleString('zh-CN')}</p>
                        <p><strong>更新时间:</strong> {new Date(selectedSubscription.updated_at).toLocaleString('zh-CN')}</p>
                      </div>
                    </div>
                  )}

                  {/* Karma购买详情侧边�?*/}
                  {selectedKarmaPurchase && (
                    <div style={{
                      position: 'fixed',
                      right: 0,
                      top: 0,
                      width: '400px',
                      height: '100vh',
                      background: 'white',
                      boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
                      padding: '20px',
                      overflowY: 'auto',
                      zIndex: 1000
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3>Karma购买详情</h3>
                        <button onClick={() => setSelectedKarmaPurchase(null)}>关闭</button>
                      </div>
                      <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                        <p><strong>ID:</strong> {selectedKarmaPurchase.id}</p>
                        <p><strong>用户ID:</strong> {selectedKarmaPurchase.user_id}</p>
                        <p><strong>用户�?</strong> {selectedKarmaPurchase.user_name}</p>
                        <p><strong>交易类型:</strong> {selectedKarmaPurchase.transaction_type}</p>
                        <p><strong>描述:</strong> {selectedKarmaPurchase.description || '�?}</p>
                        <p><strong>原因:</strong> {selectedKarmaPurchase.reason || '�?}</p>
                        <p><strong>Karma类型:</strong> {selectedKarmaPurchase.karma_type}</p>
                        <p><strong>Karma数量:</strong> {selectedKarmaPurchase.karma_amount}</p>
                        <p><strong>支付金额:</strong> ${selectedKarmaPurchase.amount_paid.toFixed(2)}</p>
                        <p><strong>货币:</strong> {selectedKarmaPurchase.currency}</p>
                        <p><strong>支付方式:</strong> {selectedKarmaPurchase.payment_method || '未知'}</p>
                        <p><strong>状�?</strong> {selectedKarmaPurchase.status}</p>
                        <p><strong>余额变化:</strong> {selectedKarmaPurchase.balance_before} �?{selectedKarmaPurchase.balance_after}</p>
                        {selectedKarmaPurchase.transaction_id && (
                          <p><strong>交易ID:</strong> {selectedKarmaPurchase.transaction_id}</p>
                        )}
                        {selectedKarmaPurchase.stripe_payment_intent_id && (
                          <p><strong>Stripe PaymentIntent ID:</strong> {selectedKarmaPurchase.stripe_payment_intent_id}</p>
                        )}
                        {selectedKarmaPurchase.paypal_order_id && (
                          <p><strong>PayPal Order ID:</strong> {selectedKarmaPurchase.paypal_order_id}</p>
                        )}
                        {selectedKarmaPurchase.novel_id && (
                          <p><strong>小说ID:</strong> {selectedKarmaPurchase.novel_id}</p>
                        )}
                        {selectedKarmaPurchase.chapter_id && (
                          <p><strong>章节ID:</strong> {selectedKarmaPurchase.chapter_id}</p>
                        )}
                        <p><strong>创建时间:</strong> {new Date(selectedKarmaPurchase.created_at).toLocaleString('zh-CN')}</p>
                        <p><strong>更新时间:</strong> {new Date(selectedKarmaPurchase.updated_at).toLocaleString('zh-CN')}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyState}>请设置筛选条件并查询</div>
              )}
            </div>
          )}

          {/* 作者收入统计选项�?*/}
          {activeTab === 'author-income' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2>作者收入统�?/h2>
                <div className={styles.dateFilter}>
                  <input
                    type="month"
                    value={authorIncomeMonth}
                    onChange={(e) => {
                      setAuthorIncomeMonth(e.target.value);
                      setTimeout(() => loadAuthorIncomeStats(), 100);
                    }}
                  />
                  <button onClick={loadAuthorIncomeStats} className={styles.searchButton}>
                    查询
                  </button>
                </div>
              </div>

              {authorIncomeLoading ? (
                <div className={styles.loading}>加载�?..</div>
              ) : authorIncomeData ? (
                <>
                  {/* 作者收入汇总表�?*/}
                  <div className={styles.paymentTable}>
                    <h3>作者收入汇�?/h3>
                    <table>
                      <thead>
                        <tr>
                          <th>作�?/th>
                          <th>基础收入（美元）</th>
                          <th>推广收入（美元）</th>
                          <th>总收入（美元�?/th>
                          <th>推广收入计算方法</th>
                        </tr>
                      </thead>
                      <tbody>
                        {authorIncomeData.summary && authorIncomeData.summary.length === 0 ? (
                          <tr>
                            <td colSpan={5} className={styles.emptyCell}>暂无数据</td>
                          </tr>
                        ) : (
                          authorIncomeData.summary?.map((item: any, index: number) => (
                            <tr key={index}>
                              <td>{item.authorName}</td>
                              <td>${item.baseIncome.toFixed(2)}</td>
                              <td>${item.referralIncome.toFixed(2)}</td>
                              <td><strong>${item.totalIncome.toFixed(2)}</strong></td>
                              <td style={{ fontSize: '12px', lineHeight: '1.5', wordBreak: 'break-word' }}>
                                {item.calculationMethod || '暂无推广收入'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 作者基础收入明细 */}
                  <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
                    <h3>作者基础收入明细</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>作�?/th>
                          <th>小说</th>
                          <th>读者消费（美元�?/th>
                          <th>作者收入（美元�?/th>
                          <th>消费时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {authorIncomeData.details && authorIncomeData.details.length === 0 ? (
                          <tr>
                            <td colSpan={5} className={styles.emptyCell}>暂无数据</td>
                          </tr>
                        ) : (
                          authorIncomeData.details?.map((item: any) => (
                            <tr key={item.id}>
                              <td>{item.authorName}</td>
                              <td>{item.novelTitle || '未知'}</td>
                              <td>${item.readerSpendAmount.toFixed(2)}</td>
                              <td>${item.authorAmount.toFixed(2)}</td>
                              <td>{new Date(item.spendTime).toLocaleString('zh-CN')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 作者推广佣金明�?*/}
                  <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
                    <h3>作者推广佣金明�?/h3>
                    <table>
                      <thead>
                        <tr>
                          <th>推广�?/th>
                          <th>被推广作�?/th>
                          <th>小说</th>
                          <th>层级</th>
                          <th>基础金额（美元）</th>
                          <th>佣金金额（美元）</th>
                        </tr>
                      </thead>
                      <tbody>
                        {authorIncomeData.referralDetails && authorIncomeData.referralDetails.length === 0 ? (
                          <tr>
                            <td colSpan={6} className={styles.emptyCell}>暂无数据</td>
                          </tr>
                        ) : (
                          authorIncomeData.referralDetails?.map((item: any) => (
                            <tr key={item.id}>
                              <td>{item.userName}</td>
                              <td>{item.sourceAuthorName}</td>
                              <td>{item.novelTitle || '未知'}</td>
                              <td>第{item.level}�?/td>
                              <td>${item.baseAmount.toFixed(2)}</td>
                              <td>${item.commissionAmount.toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>请选择月份查询</div>
              )}
            </div>
          )}

          {/* 读者收入统计选项�?*/}
          {activeTab === 'reader-income' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2>读者收入统�?/h2>
                <div className={styles.dateFilter}>
                  <input
                    type="month"
                    value={readerIncomeMonth}
                    onChange={(e) => {
                      setReaderIncomeMonth(e.target.value);
                      setTimeout(() => loadReaderIncomeStats(), 100);
                    }}
                  />
                  <button onClick={loadReaderIncomeStats} className={styles.searchButton}>
                    查询
                  </button>
                </div>
              </div>

              {readerIncomeLoading ? (
                <div className={styles.loading}>加载�?..</div>
              ) : readerIncomeData ? (
                <>
                  {/* 读者推广收入汇�?*/}
                  <div className={styles.paymentTable}>
                    <h3>读者推广收入汇�?/h3>
                    <table>
                      <thead>
                        <tr>
                          <th>推广�?/th>
                          <th>推广收入（美元）</th>
                          <th>推广人数</th>
                          <th>计算方法</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readerIncomeData.referralSummary && readerIncomeData.referralSummary.length === 0 ? (
                          <tr>
                            <td colSpan={4} className={styles.emptyCell}>暂无数据</td>
                          </tr>
                        ) : (
                          readerIncomeData.referralSummary?.map((item: any, index: number) => (
                            <tr key={index}>
                              <td>{item.userName}</td>
                              <td><strong>${item.totalReferralIncome.toFixed(2)}</strong></td>
                              <td>{item.referralCount}�?/td>
                              <td style={{ fontSize: '12px', lineHeight: '1.5', wordBreak: 'break-word' }}>
                                {item.calculationMethod || '暂无数据'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 读者消费汇�?*/}
                  <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
                    <h3>读者消费汇�?/h3>
                    <table>
                      <thead>
                        <tr>
                          <th>读�?/th>
                          <th>消费总额（美元）</th>
                          <th>消费次数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readerIncomeData.spendingSummary && readerIncomeData.spendingSummary.length === 0 ? (
                          <tr>
                            <td colSpan={3} className={styles.emptyCell}>暂无数据</td>
                          </tr>
                        ) : (
                          readerIncomeData.spendingSummary?.map((item: any, index: number) => (
                            <tr key={index}>
                              <td>{item.userName}</td>
                              <td>${item.totalSpending.toFixed(2)}</td>
                              <td>{item.spendingCount}�?/td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 读者推广佣金明�?*/}
                  <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
                    <h3>读者推广佣金明�?/h3>
                    <table>
                      <thead>
                        <tr>
                          <th>推广�?/th>
                          <th>被推广读�?/th>
                          <th>小说</th>
                          <th>层级</th>
                          <th>读者消费（美元�?/th>
                          <th>佣金金额（美元）</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readerIncomeData.details && readerIncomeData.details.length === 0 ? (
                          <tr>
                            <td colSpan={6} className={styles.emptyCell}>暂无数据</td>
                          </tr>
                        ) : (
                          readerIncomeData.details?.map((item: any) => (
                            <tr key={item.id}>
                              <td>{item.userName}</td>
                              <td>{item.sourceUserName}</td>
                              <td>{item.novelTitle || '未知'}</td>
                              <td>第{item.level}�?/td>
                              <td>${item.baseAmount.toFixed(2)}</td>
                              <td>${item.commissionAmount.toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>请选择月份查询</div>
              )}
            </div>
          )}

          {/* 结算总览选项�?*/}
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
                    <option value="all">全部状�?/option>
                    <option value="unpaid">未支�?/option>
                    <option value="paid">已支�?/option>
                  </select>
                  <select
                    value={settlementRole}
                    onChange={(e) => setSettlementRole(e.target.value)}
                    style={{ marginLeft: '10px', padding: '5px' }}
                  >
                    <option value="all">全部用户</option>
                    <option value="author_only">仅作�?/option>
                    <option value="promoter_only">仅推广�?/option>
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
                    生成月度汇�?
                  </button>
                </div>
              </div>

              {settlementLoading ? (
                <div className={styles.loading}>加载�?..</div>
              ) : (
                <>
                  <div className={styles.paymentTable}>
                    <h3>用户结算列表（作�?推广者）</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>用户</th>
                          <th>作者作品收�?USD)</th>
                          <th>读者推广收�?USD)</th>
                          <th>作者推广收�?USD)</th>
                          <th>当月总收�?USD)</th>
                          <th>支付状�?/th>
                          <th>支付方法</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settlementData.length === 0 ? (
                          <tr>
                            <td colSpan={8} className={styles.emptyCell}>暂无数据</td>
                          </tr>
                        ) : (
                          settlementData.map((item: any) => {
                            // 只显示当月有收入的用�?
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
                                    // 只有已支付状态才能点击查看详情（弹窗方式�?
                                    if (item.month_status === 'paid' && item.income_monthly_id) {
                                      loadSettlementDetail(item.income_monthly_id);
                                    } else if (item.month_status === 'paid' && !item.income_monthly_id) {
                                      setError('该用户该月的收入记录ID不存�?);
                                    }
                                  }}
                                  style={{
                                    cursor: item.month_status === 'paid' && item.income_monthly_id ? 'pointer' : 'default',
                                    textDecoration: item.month_status === 'paid' && item.income_monthly_id ? 'underline' : 'none',
                                    userSelect: 'none'
                                  }}
                                  title={item.month_status === 'paid' && item.income_monthly_id ? '点击查看支付详情（弹窗）' : ''}
                                >
                                  {item.month_status === 'paid' ? '已支�? :
                                   item.month_status === 'processing' ? '处理�? :
                                   item.month_status === 'failed' ? '失败' :
                                   '未支�?}
                                </span>
                              </td>
                              <td>
                                {(() => {
                                  const method = item.payout_method?.toLowerCase() || '';
                                  let displayText = '';
                                  let bgColor = '';
                                  let textColor = '';
                                  const isPayPal = method === 'paypal';
                                  
                                  switch (method) {
                                    case 'paypal':
                                      displayText = 'PayPal';
                                      bgColor = '#0070ba';
                                      textColor = '#ffffff';
                                      break;
                                    case 'alipay':
                                      displayText = '支付�?;
                                      bgColor = '#1677ff';
                                      textColor = '#ffffff';
                                      break;
                                    case 'wechat':
                                      displayText = '微信';
                                      bgColor = '#07c160';
                                      textColor = '#ffffff';
                                      break;
                                    case 'bank_transfer':
                                      displayText = '银行转账';
                                      bgColor = '#722ed1';
                                      textColor = '#ffffff';
                                      break;
                                    case 'manual':
                                      displayText = '手动支付';
                                      bgColor = '#fa8c16';
                                      textColor = '#ffffff';
                                      break;
                                    default:
                                      displayText = item.payout_method || '未设�?;
                                      bgColor = '#d9d9d9';
                                      textColor = '#595959';
                                  }
                                  
                                  return (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // 只有PayPal支付方式才可点击同步状�?
                                        if (isPayPal && item.income_monthly_id) {
                                          syncPayPalStatusByIncomeMonthlyId(item.income_monthly_id);
                                        }
                                      }}
                                      style={{
                                        display: 'inline-block',
                                        padding: '4px 12px',
                                        borderRadius: '4px',
                                        backgroundColor: bgColor,
                                        color: textColor,
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        whiteSpace: 'nowrap',
                                        cursor: isPayPal && item.income_monthly_id ? 'pointer' : 'default',
                                        opacity: userDetailLoading && isPayPal ? 0.7 : 1,
                                        textDecoration: isPayPal && item.income_monthly_id ? 'underline' : 'none'
                                      }}
                                      title={isPayPal && item.income_monthly_id ? '点击同步PayPal支付状态（只查询状态，不会重复扣款�? : ''}
                                    >
                                      {userDetailLoading && isPayPal ? '同步�?..' : displayText}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {/* 发起支付按钮 */}
                                  <button
                                    onClick={async () => {
                                      if (!item.income_monthly_id) {
                                        setError('该用户该月的收入记录ID不存�?);
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
                                        
                                        // 找到对应的月度收入记�?
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
                                        
                                        // 如果还是没有 id，说明这个月的记录可能还没有生成，需要先提示用户生成月度汇�?
                                        if (!incomeMonthlyId) {
                                          setError(`该用�?${settlementMonth} 的月度收入记录尚未生成，请先点击"生成月度汇�?按钮`);
                                          return;
                                        }
                                        
                                        setSelectedIncomeMonthly(incomeMonthly);
                                        
                                        // 初始化支付表单（根据默认账户设置，使用返回的数据�?
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
                                          // 如果没有默认账户，使用第一个账�?
                                          const firstAccount = userDetailData.all_accounts[0];
                                          setPayoutForm({
                                            method: firstAccount.method || 'paypal',
                                            account_id: firstAccount.id.toString(),
                                            payout_currency: firstAccount.method === 'alipay' || firstAccount.method === 'wechat' ? 'CNY' : 'USD',
                                            fx_rate: firstAccount.method === 'alipay' || firstAccount.method === 'wechat' ? '7.20' : '1.0',
                                            note: ''
                                          });
                                        } else {
                                          // 如果没有账户，使用默认�?
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
                                        setError('加载用户信息失败�? + (err.message || '未知错误'));
                                      }
                                    }}
                                    className={styles.searchButton}
                                    disabled={userDetailLoading || item.month_status === 'paid' || item.month_status === 'processing'}
                                    title={item.month_status === 'paid' ? '已支�? : item.month_status === 'processing' ? '处理中，请使用同步按钮刷新状�? : '发起新的打款请求'}
                                    style={{ 
                                      opacity: (item.month_status === 'paid' || item.month_status === 'processing') ? 0.5 : 1,
                                      cursor: (item.month_status === 'paid' || item.month_status === 'processing') ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    {item.month_status === 'processing' ? '处理�? : '发起支付'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {/* 展开的详情行 */}
                            {isExpanded && item.income_monthly_id && (
                              <tr>
                                <td colSpan={8} style={{ padding: '20px', backgroundColor: '#f9f9f9' }}>
                                  {isLoading ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>加载�?..</div>
                                  ) : rowDetail ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                      {/* user_payout 表格 */}
                                      {rowDetail.payout ? (
                                        <div>
                                          <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#333' }}>支付单信�?(user_payout)</h4>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', marginBottom: '20px' }}>
                                            <thead>
                                              <tr style={{ backgroundColor: '#f0f0f0' }}>
                                                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>字段</th>
                                                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>�?/th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>ID</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.payout.id}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>用户ID</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.payout.user_id}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>月份</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.payout.month ? new Date(rowDetail.payout.month).toLocaleDateString('zh-CN') : '-'}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>基准金额（USD�?/td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>${(rowDetail.payout.base_amount_usd || 0).toFixed(2)}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>支付币种</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.payout.payout_currency || 'USD'}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>支付金额</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.payout.payout_currency === 'USD' ? '$' : '¥'}{(rowDetail.payout.payout_amount || 0).toFixed(2)}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>汇率</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{(rowDetail.payout.fx_rate || 0).toFixed(6)}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>状�?/td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                                  <span className={`${styles.status} ${
                                                    rowDetail.payout.status === 'paid' ? styles.completed :
                                                    rowDetail.payout.status === 'processing' ? styles.pending :
                                                    rowDetail.payout.status === 'failed' ? styles.error :
                                                    styles.pending
                                                  }`}>
                                                    {rowDetail.payout.status === 'paid' ? '已支�? :
                                                     rowDetail.payout.status === 'processing' ? '处理�? :
                                                     rowDetail.payout.status === 'failed' ? '失败' :
                                                     rowDetail.payout.status === 'pending' ? '待处�? :
                                                     rowDetail.payout.status === 'cancelled' ? '已取�? :
                                                     rowDetail.payout.status}
                                                  </span>
                                                </td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>支付方式</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.payout.method || '-'}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>请求时间</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.payout.requested_at ? new Date(rowDetail.payout.requested_at).toLocaleString('zh-CN') : '-'}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>完成时间</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.payout.paid_at ? new Date(rowDetail.payout.paid_at).toLocaleString('zh-CN') : '-'}</td>
                                              </tr>
                                              {rowDetail.payout.note && (
                                                <tr>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>备注</td>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.payout.note}</td>
                                                </tr>
                                              )}
                                              {rowDetail.payout.account_info && (
                                                <tr>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>账户信息</td>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                                    <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                      {JSON.stringify(rowDetail.payout.account_info, null, 2)}
                                                    </pre>
                                                  </td>
                                                </tr>
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <div style={{ padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '20px' }}>
                                          <p style={{ margin: 0, color: '#856404' }}>暂无支付单记�?/p>
                                        </div>
                                      )}
                                      
                                      {/* payout_gateway_transaction 表格 */}
                                      {rowDetail.gateway_tx ? (
                                        <div>
                                          <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#333' }}>支付网关交易信息 (payout_gateway_transaction)</h4>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
                                            <thead>
                                              <tr style={{ backgroundColor: '#f0f0f0' }}>
                                                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>字段</th>
                                                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>�?/th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>ID</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.gateway_tx.id}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>支付提供�?/td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.gateway_tx.provider || '-'}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>网关交易�?/td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.gateway_tx.provider_tx_id || '-'}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>状�?/td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                                  <span className={`${styles.status} ${
                                                    rowDetail.gateway_tx.status === 'succeeded' ? styles.completed :
                                                    rowDetail.gateway_tx.status === 'failed' ? styles.error :
                                                    rowDetail.gateway_tx.status === 'processing' ? styles.pending :
                                                    styles.pending
                                                  }`}>
                                                    {rowDetail.gateway_tx.status === 'succeeded' ? '成功' :
                                                     rowDetail.gateway_tx.status === 'failed' ? '失败' :
                                                     rowDetail.gateway_tx.status === 'processing' ? '处理�? :
                                                     rowDetail.gateway_tx.status === 'created' ? '已创�? :
                                                     rowDetail.gateway_tx.status}
                                                  </span>
                                                </td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>基准金额（USD�?/td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>${(rowDetail.gateway_tx.base_amount_usd || 0).toFixed(2)}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>币种</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.gateway_tx.payout_currency || 'USD'}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>打款金额</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.gateway_tx.payout_currency === 'USD' ? '$' : '¥'}{(rowDetail.gateway_tx.payout_amount || 0).toFixed(2)}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>汇率</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{(rowDetail.gateway_tx.fx_rate || 0).toFixed(6)}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>创建时间</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.gateway_tx.created_at ? new Date(rowDetail.gateway_tx.created_at).toLocaleString('zh-CN') : '-'}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>更新时间</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{rowDetail.gateway_tx.updated_at ? new Date(rowDetail.gateway_tx.updated_at).toLocaleString('zh-CN') : '-'}</td>
                                              </tr>
                                              {rowDetail.gateway_tx.error_code && (
                                                <tr>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>错误代码</td>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd', color: '#e74c3c' }}>{rowDetail.gateway_tx.error_code}</td>
                                                </tr>
                                              )}
                                              {rowDetail.gateway_tx.error_message && (
                                                <tr>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>错误信息</td>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd', color: '#e74c3c' }}>{rowDetail.gateway_tx.error_message}</td>
                                                </tr>
                                              )}
                                              {rowDetail.gateway_tx.request_payload && (
                                                <tr>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>请求数据</td>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                                    <details>
                                                      <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#007bff' }}>查看请求数据</summary>
                                                      <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', marginTop: '5px', maxHeight: '200px', overflow: 'auto', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                                                        {typeof rowDetail.gateway_tx.request_payload === 'string' 
                                                          ? rowDetail.gateway_tx.request_payload 
                                                          : JSON.stringify(rowDetail.gateway_tx.request_payload, null, 2)}
                                                      </pre>
                                                    </details>
                                                  </td>
                                                </tr>
                                              )}
                                              {rowDetail.gateway_tx.response_payload && (
                                                <tr>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>响应数据</td>
                                                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                                    <details>
                                                      <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#007bff' }}>查看响应数据</summary>
                                                      <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', marginTop: '5px', maxHeight: '200px', overflow: 'auto', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                                                        {typeof rowDetail.gateway_tx.response_payload === 'string' 
                                                          ? rowDetail.gateway_tx.response_payload 
                                                          : JSON.stringify(rowDetail.gateway_tx.response_payload, null, 2)}
                                                      </pre>
                                                    </details>
                                                  </td>
                                                </tr>
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <div style={{ padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                                          <p style={{ margin: 0, color: '#856404' }}>暂无支付网关交易记录</p>
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            )}
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
                            <div className={styles.loading}>加载�?..</div>
                          ) : (
                            <>
                              {/* 顶部：基本信�?*/}
                              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                                <h4 style={{ marginTop: 0 }}>基本信息</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                  <p><strong>用户:</strong> {selectedUserDetail.user?.pen_name || selectedUserDetail.user?.username || `用户${selectedUserDetail.user?.id}`}</p>
                                  <p><strong>用户ID:</strong> {selectedUserDetail.user?.id}</p>
                                  <p><strong>邮箱:</strong> {selectedUserDetail.user?.email || '-'}</p>
                                  <p><strong>月份:</strong> {settlementMonth}</p>
                                  <p><strong>是否作�?</strong> {selectedUserDetail.user?.is_author ? '�? : '�?}</p>
                                  <p><strong>是否推广�?</strong> {selectedUserDetail.user?.is_promoter ? '�? : '�?}</p>
                                  {selectedUserDetail.default_account && (
                                    <p><strong>默认收款账户:</strong> {selectedUserDetail.default_account.account_label} ({selectedUserDetail.default_account.method})</p>
                                  )}
                                </div>
                              </div>

                              {/* 当月收入信息 */}
                              {selectedUserDetail.monthly_incomes && selectedUserDetail.monthly_incomes.length > 0 && (
                                <div className={styles.paymentTable} style={{ marginBottom: '20px' }}>
                                  <h4>本月收入（USD�?/h4>
                                  {selectedUserDetail.monthly_incomes.map((income: any) => {
                                    const formatMonth = (monthStr: string) => {
                                      try {
                                        const date = new Date(monthStr);
                                        const year = date.getFullYear();
                                        const month = date.getMonth() + 1;
                                        return `${year}�?{month}月`;
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
                                            <strong>读者推�?</strong> ${(income.reader_referral_income_usd || 0).toFixed(2)}
                                          </div>
                                          <div>
                                            <strong>作者推�?</strong> ${(income.author_referral_income_usd || 0).toFixed(2)}
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                                          <div>
                                            <strong>总收�?</strong> <span style={{ fontSize: '18px', color: '#e74c3c' }}>${(income.total_income_usd || 0).toFixed(2)}</span>
                                          </div>
                                          <div>
                                            <span className={`${styles.status} ${
                                              income.payout_status === 'paid' ? styles.completed : styles.pending
                                            }`}>
                                              {income.payout_status === 'paid' ? '已支�? : '未支�?}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* 支付订单信息（user_payout�?*/}
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
                                      <th>状�?/th>
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
                                        
                                        // 格式化金额显�?
                                        const amountDisplay = payoutCurrency === 'USD' 
                                          ? `$${payoutAmount.toFixed(2)}`
                                          : `¥${payoutAmount.toFixed(2)} ${payoutCurrency}`;
                                        
                                        const formatMonth = (monthStr: string) => {
                                          if (!monthStr) return '-';
                                          try {
                                            const date = new Date(monthStr);
                                            const year = date.getFullYear();
                                            const month = date.getMonth() + 1;
                                            return `${year}�?{month}月`;
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
                                              {payout.status === 'paid' ? '已支�? :
                                               payout.status === 'processing' ? '处理�? :
                                               payout.status === 'approved' ? '已审�? :
                                               payout.status === 'pending' ? '待审�? :
                                               payout.status === 'failed' ? '失败' :
                                               payout.status === 'cancelled' ? '已取�? : payout.status}
                                            </span>
                                          </td>
                                          <td>{new Date(payout.requested_at).toLocaleString('zh-CN')}</td>
                                          <td>{payout.paid_at ? new Date(payout.paid_at).toLocaleString('zh-CN') : '-'}</td>
                                          <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                              <div>{payout.note || '-'}</div>
                                              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                {/* PayPal支付且状态为processing时，显示查询状态按�?*/}
                                                {payout.method === 'paypal' && payout.status === 'processing' && (
                                                  <button
                                                    onClick={() => checkPayoutStatus(payout.id)}
                                                    className={styles.generateButton}
                                                    disabled={checkingPayoutStatus === payout.id}
                                                    style={{ padding: '4px 8px', fontSize: '12px', minWidth: 'auto' }}
                                                  >
                                                    {checkingPayoutStatus === payout.id ? '查询�?..' : '查询PayPal状�?}
                                                  </button>
                                                )}
                                                {/* 手动标记已支付按�?*/}
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
                                                    标记已支�?
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
                                
                                {/* 网关流水（payout_gateway_transaction）嵌套显�?*/}
                                {selectedUserDetail.payouts.map((payout: any) => {
                                  if (!payout.gateway_tx_id) return null;
                                  
                                  return (
                                    <div key={`gateway-${payout.id}`} style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                                      <h5 style={{ marginTop: 0 }}>支付�?#{payout.id} - 网关流水</h5>
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
                                              <td style={{ padding: '8px', fontWeight: 'bold' }}>状�?</td>
                                              <td style={{ padding: '8px' }}>
                                                <span className={`${styles.status} ${
                                                  payout.gateway_transaction.status === 'succeeded' ? styles.completed :
                                                  payout.gateway_transaction.status === 'failed' ? styles.error :
                                                  styles.pending
                                                }`}>
                                                  {payout.gateway_transaction.status === 'succeeded' ? '成功' :
                                                   payout.gateway_transaction.status === 'failed' ? '失败' :
                                                   payout.gateway_transaction.status === 'processing' ? '处理�? :
                                                   payout.gateway_transaction.status === 'created' ? '已创�? : payout.gateway_transaction.status}
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
                        {userDetailLoading ? '同步�?..' : '同步PayPal支付状�?}
                      </button>
                    )}
                    <button onClick={() => setShowSettlementDetailModal(false)} className={styles.closeButton}>×</button>
                  </div>
                </div>
                <div className={styles.modalBody}>
                  {userDetailLoading ? (
                    <div className={styles.loading}>加载�?..</div>
                  ) : (
                    <>
                      {/* 顶部汇总状态条 */}
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <strong>本月总收�?</strong> <span style={{ fontSize: '18px', color: '#e74c3c', fontWeight: 'bold' }}>${(selectedSettlementDetail.income_monthly.total_income_usd || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <strong>已结算金�?</strong> <span style={{ fontSize: '16px', color: '#27ae60' }}>${(selectedSettlementDetail.income_monthly.paid_amount_usd || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <strong>结算状�?</strong> <span className={`${styles.status} ${
                            selectedSettlementDetail.income_monthly.payout_status === 'paid' ? styles.completed : styles.pending
                          }`}>
                            {selectedSettlementDetail.income_monthly.payout_status === 'paid' ? '已支�? : '未支�?}
                          </span>
                        </div>
                        <div>
                          <strong>网关状�?</strong> {selectedSettlementDetail.gateway_tx ? (
                            <span className={`${styles.status} ${
                              selectedSettlementDetail.gateway_tx.status === 'succeeded' ? styles.completed :
                              selectedSettlementDetail.gateway_tx.status === 'failed' ? styles.error :
                              styles.pending
                            }`}>
                              {selectedSettlementDetail.gateway_tx.status === 'succeeded' ? '成功' :
                               selectedSettlementDetail.gateway_tx.status === 'failed' ? '失败' :
                               selectedSettlementDetail.gateway_tx.status === 'processing' ? '处理�? :
                               selectedSettlementDetail.gateway_tx.status}
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>未发�?/span>
                          )}
                        </div>
                      </div>

                      {/* 区块一：基本信�?*/}
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <h4 style={{ marginTop: 0 }}>基本信息</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <p><strong>用户:</strong> {selectedSettlementDetail.user.name}</p>
                          <p><strong>用户ID:</strong> {selectedSettlementDetail.user.id}</p>
                          <p><strong>邮箱:</strong> {selectedSettlementDetail.user.email || '-'}</p>
                          <p><strong>月份:</strong> {selectedSettlementDetail.income_monthly.month ? new Date(selectedSettlementDetail.income_monthly.month).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' }) : '-'}</p>
                          <p><strong>是否作�?</strong> {selectedSettlementDetail.user.is_author ? '�? : '�?}</p>
                          <p><strong>是否推广�?</strong> {selectedSettlementDetail.user.is_promoter ? '�? : '�?}</p>
                          {selectedSettlementDetail.user.default_payout_account_label && (
                            <p><strong>默认收款账户:</strong> {selectedSettlementDetail.user.default_payout_account_label}</p>
                          )}
                        </div>
                      </div>

                      {/* 区块二：本月收入情况 */}
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <h4 style={{ marginTop: 0 }}>本月收入明细（USD�?/h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <p><strong>作者基础收入:</strong> ${(selectedSettlementDetail.income_monthly.author_base_income_usd || 0).toFixed(2)}</p>
                          <p><strong>读者推荐收�?</strong> ${(selectedSettlementDetail.income_monthly.reader_referral_income_usd || 0).toFixed(2)}</p>
                          <p><strong>作者推荐收�?</strong> ${(selectedSettlementDetail.income_monthly.author_referral_income_usd || 0).toFixed(2)}</p>
                          <p><strong style={{ fontSize: '16px', color: '#e74c3c' }}>总收�?</strong> <span style={{ fontSize: '18px', color: '#e74c3c', fontWeight: 'bold' }}>${(selectedSettlementDetail.income_monthly.total_income_usd || 0).toFixed(2)}</span></p>
                          <p><strong>已支付金�?</strong> ${(selectedSettlementDetail.income_monthly.paid_amount_usd || 0).toFixed(2)}</p>
                          <p><strong>结算状�?</strong> <span className={`${styles.status} ${
                            selectedSettlementDetail.income_monthly.payout_status === 'paid' ? styles.completed : styles.pending
                          }`}>
                            {selectedSettlementDetail.income_monthly.payout_status === 'paid' ? '已支�? : '未支�?}
                          </span></p>
                          <p><strong>创建时间:</strong> {selectedSettlementDetail.income_monthly.created_at ? new Date(selectedSettlementDetail.income_monthly.created_at).toLocaleString('zh-CN') : '-'}</p>
                          <p><strong>最近更新时�?</strong> {selectedSettlementDetail.income_monthly.updated_at ? new Date(selectedSettlementDetail.income_monthly.updated_at).toLocaleString('zh-CN') : '-'}</p>
                        </div>
                      </div>

                      {/* 区块三：结算/打款记录 */}
                      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <h4 style={{ marginTop: 0 }}>结算与打款记�?/h4>
                        {!selectedSettlementDetail.payout ? (
                          <p style={{ color: '#999', fontStyle: 'italic' }}>尚未生成结算记录</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <p><strong>结算单ID:</strong> {selectedSettlementDetail.payout.id}</p>
                            <p><strong>结算月份:</strong> {selectedSettlementDetail.payout.month ? new Date(selectedSettlementDetail.payout.month).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' }) : '-'}</p>
                            <p><strong>关联收入记录ID:</strong> {selectedSettlementDetail.payout.income_monthly_id || '-'}</p>
                            <p><strong>结算基准金额（USD�?</strong> ${(selectedSettlementDetail.payout.base_amount_usd || 0).toFixed(2)}</p>
                            <p><strong>结算币种:</strong> {selectedSettlementDetail.payout.payout_currency || 'USD'}</p>
                            <p><strong>实际打款金额:</strong> {selectedSettlementDetail.payout.payout_currency === 'USD' ? '$' : '¥'}{(selectedSettlementDetail.payout.payout_amount || 0).toFixed(2)}</p>
                            <p><strong>汇率:</strong> {(selectedSettlementDetail.payout.fx_rate || 0).toFixed(6)}</p>
                            <p><strong>结算状�?</strong> <span className={`${styles.status} ${
                              selectedSettlementDetail.payout.status === 'paid' ? styles.completed :
                              selectedSettlementDetail.payout.status === 'processing' ? styles.pending :
                              selectedSettlementDetail.payout.status === 'failed' ? styles.error :
                              styles.pending
                            }`}>
                              {selectedSettlementDetail.payout.status === 'paid' ? '已支�? :
                               selectedSettlementDetail.payout.status === 'processing' ? '处理�? :
                               selectedSettlementDetail.payout.status === 'pending' ? '待审�? :
                               selectedSettlementDetail.payout.status === 'failed' ? '失败' :
                               selectedSettlementDetail.payout.status === 'cancelled' ? '已取�? : selectedSettlementDetail.payout.status}
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
                          <p style={{ color: '#999', fontStyle: 'italic' }}>暂无网关交易记录（可能尚未发起或发起失败�?/p>
                        ) : (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                              <p><strong>网关记录ID:</strong> {selectedSettlementDetail.gateway_tx.id}</p>
                              <p><strong>支付提供�?</strong> {selectedSettlementDetail.gateway_tx.provider || '-'}</p>
                              <p><strong>网关交易�?</strong> {selectedSettlementDetail.gateway_tx.provider_tx_id || '-'}</p>
                              <p><strong>网关状�?</strong> <span className={`${styles.status} ${
                                selectedSettlementDetail.gateway_tx.status === 'succeeded' ? styles.completed :
                                selectedSettlementDetail.gateway_tx.status === 'failed' ? styles.error :
                                styles.pending
                              }`}>
                                {selectedSettlementDetail.gateway_tx.status === 'succeeded' ? '成功' :
                                 selectedSettlementDetail.gateway_tx.status === 'failed' ? '失败' :
                                 selectedSettlementDetail.gateway_tx.status === 'processing' ? '处理�? :
                                 selectedSettlementDetail.gateway_tx.status}
                              </span></p>
                              <p><strong>基准金额（USD�?</strong> ${(selectedSettlementDetail.gateway_tx.base_amount_usd || 0).toFixed(2)}</p>
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
                    <h4 style={{ marginTop: 0, color: '#856404' }}>⚠️ 请仔细核对以下信�?/h4>
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
                    <label><strong>记账金额（USD�?</strong></label>
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
                      {processingPayment ? '处理�?..' : '确认支付'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 发起支付弹窗（基于月度收入记录，支持汇率�?*/}
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
                    <label><strong>本月收入（USD�?</strong></label>
                    <p style={{ color: '#e74c3c', fontSize: '18px' }}>${(selectedIncomeMonthly.total_income_usd || 0).toFixed(2)}</p>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label><strong>支付方式:</strong></label>
                    <select
                      value={payoutForm.method}
                      onChange={(e) => {
                        const newMethod = e.target.value.toLowerCase();
                        // 根据支付方式自动设置币种和汇�?
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
                      <option value="alipay">支付�?/option>
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
                              // 根据账户的支付方式自动设置币�?
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
                      <p style={{ color: '#e74c3c', marginTop: '5px' }}>该用户尚未设置收款账�?/p>
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
                      <option value="CNY">CNY（人民币�?/option>
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
                    <label><strong>备注 (可�?:</strong></label>
                    <textarea
                      value={payoutForm.note}
                      onChange={(e) => setPayoutForm({ ...payoutForm, note: e.target.value })}
                      placeholder={`例如：结�?{settlementMonth}收入`}
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
                      {creatingPayout ? '创建�?..' : '确认创建支付订单'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 标记已支付弹�?*/}
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
                    <label><strong>支付提供�?</strong></label>
                    <select
                      value={markPaidForm.provider}
                      onChange={(e) => setMarkPaidForm({ ...markPaidForm, provider: e.target.value })}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    >
                      <option value="bank_manual">银行转账（人工）</option>
                      <option value="alipay">支付�?/option>
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
                      {markingPaid ? '处理�?..' : '确认标记已支�?}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 基础收入统计选项�?*/}
          {activeTab === 'base-income' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2>基础收入统计{baseIncomeData && baseIncomeData.summary && baseIncomeData.summary.totalCount > 0 ? ' - reader_spending' : ''}</h2>
                <div className={styles.dateFilter}>
                  <input
                    type="month"
                    value={baseIncomeMonth}
                    onChange={(e) => {
                      setBaseIncomeMonth(e.target.value);
                      setTimeout(() => loadBaseIncomeData(), 100);
                    }}
                  />
                  <button onClick={loadBaseIncomeData} className={styles.searchButton} disabled={baseIncomeLoading}>
                    查询
                  </button>
                  <button 
                    onClick={generateBaseIncomeData} 
                    className={styles.generateButton}
                    disabled={generating || baseIncomeLoading}
                  >
                    {generating ? '生成�?..' : '生成'}
                  </button>
                  {baseIncomeData && baseIncomeData.summary && baseIncomeData.summary.totalCount > 0 && (
                    <button 
                      onClick={deleteBaseIncomeData} 
                      className={styles.deleteButton}
                      disabled={baseIncomeLoading}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>

              {baseIncomeLoading ? (
                <div className={styles.loading}>加载�?..</div>
              ) : baseIncomeData ? (
                <>
                  {/* 汇总统计卡�?*/}
                  {baseIncomeData.summary && (
                    <div className={styles.statsCards}>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>总记录数</div>
                        <div className={styles.statValue}>{baseIncomeData.summary.totalCount}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>总金额（美元�?/div>
                        <div className={styles.statValue}>${baseIncomeData.summary.totalAmountUsd.toFixed(2)}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>章节解锁�?/div>
                        <div className={styles.statValue}>{baseIncomeData.summary.chapterUnlockCount}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>章节解锁金额</div>
                        <div className={styles.statValue}>${baseIncomeData.summary.chapterUnlockAmount.toFixed(2)}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>订阅�?/div>
                        <div className={styles.statValue}>{baseIncomeData.summary.subscriptionCount}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>订阅金额</div>
                        <div className={styles.statValue}>${baseIncomeData.summary.subscriptionAmount.toFixed(2)}</div>
                      </div>
                    </div>
                  )}

                  {/* 详细列表 */}
                  <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
                    <h3>基础收入明细</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>用户</th>
                          <th>小说</th>
                          <th>来源类型</th>
                          <th>Karma数量</th>
                          <th>金额（美元）</th>
                          <th>消费时间</th>
                          <th>状�?/th>
                        </tr>
                      </thead>
                      <tbody>
                        {baseIncomeData.details && baseIncomeData.details.length === 0 ? (
                          <tr>
                            <td colSpan={8} className={styles.emptyCell}>暂无数据，请点击"生成"按钮生成数据</td>
                          </tr>
                        ) : (
                          baseIncomeData.details?.map((item: any) => (
                            <tr key={item.id}>
                              <td>{item.id}</td>
                              <td>{item.userName}</td>
                              <td>{item.novelTitle}</td>
                              <td>
                                {item.sourceType === 'chapter_unlock' ? '章节解锁' : 
                                 item.sourceType === 'subscription' ? '订阅' : item.sourceType}
                              </td>
                              <td>{item.karmaAmount || 0}</td>
                              <td>${item.amountUsd.toFixed(2)}</td>
                              <td>{new Date(item.spendTime).toLocaleString('zh-CN')}</td>
                              <td>
                                <span className={`${styles.status} ${item.settled ? styles.completed : styles.pending}`}>
                                  {item.settled ? '已结�? : '未结�?}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>请选择月份查询或生成数�?/div>
              )}
            </div>
          )}

          {/* 作者基础收入表选项�?*/}
          {activeTab === 'author-royalty' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2>作者基础收入表{authorRoyaltyData && authorRoyaltyData.summary && authorRoyaltyData.summary.totalCount > 0 ? ' - author_royalty' : ''}</h2>
                <div className={styles.dateFilter}>
                  <input
                    type="month"
                    value={authorRoyaltyMonth}
                    onChange={(e) => {
                      setAuthorRoyaltyMonth(e.target.value);
                      setTimeout(() => loadAuthorRoyaltyData(), 100);
                    }}
                  />
                  <input
                    type="text"
                    placeholder="搜索作者（ID/用户�?邮箱/笔名/手机号）"
                    value={authorRoyaltySearchQuery}
                    onChange={(e) => setAuthorRoyaltySearchQuery(e.target.value)}
                    style={{ marginLeft: '10px', padding: '8px', width: '250px' }}
                  />
                  <button onClick={loadAuthorRoyaltyData} className={styles.searchButton} disabled={authorRoyaltyLoading}>
                    查询
                  </button>
                  <button 
                    onClick={generateAuthorRoyaltyData} 
                    className={styles.generateButton}
                    disabled={authorRoyaltyGenerating || authorRoyaltyLoading}
                  >
                    {authorRoyaltyGenerating ? '生成�?..' : '生成'}
                  </button>
                  {authorRoyaltyData && authorRoyaltyData.summary && authorRoyaltyData.summary.totalCount > 0 && (
                    <button 
                      onClick={deleteAuthorRoyaltyData} 
                      className={styles.deleteButton}
                      disabled={authorRoyaltyLoading}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>

              {authorRoyaltyLoading ? (
                <div className={styles.loading}>加载�?..</div>
              ) : authorRoyaltyData ? (
                <>
                  {/* 汇总统计卡�?*/}
                  {authorRoyaltyData.summary && (
                    <div className={styles.statsCards}>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>总记录数</div>
                        <div className={styles.statValue}>{authorRoyaltyData.summary.totalCount}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>总金额（美元�?/div>
                        <div className={styles.statValue}>${authorRoyaltyData.summary.totalAmountUsd.toFixed(2)}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>作者收入总额</div>
                        <div className={styles.statValue}>${authorRoyaltyData.summary.totalAuthorAmountUsd.toFixed(2)}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>作者数�?/div>
                        <div className={styles.statValue}>{authorRoyaltyData.summary.authorCount}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>小说数量</div>
                        <div className={styles.statValue}>{authorRoyaltyData.summary.novelCount}</div>
                      </div>
                    </div>
                  )}

                  {/* 详细列表 */}
                  <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
                    <h3>作者基础收入明细</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>作者ID</th>
                          <th>作�?/th>
                          <th>小说ID</th>
                          <th>小说</th>
                          <th>总收入（美元�?/th>
                          <th>作者收入（美元�?/th>
                          <th>结算月份</th>
                          <th>创建时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {authorRoyaltyData.details && authorRoyaltyData.details.length === 0 ? (
                          <tr>
                            <td colSpan={9} className={styles.emptyCell}>暂无数据，请点击"生成"按钮生成数据</td>
                          </tr>
                        ) : (
                          authorRoyaltyData.details?.map((item: any) => (
                            <tr key={item.id}>
                              <td>{item.id}</td>
                              <td>{item.authorId}</td>
                              <td>{item.authorName || `用户${item.authorId}`}</td>
                              <td>{item.novelId}</td>
                              <td>{item.novelTitle || '未知'}</td>
                              <td>${item.grossAmountUsd.toFixed(2)}</td>
                              <td>${item.authorAmountUsd.toFixed(2)}</td>
                              <td>{item.settlementMonth ? (() => {
                                const dateStr = typeof item.settlementMonth === 'string' 
                                  ? item.settlementMonth 
                                  : new Date(item.settlementMonth).toISOString().split('T')[0];
                                const [year, month] = dateStr.split('-');
                                return `${year}�?{parseInt(month)}月`;
                              })() : ''}</td>
                              <td>{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>请选择月份查询或生成数�?/div>
              )}
            </div>
          )}

          {/* 推广佣金明细选项�?*/}
          {activeTab === 'commission-transaction' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2>推广佣金明细{commissionData && commissionData.summary && commissionData.summary.totalCount > 0 ? ' - commission_transaction' : ''}</h2>
                <div className={styles.dateFilter}>
                  <input
                    type="month"
                    value={commissionMonth}
                    onChange={(e) => {
                      setCommissionMonth(e.target.value);
                      setTimeout(() => loadCommissionData(), 100);
                    }}
                  />
                  <input
                    type="text"
                    placeholder="搜索用户（ID/用户�?邮箱/笔名/手机号）"
                    value={commissionSearchQuery}
                    onChange={(e) => setCommissionSearchQuery(e.target.value)}
                    style={{ marginLeft: '10px', padding: '8px', width: '250px' }}
                  />
                  <select
                    value={commissionTypeFilter}
                    onChange={(e) => {
                      setCommissionTypeFilter(e.target.value);
                      setTimeout(() => loadCommissionData(), 100);
                    }}
                    style={{ marginLeft: '10px', padding: '8px' }}
                  >
                    <option value="all">全部类型</option>
                    <option value="reader_referral">读者推�?/option>
                    <option value="author_referral">作者推�?/option>
                  </select>
                  <button onClick={loadCommissionData} className={styles.searchButton} disabled={commissionLoading}>
                    查询
                  </button>
                  <button 
                    onClick={generateCommissionData} 
                    className={styles.generateButton}
                    disabled={commissionGenerating || commissionLoading}
                  >
                    {commissionGenerating ? '生成�?..' : '生成'}
                  </button>
                  {commissionData && commissionData.summary && commissionData.summary.totalCount > 0 && (
                    <button 
                      onClick={deleteCommissionData} 
                      className={styles.deleteButton}
                      disabled={commissionLoading}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>

              {commissionLoading ? (
                <div className={styles.loading}>加载�?..</div>
              ) : commissionData ? (
                <>
                  {/* 汇总统计卡�?*/}
                  {commissionData.summary && (
                    <div className={styles.statsCards}>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>总记录数</div>
                        <div className={styles.statValue}>{commissionData.summary.totalCount}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>总佣金（美元�?/div>
                        <div className={styles.statValue}>${commissionData.summary.totalCommissionUsd.toFixed(2)}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>读者推广佣�?/div>
                        <div className={styles.statValue}>${commissionData.summary.readerReferralCommission.toFixed(2)}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>作者推广佣�?/div>
                        <div className={styles.statValue}>${commissionData.summary.authorReferralCommission.toFixed(2)}</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>受益用户�?/div>
                        <div className={styles.statValue}>{commissionData.summary.userCount}</div>
                      </div>
                    </div>
                  )}

                  {/* 详细列表 */}
                  <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
                    <h3>推广佣金明细</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>受益用户ID</th>
                          <th>受益用户</th>
                          <th>佣金类型</th>
                          <th>层级</th>
                          <th>来源用户ID</th>
                          <th>来源用户</th>
                          <th>小说ID</th>
                          <th>小说</th>
                          <th>基础金额（美元）</th>
                          <th>佣金金额（美元）</th>
                          <th>结算月份</th>
                          <th>创建时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissionData.details && commissionData.details.length === 0 ? (
                          <tr>
                            <td colSpan={13} className={styles.emptyCell}>暂无数据，请点击"生成"按钮生成数据</td>
                          </tr>
                        ) : (
                          commissionData.details?.map((item: any) => (
                            <tr key={item.id}>
                              <td>{item.id}</td>
                              <td>{item.userId}</td>
                              <td>{item.userName || `用户${item.userId}`}</td>
                              <td>
                                <span className={`${styles.status} ${item.commissionType === 'reader_referral' ? styles.completed : styles.pending}`}>
                                  {item.commissionType === 'reader_referral' ? '读者推�? : '作者推�?}
                                </span>
                              </td>
                              <td>第{item.level}�?/td>
                              <td>{item.sourceUserId || item.sourceAuthorId || '-'}</td>
                              <td>{item.sourceUserName || item.sourceAuthorName || '-'}</td>
                              <td>{item.novelId || '-'}</td>
                              <td>{item.novelTitle || '-'}</td>
                              <td>${item.baseAmountUsd.toFixed(2)}</td>
                              <td>${item.commissionAmountUsd.toFixed(2)}</td>
                              <td>{item.settlementMonth ? (() => {
                                const dateStr = typeof item.settlementMonth === 'string' 
                                  ? item.settlementMonth 
                                  : new Date(item.settlementMonth).toISOString().split('T')[0];
                                const [year, month] = dateStr.split('-');
                                return `${year}�?{parseInt(month)}月`;
                              })() : ''}</td>
                              <td>{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>请选择月份查询或生成数�?/div>
              )}
            </div>
          )}

          {/* 提成设置选项�?*/}
          {activeTab === 'commission-settings' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2>提成设置</h2>
              </div>

              {/* 操作�?- 所有Tab共用 */}
              <div style={{ marginTop: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {commissionSettingsTab === 'plans' && plansSubTab === 'plans-list' && (
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
                        alert('新增汇率功能待实�?);
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
                    onClick={() => setCommissionSettingsTab('chapter-pricing')}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      background: commissionSettingsTab === 'chapter-pricing' ? '#007bff' : '#f0f0f0',
                      color: commissionSettingsTab === 'chapter-pricing' ? 'white' : '#333',
                      cursor: 'pointer',
                      borderRadius: '4px'
                    }}
                  >
                    章节单价
                  </button>
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
                    作者分成方�?
                  </button>
                </div>
              </div>

              {/* 章节单价Tab - 重构为列�?抽屉模式 */}
              {commissionSettingsTab === 'chapter-pricing' && (
                <>
                <div style={{ marginTop: '20px', position: 'relative' }}>
                  {/* 定价配置管理 - 只保留列�?*/}
                  <div>
                    <div>
                      {/* 数据列表查询区域 */}
                      <div style={{ 
                        background: '#ffffff', 
                        padding: '20px', 
                        borderRadius: '8px', 
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        marginBottom: '20px'
                      }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 600, color: '#333' }}>
                          定价配置列表
                        </h3>
                        
                        {/* 查询条件 */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                          gap: '15px',
                          marginBottom: '20px',
                          padding: '15px',
                          background: '#f8f9fa',
                          borderRadius: '6px'
                        }}>
                          {/* 小说搜索选择 */}
                          <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#666', fontWeight: 500 }}>
                              小说
                            </label>
                            {selectedNovelForPricing ? (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '8px 12px', 
                                border: '1px solid #28a745', 
                                borderRadius: '6px',
                                background: '#f0fff4',
                                fontSize: '14px'
                              }}>
                                <span style={{ color: '#333', fontWeight: 500 }}>
                                  {selectedNovelForPricing.title} (ID: {selectedNovelForPricing.id})
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedNovelForPricing(null);
                                    setUnlockpriceNovelSearchQuery('');
                                    setUnlockpriceFilters({ ...unlockpriceFilters, novel_id: '' });
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#dc3545',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    padding: '0 4px',
                                    lineHeight: 1
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="text"
                                  value={unlockpriceNovelSearchQuery}
                                  onChange={(e) => {
                                    setUnlockpriceNovelSearchQuery(e.target.value);
                                    searchNovelsForPricing(e.target.value);
                                    setUnlockpriceNovelSearchOpen(true);
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.borderColor = '#007bff';
                                    if (unlockpriceNovelSearchQuery) {
                                      setUnlockpriceNovelSearchOpen(true);
                                    }
                                  }}
                                  placeholder="搜索小说（ID、标题、作者、主角）"
                                  style={{ 
                                    width: '100%', 
                                    padding: '8px 12px', 
                                    border: '1px solid #ddd', 
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    transition: 'all 0.2s'
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.borderColor = '#ddd';
                                    // 延迟关闭下拉框，以便点击选项
                                    setTimeout(() => setUnlockpriceNovelSearchOpen(false), 200);
                                  }}
                                />
                                {unlockpriceNovelSearchOpen && unlockpriceNovelSearchResults.length > 0 && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    marginTop: '4px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 1000,
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                  }}>
                                    {unlockpriceNovelSearchResults.map((novel: any) => (
                                      <div
                                        key={novel.id}
                                        onClick={() => {
                                          setSelectedNovelForPricing(novel);
                                          setUnlockpriceNovelSearchQuery('');
                                          setUnlockpriceNovelSearchOpen(false);
                                          setUnlockpriceFilters({ ...unlockpriceFilters, novel_id: novel.id.toString() });
                                        }}
                                        style={{
                                          padding: '10px 12px',
                                          cursor: 'pointer',
                                          borderBottom: '1px solid #f0f0f0',
                                          fontSize: '13px',
                                          transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                      >
                                        <div style={{ fontWeight: 500, color: '#333', marginBottom: '2px' }}>
                                          {novel.title}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>
                                          ID: {novel.id} | 作�? {novel.author || '-'}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* 用户搜索选择 */}
                          <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#666', fontWeight: 500 }}>
                              用户
                            </label>
                            {selectedUserForPricing ? (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '8px 12px', 
                                border: '1px solid #28a745', 
                                borderRadius: '6px',
                                background: '#f0fff4',
                                fontSize: '14px'
                              }}>
                                <span style={{ color: '#333', fontWeight: 500 }}>
                                  {selectedUserForPricing.pen_name || selectedUserForPricing.username} (ID: {selectedUserForPricing.id})
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedUserForPricing(null);
                                    setUnlockpriceUserSearchQuery('');
                                    setUnlockpriceFilters({ ...unlockpriceFilters, user_id: '' });
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#dc3545',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    padding: '0 4px',
                                    lineHeight: 1
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="text"
                                  value={unlockpriceUserSearchQuery}
                                  onChange={(e) => {
                                    setUnlockpriceUserSearchQuery(e.target.value);
                                    searchUsersForPricing(e.target.value);
                                    setUnlockpriceUserSearchOpen(true);
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.borderColor = '#007bff';
                                    if (unlockpriceUserSearchQuery) {
                                      setUnlockpriceUserSearchOpen(true);
                                    }
                                  }}
                                  placeholder="搜索用户（ID、用户名、笔名、邮箱）"
                                  style={{ 
                                    width: '100%', 
                                    padding: '8px 12px', 
                                    border: '1px solid #ddd', 
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    transition: 'all 0.2s'
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.borderColor = '#ddd';
                                    // 延迟关闭下拉框，以便点击选项
                                    setTimeout(() => setUnlockpriceUserSearchOpen(false), 200);
                                  }}
                                />
                                {unlockpriceUserSearchOpen && unlockpriceUserSearchResults.length > 0 && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    marginTop: '4px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 1000,
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                  }}>
                                    {unlockpriceUserSearchResults.map((user: any) => (
                                      <div
                                        key={user.id}
                                        onClick={() => {
                                          setSelectedUserForPricing(user);
                                          setUnlockpriceUserSearchQuery('');
                                          setUnlockpriceUserSearchOpen(false);
                                          setUnlockpriceFilters({ ...unlockpriceFilters, user_id: user.id.toString() });
                                        }}
                                        style={{
                                          padding: '10px 12px',
                                          cursor: 'pointer',
                                          borderBottom: '1px solid #f0f0f0',
                                          fontSize: '13px',
                                          transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                      >
                                        <div style={{ fontWeight: 500, color: '#333', marginBottom: '2px' }}>
                                          {user.pen_name || user.username}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>
                                          ID: {user.id} | 用户�? {user.username} {user.pen_name && `| 笔名: ${user.pen_name}`}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                            <button
                              onClick={() => {
                                loadUnlockpriceList(1, true);
                              }}
                              style={{ 
                                padding: '8px 20px', 
                                background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                                boxShadow: '0 2px 4px rgba(0,123,255,0.3)',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,123,255,0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,123,255,0.3)';
                              }}
                            >
                              查询
                            </button>
                            <button
                              onClick={() => {
                                setUnlockpriceFilters({ novel_id: '', user_id: '' });
                                setUnlockpriceSort({ sort_by: 'id', sort_order: 'DESC' });
                                setUnlockpricePagination({ ...unlockpricePagination, page: 1 });
                                setSelectedNovelForPricing(null);
                                setSelectedUserForPricing(null);
                                setUnlockpriceNovelSearchQuery('');
                                setUnlockpriceUserSearchQuery('');
                              }}
                              style={{ 
                                padding: '8px 20px', 
                                background: '#6c757d', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#5a6268';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#6c757d';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              重置
                            </button>
                          </div>
                        </div>

                        {/* 数据表格 */}
                        {unlockpriceLoading ? (
                          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>加载�?..</div>
                        ) : unlockpriceList.length > 0 ? (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ 
                              width: '100%', 
                              borderCollapse: 'separate',
                              borderSpacing: 0,
                              background: 'white',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                              <thead>
                                <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                                  <th style={{ 
                                    padding: '14px 16px', 
                                    textAlign: 'left', 
                                    color: 'white',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                  }}
                                  onClick={() => {
                                    const newOrder = unlockpriceSort.sort_by === 'id' && unlockpriceSort.sort_order === 'DESC' ? 'ASC' : 'DESC';
                                    setUnlockpriceSort({ sort_by: 'id', sort_order: newOrder });
                                    setUnlockpricePagination(prev => ({ ...prev, page: 1 }));
                                  }}
                                  >
                                    ID {unlockpriceSort.sort_by === 'id' && (unlockpriceSort.sort_order === 'ASC' ? '�? : '�?)}
                                  </th>
                                  <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontSize: '13px', fontWeight: 600 }}>小说</th>
                                  <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontSize: '13px', fontWeight: 600 }}>作�?/th>
                                  <th style={{ 
                                    padding: '14px 16px', 
                                    textAlign: 'left', 
                                    color: 'white',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                  }}
                                  onClick={() => {
                                    const newOrder = unlockpriceSort.sort_by === 'karma_per_1000' && unlockpriceSort.sort_order === 'DESC' ? 'ASC' : 'DESC';
                                    setUnlockpriceSort({ sort_by: 'karma_per_1000', sort_order: newOrder });
                                    setUnlockpricePagination(prev => ({ ...prev, page: 1 }));
                                  }}
                                  >
                                    �?000�?{unlockpriceSort.sort_by === 'karma_per_1000' && (unlockpriceSort.sort_order === 'ASC' ? '�? : '�?)}
                                  </th>
                                  <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontSize: '13px', fontWeight: 600 }}>价格范围</th>
                                  <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontSize: '13px', fontWeight: 600 }}>免费章节</th>
                                  <th style={{ 
                                    padding: '14px 16px', 
                                    textAlign: 'left', 
                                    color: 'white',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                  }}
                                  onClick={() => {
                                    const newOrder = unlockpriceSort.sort_by === 'updated_at' && unlockpriceSort.sort_order === 'DESC' ? 'ASC' : 'DESC';
                                    setUnlockpriceSort({ sort_by: 'updated_at', sort_order: newOrder });
                                    setUnlockpricePagination(prev => ({ ...prev, page: 1 }));
                                  }}
                                  >
                                    更新时间 {unlockpriceSort.sort_by === 'updated_at' && (unlockpriceSort.sort_order === 'ASC' ? '�? : '�?)}
                                  </th>
                                  <th style={{ padding: '14px 16px', textAlign: 'center', color: 'white', fontSize: '13px', fontWeight: 600 }}>操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                {unlockpriceList.map((item: any, index: number) => (
                                  <tr 
                                    key={item.id}
                                    style={{ 
                                      background: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                                      transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#e3f2fd'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? '#ffffff' : '#f8f9fa'}
                                  >
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: '13px', color: '#333' }}>
                                      {item.id}
                                    </td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: '13px' }}>
                                      <div style={{ fontWeight: 500, color: '#333', marginBottom: '2px' }}>
                                        {item.novel_title || `小说ID: ${item.novel_id}`}
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#999' }}>
                                        ID: {item.novel_id}
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: '13px' }}>
                                      <div style={{ fontWeight: 500, color: '#333', marginBottom: '2px' }}>
                                        {item.user_pen_name || item.user_username || `用户ID: ${item.user_id}`}
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#999' }}>
                                        ID: {item.user_id}
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: '13px', color: '#007bff', fontWeight: 600 }}>
                                      {item.karma_per_1000} karma
                                    </td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: '13px', color: '#333' }}>
                                      <span style={{ color: '#28a745', fontWeight: 500 }}>{item.min_karma}</span>
                                      {' ~ '}
                                      <span style={{ color: '#dc3545', fontWeight: 500 }}>{item.max_karma}</span>
                                    </td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: '13px', color: '#333' }}>
                                      <span style={{ 
                                        display: 'inline-block',
                                        padding: '4px 10px',
                                        background: '#e3f2fd',
                                        color: '#1976d2',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: 500
                                      }}>
                                        前{item.default_free_chapters}�?
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: '12px', color: '#666' }}>
                                      {item.updated_at ? new Date(item.updated_at).toLocaleString('zh-CN') : '-'}
                                    </td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>
                                      <button
                                        onClick={() => {
                                          setEditingUnlockpriceItem(item);
                                        }}
                                        style={{ 
                                          padding: '6px 14px', 
                                          background: 'linear-gradient(135deg, #ff7f24 0%, #ff9500 100%)', 
                                          color: 'white', 
                                          border: 'none', 
                                          borderRadius: '6px', 
                                          cursor: 'pointer',
                                          fontSize: '12px',
                                          fontWeight: 500,
                                          boxShadow: '0 2px 4px rgba(255,127,36,0.3)',
                                          transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(255,127,36,0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'translateY(0)';
                                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(255,127,36,0.3)';
                                        }}
                                      >
                                        编辑
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            
                            {/* 分页 */}
                            {unlockpricePagination.totalPages > 1 && (
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginTop: '20px',
                                padding: '15px',
                                background: '#f8f9fa',
                                borderRadius: '6px'
                              }}>
                                <div style={{ fontSize: '13px', color: '#666' }}>
                                  �?{unlockpricePagination.total} 条记录，�?{unlockpricePagination.page} / {unlockpricePagination.totalPages} �?
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => {
                                      if (unlockpricePagination.page > 1) {
                                        const newPage = unlockpricePagination.page - 1;
                                        setUnlockpricePagination(prev => ({ ...prev, page: newPage }));
                                      }
                                    }}
                                    disabled={unlockpricePagination.page === 1}
                                    style={{ 
                                      padding: '6px 12px', 
                                      background: unlockpricePagination.page === 1 ? '#e9ecef' : '#007bff', 
                                      color: unlockpricePagination.page === 1 ? '#999' : 'white', 
                                      border: 'none', 
                                      borderRadius: '6px', 
                                      cursor: unlockpricePagination.page === 1 ? 'not-allowed' : 'pointer',
                                      fontSize: '13px'
                                    }}
                                  >
                                    上一�?
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (unlockpricePagination.page < unlockpricePagination.totalPages) {
                                        const newPage = unlockpricePagination.page + 1;
                                        setUnlockpricePagination(prev => ({ ...prev, page: newPage }));
                                      }
                                    }}
                                    disabled={unlockpricePagination.page === unlockpricePagination.totalPages}
                                    style={{ 
                                      padding: '6px 12px', 
                                      background: unlockpricePagination.page === unlockpricePagination.totalPages ? '#e9ecef' : '#007bff', 
                                      color: unlockpricePagination.page === unlockpricePagination.totalPages ? '#999' : 'white', 
                                      border: 'none', 
                                      borderRadius: '6px', 
                                      cursor: unlockpricePagination.page === unlockpricePagination.totalPages ? 'not-allowed' : 'pointer',
                                      fontSize: '13px'
                                    }}
                                  >
                                    下一�?
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ 
                            textAlign: 'center', 
                            padding: '60px 20px', 
                            color: '#999',
                            background: '#f8f9fa',
                            borderRadius: '8px'
                          }}>
                            <div style={{ fontSize: '48px', marginBottom: '10px' }}>📋</div>
                            <div style={{ fontSize: '14px' }}>暂无数据</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 底部编辑区域 */}
                {editingUnlockpriceItem && (
                    <div style={{
                      marginTop: '30px',
                      padding: '24px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#333' }}>
                        编辑定价配置 - {editingUnlockpriceItem.novel_title}
                      </h3>
                      <button
                        onClick={() => setEditingUnlockpriceItem(null)}
                        style={{
                          background: '#f0f0f0',
                          border: 'none',
                          color: '#666',
                          fontSize: '14px',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        关闭
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#333' }}>
                          �?000字karma�?*
                        </label>
                        <input
                          type="number"
                          value={editingUnlockpriceItem.karma_per_1000 || 6}
                          onChange={(e) => setEditingUnlockpriceItem({ ...editingUnlockpriceItem, karma_per_1000: parseInt(e.target.value) || 6 })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#333' }}>
                          单章价格下限 *
                        </label>
                        <input
                          type="number"
                          value={editingUnlockpriceItem.min_karma || 5}
                          onChange={(e) => setEditingUnlockpriceItem({ ...editingUnlockpriceItem, min_karma: parseInt(e.target.value) || 5 })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#333' }}>
                          单章价格上限 *
                        </label>
                        <input
                          type="number"
                          value={editingUnlockpriceItem.max_karma || 30}
                          onChange={(e) => setEditingUnlockpriceItem({ ...editingUnlockpriceItem, max_karma: parseInt(e.target.value) || 30 })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#333' }}>
                          前N章免�?*
                        </label>
                        <input
                          type="number"
                          value={editingUnlockpriceItem.default_free_chapters || 50}
                          onChange={(e) => setEditingUnlockpriceItem({ ...editingUnlockpriceItem, default_free_chapters: parseInt(e.target.value) || 50 })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={async () => {
                          try {
                            const response = await ApiService.put(`/admin/novels/${editingUnlockpriceItem.novel_id}/unlockprice`, {
                              karma_per_1000: editingUnlockpriceItem.karma_per_1000,
                              min_karma: editingUnlockpriceItem.min_karma,
                              max_karma: editingUnlockpriceItem.max_karma,
                              default_free_chapters: editingUnlockpriceItem.default_free_chapters
                            });
                            if (response.success) {
                              window.alert('保存成功');
                              setEditingUnlockpriceItem(null);
                              loadUnlockpriceList();
                            } else {
                              window.alert(response.message || '保存失败');
                            }
                          } catch (error: any) {
                            console.error('保存失败:', error);
                            window.alert('保存失败�? + (error.message || '未知错误'));
                          }
                        }}
                        style={{
                          padding: '10px 24px',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      >
                        保存配置
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm('确定要重新计算所有章节价格吗�?)) {
                            return;
                          }
                          try {
                            const response = await ApiService.post(`/admin/novels/${editingUnlockpriceItem.novel_id}/recalc-chapter-prices`, {});
                            if (response.success) {
                              window.alert(`成功�?{response.data.updated} 个章节已更新，失败：${response.data.failed} 个`);
                            } else {
                              window.alert(response.message || '计算失败');
                            }
                          } catch (error: any) {
                            console.error('计算失败:', error);
                            window.alert('计算失败�? + (error.message || '未知错误'));
                          }
                        }}
                        style={{
                          padding: '10px 24px',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      >
                        批量重新计算章节价格
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}

              {/* 推广分成方案Tab */}
              {commissionSettingsTab === 'plans' && (
                <>
                  {/* 二级Tab导航 */}
                  <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', borderBottom: '2px solid #e0e0e0' }}>
                    <button
                      onClick={() => setPlansSubTab('plans-list')}
                      style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: 'transparent',
                        color: plansSubTab === 'plans-list' ? '#007bff' : '#666',
                        cursor: 'pointer',
                        borderBottom: plansSubTab === 'plans-list' ? '2px solid #007bff' : '2px solid transparent',
                        marginBottom: '-2px',
                        fontWeight: plansSubTab === 'plans-list' ? '600' : 'normal'
                      }}
                    >
                      方案列表
                    </button>
                    <button
                      onClick={() => setPlansSubTab('referrals')}
                      style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: 'transparent',
                        color: plansSubTab === 'referrals' ? '#007bff' : '#666',
                        cursor: 'pointer',
                        borderBottom: plansSubTab === 'referrals' ? '2px solid #007bff' : '2px solid transparent',
                        marginBottom: '-2px',
                        fontWeight: plansSubTab === 'referrals' ? '600' : 'normal'
                      }}
                    >
                      用户绑定关系
                    </button>
                  </div>

                  {/* Tab1: 方案列表 */}
                  {plansSubTab === 'plans-list' && (
                <>
                  <div className={styles.paymentTable}>
                    <h3>推广分成方案列表</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>方案名称</th>
                          <th>类型</th>
                          <th>最大层�?/th>
                          <th>是否定制</th>
                          <th>拥有者用户ID</th>
                          <th>备注</th>
                          <th>状�?/th>
                          <th>生效时间</th>
                          <th>结束时间</th>
                          <th>使用中关系数</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissionPlansLoading ? (
                          <tr>
                            <td colSpan={12} className={styles.emptyCell}>加载�?..</td>
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
                                <td>{plan.plan_type === 'reader_promoter' ? '读者推�? : '作者推�?}</td>
                                <td>{plan.max_level}</td>
                                <td>{plan.is_custom === 1 || plan.is_custom === true ? '�? : '�?}</td>
                                <td>{plan.owner_user_id || '�?}</td>
                                <td>{plan.remark || '�?}</td>
                                <td>
                                  {plan.end_date ? '历史' : '当前生效'}
                                </td>
                                <td>{new Date(plan.start_date).toLocaleString('zh-CN')}</td>
                                <td>{plan.end_date ? new Date(plan.end_date).toLocaleString('zh-CN') : '�?}</td>
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
                                        <div>加载�?..</div>
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
                                                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>第{level.level}�?/td>
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
                    </>
                  )}

                  {/* Tab2: 用户绑定关系 */}
                  {plansSubTab === 'referrals' && (
                    <>
                      {/* 筛选区�?*/}
                      <div style={{ marginBottom: '20px', padding: '20px', background: '#fff', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
                            <label style={{ marginBottom: '5px', fontSize: '14px', color: '#666' }}>用户ID</label>
                            <input
                              type="text"
                              placeholder="输入用户ID"
                              value={referralsFilters.user_id}
                              onChange={(e) => setReferralsFilters({ ...referralsFilters, user_id: e.target.value })}
                              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
                            <label style={{ marginBottom: '5px', fontSize: '14px', color: '#666' }}>推荐人ID</label>
                            <input
                              type="text"
                              placeholder="输入推荐人ID"
                              value={referralsFilters.referrer_id}
                              onChange={(e) => setReferralsFilters({ ...referralsFilters, referrer_id: e.target.value })}
                              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '180px' }}>
                            <label style={{ marginBottom: '5px', fontSize: '14px', color: '#666' }}>推广分成方案</label>
                            <select
                              value={referralsFilters.promoter_plan_id}
                              onChange={(e) => setReferralsFilters({ ...referralsFilters, promoter_plan_id: e.target.value })}
                              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                            >
                              <option value="">全部推广方案</option>
                              {promoterPlanOptions.map(plan => (
                                <option key={plan.id} value={plan.id}>{plan.name}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '180px' }}>
                            <label style={{ marginBottom: '5px', fontSize: '14px', color: '#666' }}>作者分成方�?/label>
                            <select
                              value={referralsFilters.author_plan_id}
                              onChange={(e) => setReferralsFilters({ ...referralsFilters, author_plan_id: e.target.value })}
                              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                            >
                              <option value="">全部作者方�?/option>
                              {authorPlanOptions.map(plan => (
                                <option key={plan.id} value={plan.id}>{plan.name}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '300px' }}>
                            <label style={{ marginBottom: '5px', fontSize: '14px', color: '#666' }}>绑定时间</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <input
                                type="datetime-local"
                                value={referralsFilters.created_from}
                                onChange={(e) => setReferralsFilters({ ...referralsFilters, created_from: e.target.value })}
                                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                              />
                              <span style={{ lineHeight: '36px' }}>�?/span>
                              <input
                                type="datetime-local"
                                value={referralsFilters.created_to}
                                onChange={(e) => setReferralsFilters({ ...referralsFilters, created_to: e.target.value })}
                                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={loadReferralsData}
                              className={styles.searchButton}
                              disabled={referralsLoading}
                              style={{ padding: '8px 16px' }}
                            >
                              查询
                            </button>
                            <button
                              onClick={() => {
                                setReferralsFilters({
                                  user_id: '',
                                  referrer_id: '',
                                  promoter_plan_id: '',
                                  author_plan_id: '',
                                  created_from: '',
                                  created_to: ''
                                });
                                setReferralsPage(1);
                                setTimeout(() => loadReferralsData(), 100);
                              }}
                              style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              重置
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 表格区域 */}
                      <div className={styles.paymentTable}>
                        <h3>用户绑定关系列表</h3>
                        {referralsLoading ? (
                          <div className={styles.loading}>加载�?..</div>
                        ) : (
                          <>
                            <table>
                              <thead>
                                <tr>
                                  <th>ID</th>
                                  <th>用户ID / 昵称</th>
                                  <th>推荐人ID / 昵称</th>
                                  <th>推广分成方案</th>
                                  <th>作者分成方�?/th>
                                  <th>绑定时间</th>
                                  <th>最近更新时�?/th>
                                  <th>操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                {referralsData.length === 0 ? (
                                  <tr>
                                    <td colSpan={8} className={styles.emptyCell}>暂无数据</td>
                                  </tr>
                                ) : (
                                  referralsData.map((item: any) => (
                                    <tr key={item.id}>
                                      <td>{item.id}</td>
                                      <td>
                                        <div 
                                          onClick={() => openUserDialog(item.user_id)}
                                          style={{ cursor: 'pointer', color: '#007bff' }}
                                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                        >
                                          UID: {item.user_id}
                                        </div>
                                        <div style={{ color: '#999', fontSize: '12px' }}>{item.user_name || '-'}</div>
                                      </td>
                                      <td>
                                        <div 
                                          onClick={() => openUserDialog(item.referrer_id)}
                                          style={{ cursor: 'pointer', color: '#007bff' }}
                                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                        >
                                          RID: {item.referrer_id}
                                        </div>
                                        <div style={{ color: '#999', fontSize: '12px' }}>{item.referrer_name || '-'}</div>
                                      </td>
                                      <td>
                                        {item.promoter_plan_name ? (
                                          <span 
                                            onClick={() => openPlanDialog(item.promoter_plan_id)}
                                            style={{ cursor: 'pointer', color: '#28a745' }}
                                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                          >
                                            {item.promoter_plan_name}（ID: {item.promoter_plan_id}�?
                                          </span>
                                        ) : (
                                          <span style={{ color: '#999' }}>�?/span>
                                        )}
                                      </td>
                                      <td>
                                        {item.author_plan_name ? (
                                          <span 
                                            onClick={() => openPlanDialog(item.author_plan_id)}
                                            style={{ cursor: 'pointer', color: '#28a745' }}
                                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                          >
                                            {item.author_plan_name}（ID: {item.author_plan_id}�?
                                          </span>
                                        ) : (
                                          <span style={{ color: '#999' }}>�?/span>
                                        )}
                                      </td>
                                      <td>{item.created_at ? new Date(item.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '�?}</td>
                                      <td>{item.updated_at ? new Date(item.updated_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '�?}</td>
                                      <td>
                                        <button
                                          onClick={() => openEditReferralDialog(item)}
                                          style={{ padding: '4px 8px', fontSize: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
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
                            {referralsTotal > 0 && (
                              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ color: '#666' }}>
                                  �?{referralsTotal} 条记录，�?{referralsPage} / {Math.ceil(referralsTotal / referralsPageSize)} �?
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <button
                                    onClick={() => {
                                      if (referralsPage > 1) {
                                        setReferralsPage(referralsPage - 1);
                                        setTimeout(() => loadReferralsData(), 100);
                                      }
                                    }}
                                    disabled={referralsPage === 1}
                                    style={{ padding: '6px 12px', border: '1px solid #ddd', background: referralsPage === 1 ? '#f5f5f5' : 'white', cursor: referralsPage === 1 ? 'not-allowed' : 'pointer', borderRadius: '4px' }}
                                  >
                                    上一�?
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (referralsPage < Math.ceil(referralsTotal / referralsPageSize)) {
                                        setReferralsPage(referralsPage + 1);
                                        setTimeout(() => loadReferralsData(), 100);
                                      }
                                    }}
                                    disabled={referralsPage >= Math.ceil(referralsTotal / referralsPageSize)}
                                    style={{ padding: '6px 12px', border: '1px solid #ddd', background: referralsPage >= Math.ceil(referralsTotal / referralsPageSize) ? '#f5f5f5' : 'white', cursor: referralsPage >= Math.ceil(referralsTotal / referralsPageSize) ? 'not-allowed' : 'pointer', borderRadius: '4px' }}
                                  >
                                    下一�?
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Karma汇率Tab */}
              {commissionSettingsTab === 'karma' && (
                <>
                  <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
                    <p>说明：所有章节解锁消费将按解锁时刻对应的汇率计算。调整汇率仅影响未来消费，历史已结算数据不会被回算�?/p>
                  </div>
                  <div className={styles.paymentTable}>
                    <h3>Karma汇率列表</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>生效开始时�?/th>
                          <th>生效结束时间</th>
                          <th>1 Karma = 美元</th>
                          <th>创建时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {karmaRatesLoading ? (
                          <tr>
                            <td colSpan={4} className={styles.emptyCell}>加载�?..</td>
                          </tr>
                        ) : karmaRates.length === 0 ? (
                          <tr>
                            <td colSpan={4} className={styles.emptyCell}>暂无数据</td>
                          </tr>
                        ) : (
                          karmaRates.map((rate) => (
                            <tr key={rate.id}>
                              <td>{new Date(rate.effective_from).toLocaleString('zh-CN')}</td>
                              <td>{rate.effective_to ? new Date(rate.effective_to).toLocaleString('zh-CN') : '�?(当前生效)'}</td>
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
                    <h3>作者分成方案列�?/h3>
                    <table>
                      <thead>
                        <tr>
                          <th>方案名称</th>
                          <th>分成比例</th>
                          <th>是否默认</th>
                          <th>生效时间</th>
                          <th>结束时间</th>
                          <th>使用小说�?/th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {authorRoyaltyPlansLoading ? (
                          <tr>
                            <td colSpan={7} className={styles.emptyCell}>加载�?..</td>
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
                              <td>{plan.is_default ? '�? : '�?}</td>
                              <td>{new Date(plan.start_date).toLocaleString('zh-CN')}</td>
                              <td>{plan.end_date ? new Date(plan.end_date).toLocaleString('zh-CN') : '�?}</td>
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
            </div>
          )}
        </div>
    </div>
  );
};

export default AdminPanel;

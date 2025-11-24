import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import ApiService from '../../services/ApiService';
import styles from './IncomeManagement.module.css';

interface IncomeSummary {
  month: string;
  author_base_income: string;
  reader_referral_income: string;
  author_referral_income: string;
  total_income: string;
}

interface NovelIncome {
  novel_id: number;
  novel_title: string;
  author_base_income: string;
  reader_referral_income: string;
  author_referral_income: string;
  total_income: string;
}

interface IncomeDetail {
  id: number;
  time: string;
  novel_title?: string;
  source_type?: string;
  reader_username?: string;
  author_username?: string;
  author_pen_name?: string;
  level?: number;
  percent?: string;
  consumer_amount?: string;
  base_amount?: string;
  author_amount?: string;
  commission_amount?: string;
}

interface ReferralCode {
  code: string;
  link_type: string;
  referral_url: string;
  created_at: string;
}

interface ReferralPlan {
  id: number;
  name: string;
  max_level: number;
  is_custom?: boolean;
  levels: Array<{
    level: number;
    percent: number;
    percent_display: string;
  }>;
}

interface ReferralStats {
  month: string | null;
  total_referred_users: number;
  total_paying_users: number;
  reader_referral_income: string;
  author_referral_income: string;
  total_referral_income: string;
  daily: Array<{
    date: string;
    new_referred_users: number;
    referral_income: string;
  }>;
}

const IncomeManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'income' | 'referral' | 'settlement' | 'account'>('income');
  
  // 切换Tab时重置分页
  const handleTabChange = (tab: 'income' | 'referral' | 'settlement' | 'account') => {
    setActiveTab(tab);
    if (tab === 'income') {
      setIncomeDetailsPage(1);
    } else if (tab === 'referral') {
      setSubordinatesPage(1);
    } else if (tab === 'settlement') {
      setSettlementSubTab('monthly');
      setPayoutPage(1);
    }
  };
  
  // 作者收入相关状态
  const [incomeMonth, setIncomeMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedNovelId, setSelectedNovelId] = useState<string>('all');
  const [incomeSummary, setIncomeSummary] = useState<IncomeSummary | null>(null);
  const [novelIncomes, setNovelIncomes] = useState<NovelIncome[]>([]);
  const [incomeDetailsTab, setIncomeDetailsTab] = useState<'base' | 'reader' | 'author'>('base');
  const [incomeDetails, setIncomeDetails] = useState<IncomeDetail[]>([]);
  const [incomeDetailsPage, setIncomeDetailsPage] = useState(1);
  const [incomeDetailsTotal, setIncomeDetailsTotal] = useState(0);
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [userNovels, setUserNovels] = useState<any[]>([]);
  
  // 推广链接相关状态
  const [promotionLink, setPromotionLink] = useState<string>('');
  const [promotionCode, setPromotionCode] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [referralPlans, setReferralPlans] = useState<{ reader_plan: ReferralPlan | null; author_plan: ReferralPlan | null } | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  // 推广方案展开/折叠状态
  const [readerPlanExpanded, setReaderPlanExpanded] = useState<boolean>(false);
  const [authorPlanExpanded, setAuthorPlanExpanded] = useState<boolean>(false);
  const [subordinates, setSubordinates] = useState<any[]>([]);
  const [subordinatesPage, setSubordinatesPage] = useState(1);
  const [subordinatesTotal, setSubordinatesTotal] = useState(0);
  
  // 结算管理相关状态
  const [settlementSubTab, setSettlementSubTab] = useState<'monthly' | 'payout'>('monthly');
  const [monthlyIncomes, setMonthlyIncomes] = useState<any[]>([]);
  const [monthlyIncomesLoading, setMonthlyIncomesLoading] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutTotal, setPayoutTotal] = useState(0);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [selectedPayoutDetail, setSelectedPayoutDetail] = useState<any>(null);
  
  // 收款账户相关状态
  const [payoutAccounts, setPayoutAccounts] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [accountForm, setAccountForm] = useState({
    method: 'PayPal',
    account_label: '',
    account_data: {} as any,
    is_default: false
  });

  // 加载用户作品列表
  const loadUserNovels = useCallback(async () => {
    if (!user) return;
    try {
      const response = await ApiService.get(`/novels/user/${user.id}`);
      const novels = Array.isArray(response) ? response : (response.data || []);
      setUserNovels(novels);
    } catch (error) {
      console.error('加载作品列表失败:', error);
    }
  }, [user]);

  // 加载收入汇总
  const loadIncomeSummary = useCallback(async () => {
    if (!user) return;
    try {
      setIncomeLoading(true);
      let url = `/writer/income/summary?month=${incomeMonth}-01`;
      if (selectedNovelId !== 'all') {
        url += `&novel_id=${selectedNovelId}`;
      }
      
      const response = await ApiService.get(url);
      if (response && response.success) {
        setIncomeSummary(response.data);
      }
    } catch (error) {
      console.error('加载收入汇总失败:', error);
    } finally {
      setIncomeLoading(false);
    }
  }, [user, incomeMonth, selectedNovelId]);

  // 加载按作品汇总
  const loadNovelIncomes = useCallback(async () => {
    if (!user) return;
    try {
      const response = await ApiService.get(`/writer/income/by-novel?month=${incomeMonth}-01`);
      if (response && response.success) {
        setNovelIncomes(response.data || []);
      }
    } catch (error) {
      console.error('加载按作品汇总失败:', error);
    }
  }, [user, incomeMonth]);

  // 加载收入明细
  const loadIncomeDetails = useCallback(async () => {
    if (!user) return;
    try {
      setIncomeLoading(true);
      const endpoint = incomeDetailsTab === 'base' 
        ? '/writer/income/details/base'
        : incomeDetailsTab === 'reader'
        ? '/writer/income/details/reader-referral'
        : '/writer/income/details/author-referral';
      
      let url = `${endpoint}?month=${incomeMonth}-01&page=${incomeDetailsPage}&pageSize=20`;
      if (selectedNovelId !== 'all') {
        url += `&novel_id=${selectedNovelId}`;
      }
      
      const response = await ApiService.get(url);
      if (response && response.success) {
        setIncomeDetails(response.data || []);
        setIncomeDetailsTotal(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error('加载收入明细失败:', error);
    } finally {
      setIncomeLoading(false);
    }
  }, [user, incomeMonth, selectedNovelId, incomeDetailsTab, incomeDetailsPage]);

  // 初始化推广链接和推广码（使用用户ID）
  const initializePromotionLink = useCallback(() => {
    if (!user) return;
    const baseUrl = window.location.origin;
    const promotionUrl = `${baseUrl}/register?ref=${user.id}`;
    setPromotionLink(promotionUrl);
    setPromotionCode(String(user.id));
    
    // 生成二维码
    generateQRCode(promotionUrl);
  }, [user]);

  // 生成二维码
  const generateQRCode = async (url: string) => {
    try {
      // 使用第三方服务生成二维码，或者调用后端API
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
      setQrCode(qrCodeUrl);
    } catch (error) {
      console.error('生成二维码失败:', error);
    }
  };

  // 加载推广方案
  const loadReferralPlans = useCallback(async () => {
    if (!user) return;
    try {
      const response = await ApiService.get('/writer/referral/plans');
      if (response && response.success) {
        setReferralPlans(response.data);
      }
    } catch (error) {
      console.error('加载推广方案失败:', error);
    }
  }, [user]);

  // 加载推广统计
  const loadReferralStats = useCallback(async () => {
    if (!user) return;
    try {
      let url = '/writer/referral/stats';
      if (incomeMonth) {
        url += `?month=${incomeMonth}-01`;
      }
      const response = await ApiService.get(url);
      if (response && response.success) {
        setReferralStats(response.data);
      }
    } catch (error) {
      console.error('加载推广统计失败:', error);
    }
  }, [user, incomeMonth]);

  // 加载下级列表
  const loadSubordinates = useCallback(async () => {
    if (!user) return;
    try {
      const response = await ApiService.get(`/writer/referral/subordinates?page=${subordinatesPage}&pageSize=20`);
      if (response && response.success) {
        setSubordinates(response.data || []);
        setSubordinatesTotal(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error('加载下级列表失败:', error);
    }
  }, [user, subordinatesPage]);

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板');
    }).catch(err => {
      console.error('复制失败:', err);
    });
  };

  // 加载月度收入列表（结算管理用）
  const loadMonthlyIncomes = useCallback(async () => {
    if (!user) return;
    try {
      setMonthlyIncomesLoading(true);
      const response = await ApiService.get('/writer/income/monthly?limit=24');
      if (response && response.success) {
        setMonthlyIncomes(response.data || []);
      }
    } catch (error) {
      console.error('加载月度收入列表失败:', error);
    } finally {
      setMonthlyIncomesLoading(false);
    }
  }, [user]);
  
  // 加载支付记录列表
  const loadPayouts = useCallback(async () => {
    if (!user) return;
    try {
      setPayoutsLoading(true);
      const response = await ApiService.get(`/writer/payout/list?page=${payoutPage}&pageSize=20`);
      if (response && response.success) {
        setPayouts(response.data || []);
        setPayoutTotal(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error('加载支付记录失败:', error);
    } finally {
      setPayoutsLoading(false);
    }
  }, [user, payoutPage]);
  
  // 加载支付记录详情
  const loadPayoutDetail = async (payoutId: number) => {
    if (!user) return;
    try {
      const response = await ApiService.get(`/writer/payout/detail/${payoutId}`);
      if (response && response.success) {
        setSelectedPayoutDetail(response.data);
      }
    } catch (error) {
      console.error('加载支付记录详情失败:', error);
    }
  };
  
  // 加载收款账户列表
  const loadPayoutAccounts = useCallback(async () => {
    if (!user) return;
    try {
      setAccountsLoading(true);
      const response = await ApiService.get('/writer/payout-account/list');
      if (response && response.success) {
        setPayoutAccounts(response.data || []);
      }
    } catch (error) {
      console.error('加载收款账户列表失败:', error);
    } finally {
      setAccountsLoading(false);
    }
  }, [user]);
  
  // 保存收款账户
  const savePayoutAccount = async () => {
    if (!user) return;
    if (!accountForm.account_label) {
      alert('请填写账户标签');
      return;
    }
    
    // 根据支付方式验证必填字段
    let isValid = false;
    switch (accountForm.method) {
      case 'PayPal':
        isValid = !!(accountForm.account_data.email);
        if (!isValid) alert('请填写PayPal邮箱');
        break;
      case 'Alipay':
        isValid = !!(accountForm.account_data.account);
        if (!isValid) alert('请填写支付宝账号');
        break;
      case 'WeChat':
        isValid = !!(accountForm.account_data.wechat_id || accountForm.account_data.qrcode_url);
        if (!isValid) alert('请填写微信号或收款码URL');
        break;
      case 'Bank':
        isValid = !!(accountForm.account_data.bank_name && accountForm.account_data.account_name && accountForm.account_data.card_number);
        if (!isValid) alert('请填写完整的银行卡信息');
        break;
      default:
        isValid = false;
        alert('请选择支付方式');
    }
    
    if (!isValid) return;
    
    try {
      // 将前端的method值转换为数据库格式（小写）
      const methodMap: { [key: string]: string } = {
        'PayPal': 'paypal',
        'Alipay': 'alipay',
        'WeChat': 'wechat',
        'Bank': 'bank_transfer'
      };
      const dbMethod = methodMap[accountForm.method] || accountForm.method.toLowerCase();
      
      const response = await ApiService.post('/writer/payout-account/save', {
        id: editingAccount?.id,
        ...accountForm,
        method: dbMethod // 使用数据库格式的method值
      });
      if (response && response.success) {
        alert(editingAccount ? '收款账户已更新' : '收款账户已创建');
        setShowAccountModal(false);
        setEditingAccount(null);
        setAccountForm({
          method: 'PayPal',
          account_label: '',
          account_data: {},
          is_default: false
        });
        await loadPayoutAccounts();
      }
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };
  
  // 设置默认收款账户
  const setDefaultAccount = async (accountId: number) => {
    if (!user) return;
    try {
      const response = await ApiService.post(`/writer/payout-account/${accountId}/set-default`);
      if (response && response.success) {
        alert('已设置为默认收款账户');
        await loadPayoutAccounts();
      }
    } catch (error: any) {
      alert(error.message || '设置失败');
    }
  };
  
  // 打开新增账户Modal
  const openAddAccountModal = () => {
    setEditingAccount(null);
    setAccountForm({
      method: 'PayPal',
      account_label: '',
      account_data: {},
      is_default: false
    });
    setShowAccountModal(true);
  };
  
  // 打开编辑账户Modal
  const openEditAccountModal = (account: any) => {
    setEditingAccount(account);
    setAccountForm({
      method: normalizeMethod(account.method), // 标准化method值
      account_label: account.account_label,
      account_data: account.account_data || {},
      is_default: account.is_default
    });
    setShowAccountModal(true);
  };
  
  // 格式化银行卡号（中间打星）
  const formatCardNumber = (cardNumber: string) => {
    if (!cardNumber) return '';
    if (cardNumber.length <= 8) return cardNumber;
    const last4 = cardNumber.slice(-4);
    const first4 = cardNumber.slice(0, 4);
    return `${first4} **** ${last4}`;
  };
  
  // 获取支付方式显示名称
  const getMethodName = (method: string) => {
    const methodMap: { [key: string]: string } = {
      'PayPal': 'PayPal',
      'paypal': 'PayPal',
      'Alipay': '支付宝',
      'alipay': '支付宝',
      'WeChat': '微信支付',
      'wechat': '微信支付',
      'Bank': '银行卡',
      'bank_transfer': '银行卡',
      'bank': '银行卡'
    };
    return methodMap[method] || method;
  };
  
  // 标准化支付方式（将数据库的小写值转换为前端使用的大写值）
  const normalizeMethod = (method: string) => {
    const methodMap: { [key: string]: string } = {
      'paypal': 'PayPal',
      'alipay': 'Alipay',
      'wechat': 'WeChat',
      'bank_transfer': 'Bank',
      'bank': 'Bank'
    };
    return methodMap[method.toLowerCase()] || method;
  };
  
  // 删除收款账户
  const deletePayoutAccount = async (accountId: number) => {
    if (!window.confirm('确定要删除这个收款账户吗？')) {
      return;
    }
    
    try {
      const response = await ApiService.delete(`/writer/payout-account/${accountId}`);
      if (response && response.success) {
        alert('收款账户已删除');
        await loadPayoutAccounts();
      }
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  // 初始化加载
  useEffect(() => {
    loadUserNovels();
  }, [loadUserNovels]);

  useEffect(() => {
    if (activeTab === 'income') {
      loadIncomeSummary();
      loadNovelIncomes();
    } else if (activeTab === 'referral') {
      initializePromotionLink();
      loadReferralPlans();
      loadReferralStats();
      loadSubordinates();
    } else if (activeTab === 'settlement') {
      if (settlementSubTab === 'monthly') {
        loadMonthlyIncomes();
      } else {
        loadPayouts();
      }
    } else if (activeTab === 'account') {
      loadPayoutAccounts();
    }
  }, [activeTab, settlementSubTab, payoutPage, loadIncomeSummary, loadNovelIncomes, initializePromotionLink, loadReferralPlans, loadReferralStats, loadSubordinates, loadMonthlyIncomes, loadPayouts, loadPayoutAccounts]);

  useEffect(() => {
    if (activeTab === 'income') {
      loadIncomeDetails();
    }
  }, [activeTab, incomeMonth, selectedNovelId, incomeDetailsTab, incomeDetailsPage, loadIncomeDetails]);

  useEffect(() => {
    if (activeTab === 'referral' && user) {
      initializePromotionLink();
    }
  }, [activeTab, user, initializePromotionLink]);

  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'income' ? styles.active : ''}`}
          onClick={() => handleTabChange('income')}
        >
          作者收入
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'referral' ? styles.active : ''}`}
          onClick={() => handleTabChange('referral')}
        >
          推广链接
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'settlement' ? styles.active : ''}`}
          onClick={() => handleTabChange('settlement')}
        >
          结算管理
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'account' ? styles.active : ''}`}
          onClick={() => handleTabChange('account')}
        >
          收款账户
        </button>
      </div>

      {/* 作者收入 Tab */}
      {activeTab === 'income' && (
        <div className={styles.tabContent}>
          {/* 筛选区 */}
          <div className={styles.filters}>
            <div className={styles.filterItem}>
              <label>月份：</label>
              <input
                type="month"
                value={incomeMonth}
                onChange={(e) => setIncomeMonth(e.target.value)}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div className={styles.filterItem}>
              <label>作品：</label>
              <select
                value={selectedNovelId}
                onChange={(e) => setSelectedNovelId(e.target.value)}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="all">全部作品</option>
                {userNovels.map(novel => (
                  <option key={novel.id} value={novel.id}>{novel.title}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterItem}>
              <label>货币：</label>
              <span>USD</span>
            </div>
          </div>

          {/* 统计卡片 */}
          {incomeSummary && (
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <div className={styles.cardTitle}>本月总收入</div>
                <div className={styles.cardValue}>{formatCurrency(incomeSummary.total_income)}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.cardTitle}>基础作者收入</div>
                <div className={styles.cardValue}>{formatCurrency(incomeSummary.author_base_income)}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.cardTitle}>读者推广收入</div>
                <div className={styles.cardValue}>{formatCurrency(incomeSummary.reader_referral_income)}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.cardTitle}>作者推广收入</div>
                <div className={styles.cardValue}>{formatCurrency(incomeSummary.author_referral_income)}</div>
              </div>
            </div>
          )}

          {/* 按作品汇总 */}
          <div className={styles.section}>
            <h3>按作品汇总</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>作品</th>
                  <th>基础收入</th>
                  <th>总收入</th>
                </tr>
              </thead>
              <tbody>
                {novelIncomes.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px' }}>
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  novelIncomes.map(novel => (
                    <tr key={novel.novel_id}>
                      <td>{novel.novel_title}</td>
                      <td>{formatCurrency(novel.author_base_income)}</td>
                      <td>{formatCurrency(novel.total_income)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 收入明细 */}
          <div className={styles.section}>
            <div className={styles.subTabs}>
              <button
                className={`${styles.subTab} ${incomeDetailsTab === 'base' ? styles.active : ''}`}
                onClick={() => setIncomeDetailsTab('base')}
              >
                基础收入明细
              </button>
              <button
                className={`${styles.subTab} ${incomeDetailsTab === 'reader' ? styles.active : ''}`}
                onClick={() => setIncomeDetailsTab('reader')}
              >
                读者推广明细
              </button>
              <button
                className={`${styles.subTab} ${incomeDetailsTab === 'author' ? styles.active : ''}`}
                onClick={() => setIncomeDetailsTab('author')}
              >
                作者推广明细
              </button>
            </div>

            {incomeLoading ? (
              <div>加载中...</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    {incomeDetailsTab === 'base' && (
                      <>
                        <th>时间</th>
                        <th>作品</th>
                        <th>来源类型</th>
                        <th>读者</th>
                        <th>消费金额</th>
                        <th>作者分成</th>
                      </>
                    )}
                    {incomeDetailsTab === 'reader' && (
                      <>
                        <th>时间</th>
                        <th>下级读者</th>
                        <th>作品</th>
                        <th>层级</th>
                        <th>分成比例</th>
                        <th>消费金额</th>
                        <th>推广收入</th>
                      </>
                    )}
                    {incomeDetailsTab === 'author' && (
                      <>
                        <th>时间</th>
                        <th>下级作者</th>
                        <th>作品</th>
                        <th>层级</th>
                        <th>分成比例</th>
                        <th>基础收入</th>
                        <th>推广收入</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {incomeDetails.length === 0 ? (
                    <tr>
                      <td colSpan={incomeDetailsTab === 'base' ? 6 : 7} style={{ textAlign: 'center', padding: '20px' }}>
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    incomeDetails.map(detail => (
                    <tr key={detail.id}>
                      {incomeDetailsTab === 'base' && (
                        <>
                          <td>{new Date(detail.time).toLocaleString('zh-CN')}</td>
                          <td>{detail.novel_title}</td>
                          <td>{detail.source_type}</td>
                          <td>{detail.reader_username}</td>
                          <td>{formatCurrency(detail.consumer_amount || '0')}</td>
                          <td>{formatCurrency(detail.author_amount || '0')}</td>
                        </>
                      )}
                      {incomeDetailsTab === 'reader' && (
                        <>
                          <td>{new Date(detail.time).toLocaleString('zh-CN')}</td>
                          <td>{detail.reader_username}</td>
                          <td>{detail.novel_title}</td>
                          <td>第{detail.level}层</td>
                          <td>{detail.percent}</td>
                          <td>{formatCurrency(detail.base_amount || '0')}</td>
                          <td>{formatCurrency(detail.commission_amount || '0')}</td>
                        </>
                      )}
                      {incomeDetailsTab === 'author' && (
                        <>
                          <td>{new Date(detail.time).toLocaleString('zh-CN')}</td>
                          <td>{detail.author_pen_name || detail.author_username}</td>
                          <td>{detail.novel_title}</td>
                          <td>第{detail.level}层</td>
                          <td>{detail.percent}</td>
                          <td>{formatCurrency(detail.base_amount || '0')}</td>
                          <td>{formatCurrency(detail.commission_amount || '0')}</td>
                        </>
                      )}
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 推广链接 Tab */}
      {activeTab === 'referral' && (
        <div className={styles.tabContent}>
          {/* 推广方案说明 */}
          {referralPlans && (
            <div className={styles.planInfo}>
              <h3 style={{ 
                marginTop: 0, 
                marginBottom: '20px', 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#333',
                paddingBottom: '12px',
                borderBottom: '2px solid #e0e0e0'
              }}>
                当前推广方案
              </h3>
              
              {/* 读者推广方案 */}
              {referralPlans.reader_plan && (
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  {/* 可点击的标题区域（红色框） */}
                  <div 
                    onClick={() => setReaderPlanExpanded(!readerPlanExpanded)}
                    style={{ 
                      fontSize: '15px', 
                      fontWeight: '600', 
                      color: '#333',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e9ecef';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        transform: readerPlanExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s',
                        fontSize: '12px',
                        color: '#007bff'
                      }}>
                        ▶
                      </span>
                      <span>
                        读者推广方案：
                        <span style={{ 
                          color: '#007bff', 
                          marginLeft: '8px',
                          fontWeight: 'bold'
                        }}>
                          {referralPlans.reader_plan.name}
                        </span>
                        {referralPlans.reader_plan.is_custom && (
                          <span style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            background: '#ffc107',
                            color: '#333',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'normal'
                          }}>
                            专属方案
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '16px', 
                      color: '#666'
                    }}>
                      {referralPlans.reader_plan.levels.map((l, idx) => (
                        <span key={l.level}>
                          <span style={{ fontWeight: '600', color: '#007bff' }}>
                            {l.percent_display}
                          </span>
                          {idx < referralPlans.reader_plan!.levels.length - 1 && ' / '}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* 读者提成规则说明（绿色框，默认隐藏） */}
                  {readerPlanExpanded && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      background: 'white',
                      borderRadius: '6px',
                      borderLeft: '4px solid #007bff',
                      animation: 'fadeIn 0.3s ease-in'
                    }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#333',
                        marginBottom: '8px'
                      }}>
                        推广读者的提成规则：
                      </div>
                      {referralPlans.reader_plan.levels.map((l) => (
                        <div key={l.level} style={{
                          fontSize: '13px',
                          color: '#666',
                          lineHeight: '1.8',
                          paddingLeft: '12px',
                          position: 'relative'
                        }}>
                          <span style={{
                            position: 'absolute',
                            left: '0',
                            color: '#007bff',
                            fontWeight: '600'
                          }}>
                            •
                          </span>
                          {l.level === 1 && '一级读者消费的 '}
                          {l.level === 2 && '二级读者消费的 '}
                          {l.level === 3 && '三级读者消费的 '}
                          {l.level === 4 && '四级读者消费的 '}
                          <span style={{ fontWeight: '600', color: '#007bff' }}>
                            {l.percent_display}
                          </span>
                          {' 为您的收入'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* 作者推广方案 */}
              {referralPlans.author_plan && (
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  {/* 可点击的标题区域（红色框） */}
                  <div 
                    onClick={() => setAuthorPlanExpanded(!authorPlanExpanded)}
                    style={{ 
                      fontSize: '15px', 
                      fontWeight: '600', 
                      color: '#333',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e9ecef';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        transform: authorPlanExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s',
                        fontSize: '12px',
                        color: '#28a745'
                      }}>
                        ▶
                      </span>
                      <span>
                        作者推广方案：
                        <span style={{ 
                          color: '#28a745', 
                          marginLeft: '8px',
                          fontWeight: 'bold'
                        }}>
                          {referralPlans.author_plan.name}
                        </span>
                        {referralPlans.author_plan.is_custom && (
                          <span style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            background: '#ffc107',
                            color: '#333',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'normal'
                          }}>
                            专属方案
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '16px', 
                      color: '#666'
                    }}>
                      {referralPlans.author_plan.levels.map((l, idx) => (
                        <span key={l.level}>
                          <span style={{ fontWeight: '600', color: '#28a745' }}>
                            {l.percent_display}
                          </span>
                          {idx < referralPlans.author_plan!.levels.length - 1 && ' / '}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* 作者提成规则说明（绿色框，默认隐藏） */}
                  {authorPlanExpanded && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      background: 'white',
                      borderRadius: '6px',
                      borderLeft: '4px solid #28a745',
                      animation: 'fadeIn 0.3s ease-in'
                    }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#333',
                        marginBottom: '8px'
                      }}>
                        推广作者的提成规则：
                      </div>
                      {referralPlans.author_plan.levels.map((l) => (
                        <div key={l.level} style={{
                          fontSize: '13px',
                          color: '#666',
                          lineHeight: '1.8',
                          paddingLeft: '12px',
                          position: 'relative'
                        }}>
                          <span style={{
                            position: 'absolute',
                            left: '0',
                            color: '#28a745',
                            fontWeight: '600'
                          }}>
                            •
                          </span>
                          {l.level === 1 && '一级作者基础收入的 '}
                          {l.level === 2 && '二级作者基础收入的 '}
                          {l.level === 3 && '三级作者基础收入的 '}
                          {l.level === 4 && '四级作者基础收入的 '}
                          <span style={{ fontWeight: '600', color: '#28a745' }}>
                            {l.percent_display}
                          </span>
                          {' 为您的收入'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 链接生成区 */}
          <div className={styles.section}>
            <div className={styles.referralLinkCard}>
              {promotionLink ? (
                <>
                  <div className={styles.linkSection}>
                    <label>推广链接：</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={promotionLink}
                        readOnly
                        style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                      <button
                        onClick={() => copyToClipboard(promotionLink)}
                        className={styles.copyBtn}
                      >
                        复制链接
                      </button>
                    </div>
                  </div>

                  <div className={styles.linkSection}>
                    <label>推广码：</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={promotionCode}
                        readOnly
                        style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                      <button
                        onClick={() => copyToClipboard(promotionCode)}
                        className={styles.copyBtn}
                      >
                        复制
                      </button>
                    </div>
                  </div>

                  {qrCode && (
                    <div className={styles.qrcodeSection}>
                      <label>二维码：</label>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <img src={qrCode} alt="QR Code" style={{ width: '200px', height: '200px' }} />
                        <div>
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = qrCode;
                              link.download = `qrcode-${promotionCode}.png`;
                              link.click();
                            }}
                            className={styles.downloadBtn}
                          >
                            下载PNG
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p>正在加载推广链接...</p>
                </div>
              )}
            </div>
          </div>

          {/* 推广统计 */}
          {referralStats && (
            <div className={styles.section}>
              <h3>推广统计</h3>
              <div className={styles.summaryCards}>
                <div className={styles.summaryCard}>
                  <div className={styles.cardTitle}>累计推广注册用户</div>
                  <div className={styles.cardValue}>{referralStats.total_referred_users}</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.cardTitle}>累计推广付费用户</div>
                  <div className={styles.cardValue}>{referralStats.total_paying_users}</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.cardTitle}>累计推广总收入</div>
                  <div className={styles.cardValue}>{formatCurrency(referralStats.total_referral_income)}</div>
                </div>
              </div>

              {/* 下级列表 */}
              <div style={{ marginTop: '20px' }}>
                <h4>我的下级列表</h4>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>用户ID</th>
                      <th>用户名</th>
                      <th>类型</th>
                      <th>注册时间</th>
                      <th>累计消费</th>
                      <th>我已获得的推广收入</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subordinates.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                          暂无数据
                        </td>
                      </tr>
                    ) : (
                      subordinates.map(sub => (
                        <tr key={sub.user_id}>
                          <td>{sub.user_id}</td>
                          <td>{sub.pen_name || sub.username}</td>
                          <td>{sub.user_type}</td>
                          <td>{new Date(sub.register_time).toLocaleString('zh-CN')}</td>
                          <td>{formatCurrency(sub.total_consumption)}</td>
                          <td>{formatCurrency(sub.total_commission)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 结算管理 Tab */}
      {activeTab === 'settlement' && (
        <div className={styles.tabContent}>
          <div className={styles.subTabs}>
            <button
              className={`${styles.subTab} ${settlementSubTab === 'monthly' ? styles.active : ''}`}
              onClick={() => {
                setSettlementSubTab('monthly');
                loadMonthlyIncomes();
              }}
            >
              月度收入
            </button>
            <button
              className={`${styles.subTab} ${settlementSubTab === 'payout' ? styles.active : ''}`}
              onClick={() => {
                setSettlementSubTab('payout');
                loadPayouts();
              }}
            >
              支付记录
            </button>
          </div>

          {settlementSubTab === 'monthly' && (
            <div>
              {/* 本月汇总卡片 */}
              {(() => {
                // 获取当前月份
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;
                const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
                
                // 查找当前月份的收入记录
                const currentMonthIncome = monthlyIncomes.find((income: any) => {
                  const incomeMonth = new Date(income.month);
                  return incomeMonth.getFullYear() === currentYear && 
                         incomeMonth.getMonth() + 1 === currentMonth;
                });
                
                // 如果没有当前月份记录，显示0
                const displayIncome = currentMonthIncome || {
                  total_income_usd: 0,
                  paid_amount_usd: 0,
                  paid_amount_rmb: 0,
                  unpaid_amount: 0,
                  payout_currency: null,
                  payout_amount: null
                };
                
                // 格式化支付金额（根据币种）
                const formatPaidAmount = () => {
                  if (displayIncome.payout_status === 'paid' && displayIncome.payout_currency) {
                    if (displayIncome.payout_currency === 'CNY') {
                      return `¥${(displayIncome.paid_amount_rmb || 0).toFixed(2)}`;
                    } else {
                      return `$${(displayIncome.paid_amount_usd || 0).toFixed(2)}`;
                    }
                  }
                  return `$${(displayIncome.paid_amount_usd || 0).toFixed(2)}`;
                };
                
                return (
                  <div className={styles.summaryCards} style={{ marginBottom: '30px' }}>
                    <div className={styles.summaryCard}>
                      <div className={styles.cardTitle}>本月总收入</div>
                      <div className={styles.cardValue}>${(displayIncome.total_income_usd || 0).toFixed(2)}</div>
                    </div>
                    <div className={styles.summaryCard}>
                      <div className={styles.cardTitle}>本月已支付</div>
                      <div className={styles.cardValue} style={{ color: '#28a745' }}>
                        {formatPaidAmount()}
                      </div>
                    </div>
                    <div className={styles.summaryCard}>
                      <div className={styles.cardTitle}>本月未支付</div>
                      <div className={styles.cardValue} style={{ color: '#e74c3c' }}>
                        ${(displayIncome.unpaid_amount || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 月度收入表 */}
              <div className={styles.section}>
                <h3>所有月份收入汇总</h3>
                {monthlyIncomesLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>月份</th>
                        <th>总收入</th>
                        <th>已支付</th>
                        <th>未支付</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyIncomes.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                            暂无数据
                          </td>
                        </tr>
                      ) : (
                        monthlyIncomes.map((income: any) => {
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
                          
                          // 格式化已支付金额（根据币种）
                          const formatPaidAmount = () => {
                            if (income.payout_status === 'paid' && income.payout_currency) {
                              if (income.payout_currency === 'CNY') {
                                return `¥${(income.paid_amount_rmb || 0).toFixed(2)}`;
                              } else {
                                return `$${(income.paid_amount_usd || 0).toFixed(2)}`;
                              }
                            }
                            return `$${(income.paid_amount_usd || 0).toFixed(2)}`;
                          };
                          
                          return (
                            <tr key={income.month}>
                              <td>{formatMonth(income.month)}</td>
                              <td>${(income.total_income_usd || 0).toFixed(2)}</td>
                              <td>{formatPaidAmount()}</td>
                              <td>${(income.unpaid_amount || 0).toFixed(2)}</td>
                              <td>
                                <span className={`${styles.status} ${
                                  income.payout_status === 'paid' ? styles.completed :
                                  income.payout_status === 'partially_paid' ? styles.pending :
                                  styles.pending
                                }`}>
                                  {income.payout_status === 'paid' ? '已支付' :
                                   income.payout_status === 'partially_paid' ? '部分支付' : '未支付'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {settlementSubTab === 'payout' && (
            <div>
              <div className={styles.section}>
                <h3>支付记录</h3>
                {payoutsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
                ) : (
                  <>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>月份</th>
                          <th>当月收入(USD)</th>
                          <th>支付币种</th>
                          <th>支付金额</th>
                          <th>支付方式</th>
                          <th>支付时间</th>
                          <th>收款账号</th>
                          <th>交易单号</th>
                        </tr>
                      </thead>
                      <tbody>
                          {payouts.length === 0 ? (
                            <tr>
                              <td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>
                                暂无支付记录
                              </td>
                            </tr>
                        ) : (
                          payouts.map((payout: any) => {
                            // 格式化月份
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
                            
                            // 格式化支付方式
                            const formatMethod = (method: string) => {
                              const methodMap: { [key: string]: string } = {
                                'paypal': 'PayPal',
                                'alipay': '支付宝',
                                'wechat': '微信',
                                'bank_transfer': '银行转账',
                                'manual': '手动支付'
                              };
                              return methodMap[method?.toLowerCase()] || method || '未知';
                            };
                            
                            // 格式化收款账号
                            const formatAccount = () => {
                              if (payout.account_label && payout.account_data) {
                                return `${payout.account_label} (${payout.account_data})`;
                              } else if (payout.account_data) {
                                return payout.account_data;
                              } else if (payout.account_label) {
                                return payout.account_label;
                              }
                              return '-';
                            };
                            
                            return (
                              <tr key={payout.id}>
                                <td>{payout.month ? formatMonth(payout.month) : '-'}</td>
                                <td>${(payout.total_income_usd || 0).toFixed(2)}</td>
                                <td>{payout.payout_currency || 'USD'}</td>
                                <td>
                                  {payout.payout_currency === 'CNY' ? '¥' : '$'}
                                  {(payout.payout_amount || 0).toFixed(2)}
                                </td>
                                <td>{formatMethod(payout.method)}</td>
                                <td>{payout.paid_at ? new Date(payout.paid_at).toLocaleString('zh-CN') : (payout.requested_at ? new Date(payout.requested_at).toLocaleString('zh-CN') : '-')}</td>
                                <td>{formatAccount()}</td>
                                <td>{payout.provider_tx_id || '-'}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                    {payoutTotal > 20 && (
                      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        <button
                          onClick={() => setPayoutPage(p => Math.max(1, p - 1))}
                          disabled={payoutPage === 1}
                          style={{ padding: '8px 16px' }}
                        >
                          上一页
                        </button>
                        <span style={{ padding: '8px' }}>
                          第 {payoutPage} 页，共 {Math.ceil(payoutTotal / 20)} 页
                        </span>
                        <button
                          onClick={() => setPayoutPage(p => p + 1)}
                          disabled={payoutPage >= Math.ceil(payoutTotal / 20)}
                          style={{ padding: '8px 16px' }}
                        >
                          下一页
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 支付记录详情弹窗 */}
              {selectedPayoutDetail && (
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                  }}
                  onClick={() => setSelectedPayoutDetail(null)}
                >
                  <div
                    style={{
                      background: 'white',
                      padding: '24px',
                      borderRadius: '8px',
                      maxWidth: '600px',
                      width: '90%',
                      maxHeight: '80vh',
                      overflow: 'auto'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3>支付记录详情 - #{selectedPayoutDetail.payout.id}</h3>
                      <button onClick={() => setSelectedPayoutDetail(null)} style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                      <p><strong>月份:</strong> {selectedPayoutDetail.payout.month ? new Date(selectedPayoutDetail.payout.month).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' }) : '-'}</p>
                      <p><strong>记账金额(USD):</strong> {formatCurrency(String(selectedPayoutDetail.payout.base_amount_usd || 0))}</p>
                      <p><strong>实付金额:</strong> {selectedPayoutDetail.payout.payout_currency === 'USD' ? '$' : '¥'}{parseFloat(selectedPayoutDetail.payout.payout_amount || 0).toFixed(2)} {selectedPayoutDetail.payout.payout_currency || 'USD'}</p>
                      <p><strong>汇率:</strong> {parseFloat(selectedPayoutDetail.payout.fx_rate || 1.0).toFixed(4)}</p>
                      <p><strong>状态:</strong> {selectedPayoutDetail.payout.status}</p>
                      <p><strong>收款方式:</strong> {selectedPayoutDetail.payout.method}</p>
                      <p><strong>申请时间:</strong> {new Date(selectedPayoutDetail.payout.requested_at).toLocaleString('zh-CN')}</p>
                      {selectedPayoutDetail.payout.paid_at && (
                        <p><strong>支付时间:</strong> {new Date(selectedPayoutDetail.payout.paid_at).toLocaleString('zh-CN')}</p>
                      )}
                      {selectedPayoutDetail.payout.note && (
                        <p><strong>备注:</strong> {selectedPayoutDetail.payout.note}</p>
                      )}
                    </div>
                    {selectedPayoutDetail.gateway_transaction && (
                      <div style={{ marginBottom: '15px', marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                        <h4>网关交易信息:</h4>
                        <p><strong>支付网关:</strong> {selectedPayoutDetail.gateway_transaction.provider}</p>
                        <p><strong>第三方交易号:</strong> {selectedPayoutDetail.gateway_transaction.provider_tx_id || '-'}</p>
                        <p><strong>批次号:</strong> {selectedPayoutDetail.gateway_transaction.provider_batch_id || '-'}</p>
                        <p><strong>状态:</strong> {selectedPayoutDetail.gateway_transaction.status}</p>
                        {selectedPayoutDetail.gateway_transaction.base_amount_usd && (
                          <>
                            <p><strong>记账金额(USD):</strong> {formatCurrency(String(selectedPayoutDetail.gateway_transaction.base_amount_usd))}</p>
                            <p><strong>实付金额:</strong> {selectedPayoutDetail.gateway_transaction.payout_currency === 'USD' ? '$' : '¥'}{parseFloat(selectedPayoutDetail.gateway_transaction.payout_amount || 0).toFixed(2)} {selectedPayoutDetail.gateway_transaction.payout_currency || 'USD'}</p>
                            <p><strong>汇率:</strong> {parseFloat(selectedPayoutDetail.gateway_transaction.fx_rate || 1.0).toFixed(4)}</p>
                          </>
                        )}
                        <p><strong>创建时间:</strong> {selectedPayoutDetail.gateway_transaction.created_at ? new Date(selectedPayoutDetail.gateway_transaction.created_at).toLocaleString('zh-CN') : '-'}</p>
                      </div>
                    )}
                    {selectedPayoutDetail.gateway_transaction && (
                      <div>
                        <h4>支付流水:</h4>
                        <p><strong>提供商:</strong> {selectedPayoutDetail.gateway_transaction.provider}</p>
                        <p><strong>交易号:</strong> {selectedPayoutDetail.gateway_transaction.provider_tx_id}</p>
                        <p><strong>状态:</strong> {selectedPayoutDetail.gateway_transaction.status}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 收款账户 Tab */}
      {activeTab === 'account' && (
        <div className={styles.tabContent}>
          <>
            {/* 提示条 */}
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f7ff', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
              <p style={{ margin: 0, color: '#0066cc' }}>
                <strong>提示:</strong> 请提供准确的收款信息，否则无法收到稿费。建议设置一个默认收款账户。
              </p>
            </div>

            {/* 账户列表区域 */}
            <div className={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>我的收款账户</h3>
              <button
                onClick={openAddAccountModal}
                style={{
                  padding: '8px 16px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                + 新增账户
              </button>
            </div>

            {accountsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
            ) : payoutAccounts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <p style={{ fontSize: '16px', marginBottom: '10px' }}>还没有添加收款账户</p>
                <p style={{ fontSize: '14px' }}>点击右上角【新增账户】开始添加</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {payoutAccounts.map((account: any) => (
                  <div
                    key={account.id}
                    style={{
                      padding: '20px',
                      background: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      border: account.is_default ? '2px solid #007bff' : '1px solid #e0e0e0',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* 标题行 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                          {account.account_label}
                        </h4>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '4px 10px',
                            background: '#f0f0f0',
                            color: '#666',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            {getMethodName(account.method)}
                          </span>
                          {account.is_default && (
                            <span style={{
                              padding: '4px 10px',
                              background: '#007bff',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              默认
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 内容区域 */}
                    <div style={{ flex: 1, marginBottom: '15px', fontSize: '14px', color: '#666' }}>
                      {(account.method === 'PayPal' || account.method === 'paypal') && (
                        <div>
                          <p style={{ margin: '4px 0' }}><strong>PayPal 邮箱:</strong> {account.account_data?.email || '-'}</p>
                        </div>
                      )}
                      {(account.method === 'Alipay' || account.method === 'alipay') && (
                        <div>
                          {account.account_data?.name && (
                            <p style={{ margin: '4px 0' }}><strong>姓名:</strong> {account.account_data.name}</p>
                          )}
                          <p style={{ margin: '4px 0' }}><strong>账号:</strong> {account.account_data?.account || '-'}</p>
                        </div>
                      )}
                      {(account.method === 'WeChat' || account.method === 'wechat') && (
                        <div>
                          {account.account_data?.name && (
                            <p style={{ margin: '4px 0' }}><strong>姓名:</strong> {account.account_data.name}</p>
                          )}
                          {account.account_data?.wechat_id && (
                            <p style={{ margin: '4px 0' }}><strong>微信号:</strong> {account.account_data.wechat_id}</p>
                          )}
                          {account.account_data?.qrcode_url && (
                            <div style={{ marginTop: '8px' }}>
                              <img
                                src={account.account_data.qrcode_url}
                                alt="收款码"
                                style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '4px' }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {(account.method === 'Bank' || account.method === 'bank_transfer' || account.method === 'bank') && (
                        <div>
                          <p style={{ margin: '4px 0' }}><strong>开户行:</strong> {account.account_data?.bank_name || '-'}</p>
                          <p style={{ margin: '4px 0' }}><strong>户名:</strong> {account.account_data?.account_name || '-'}</p>
                          <p style={{ margin: '4px 0' }}><strong>卡号:</strong> {formatCardNumber(account.account_data?.card_number || '')}</p>
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '15px', borderTop: '1px solid #f0f0f0' }}>
                      {!account.is_default && (
                        <button
                          onClick={() => setDefaultAccount(account.id)}
                          style={{
                            padding: '6px 12px',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          设为默认
                        </button>
                      )}
                      <button
                        onClick={() => openEditAccountModal(account)}
                        style={{
                          padding: '6px 12px',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('确定删除该收款账户？此操作不可恢复。')) {
                            deletePayoutAccount(account.id);
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>

            {/* 新增/编辑账户Modal */}
            {showAccountModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}
              onClick={() => {
                setShowAccountModal(false);
                setEditingAccount(null);
                setAccountForm({
                  method: 'PayPal',
                  account_label: '',
                  account_data: {},
                  is_default: false
                });
              }}
            >
              <div
                style={{
                  background: 'white',
                  padding: '24px',
                  borderRadius: '8px',
                  maxWidth: '600px',
                  width: '90%',
                  maxHeight: '90vh',
                  overflow: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0 }}>{editingAccount ? '编辑收款账户' : '新增收款账户'}</h3>
                  <button
                    onClick={() => {
                      setShowAccountModal(false);
                      setEditingAccount(null);
                      setAccountForm({
                        method: 'PayPal',
                        account_label: '',
                        account_data: {},
                        is_default: false
                      });
                    }}
                    style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
                  >
                    ×
                  </button>
                </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>支付方式:</label>
                      <select
                        value={accountForm.method}
                        onChange={(e) => setAccountForm({ ...accountForm, method: e.target.value, account_data: {} })}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      >
                        <option value="PayPal">PayPal</option>
                        <option value="Alipay">支付宝</option>
                        <option value="WeChat">微信支付</option>
                        <option value="Bank">银行卡</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>账户标签:</label>
                      <input
                        type="text"
                        value={accountForm.account_label}
                        onChange={(e) => setAccountForm({ ...accountForm, account_label: e.target.value })}
                        placeholder="例如：我的PayPal账户"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      />
                    </div>

                    {/* 根据支付方式显示不同的输入字段 */}
                    {accountForm.method === 'PayPal' && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>PayPal邮箱:</label>
                        <input
                          type="email"
                          value={accountForm.account_data.email || ''}
                          onChange={(e) => setAccountForm({
                            ...accountForm,
                            account_data: { ...accountForm.account_data, email: e.target.value }
                          })}
                          placeholder="your@email.com"
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                    )}

                    {accountForm.method === 'Alipay' && (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>支付宝账号:</label>
                          <input
                            type="text"
                            value={accountForm.account_data.account || ''}
                            onChange={(e) => setAccountForm({
                              ...accountForm,
                              account_data: { ...accountForm.account_data, account: e.target.value }
                            })}
                            placeholder="手机号或邮箱"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>真实姓名 (选填):</label>
                          <input
                            type="text"
                            value={accountForm.account_data.name || ''}
                            onChange={(e) => setAccountForm({
                              ...accountForm,
                              account_data: { ...accountForm.account_data, name: e.target.value }
                            })}
                            placeholder="真实姓名"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                      </>
                    )}

                    {accountForm.method === 'WeChat' && (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>微信号 (必填):</label>
                          <input
                            type="text"
                            value={accountForm.account_data.wechat_id || ''}
                            onChange={(e) => setAccountForm({
                              ...accountForm,
                              account_data: { ...accountForm.account_data, wechat_id: e.target.value }
                            })}
                            placeholder="微信号"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>真实姓名 (选填):</label>
                          <input
                            type="text"
                            value={accountForm.account_data.name || ''}
                            onChange={(e) => setAccountForm({
                              ...accountForm,
                              account_data: { ...accountForm.account_data, name: e.target.value }
                            })}
                            placeholder="真实姓名"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>收款码图片URL (选填):</label>
                          <input
                            type="text"
                            value={accountForm.account_data.qrcode_url || ''}
                            onChange={(e) => setAccountForm({
                              ...accountForm,
                              account_data: { ...accountForm.account_data, qrcode_url: e.target.value }
                            })}
                            placeholder="上传收款码后填入图片URL"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                      </>
                    )}

                    {accountForm.method === 'Bank' && (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>开户行:</label>
                          <input
                            type="text"
                            value={accountForm.account_data.bank_name || ''}
                            onChange={(e) => setAccountForm({
                              ...accountForm,
                              account_data: { ...accountForm.account_data, bank_name: e.target.value }
                            })}
                            placeholder="例如：中国工商银行"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>账户名:</label>
                          <input
                            type="text"
                            value={accountForm.account_data.account_name || ''}
                            onChange={(e) => setAccountForm({
                              ...accountForm,
                              account_data: { ...accountForm.account_data, account_name: e.target.value }
                            })}
                            placeholder="账户持有人姓名"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>卡号:</label>
                          <input
                            type="text"
                            value={accountForm.account_data.card_number || ''}
                            onChange={(e) => setAccountForm({
                              ...accountForm,
                              account_data: { ...accountForm.account_data, card_number: e.target.value }
                            })}
                            placeholder="银行卡号"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={accountForm.is_default}
                          onChange={(e) => setAccountForm({ ...accountForm, is_default: e.target.checked })}
                        />
                        <span>设为默认收款账户</span>
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={savePayoutAccount}
                        style={{
                          padding: '10px 20px',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {editingAccount ? '更新账户' : '保存账户'}
                      </button>
                      <button
                        onClick={() => {
                          setShowAccountModal(false);
                          setEditingAccount(null);
                          setAccountForm({
                            method: 'PayPal',
                            account_label: '',
                            account_data: {},
                            is_default: false
                          });
                        }}
                        style={{
                          padding: '10px 20px',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        </div>
      )}
    </div>
  );
};

export default IncomeManagement;


import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../../../config';
import styles from './PaymentStats.module.css';

interface PaymentStatsProps {
  onError?: (error: string) => void;
}

const PaymentStats: React.FC<PaymentStatsProps> = ({ onError }) => {
  // 费用统计相关状态
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [karmaPurchases, setKarmaPurchases] = useState<any[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [karmaPurchasesLoading, setKarmaPurchasesLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
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

  // 加载费用汇总
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
      
      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(`${base}/admin/payments/summary?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPaymentSummary(data.data);
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
      
      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(`${base}/admin/subscriptions?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSubscriptions(data.data.items);
        setSubscriptionsTotal(data.data.total);
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
      
      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(`${base}/admin/karma-purchases?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setKarmaPurchases(data.data.items);
        setKarmaPurchasesTotal(data.data.total);
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

  // 当Tab切换时加载对应数据
  useEffect(() => {
    if (activePaymentTab === 'subscriptions') {
      loadSubscriptions();
    } else {
      loadKarmaPurchases();
    }
  }, [activePaymentTab, subscriptionsPage, karmaPurchasesPage]);

  // 初始化时设置默认日期范围（当前自然月）
  useEffect(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setPaymentFilters(prev => ({
      ...prev,
      start_date: prev.start_date || monthStart,
      end_date: prev.end_date || monthEnd
    }));
  }, []);

  return (
    <>
      <div className={styles.tabContent}>
        <div className={styles.tabHeader}>
          <h2>费用统计</h2>
          <div className={styles.dateFilter}>
            <input
              type="date"
              value={paymentFilters.start_date}
              onChange={(e) => setPaymentFilters({ ...paymentFilters, start_date: e.target.value })}
              placeholder="开始日期"
            />
            <span>至</span>
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
              <option value="">全部状态</option>
              <option value="completed">已完成</option>
              <option value="pending">待处理</option>
              <option value="failed">失败</option>
              <option value="refunded">已退款</option>
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
          <div className={styles.loading}>加载中...</div>
        ) : paymentSummary ? (
          <>
            {/* 汇总统计卡片 */}
            <div className={styles.statsCards}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总收入</div>
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
                <div className={styles.statLabel}>付费用户数</div>
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
                  <div className={styles.loading}>加载中...</div>
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
                          <th>订阅时长(月)</th>
                          <th>月价格</th>
                          <th>实际支付金额(USD)</th>
                          <th>支付方式</th>
                          <th>状态</th>
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
                                  {item.payment_status === 'completed' ? '已完成' :
                                   item.payment_status === 'pending' ? '待处理' :
                                   item.payment_status === 'failed' ? '失败' :
                                   item.payment_status === 'refunded' ? '已退款' : item.payment_status}
                                </span>
                              </td>
                              <td>{item.auto_renew ? '是' : '否'}</td>
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
                        上一页
                      </button>
                      <span>第 {subscriptionsPage} 页，共 {Math.ceil(subscriptionsTotal / 20)} 页</span>
                      <button
                        onClick={() => {
                          if (subscriptionsPage < Math.ceil(subscriptionsTotal / 20)) {
                            setSubscriptionsPage(subscriptionsPage + 1);
                            setTimeout(() => loadSubscriptions(), 100);
                          }
                        }}
                        disabled={subscriptionsPage >= Math.ceil(subscriptionsTotal / 20)}
                      >
                        下一页
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
                  <div className={styles.loading}>加载中...</div>
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
                          <th>状态</th>
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
                                  {item.status === 'completed' ? '已完成' :
                                   item.status === 'pending' ? '待处理' :
                                   item.status === 'failed' ? '失败' : item.status}
                                </span>
                              </td>
                              <td>{item.balance_before} → {item.balance_after}</td>
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
                        上一页
                      </button>
                      <span>第 {karmaPurchasesPage} 页，共 {Math.ceil(karmaPurchasesTotal / 20)} 页</span>
                      <button
                        onClick={() => {
                          if (karmaPurchasesPage < Math.ceil(karmaPurchasesTotal / 20)) {
                            setKarmaPurchasesPage(karmaPurchasesPage + 1);
                            setTimeout(() => loadKarmaPurchases(), 100);
                          }
                        }}
                        disabled={karmaPurchasesPage >= Math.ceil(karmaPurchasesTotal / 20)}
                      >
                        下一页
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>请设置筛选条件并查询</div>
        )}
      </div>

      {/* 订阅详情侧边栏 */}
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
            <p><strong>用户名:</strong> {selectedSubscription.user_name}</p>
            <p><strong>小说ID:</strong> {selectedSubscription.novel_id}</p>
            <p><strong>小说名:</strong> {selectedSubscription.novel_title}</p>
            <p><strong>订阅等级:</strong> {selectedSubscription.tier_name} (Level {selectedSubscription.tier_level})</p>
            <p><strong>订阅类型:</strong> {selectedSubscription.subscription_type}</p>
            <p><strong>订阅时长:</strong> {selectedSubscription.subscription_duration_months} 月</p>
            <p><strong>月价格:</strong> ${selectedSubscription.monthly_price.toFixed(2)}</p>
            <p><strong>支付金额:</strong> ${selectedSubscription.payment_amount.toFixed(2)}</p>
            <p><strong>货币:</strong> {selectedSubscription.currency}</p>
            {selectedSubscription.local_amount && (
              <p><strong>本地金额:</strong> {selectedSubscription.local_amount.toFixed(2)} {selectedSubscription.local_currency}</p>
            )}
            {selectedSubscription.exchange_rate && (
              <p><strong>汇率:</strong> {selectedSubscription.exchange_rate}</p>
            )}
            <p><strong>支付方式:</strong> {selectedSubscription.payment_method}</p>
            <p><strong>支付状态:</strong> {selectedSubscription.payment_status}</p>
            <p><strong>自动续费:</strong> {selectedSubscription.auto_renew ? '是' : '否'}</p>
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
              <p><strong>卡品牌:</strong> {selectedSubscription.card_brand} ****{selectedSubscription.card_last4}</p>
            )}
            {selectedSubscription.discount_amount > 0 && (
              <p><strong>折扣金额:</strong> ${selectedSubscription.discount_amount.toFixed(2)} ({selectedSubscription.discount_code})</p>
            )}
            {selectedSubscription.tax_amount > 0 && (
              <p><strong>税费:</strong> ${selectedSubscription.tax_amount.toFixed(2)}</p>
            )}
            {selectedSubscription.fee_amount > 0 && (
              <p><strong>手续费:</strong> ${selectedSubscription.fee_amount.toFixed(2)}</p>
            )}
            {selectedSubscription.refund_amount > 0 && (
              <p><strong>退款金额:</strong> ${selectedSubscription.refund_amount.toFixed(2)} ({selectedSubscription.refund_reason})</p>
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

      {/* Karma购买详情侧边栏 */}
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
            <p><strong>用户名:</strong> {selectedKarmaPurchase.user_name}</p>
            <p><strong>交易类型:</strong> {selectedKarmaPurchase.transaction_type}</p>
            <p><strong>描述:</strong> {selectedKarmaPurchase.description || '无'}</p>
            <p><strong>原因:</strong> {selectedKarmaPurchase.reason || '无'}</p>
            <p><strong>Karma类型:</strong> {selectedKarmaPurchase.karma_type}</p>
            <p><strong>Karma数量:</strong> {selectedKarmaPurchase.karma_amount}</p>
            <p><strong>支付金额:</strong> ${selectedKarmaPurchase.amount_paid.toFixed(2)}</p>
            <p><strong>货币:</strong> {selectedKarmaPurchase.currency}</p>
            <p><strong>支付方式:</strong> {selectedKarmaPurchase.payment_method || '未知'}</p>
            <p><strong>状态:</strong> {selectedKarmaPurchase.status}</p>
            <p><strong>余额变化:</strong> {selectedKarmaPurchase.balance_before} → {selectedKarmaPurchase.balance_after}</p>
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
  );
};

export default PaymentStats;


/**
 * 编辑结算管理Tab组件
 * 显示编辑/管理员的月度结算和支付记录
 */
import React, { useState, useEffect, useCallback } from 'react';
import ApiService from '../../services/ApiService';
import AdminEditorPayoutDetailModal from './AdminEditorPayoutDetailModal';
import styles from './AdminEditorIncome.module.css';

interface AdminEditorSettlementTabProps {
  onError?: (error: string) => void;
}

interface MonthlySettlement {
  month: string;
  novel_count: number;
  record_count: number;
  total_income_usd: number;
  paid_amount_usd: number;
  unpaid_amount: number;
  payout_status: string;
  payout_currency?: string;
  payout_amount?: number;
}

interface PayoutRecord {
  id: number;
  month: string;
  total_income_usd: number;
  payout_currency: string;
  payout_amount: number;
  method: string;
  account_label: string;
  account_data: string;
  provider_tx_id: string | null;
  status: string;
  requested_at: string;
  paid_at: string | null;
}

const AdminEditorSettlementTab: React.FC<AdminEditorSettlementTabProps> = ({ onError }) => {
  const [subTab, setSubTab] = useState<'monthly' | 'payout'>('monthly');
  
  // 月度结算数据
  const [monthlySettlements, setMonthlySettlements] = useState<MonthlySettlement[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  
  // 支付记录数据
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutTotal, setPayoutTotal] = useState(0);
  const pageSize = 20;

  // 详情弹窗
  const [selectedPayoutDetail, setSelectedPayoutDetail] = useState<any>(null);

  // 格式化金额
  const formatCurrency = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '$0.00';
    return `$${num.toFixed(2)}`;
  };

  // 格式化月份
  const formatMonth = (monthStr: string): string => {
    try {
      const date = new Date(monthStr);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return `${year}年${month}月`;
    } catch (e) {
      return monthStr;
    }
  };

  // 获取状态标签样式
  const getStatusClass = (status: string): string => {
    if (status === 'paid') return styles.status + ' ' + styles.completed;
    if (status === 'partially_paid') return styles.status + ' ' + styles.pending;
    if (status === 'processing') return styles.status + ' ' + styles.pending;
    if (status === 'failed') return styles.status + ' ' + styles.error;
    return styles.status + ' ' + styles.pending;
  };

  // 获取状态文本
  const getStatusText = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'paid': '已支付',
      'partially_paid': '部分支付',
      'unpaid': '未支付',
      'pending': '待处理',
      'processing': '处理中',
      'failed': '失败',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  };

  // 格式化支付方式
  const formatMethod = (method: string): string => {
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
  const formatAccount = (accountLabel: string, accountData: string): string => {
    if (accountLabel && accountData) {
      return `${accountLabel} (${accountData})`;
    } else if (accountData) {
      return accountData;
    } else if (accountLabel) {
      return accountLabel;
    }
    return '-';
  };

  // 加载月度结算列表
  const loadMonthlySettlements = useCallback(async () => {
    try {
      setMonthlyLoading(true);
      const response = await ApiService.get('/admin/editor-settlement/monthly?limit=12');
      if (response && response.success) {
        setMonthlySettlements(response.data || []);
      }
    } catch (error: any) {
      console.error('加载月度结算列表失败:', error);
      if (onError) {
        onError(error.message || '加载月度结算列表失败');
      }
    } finally {
      setMonthlyLoading(false);
    }
  }, [onError]);

  // 加载支付记录列表
  const loadPayouts = useCallback(async () => {
    try {
      setPayoutsLoading(true);
      const response = await ApiService.get(`/admin/editor-payout/list?page=${payoutPage}&pageSize=${pageSize}`);
      if (response && response.success) {
        setPayouts(response.data || []);
        setPayoutTotal(response.pagination?.total || 0);
      }
    } catch (error: any) {
      console.error('加载支付记录失败:', error);
      if (onError) {
        onError(error.message || '加载支付记录失败');
      }
    } finally {
      setPayoutsLoading(false);
    }
  }, [payoutPage, onError]);

  // 加载支付详情
  const loadPayoutDetail = async (payoutId: number) => {
    try {
      const response = await ApiService.get(`/admin/editor-payout/detail/${payoutId}`);
      if (response && response.success) {
        setSelectedPayoutDetail(response.data);
      }
    } catch (error: any) {
      console.error('加载支付详情失败:', error);
      if (onError) {
        onError(error.message || '加载支付详情失败');
      }
    }
  };

  // 初始化加载
  useEffect(() => {
    if (subTab === 'monthly') {
      loadMonthlySettlements();
    } else if (subTab === 'payout') {
      loadPayouts();
    }
  }, [subTab, loadMonthlySettlements, loadPayouts]);

  // 计算累计统计
  const calculateTotals = () => {
    const totals = monthlySettlements.reduce((acc, item) => {
      acc.totalIncome += parseFloat(String(item.total_income_usd || 0));
      acc.totalPaid += parseFloat(String(item.paid_amount_usd || 0));
      acc.totalUnpaid += parseFloat(String(item.unpaid_amount || 0));
      return acc;
    }, { totalIncome: 0, totalPaid: 0, totalUnpaid: 0 });
    return totals;
  };

  const totals = calculateTotals();

  return (
    <div className={styles.tabContent}>
      {/* 二级Tab */}
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTab} ${subTab === 'monthly' ? styles.active : ''}`}
          onClick={() => {
            setSubTab('monthly');
            loadMonthlySettlements();
          }}
        >
          月度结算
        </button>
        <button
          className={`${styles.subTab} ${subTab === 'payout' ? styles.active : ''}`}
          onClick={() => {
            setSubTab('payout');
            loadPayouts();
          }}
        >
          支付记录
        </button>
      </div>

      {subTab === 'monthly' && (
        <div>
          {/* 累计统计卡片 */}
          <div className={styles.summaryCards} style={{ marginBottom: '30px' }}>
            <div className={styles.summaryCard}>
              <div className={styles.cardTitle}>累计编辑收入</div>
              <div className={styles.cardValue}>{formatCurrency(totals.totalIncome)}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.cardTitle}>累计已支付</div>
              <div className={styles.cardValue} style={{ color: '#28a745' }}>
                {formatCurrency(totals.totalPaid)}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.cardTitle}>累计未支付</div>
              <div className={styles.cardValue} style={{ color: '#e74c3c' }}>
                {formatCurrency(totals.totalUnpaid)}
              </div>
            </div>
          </div>

          {/* 月度结算表格 */}
          <div className={styles.section}>
            <h3>所有月份结算汇总</h3>
            {monthlyLoading ? (
              <div className={styles.loading}>加载中...</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>月份</th>
                    <th>参与作品数</th>
                    <th>收入记录条数</th>
                    <th>总收入(USD)</th>
                    <th>已支付</th>
                    <th>未支付(USD)</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySettlements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyCell}>暂无数据</td>
                    </tr>
                  ) : (
                    monthlySettlements.map((settlement) => {
                      const formatPaidAmount = () => {
                        if (settlement.payout_status === 'paid' && settlement.payout_currency) {
                          if (settlement.payout_currency === 'CNY') {
                            return `¥${(settlement.payout_amount || 0).toFixed(2)}`;
                          } else {
                            return `$${(settlement.paid_amount_usd || 0).toFixed(2)}`;
                          }
                        }
                        return `$${(settlement.paid_amount_usd || 0).toFixed(2)}`;
                      };

                      return (
                        <tr key={settlement.month}>
                          <td>{formatMonth(settlement.month)}</td>
                          <td>{settlement.novel_count}</td>
                          <td>{settlement.record_count}</td>
                          <td>{formatCurrency(settlement.total_income_usd)}</td>
                          <td>{formatPaidAmount()}</td>
                          <td>{formatCurrency(settlement.unpaid_amount)}</td>
                          <td>
                            <span className={getStatusClass(settlement.payout_status)}>
                              {getStatusText(settlement.payout_status)}
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

      {subTab === 'payout' && (
        <div>
          <div className={styles.section}>
            <h3>支付记录</h3>
            {payoutsLoading ? (
              <div className={styles.loading}>加载中...</div>
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
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.length === 0 ? (
                      <tr>
                        <td colSpan={10} className={styles.emptyCell}>暂无支付记录</td>
                      </tr>
                    ) : (
                      payouts.map((payout) => (
                        <tr key={payout.id}>
                          <td>{payout.month ? formatMonth(payout.month) : '-'}</td>
                          <td>{formatCurrency(payout.total_income_usd)}</td>
                          <td>{payout.payout_currency || 'USD'}</td>
                          <td>
                            {payout.payout_currency === 'CNY' ? '¥' : '$'}
                            {(payout.payout_amount || 0).toFixed(2)}
                          </td>
                          <td>{formatMethod(payout.method)}</td>
                          <td>
                            {payout.paid_at 
                              ? new Date(payout.paid_at).toLocaleString('zh-CN')
                              : payout.requested_at 
                              ? new Date(payout.requested_at).toLocaleString('zh-CN')
                              : '-'}
                          </td>
                          <td>{formatAccount(payout.account_label, payout.account_data)}</td>
                          <td>{payout.provider_tx_id || '-'}</td>
                          <td>
                            <span className={getStatusClass(payout.status)}>
                              {getStatusText(payout.status)}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => loadPayoutDetail(payout.id)}
                              style={{
                                padding: '4px 8px',
                                background: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              查看详情
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {payoutTotal > pageSize && (
                  <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button
                      onClick={() => setPayoutPage(p => Math.max(1, p - 1))}
                      disabled={payoutPage === 1}
                      style={{ padding: '8px 16px' }}
                    >
                      上一页
                    </button>
                    <span style={{ padding: '8px' }}>
                      第 {payoutPage} 页，共 {Math.ceil(payoutTotal / pageSize)} 页
                    </span>
                    <button
                      onClick={() => setPayoutPage(p => p + 1)}
                      disabled={payoutPage >= Math.ceil(payoutTotal / pageSize)}
                      style={{ padding: '8px 16px' }}
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 支付详情弹窗 */}
      {selectedPayoutDetail && (
        <AdminEditorPayoutDetailModal
          detail={selectedPayoutDetail}
          onClose={() => setSelectedPayoutDetail(null)}
        />
      )}
    </div>
  );
};

export default AdminEditorSettlementTab;


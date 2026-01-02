import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../../../config';
import styles from './ReaderIncome.module.css';

interface ReaderIncomeProps {
  onError?: (error: string) => void;
}

const ReaderIncome: React.FC<ReaderIncomeProps> = ({ onError }) => {
  const [readerIncomeMonth, setReaderIncomeMonth] = useState('');
  const [readerIncomeData, setReaderIncomeData] = useState<any>(null);
  const [readerIncomeLoading, setReaderIncomeLoading] = useState(false);

  // 加载读者收入统计
  const loadReaderIncomeStats = async () => {
    if (!readerIncomeMonth) return;
    
    try {
      setReaderIncomeLoading(true);
      const token = localStorage.getItem('adminToken');
      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(`${base}/admin/reader-income-stats?month=${readerIncomeMonth}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setReaderIncomeData(data.data);
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
      setReaderIncomeLoading(false);
    }
  };

  // 初始化时设置当前月份
  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setReaderIncomeMonth(month);
  }, []);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>读者收入统计</h2>
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
        <div className={styles.loading}>加载中...</div>
      ) : readerIncomeData ? (
        <>
          {/* 读者推广收入汇总 */}
          <div className={styles.paymentTable}>
            <h3>读者推广收入汇总</h3>
            <table>
              <thead>
                <tr>
                  <th>推广人</th>
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
                      <td>{item.referralCount}人</td>
                      <td style={{ fontSize: '12px', lineHeight: '1.5', wordBreak: 'break-word' }}>
                        {item.calculationMethod || '暂无数据'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 读者消费汇总 */}
          <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
            <h3>读者消费汇总</h3>
            <table>
              <thead>
                <tr>
                  <th>读者</th>
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
                      <td>{item.spendingCount}次</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 读者推广佣金明细 */}
          <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
            <h3>读者推广佣金明细</h3>
            <table>
              <thead>
                <tr>
                  <th>推广人</th>
                  <th>被推广读者</th>
                  <th>小说</th>
                  <th>层级</th>
                  <th>读者消费（美元）</th>
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
                      <td>第{item.level}层</td>
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
  );
};

export default ReaderIncome;


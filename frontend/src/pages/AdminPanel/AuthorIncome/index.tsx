import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../../../config';
import styles from './AuthorIncome.module.css';

interface AuthorIncomeProps {
  onError?: (error: string) => void;
}

const AuthorIncome: React.FC<AuthorIncomeProps> = ({ onError }) => {
  const [authorIncomeMonth, setAuthorIncomeMonth] = useState('');
  const [authorIncomeData, setAuthorIncomeData] = useState<any>(null);
  const [authorIncomeLoading, setAuthorIncomeLoading] = useState(false);

  // 加载作者收入统计
  const loadAuthorIncomeStats = async () => {
    if (!authorIncomeMonth) return;
    
    try {
      setAuthorIncomeLoading(true);
      const token = localStorage.getItem('adminToken');
      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(`${base}/admin/author-income-stats?month=${authorIncomeMonth}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAuthorIncomeData(data.data);
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
      setAuthorIncomeLoading(false);
    }
  };

  // 初始化时设置当前月份
  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setAuthorIncomeMonth(month);
  }, []);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>作者收入统计</h2>
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
        <div className={styles.loading}>加载中...</div>
      ) : authorIncomeData ? (
        <>
          {/* 作者收入汇总表格 */}
          <div className={styles.paymentTable}>
            <h3>作者收入汇总</h3>
            <table>
              <thead>
                <tr>
                  <th>作者</th>
                  <th>基础收入（美元）</th>
                  <th>推广收入（美元）</th>
                  <th>总收入（美元）</th>
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
                  <th>作者</th>
                  <th>小说</th>
                  <th>读者消费（美元）</th>
                  <th>作者收入（美元）</th>
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

          {/* 作者推广佣金明细 */}
          <div className={styles.paymentTable} style={{ marginTop: '24px' }}>
            <h3>作者推广佣金明细</h3>
            <table>
              <thead>
                <tr>
                  <th>推广人</th>
                  <th>被推广作者</th>
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

export default AuthorIncome;


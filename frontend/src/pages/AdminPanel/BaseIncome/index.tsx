import React, { useState, useEffect } from 'react';
import styles from './BaseIncome.module.css';

interface BaseIncomeProps {
  onError?: (error: string) => void;
}

const BaseIncome: React.FC<BaseIncomeProps> = ({ onError }) => {
  const [baseIncomeMonth, setBaseIncomeMonth] = useState('');
  const [baseIncomeData, setBaseIncomeData] = useState<any>(null);
  const [baseIncomeLoading, setBaseIncomeLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

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
      setBaseIncomeLoading(false);
    }
  };
  
  // 生成基础收入数据
  const generateBaseIncomeData = async () => {
    if (!baseIncomeMonth) {
      if (onError) {
        onError('请选择月份');
      }
      return;
    }
    
    if (!window.confirm(`确定要生成 ${baseIncomeMonth} 月的基础收入数据吗？`)) {
      return;
    }
    
    try {
      setGenerating(true);
      if (onError) {
        onError('');
      }
      const token = localStorage.getItem('adminToken');
      const response = await const apiBase = typeof window !== 'undefined' && window.location?.origin 
      ? `${window.location.origin}/api` 
      : (process.env.REACT_APP_API_URL || '');
    if (!apiBase) {
      throw new Error('API base url is not configured');
    }
    fetch('${apiBase}/admin/generate-reader-spending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ month: baseIncomeMonth })
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (onError) {
          onError('');
        }
        alert(data.message || '生成成功');
        // 重新加载数据
        loadBaseIncomeData();
      } else {
        if (onError) {
          onError(data.message || '生成失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '生成失败');
      }
    } finally {
      setGenerating(false);
    }
  };
  
  // 删除基础收入数据
  const deleteBaseIncomeData = async () => {
    if (!baseIncomeMonth) {
      if (onError) {
        onError('请选择月份');
      }
      return;
    }
    
    if (!window.confirm(`确定要删除 ${baseIncomeMonth} 月的基础收入数据吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      setBaseIncomeLoading(true);
      if (onError) {
        onError('');
      }
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/reader-spending?month=${baseIncomeMonth}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (onError) {
          onError('');
        }
        alert(data.message || '删除成功');
        setBaseIncomeData(null);
      } else {
        if (onError) {
          onError(data.message || '删除失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '删除失败');
      }
    } finally {
      setBaseIncomeLoading(false);
    }
  };

  // 初始化时设置当前月份
  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setBaseIncomeMonth(month);
  }, []);

  // 当月份改变时自动加载数据
  useEffect(() => {
    if (baseIncomeMonth) {
      loadBaseIncomeData();
    }
  }, [baseIncomeMonth]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>基础收入统计</h2>
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
            {generating ? '生成中...' : '生成'}
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
        <div className={styles.loading}>加载中...</div>
      ) : baseIncomeData ? (
        <>
          {/* 汇总统计卡片 */}
          {baseIncomeData.summary && (
            <div className={styles.statsCards}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总记录数</div>
                <div className={styles.statValue}>{baseIncomeData.summary.totalCount}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总金额（美元）</div>
                <div className={styles.statValue}>${baseIncomeData.summary.totalAmountUsd.toFixed(2)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>章节解锁数</div>
                <div className={styles.statValue}>{baseIncomeData.summary.chapterUnlockCount}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>章节解锁金额</div>
                <div className={styles.statValue}>${baseIncomeData.summary.chapterUnlockAmount.toFixed(2)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>订阅数</div>
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
            <h3>基础收入明细 (reader_spending)</h3>
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
                  <th>状态</th>
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
                          {item.settled ? '已结算' : '未结算'}
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
        <div className={styles.emptyState}>请选择月份查询或生成数据</div>
      )}
    </div>
  );
};

export default BaseIncome;


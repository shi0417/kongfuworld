import React, { useState, useEffect } from 'react';
import styles from './CommissionTransaction.module.css';

interface CommissionTransactionProps {
  onError?: (error: string) => void;
}

const CommissionTransaction: React.FC<CommissionTransactionProps> = ({ onError }) => {
  const [commissionMonth, setCommissionMonth] = useState('');
  const [commissionData, setCommissionData] = useState<any>(null);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionGenerating, setCommissionGenerating] = useState(false);
  const [commissionSearchQuery, setCommissionSearchQuery] = useState('');
  const [commissionTypeFilter, setCommissionTypeFilter] = useState<string>('all'); // 'all', 'reader_referral', 'author_referral'

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
      setCommissionLoading(false);
    }
  };

  // 生成推广佣金明细数据
  const generateCommissionData = async () => {
    if (!commissionMonth) {
      if (onError) {
        onError('请选择月份');
      }
      return;
    }
    
    if (!window.confirm(`确定要生成 ${commissionMonth} 月的推广佣金明细数据吗？`)) {
      return;
    }
    
    try {
      setCommissionGenerating(true);
      if (onError) {
        onError('');
      }
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
        if (onError) {
          onError('');
        }
        alert(data.message || '生成成功');
        // 重新加载数据
        loadCommissionData();
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
      setCommissionGenerating(false);
    }
  };

  // 删除推广佣金明细数据
  const deleteCommissionData = async () => {
    if (!commissionMonth) {
      if (onError) {
        onError('请选择月份');
      }
      return;
    }
    
    if (!window.confirm(`确定要删除 ${commissionMonth} 月的推广佣金明细数据吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      setCommissionLoading(true);
      if (onError) {
        onError('');
      }
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/commission-transaction?month=${commissionMonth}`, {
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
        setCommissionData(null);
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
      setCommissionLoading(false);
    }
  };

  // 初始化时设置当前月份
  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setCommissionMonth(month);
  }, []);

  // 当月份改变时自动加载数据
  useEffect(() => {
    if (commissionMonth) {
      loadCommissionData();
    }
  }, [commissionMonth]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>推广佣金明细</h2>
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
            placeholder="搜索用户（ID/用户名/邮箱/笔名/手机号）"
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
            <option value="reader_referral">读者推广</option>
            <option value="author_referral">作者推广</option>
          </select>
          <button onClick={loadCommissionData} className={styles.searchButton} disabled={commissionLoading}>
            查询
          </button>
          <button 
            onClick={generateCommissionData} 
            className={styles.generateButton}
            disabled={commissionGenerating || commissionLoading}
          >
            {commissionGenerating ? '生成中...' : '生成'}
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
        <div className={styles.loading}>加载中...</div>
      ) : commissionData ? (
        <>
          {/* 汇总统计卡片 */}
          {commissionData.summary && (
            <div className={styles.statsCards}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总记录数</div>
                <div className={styles.statValue}>{commissionData.summary.totalCount}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总佣金（美元）</div>
                <div className={styles.statValue}>${commissionData.summary.totalCommissionUsd.toFixed(2)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>读者推广佣金</div>
                <div className={styles.statValue}>${commissionData.summary.readerReferralCommission.toFixed(2)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>作者推广佣金</div>
                <div className={styles.statValue}>${commissionData.summary.authorReferralCommission.toFixed(2)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>受益用户数</div>
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
                          {item.commissionType === 'reader_referral' ? '读者推广' : '作者推广'}
                        </span>
                      </td>
                      <td>第{item.level}级</td>
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
                        return `${year}年${parseInt(month)}月`;
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
        <div className={styles.emptyState}>请选择月份查询或生成数据</div>
      )}
    </div>
  );
};

export default CommissionTransaction;


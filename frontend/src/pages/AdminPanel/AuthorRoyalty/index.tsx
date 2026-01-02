import React, { useState, useEffect } from 'react';
import styles from './AuthorRoyalty.module.css';

interface AuthorRoyaltyProps {
  onError?: (error: string) => void;
}

const AuthorRoyalty: React.FC<AuthorRoyaltyProps> = ({ onError }) => {
  const [authorRoyaltyMonth, setAuthorRoyaltyMonth] = useState('');
  const [authorRoyaltyData, setAuthorRoyaltyData] = useState<any>(null);
  const [authorRoyaltyLoading, setAuthorRoyaltyLoading] = useState(false);
  const [authorRoyaltyGenerating, setAuthorRoyaltyGenerating] = useState(false);
  const [authorRoyaltySearchQuery, setAuthorRoyaltySearchQuery] = useState('');

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
      setAuthorRoyaltyLoading(false);
    }
  };

  // 生成作者基础收入数据
  const generateAuthorRoyaltyData = async () => {
    if (!authorRoyaltyMonth) {
      if (onError) {
        onError('请选择月份');
      }
      return;
    }
    
    if (!window.confirm(`确定要生成 ${authorRoyaltyMonth} 月的作者基础收入数据吗？`)) {
      return;
    }
    
    try {
      setAuthorRoyaltyGenerating(true);
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
    fetch('${apiBase}/admin/author-royalty/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ month: authorRoyaltyMonth })
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (onError) {
          onError('');
        }
        alert(data.message || '生成成功');
        // 重新加载数据
        loadAuthorRoyaltyData();
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
      setAuthorRoyaltyGenerating(false);
    }
  };

  // 删除作者基础收入数据
  const deleteAuthorRoyaltyData = async () => {
    if (!authorRoyaltyMonth) {
      if (onError) {
        onError('请选择月份');
      }
      return;
    }
    
    if (!window.confirm(`确定要删除 ${authorRoyaltyMonth} 月的作者基础收入数据吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      setAuthorRoyaltyLoading(true);
      if (onError) {
        onError('');
      }
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/author-royalty?month=${authorRoyaltyMonth}`, {
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
        setAuthorRoyaltyData(null);
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
      setAuthorRoyaltyLoading(false);
    }
  };

  // 初始化时设置当前月份
  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setAuthorRoyaltyMonth(month);
  }, []);

  // 当月份改变时自动加载数据
  useEffect(() => {
    if (authorRoyaltyMonth) {
      loadAuthorRoyaltyData();
    }
  }, [authorRoyaltyMonth]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>作者基础收入表</h2>
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
            placeholder="搜索作者（ID/用户名/邮箱/笔名/手机号）"
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
            {authorRoyaltyGenerating ? '生成中...' : '生成'}
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
        <div className={styles.loading}>加载中...</div>
      ) : authorRoyaltyData ? (
        <>
          {/* 汇总统计卡片 */}
          {authorRoyaltyData.summary && (
            <div className={styles.statsCards}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总记录数</div>
                <div className={styles.statValue}>{authorRoyaltyData.summary.totalCount}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总金额（美元）</div>
                <div className={styles.statValue}>${authorRoyaltyData.summary.totalAmountUsd.toFixed(2)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>作者收入总额</div>
                <div className={styles.statValue}>${authorRoyaltyData.summary.totalAuthorAmountUsd.toFixed(2)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>作者数量</div>
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
            <h3>作者基础收入明细 (author_royalty)</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>作者ID</th>
                  <th>作者</th>
                  <th>小说ID</th>
                  <th>小说</th>
                  <th>总收入（美元）</th>
                  <th>作者收入（美元）</th>
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

export default AuthorRoyalty;


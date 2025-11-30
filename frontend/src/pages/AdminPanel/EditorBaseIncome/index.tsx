import React, { useState, useEffect } from 'react';
import styles from './EditorBaseIncome.module.css';

interface EditorBaseIncomeProps {
  onError?: (error: string) => void;
}

const EditorBaseIncome: React.FC<EditorBaseIncomeProps> = ({ onError }) => {
  const [month, setMonth] = useState('');
  const [editorKeyword, setEditorKeyword] = useState('');
  const [novelKeyword, setNovelKeyword] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // 加载编辑基础收入数据
  const loadData = async () => {
    if (!month) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams({
        month,
        page: '1',
        pageSize: '1000'
      });
      
      if (editorKeyword) {
        params.append('editorKeyword', editorKeyword);
      }
      if (novelKeyword) {
        params.append('novelKeyword', novelKeyword);
      }
      
      const response = await fetch(`http://localhost:5000/api/admin/editor-base-income?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setData(result.data || []);
        setStats(result.stats || null);
        if (onError) {
          onError(''); // 清除错误
        }
      } else {
        if (onError) {
          onError(result.message || '加载失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // 生成编辑基础收入数据
  const generateData = async () => {
    if (!month) {
      if (onError) {
        onError('请选择月份');
      }
      return;
    }
    
    if (!window.confirm(`确定要生成 ${month} 月的编辑基础收入数据吗？`)) {
      return;
    }
    
    try {
      setGenerating(true);
      if (onError) {
        onError('');
      }
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5000/api/admin/editor-base-income/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ month })
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (onError) {
          onError('');
        }
        alert(result.message || '生成成功');
        // 重新加载数据
        loadData();
      } else {
        if (onError) {
          onError(result.message || '生成失败');
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
  
  // 删除编辑基础收入数据
  const deleteData = async () => {
    if (!month) {
      if (onError) {
        onError('请选择月份');
      }
      return;
    }
    
    if (!window.confirm(`确定要删除 ${month} 月的编辑基础收入数据吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      setLoading(true);
      if (onError) {
        onError('');
      }
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/editor-base-income?month=${month}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (onError) {
          onError('');
        }
        alert(result.message || '删除成功');
        setData([]);
        setStats(null);
      } else {
        if (onError) {
          onError(result.message || '删除失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '删除失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 初始化时设置当前月份
  useEffect(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setMonth(monthStr);
  }, []);

  // 格式化百分比
  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `${(value * 100).toFixed(2)}%`;
  };

  // 格式化角色
  const formatRole = (role: string | null) => {
    if (!role) return '-';
    const roleMap: { [key: string]: string } = {
      'chief_editor': '主编',
      'editor': '编辑',
      'proofreader': '校对'
    };
    return roleMap[role] || role;
  };

  // 格式化来源类型
  const formatSourceType = (sourceType: string | null) => {
    if (!sourceType) return '-';
    const typeMap: { [key: string]: string } = {
      'chapter_unlock': '章节解锁',
      'subscription': '订阅',
      'mixed': '混合'
    };
    return typeMap[sourceType] || sourceType;
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>编辑基础收入-4</h2>
        <div className={styles.filters}>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
            }}
            className={styles.monthInput}
          />
          <input
            type="text"
            placeholder="编辑搜索（用户名/真实姓名）"
            value={editorKeyword}
            onChange={(e) => setEditorKeyword(e.target.value)}
            className={styles.searchInput}
          />
          <input
            type="text"
            placeholder="小说搜索（标题）"
            value={novelKeyword}
            onChange={(e) => setNovelKeyword(e.target.value)}
            className={styles.searchInput}
          />
          <button onClick={loadData} className={styles.searchButton} disabled={loading}>
            查询
          </button>
          <button 
            onClick={generateData} 
            className={styles.generateButton}
            disabled={generating || loading}
          >
            {generating ? '生成中...' : '生成'}
          </button>
          {data.length > 0 && (
            <button 
              onClick={deleteData} 
              className={styles.deleteButton}
              disabled={loading}
            >
              删除
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <>
          {/* 汇总统计卡片 */}
          {stats && (
            <div className={styles.statsCards}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总记录数</div>
                <div className={styles.statValue}>{stats.total_records || 0}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总编辑收入（美元）</div>
                <div className={styles.statValue}>
                  ${parseFloat(stats.total_editor_income_usd || 0).toFixed(2)}
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>编辑数量</div>
                <div className={styles.statValue}>{stats.editor_count || 0}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>小说数量</div>
                <div className={styles.statValue}>{stats.novel_count || 0}</div>
              </div>
            </div>
          )}

          {/* 详细列表 */}
          <div className={styles.paymentTable}>
            <h3>编辑基础收入明细 (editor_income_monthly)</h3>
            <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px', fontSize: '13px', color: '#666' }}>
              <strong>说明：</strong>本表中每一行，是一条 reader_spending + 一个角色（编辑/主编）生成的基础收入明细，同一编辑 + 同一小说 + 同一个月可能有多条记录。
            </div>
            {data.length === 0 ? (
              <div className={styles.emptyCell}>暂无数据，请点击"生成"按钮生成数据</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>编辑ID</th>
                    <th>编辑账号</th>
                    <th>编辑真实姓名</th>
                    <th>角色</th>
                    <th>小说ID</th>
                    <th>小说名称</th>
                    <th>来源类型</th>
                    <th>来源基础收入ID</th>
                    <th>章节ID</th>
                    <th>章节总数</th>
                    <th>编辑章节数</th>
                    <th>总字数</th>
                    <th>编辑字数</th>
                    <th>合同分成比例</th>
                    <th>实际分成比例</th>
                    <th>作品基础收入（美元）</th>
                    <th>编辑收入（美元）</th>
                    <th>结算月份</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item: any) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.editor_admin_id}</td>
                      <td>{item.editor_name || '-'}</td>
                      <td>{item.editor_real_name || '-'}</td>
                      <td>{formatRole(item.role)}</td>
                      <td>{item.novel_id}</td>
                      <td>{item.novel_title || '-'}</td>
                      <td>{formatSourceType(item.source_type)}</td>
                      <td>{item.source_spend_id || '-'}</td>
                      <td>{item.chapter_id || '-'}</td>
                      <td>{item.chapter_count_total || 0}</td>
                      <td>{item.chapter_count_editor || 0}</td>
                      <td>{item.total_word_count || 0}</td>
                      <td>{item.editor_word_count || 0}</td>
                      <td>{formatPercent(item.contract_share_percent)}</td>
                      <td>{formatPercent(item.editor_share_percent)}</td>
                      <td>${parseFloat(item.gross_book_income_usd || 0).toFixed(2)}</td>
                      <td>${parseFloat(item.editor_income_usd || 0).toFixed(2)}</td>
                      <td>{item.month}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EditorBaseIncome;


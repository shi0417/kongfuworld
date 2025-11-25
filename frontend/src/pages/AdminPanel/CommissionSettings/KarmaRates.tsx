import React, { useState, useEffect } from 'react';
import styles from './CommissionSettings.module.css';

interface KarmaRatesProps {
  onError?: (error: string) => void;
}

const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  
  // 如果已经是正确的格式，直接返回
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  try {
    // 处理 MySQL DATETIME 格式 (2025-01-01 00:00:00) 或 ISO 格式
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // 获取本地时间的各个部分
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

const KarmaRates: React.FC<KarmaRatesProps> = ({ onError }) => {
  const [karmaRates, setKarmaRates] = useState<any[]>([]);
  const [karmaRatesLoading, setKarmaRatesLoading] = useState(false);
  const [editingRate, setEditingRate] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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
      setKarmaRatesLoading(false);
    }
  };

  // 保存Karma汇率修改
  const saveKarmaRateEdit = async () => {
    if (!editingRate) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      
      // 构建请求体，只包含有值的字段
      const requestBody: any = {};
      if (editingRate.usd_per_karma !== undefined) {
        requestBody.usd_per_karma = editingRate.usd_per_karma;
      }
      if (editingRate.effective_from !== undefined) {
        requestBody.effective_from = editingRate.effective_from;
      }
      if (editingRate.effective_to !== undefined) {
        requestBody.effective_to = editingRate.effective_to || null;
      }
      
      const response = await fetch(`http://localhost:5000/api/admin/karma-rates/${editingRate.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadKarmaRates();
        setEditingRate(null);
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '保存失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    loadKarmaRates();
  }, []);

  return (
    <>
      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
        <p>说明：所有章节解锁消费将按解锁时刻对应的汇率计算。调整汇率仅影响未来消费，历史已结算数据不会被回算。</p>
      </div>
      <div className={styles.paymentTable}>
        <h3>Karma汇率列表</h3>
        <table>
          <thead>
            <tr>
              <th>生效开始时间</th>
              <th>生效结束时间</th>
              <th>1 Karma = 美元</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {karmaRatesLoading ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>加载中...</td>
              </tr>
            ) : karmaRates.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>暂无数据</td>
              </tr>
            ) : (
              karmaRates.map((rate) => (
                <tr key={rate.id}>
                  <td>{new Date(rate.effective_from).toLocaleString('zh-CN')}</td>
                  <td>{rate.effective_to ? new Date(rate.effective_to).toLocaleString('zh-CN') : '— (当前生效)'}</td>
                  <td>{rate.usd_per_karma.toFixed(10)}</td>
                  <td>{new Date(rate.created_at).toLocaleString('zh-CN')}</td>
                  <td>
                    <button
                      onClick={() => setEditingRate({ ...rate })}
                      style={{ padding: '5px 10px', fontSize: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      修改
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 修改Karma汇率模态框 */}
      {editingRate && (
        <div className={styles.modal} onClick={() => setEditingRate(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h2>修改Karma汇率</h2>
              <button onClick={() => setEditingRate(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#666' }}>汇率ID:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>{editingRate.id}</span>
                </div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                  1 Karma = 美元 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.0000000001"
                  min="0"
                  value={editingRate.usd_per_karma !== undefined ? editingRate.usd_per_karma : ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setEditingRate({ 
                      ...editingRate, 
                      usd_per_karma: isNaN(value) ? undefined : value 
                    });
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ddd', 
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  placeholder="例如：0.01"
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                  生效开始时间 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formatDateForInput(editingRate.effective_from)}
                  onChange={(e) => {
                    const value = e.target.value;
                    // datetime-local 格式是 YYYY-MM-DDTHH:mm，直接转换为 MySQL DATETIME 格式 YYYY-MM-DD HH:mm:ss
                    const mysqlDateTime = value ? value.replace('T', ' ') + ':00' : null;
                    setEditingRate({ 
                      ...editingRate, 
                      effective_from: mysqlDateTime 
                    });
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ddd', 
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                  生效结束时间
                </label>
                <input
                  type="datetime-local"
                  value={editingRate.effective_to ? formatDateForInput(editingRate.effective_to) : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    // datetime-local 格式是 YYYY-MM-DDTHH:mm，直接转换为 MySQL DATETIME 格式 YYYY-MM-DD HH:mm:ss
                    // 如果为空则设为 null
                    const mysqlDateTime = value ? value.replace('T', ' ') + ':00' : null;
                    setEditingRate({ 
                      ...editingRate, 
                      effective_to: mysqlDateTime 
                    });
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ddd', 
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                  留空表示汇率持续生效
                </div>
              </div>

              <div className={styles.modalActions} style={{ marginTop: '25px' }}>
                <button
                  onClick={saveKarmaRateEdit}
                  className={styles.approveButton}
                  disabled={saving || editingRate.usd_per_karma === undefined || !editingRate.effective_from}
                  style={{ marginRight: '10px' }}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditingRate(null)}
                  className={styles.rejectButton}
                  disabled={saving}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KarmaRates;


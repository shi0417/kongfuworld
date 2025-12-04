/**
 * 编辑收入Tab组件
 * 显示编辑/管理员的收入统计和明细
 */
import React, { useState, useEffect, useCallback } from 'react';
import ApiService from '../../services/ApiService';
import styles from './AdminEditorIncome.module.css';

interface AdminEditorIncomeTabProps {
  onError?: (error: string) => void;
}

interface IncomeSummary {
  total_income_usd: number;
  chief_editor_income_usd: number;
  editor_income_usd: number;
  novel_count: number;
}

interface NovelIncome {
  novel_id: number;
  novel_title: string;
  role: string;
  income_usd: number;
  payout_status: string;
}

interface IncomeDetail {
  id: number;
  time: string;
  novel_title: string;
  role: string;
  source_type: string;
  income_usd: number;
}

const AdminEditorIncomeTab: React.FC<AdminEditorIncomeTabProps> = ({ onError }) => {
  // 筛选状态
  const [incomeMonth, setIncomeMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedNovelId, setSelectedNovelId] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // 数据状态
  const [incomeSummary, setIncomeSummary] = useState<IncomeSummary | null>(null);
  const [novelIncomes, setNovelIncomes] = useState<NovelIncome[]>([]);
  const [incomeDetails, setIncomeDetails] = useState<IncomeDetail[]>([]);
  const [novels, setNovels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // 分页状态
  const [detailsPage, setDetailsPage] = useState(1);
  const [detailsTotal, setDetailsTotal] = useState(0);
  const pageSize = 20;

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
    return styles.status + ' ' + styles.pending;
  };

  // 获取状态文本
  const getStatusText = (status: string): string => {
    if (status === 'paid') return '已支付';
    if (status === 'partially_paid') return '部分支付';
    return '未支付';
  };

  // 加载参与的作品列表
  const loadNovels = useCallback(async () => {
    try {
      const response = await ApiService.get('/admin/editor-income/novels');
      if (response && response.success) {
        setNovels(response.data || []);
      }
    } catch (error) {
      console.error('加载作品列表失败:', error);
    }
  }, []);

  // 加载收入汇总
  const loadIncomeSummary = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/admin/editor-income/summary?month=${incomeMonth}-01`;
      if (selectedNovelId !== 'all') {
        url += `&novel_id=${selectedNovelId}`;
      }
      if (selectedRole !== 'all') {
        url += `&role=${selectedRole}`;
      }

      const response = await ApiService.get(url);
      if (response && response.success) {
        setIncomeSummary(response.data);
      }
    } catch (error: any) {
      console.error('加载收入汇总失败:', error);
      if (onError) {
        onError(error.message || '加载收入汇总失败');
      }
    } finally {
      setLoading(false);
    }
  }, [incomeMonth, selectedNovelId, selectedRole, onError]);

  // 加载按作品汇总
  const loadNovelIncomes = useCallback(async () => {
    try {
      let url = `/admin/editor-income/by-novel?month=${incomeMonth}-01`;
      if (selectedRole !== 'all') {
        url += `&role=${selectedRole}`;
      }

      const response = await ApiService.get(url);
      if (response && response.success) {
        setNovelIncomes(response.data || []);
      }
    } catch (error) {
      console.error('加载按作品汇总失败:', error);
    }
  }, [incomeMonth, selectedRole]);

  // 加载收入明细
  const loadIncomeDetails = useCallback(async () => {
    try {
      setDetailsLoading(true);
      let url = `/admin/editor-income/details?month=${incomeMonth}-01&page=${detailsPage}&pageSize=${pageSize}`;
      if (selectedNovelId !== 'all') {
        url += `&novel_id=${selectedNovelId}`;
      }
      if (selectedRole !== 'all') {
        url += `&role=${selectedRole}`;
      }

      const response = await ApiService.get(url);
      if (response && response.success) {
        setIncomeDetails(response.data || []);
        setDetailsTotal(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error('加载收入明细失败:', error);
    } finally {
      setDetailsLoading(false);
    }
  }, [incomeMonth, selectedNovelId, selectedRole, detailsPage]);

  // 初始化加载
  useEffect(() => {
    loadNovels();
  }, [loadNovels]);

  // 筛选条件变化时重新加载
  useEffect(() => {
    loadIncomeSummary();
    loadNovelIncomes();
    setDetailsPage(1); // 重置分页
  }, [incomeMonth, selectedNovelId, selectedRole, loadIncomeSummary, loadNovelIncomes]);

  // 分页变化时重新加载明细
  useEffect(() => {
    loadIncomeDetails();
  }, [detailsPage, loadIncomeDetails]);

  return (
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
            {novels.map(novel => (
              <option key={novel.id} value={novel.id}>{novel.title}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterItem}>
          <label>角色：</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="all">全部角色</option>
            <option value="chief_editor">主编</option>
            <option value="editor">责任编辑</option>
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
            <div className={styles.cardTitle}>本月编辑总收入</div>
            <div className={styles.cardValue}>{formatCurrency(incomeSummary.total_income_usd)}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.cardTitle}>主编收入</div>
            <div className={styles.cardValue}>{formatCurrency(incomeSummary.chief_editor_income_usd)}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.cardTitle}>责任编辑收入</div>
            <div className={styles.cardValue}>{formatCurrency(incomeSummary.editor_income_usd)}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.cardTitle}>参与作品数</div>
            <div className={styles.cardValue}>{incomeSummary.novel_count}</div>
          </div>
        </div>
      )}

      {/* 按作品汇总 */}
      <div className={styles.section}>
        <h3>按作品汇总</h3>
        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>作品</th>
                <th>角色</th>
                <th>本月编辑收入(USD)</th>
                <th>本月状态</th>
              </tr>
            </thead>
            <tbody>
              {novelIncomes.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.emptyCell}>暂无数据</td>
                </tr>
              ) : (
                novelIncomes.map(novel => (
                  <tr key={`${novel.novel_id}-${novel.role}`}>
                    <td>{novel.novel_title}</td>
                    <td>{novel.role === 'chief_editor' ? '主编' : '责任编辑'}</td>
                    <td>{formatCurrency(novel.income_usd)}</td>
                    <td>
                      <span className={getStatusClass(novel.payout_status)}>
                        {getStatusText(novel.payout_status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 收入明细 */}
      <div className={styles.section}>
        <h3>收入明细（{formatMonth(incomeMonth)}）</h3>
        {detailsLoading ? (
          <div className={styles.loading}>加载中...</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>作品</th>
                  <th>角色</th>
                  <th>收入来源</th>
                  <th>收入金额(USD)</th>
                </tr>
              </thead>
              <tbody>
                {incomeDetails.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyCell}>暂无数据</td>
                  </tr>
                ) : (
                  incomeDetails.map(detail => (
                    <tr key={detail.id}>
                      <td>{new Date(detail.time).toLocaleString('zh-CN')}</td>
                      <td>{detail.novel_title}</td>
                      <td>{detail.role === 'chief_editor' ? '主编' : '责任编辑'}</td>
                      <td>{detail.source_type === 'chapter_unlock' ? '章节解锁' : '订阅'}</td>
                      <td>{formatCurrency(detail.income_usd)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {detailsTotal > pageSize && (
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button
                  onClick={() => setDetailsPage(p => Math.max(1, p - 1))}
                  disabled={detailsPage === 1}
                  style={{ padding: '8px 16px' }}
                >
                  上一页
                </button>
                <span style={{ padding: '8px' }}>
                  第 {detailsPage} 页，共 {Math.ceil(detailsTotal / pageSize)} 页
                </span>
                <button
                  onClick={() => setDetailsPage(p => p + 1)}
                  disabled={detailsPage >= Math.ceil(detailsTotal / pageSize)}
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
  );
};

export default AdminEditorIncomeTab;


/**
 * 我的合同Tab组件
 * 显示当前登录编辑的所有合同列表
 */
import React, { useState, useEffect, useCallback } from 'react';
import ApiService from '../../services/ApiService';
import styles from './AdminEditorIncome.module.css';

interface AdminMyContractsTabProps {
  onError?: (error: string) => void;
}

interface MyContractSummary {
  total_count: number;
  active_count: number;
  ended_count: number;
  cancelled_count: number;
  novel_count: number;
}

interface MyContractItem {
  id: number;
  novel_id: number;
  novel_title: string;
  editor_admin_id: number;
  role: 'chief_editor' | 'editor' | 'proofreader';
  share_type: 'percent_of_book' | 'percent_of_author';
  share_percent: string | number;
  start_chapter_id?: number | null;
  end_chapter_id?: number | null;
  start_date: string;
  end_date?: string | null;
  status: 'active' | 'ended' | 'cancelled';
  created_at: string;
  updated_at: string;
}

interface NovelOption {
  id: number;
  title: string;
}

const AdminMyContractsTab: React.FC<AdminMyContractsTabProps> = ({ onError }) => {
  // 数据状态
  const [summary, setSummary] = useState<MyContractSummary | null>(null);
  const [contracts, setContracts] = useState<MyContractItem[]>([]);
  const [novelOptions, setNovelOptions] = useState<NovelOption[]>([]);
  
  // 加载状态
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  
  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  
  // 筛选状态
  const [selectedNovelId, setSelectedNovelId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  
  // 详情弹窗状态
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedContract, setSelectedContract] = useState<MyContractItem | null>(null);

  // 格式化日期
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN');
    } catch (e) {
      return dateStr.substring(0, 10);
    }
  };

  // 格式化分成比例
  const formatPercent = (percent: number | string | null | undefined): string => {
    if (percent === null || percent === undefined) return '-';
    const num = typeof percent === 'string' ? parseFloat(percent) : percent;
    if (isNaN(num)) return '-';
    return `${(num * 100).toFixed(2)}%`;
  };

  // 渲染角色文本
  const renderRole = (role: string): string => {
    const roleMap: { [key: string]: string } = {
      'chief_editor': '主编',
      'editor': '编辑',
      'proofreader': '校对'
    };
    return roleMap[role] || role;
  };

  // 渲染分成类型文本
  const renderShareType = (shareType: string): string => {
    const typeMap: { [key: string]: string } = {
      'percent_of_book': '按作品总收入',
      'percent_of_author': '按作者分成'
    };
    return typeMap[shareType] || shareType;
  };

  // 获取状态标签样式
  const getStatusClass = (status: string): string => {
    if (status === 'active') return styles.status + ' ' + styles.completed;
    if (status === 'ended') return styles.status + ' ' + styles.pending;
    if (status === 'cancelled') return styles.status + ' ' + styles.error;
    return styles.status + ' ' + styles.pending;
  };

  // 获取状态文本
  const getStatusText = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'active': '活跃',
      'ended': '已结束',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  };

  // 加载作品列表
  const loadNovels = useCallback(async () => {
    try {
      const response = await ApiService.get('/admin/editor-income/novels');
      if (response && response.success) {
        setNovelOptions(response.data || []);
      }
    } catch (error) {
      console.error('加载作品列表失败:', error);
    }
  }, []);

  // 加载合同统计
  const loadSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const response = await ApiService.get('/admin/my-contracts/summary');
      if (response && response.success) {
        setSummary(response.data);
      }
    } catch (error: any) {
      console.error('加载合同统计失败:', error);
      if (onError) {
        onError(error.message || '加载合同统计失败');
      }
    } finally {
      setSummaryLoading(false);
    }
  }, [onError]);

  // 加载合同列表
  const loadContracts = useCallback(async (pageNum: number = page) => {
    try {
      setLoading(true);
      let url = `/admin/my-contracts?page=${pageNum}&pageSize=${pageSize}`;
      
      if (selectedNovelId) {
        url += `&novel_id=${selectedNovelId}`;
      }
      if (selectedRole) {
        url += `&role=${selectedRole}`;
      }
      if (selectedStatus) {
        url += `&status=${selectedStatus}`;
      }

      const response = await ApiService.get(url);
      if (response && response.success) {
        setContracts(response.data?.list || []);
        setTotal(response.data?.total || 0);
        setPage(pageNum);
      }
    } catch (error: any) {
      console.error('加载合同列表失败:', error);
      if (onError) {
        onError(error.message || '加载合同列表失败');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedNovelId, selectedRole, selectedStatus, pageSize, page, onError]);

  // 初始化加载
  useEffect(() => {
    loadNovels();
    loadSummary();
  }, [loadNovels, loadSummary]);

  // 筛选条件变化时重新加载
  useEffect(() => {
    loadContracts(1);
  }, [selectedNovelId, selectedRole, selectedStatus, loadContracts]);

  // 搜索按钮
  const handleSearch = () => {
    loadContracts(1);
  };

  // 重置按钮
  const handleReset = () => {
    setSelectedNovelId('');
    setSelectedRole('');
    setSelectedStatus('');
    // loadContracts 会在 useEffect 中自动触发
  };

  // 打开详情弹窗
  const openDetailModal = (contract: MyContractItem) => {
    setSelectedContract(contract);
    setDetailModalVisible(true);
  };

  // 关闭详情弹窗
  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedContract(null);
  };

  // 分页处理
  const handlePageChange = (newPage: number) => {
    loadContracts(newPage);
  };

  return (
    <div className={styles.tabContent}>
      {/* 顶部统计卡片 */}
      <div className={styles.summaryCards} style={{ marginBottom: '30px' }}>
        <div className={styles.summaryCard}>
          <div className={styles.cardTitle}>合同总数</div>
          <div className={styles.cardValue}>{summaryLoading ? '...' : (summary?.total_count ?? 0)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.cardTitle}>活跃合同</div>
          <div className={styles.cardValue} style={{ color: '#28a745' }}>
            {summaryLoading ? '...' : (summary?.active_count ?? 0)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.cardTitle}>已结束合同</div>
          <div className={styles.cardValue} style={{ color: '#ffc107' }}>
            {summaryLoading ? '...' : (summary?.ended_count ?? 0)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.cardTitle}>参与作品数</div>
          <div className={styles.cardValue}>{summaryLoading ? '...' : (summary?.novel_count ?? 0)}</div>
        </div>
      </div>

      {/* 筛选区域 */}
      <div className={styles.filters}>
        <div className={styles.filterItem}>
          <label>作品：</label>
          <select
            value={selectedNovelId}
            onChange={(e) => setSelectedNovelId(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minWidth: '150px' }}
          >
            <option value="">全部作品</option>
            {novelOptions.map((novel) => (
              <option key={novel.id} value={novel.id}>
                {novel.title}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterItem}>
          <label>角色：</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minWidth: '120px' }}
          >
            <option value="">全部角色</option>
            <option value="chief_editor">主编</option>
            <option value="editor">编辑</option>
            <option value="proofreader">校对</option>
          </select>
        </div>
        <div className={styles.filterItem}>
          <label>状态：</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minWidth: '120px' }}
          >
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="ended">已结束</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
          <button
            onClick={handleSearch}
            style={{
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            搜索
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            重置
          </button>
        </div>
      </div>

      {/* 合同列表表格 */}
      <div className={styles.section}>
        <h3>我的合同列表</h3>
        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>合同ID</th>
                  <th>作品</th>
                  <th>角色</th>
                  <th>分成类型</th>
                  <th>分成比例</th>
                  <th>开始日期</th>
                  <th>结束日期</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className={styles.emptyCell}>暂无合同</td>
                  </tr>
                ) : (
                  contracts.map((contract) => (
                    <tr key={contract.id}>
                      <td>{contract.id}</td>
                      <td>{contract.novel_title || `小说ID: ${contract.novel_id}`}</td>
                      <td>{renderRole(contract.role)}</td>
                      <td>{renderShareType(contract.share_type)}</td>
                      <td>{formatPercent(contract.share_percent)}</td>
                      <td>{formatDate(contract.start_date)}</td>
                      <td>{formatDate(contract.end_date)}</td>
                      <td>
                        <span className={getStatusClass(contract.status)}>
                          {getStatusText(contract.status)}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => openDetailModal(contract)}
                          style={{
                            padding: '4px 12px',
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

            {/* 分页 */}
            {total > pageSize && (
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  style={{
                    padding: '6px 12px',
                    background: page <= 1 ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  上一页
                </button>
                <span>
                  第 {page} 页，共 {Math.ceil(total / pageSize)} 页（共 {total} 条）
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                  style={{
                    padding: '6px 12px',
                    background: page >= Math.ceil(total / pageSize) ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: page >= Math.ceil(total / pageSize) ? 'not-allowed' : 'pointer'
                  }}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 详情弹窗 */}
      {detailModalVisible && selectedContract && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={closeDetailModal}
        >
          <div
            style={{
              background: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>合同详情</h3>
              <button
                onClick={closeDetailModal}
                style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <strong>合同ID：</strong>
                {selectedContract.id}
              </div>
              <div>
                <strong>作品：</strong>
                {selectedContract.novel_title || `小说ID: ${selectedContract.novel_id}`}
              </div>
              <div>
                <strong>角色：</strong>
                {renderRole(selectedContract.role)}
              </div>
              <div>
                <strong>分成类型：</strong>
                {renderShareType(selectedContract.share_type)}
              </div>
              <div>
                <strong>分成比例：</strong>
                {formatPercent(selectedContract.share_percent)}
              </div>
              {selectedContract.start_chapter_id && (
                <div>
                  <strong>起始章节ID：</strong>
                  {selectedContract.start_chapter_id}
                </div>
              )}
              {selectedContract.end_chapter_id && (
                <div>
                  <strong>结束章节ID：</strong>
                  {selectedContract.end_chapter_id}
                </div>
              )}
              <div>
                <strong>开始日期：</strong>
                {formatDate(selectedContract.start_date)}
              </div>
              <div>
                <strong>结束日期：</strong>
                {formatDate(selectedContract.end_date)}
              </div>
              <div>
                <strong>状态：</strong>
                <span className={getStatusClass(selectedContract.status)}>
                  {getStatusText(selectedContract.status)}
                </span>
              </div>
              <div>
                <strong>创建时间：</strong>
                {formatDate(selectedContract.created_at)}
              </div>
              <div>
                <strong>更新时间：</strong>
                {formatDate(selectedContract.updated_at)}
              </div>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={closeDetailModal}
                style={{
                  padding: '8px 16px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMyContractsTab;


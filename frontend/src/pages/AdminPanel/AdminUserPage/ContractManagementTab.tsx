/**
 * Tab2: 合同管理
 * 展示 novel_editor_contract 表，支持排序和查询
 */

import React, { useState, useEffect } from 'react';
import styles from './AdminUserPage.module.css';

interface Contract {
  id: number;
  novel_id: number;
  novel_title: string;
  editor_admin_id: number;
  editor_name: string;
  role: string;
  share_type: string;
  share_percent: number;
  start_chapter_id: number | null;
  end_chapter_id: number | null;
  start_date: string;
  end_date: string | null;
  status: string;
  created_at: string;
}

interface ContractManagementTabProps {
  onError?: (error: string) => void;
  adminApiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
}

const ContractManagementTab: React.FC<ContractManagementTabProps> = ({ onError, adminApiRequest }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    novelKeyword: '',
    editorKeyword: '',
    role: '',
    status: '',
    shareType: '',
    startDateFrom: '',
    startDateTo: ''
  });
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0
  });

  // 加载合同列表
  const loadContracts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        sortField: sortField,
        sortOrder: sortOrder
      });
      
      if (filters.novelKeyword) params.append('novelKeyword', filters.novelKeyword);
      if (filters.editorKeyword) params.append('editorKeyword', filters.editorKeyword);
      if (filters.role) params.append('role', filters.role);
      if (filters.status) params.append('status', filters.status);
      if (filters.shareType) params.append('shareType', filters.shareType);
      if (filters.startDateFrom) params.append('startDateFrom', filters.startDateFrom);
      if (filters.startDateTo) params.append('startDateTo', filters.startDateTo);
      
      const { data } = await adminApiRequest(`/admin/editor-contracts?${params.toString()}`);
      
      if (data.success) {
        setContracts(data.data.list);
        setPagination(prev => ({
          ...prev,
          total: data.data.total
        }));
      }
    } catch (error: any) {
      if (onError) {
        onError(error.message || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, [pagination.page, sortField, sortOrder]);

  // 搜索
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadContracts();
  };

  // 重置
  const handleReset = () => {
    setFilters({
      novelKeyword: '',
      editorKeyword: '',
      role: '',
      status: '',
      shareType: '',
      startDateFrom: '',
      startDateTo: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 切换排序
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortField(field);
      setSortOrder('DESC');
    }
  };

  const getRoleText = (role: string) => {
    const roleMap: Record<string, string> = {
      'chief_editor': '主编',
      'editor': '编辑',
      'proofreader': '校对'
    };
    return roleMap[role] || role;
  };

  const getRoleClass = (role: string) => {
    const classMap: Record<string, string> = {
      'chief_editor': styles.roleChiefEditor,
      'editor': styles.roleEditor,
      'proofreader': styles.roleProofreader
    };
    return classMap[role] || '';
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'active': '活跃',
      'ended': '已结束',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status: string) => {
    const classMap: Record<string, string> = {
      'active': styles.contractStatusActive,
      'ended': styles.contractStatusEnded,
      'cancelled': styles.contractStatusCancelled
    };
    return classMap[status] || '';
  };

  const formatPercent = (percent: number | null) => {
    if (percent === null || percent === undefined) return '-';
    return `${(percent * 100).toFixed(2)}%`;
  };

  return (
    <>
      {/* 筛选区 */}
      <div className={styles.filters}>
        <input
          type="text"
          placeholder="搜索小说标题/ID"
          value={filters.novelKeyword}
          onChange={(e) => setFilters(prev => ({ ...prev, novelKeyword: e.target.value }))}
          className={styles.searchInput}
        />
        <input
          type="text"
          placeholder="搜索编辑用户名"
          value={filters.editorKeyword}
          onChange={(e) => setFilters(prev => ({ ...prev, editorKeyword: e.target.value }))}
          className={styles.searchInput}
        />
        <select
          value={filters.role}
          onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
          className={styles.filterSelect}
        >
          <option value="">全部角色</option>
          <option value="chief_editor">主编</option>
          <option value="editor">编辑</option>
          <option value="proofreader">校对</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          className={styles.filterSelect}
        >
          <option value="">全部状态</option>
          <option value="active">活跃</option>
          <option value="ended">已结束</option>
          <option value="cancelled">已取消</option>
        </select>
        <select
          value={filters.shareType}
          onChange={(e) => setFilters(prev => ({ ...prev, shareType: e.target.value }))}
          className={styles.filterSelect}
        >
          <option value="">全部分成类型</option>
          <option value="percent_of_book">整书分成</option>
          <option value="percent_of_author">作者分成</option>
        </select>
        <input
          type="date"
          placeholder="开始日期起"
          value={filters.startDateFrom}
          onChange={(e) => setFilters(prev => ({ ...prev, startDateFrom: e.target.value }))}
          className={styles.searchInput}
        />
        <input
          type="date"
          placeholder="开始日期止"
          value={filters.startDateTo}
          onChange={(e) => setFilters(prev => ({ ...prev, startDateTo: e.target.value }))}
          className={styles.searchInput}
        />
        <button onClick={handleSearch} className={styles.searchButton}>搜索</button>
        <button onClick={handleReset} className={styles.resetButton}>重置</button>
      </div>

      {/* 列表 */}
      {loading && contracts.length === 0 ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th>合同ID</th>
                <th>小说</th>
                <th>编辑账号</th>
                <th>角色</th>
                <th>分成类型</th>
                <th onClick={() => handleSort('share_percent')} style={{ cursor: 'pointer' }}>
                  分成比例 {sortField === 'share_percent' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th>起止章节</th>
                <th onClick={() => handleSort('start_date')} style={{ cursor: 'pointer' }}>
                  生效时间 {sortField === 'start_date' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                  状态 {sortField === 'status' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                  创建时间 {sortField === 'created_at' && (sortOrder === 'ASC' ? '↑' : '↓')}
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>{contract.id}</td>
                  <td>{contract.novel_title} (#{contract.novel_id})</td>
                  <td>{contract.editor_name}</td>
                  <td>
                    <span className={`${styles.roleTag} ${getRoleClass(contract.role)}`}>
                      {getRoleText(contract.role)}
                    </span>
                  </td>
                  <td>{contract.share_type === 'percent_of_book' ? '整书分成' : '作者分成'}</td>
                  <td>{formatPercent(contract.share_percent)}</td>
                  <td>
                    {contract.start_chapter_id && contract.end_chapter_id
                      ? `${contract.start_chapter_id} ~ ${contract.end_chapter_id}`
                      : contract.start_chapter_id
                      ? `从 ${contract.start_chapter_id}`
                      : '全书'}
                  </td>
                  <td>
                    {new Date(contract.start_date).toLocaleDateString('zh-CN')}
                    {contract.end_date ? ` ~ ${new Date(contract.end_date).toLocaleDateString('zh-CN')}` : ' (长期)'}
                  </td>
                  <td>
                    <span className={`${styles.statusTag} ${getStatusClass(contract.status)}`}>
                      {getStatusText(contract.status)}
                    </span>
                  </td>
                  <td>{new Date(contract.created_at).toLocaleString('zh-CN')}</td>
                  <td>
                    <button className={styles.editButton}>查看</button>
                    {contract.status === 'active' && (
                      <button className={styles.toggleButton}>终止</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 分页 */}
          {pagination.total > 0 && (
            <div className={styles.pagination}>
              <button 
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                上一页
              </button>
              <span>
                第 {pagination.page} 页，共 {Math.ceil(pagination.total / pagination.pageSize)} 页
              </span>
              <button 
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ContractManagementTab;


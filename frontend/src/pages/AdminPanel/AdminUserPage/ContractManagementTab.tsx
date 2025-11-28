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
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [editForm, setEditForm] = useState({
    share_type: 'percent_of_book' as string,
    share_percent: 0 as number,
    start_chapter_id: null as number | null,
    end_chapter_id: null as number | null,
    start_date: '' as string,
    end_date: '' as string,
    status: 'active' as string
  });
  const [saving, setSaving] = useState(false);
  const [loadingContract, setLoadingContract] = useState(false);
  const [chapterOptions, setChapterOptions] = useState<{ id: number; chapter_number: number; title: string }[]>([]);

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

  // 打开修改弹窗
  const openEditModal = async (contract: Contract) => {
    setSelectedContract(contract);
    setLoadingContract(true);
    setShowEditModal(true);
    
    try {
      // 获取合同详情
      const { data } = await adminApiRequest(`/admin/editor-contracts/${contract.id}`);
      
      if (data.success && data.data) {
        const contractData = data.data;
        setEditForm({
          share_type: contractData.share_type || 'percent_of_book',
          // 数据库存储的是小数（0.05表示5%），前端表单显示百分比数值（5.00）
          share_percent: contractData.share_percent ? parseFloat(contractData.share_percent) * 100 : 0,
          start_chapter_id: contractData.start_chapter_id || null,
          end_chapter_id: contractData.end_chapter_id || null,
          start_date: contractData.start_date ? contractData.start_date.split('T')[0] : '',
          end_date: contractData.end_date ? contractData.end_date.split('T')[0] : '',
          status: contractData.status || 'active'
        });
        
        // 加载该小说的章节列表（用于下拉选择）
        // 如果合同详情中没有 novel_id，使用 selectedContract.novel_id
        const novelId = contractData.novel_id || selectedContract?.novel_id;
        if (novelId) {
          try {
            const chaptersRes = await adminApiRequest(`/admin/novels/${novelId}/chapters/simple`);
            if (chaptersRes.data.success) {
              setChapterOptions(chaptersRes.data.data || []);
            }
          } catch (error: any) {
            // 如果加载章节列表失败，不影响合同编辑，只记录错误
            console.warn('加载章节列表失败:', error);
            setChapterOptions([]);
          }
        } else {
          setChapterOptions([]);
        }
      }
    } catch (error: any) {
      if (onError) {
        onError(error.message || '加载合同详情失败');
      }
      setShowEditModal(false);
    } finally {
      setLoadingContract(false);
    }
  };

  // 保存修改
  const handleSaveEdit = async () => {
    if (!selectedContract) return;
    
    // 如果当前合同是活跃状态，且状态要改为active，检查是否有冲突
    if (selectedContract.status === 'active' && editForm.status === 'active') {
      // 活跃合同不允许修改 novel_id 和 role（已在UI中禁用，这里做双重检查）
      // 如果状态从active改为其他，需要检查是否有其他active合同
    }
    
    // 如果状态从非active改为active，需要先检查是否已有active合同
    if (selectedContract.status !== 'active' && editForm.status === 'active') {
      try {
        const { data } = await adminApiRequest(
          `/admin/editor-contracts/check-active?novel_id=${selectedContract.novel_id}&role=${selectedContract.role}`
        );
        if (data.success && data.data.hasActive) {
          alert('当前已有有效的编辑合同，请先结束旧合同');
          return;
        }
      } catch (error: any) {
        // 如果检查失败，继续保存，让后端处理
      }
    }
    
    try {
      setSaving(true);
      
      // 准备更新数据（活跃合同不允许修改 novel_id 和 role）
      const updateData: any = {
        share_type: editForm.share_type,
        share_percent: editForm.share_percent / 100, // 转换为小数（例如：5.00% -> 0.05）
        start_date: editForm.start_date ? `${editForm.start_date} 00:00:00` : null,
        end_date: editForm.end_date ? `${editForm.end_date} 00:00:00` : null,
        status: editForm.status
      };
      
      // 处理章节ID
      if (editForm.start_chapter_id) {
        updateData.start_chapter_id = editForm.start_chapter_id;
      } else {
        updateData.start_chapter_id = null;
      }
      
      if (editForm.end_chapter_id) {
        updateData.end_chapter_id = editForm.end_chapter_id;
      } else {
        updateData.end_chapter_id = null;
      }
      
      const { data } = await adminApiRequest(`/admin/editor-contracts/${selectedContract.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      
      if (data.success) {
        alert('合同修改成功');
        setShowEditModal(false);
        loadContracts();
      }
    } catch (error: any) {
      // 检查是否是活跃合同不允许修改的错误
      const errorMessage = error.message || '保存失败，请稍后重试';
      if (errorMessage.includes('活跃合同不允许修改') || errorMessage.includes('请先结束旧合同')) {
        alert(errorMessage);
      } else {
        alert(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  // 终止合同
  const handleTerminate = async (contract: Contract) => {
    if (!window.confirm(`确定要终止合同 #${contract.id} 吗？终止后将无法恢复。`)) {
      return;
    }
    
    try {
      const { data } = await adminApiRequest(`/admin/editor-contracts/${contract.id}/terminate`, {
        method: 'PATCH'
      });
      
      if (data.success) {
        alert('合同已终止');
        loadContracts();
      }
    } catch (error: any) {
      alert(error.message || '终止失败，请稍后重试');
    }
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
                    <button 
                      className={styles.editButton}
                      onClick={() => openEditModal(contract)}
                    >
                      修改
                    </button>
                    {contract.status === 'active' && (
                      <button 
                        className={styles.toggleButton}
                        onClick={() => handleTerminate(contract)}
                      >
                        终止
                      </button>
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

      {/* 修改合同弹窗 */}
      {showEditModal && selectedContract && (
        <div className={styles.modal} onClick={() => setShowEditModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>修改合同 - {selectedContract.novel_title}</h3>
            
            {loadingContract ? (
              <div className={styles.loading}>加载中...</div>
            ) : (
              <div className={styles.form}>
                <div className={styles.formGroup}>
                  <label>编辑账号：</label>
                  <input 
                    type="text" 
                    value={selectedContract.editor_name} 
                    disabled 
                    style={{ background: '#f5f5f5' }}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>角色：</label>
                  <input 
                    type="text" 
                    value={getRoleText(selectedContract.role)} 
                    disabled 
                    style={{ background: '#f5f5f5' }}
                    title={selectedContract.status === 'active' ? '活跃合同不允许修改角色，请先结束合同' : ''}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>分成类型：</label>
                  <select
                    value={editForm.share_type}
                    onChange={(e) => setEditForm(prev => ({ ...prev, share_type: e.target.value }))}
                  >
                    <option value="percent_of_book">整书分成</option>
                    <option value="percent_of_author">作者分成</option>
                  </select>
                </div>
                
                <div className={styles.formGroup}>
                  <label>分成比例（%）：</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editForm.share_percent}
                    onChange={(e) => setEditForm(prev => ({ 
                      ...prev, 
                      share_percent: parseFloat(e.target.value) || 0 
                    }))}
                    placeholder="例如：3.00 表示 3%"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>起始章节ID（可选）：</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.start_chapter_id || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditForm(prev => ({ 
                        ...prev, 
                        start_chapter_id: value === '' ? null : parseInt(value) 
                      }));
                    }}
                    placeholder="留空表示从第一章开始"
                    list="start-chapter-options"
                  />
                  <datalist id="start-chapter-options">
                    {chapterOptions.map(ch => (
                      <option
                        key={ch.id}
                        value={ch.id}
                        label={`第${ch.chapter_number}章 ${ch.title}`}
                      />
                    ))}
                  </datalist>
                </div>
                
                <div className={styles.formGroup}>
                  <label>结束章节ID（可选）：</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.end_chapter_id || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditForm(prev => ({ 
                        ...prev, 
                        end_chapter_id: value === '' ? null : parseInt(value) 
                      }));
                    }}
                    placeholder="留空表示到最后一章"
                    list="end-chapter-options"
                  />
                  <datalist id="end-chapter-options">
                    {chapterOptions.map(ch => (
                      <option
                        key={ch.id}
                        value={ch.id}
                        label={`第${ch.chapter_number}章 ${ch.title}`}
                      />
                    ))}
                  </datalist>
                </div>
                
                <div className={styles.formGroup}>
                  <label>生效日期：</label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>结束日期（可选）：</label>
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, end_date: e.target.value }))}
                    placeholder="留空表示长期有效"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>状态：</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="active">活跃</option>
                    <option value="ended">已结束</option>
                    <option value="cancelled">已取消</option>
                  </select>
                </div>
                
                <div className={styles.formActions}>
                  <button onClick={handleSaveEdit} disabled={saving} className={styles.saveButton}>
                    {saving ? '保存中...' : '保存修改'}
                  </button>
                  <button onClick={() => setShowEditModal(false)} className={styles.cancelButton}>取消</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ContractManagementTab;


/**
 * Tab3: 合同审批
 * 以 novel 表为中心，处理编辑分配和申请审批
 */

import React, { useState, useEffect } from 'react';
import styles from './AdminUserPage.module.css';

interface Novel {
  id: number;
  title: string;
  review_status: string;
  chief_editor_admin_id: number | null;
  chief_editor_name: string | null;
  current_editor_admin_id: number | null;
  editor_name: string | null;
  requires_chief_edit: number;
  author: string | null;
  created_at: string;
  active_contract_count: number;
  pending_application_count: number;
}

interface Application {
  id: number;
  novel_id: number;
  editor_admin_id: number;
  editor_name: string;
  reason: string | null;
  status: string;
  handled_by_admin_id: number | null;
  handler_name: string | null;
  handled_at: string | null;
  created_at: string;
}

interface EditorAssignmentData {
  novel: {
    id: number;
    title: string;
    chief_editor_admin_id: number | null;
    current_editor_admin_id: number | null;
  };
  chiefEditorOptions: Array<{ id: number; name: string }>;
  editorOptions: Array<{ id: number; name: string }>;
  activeContracts: Array<{
    id: number;
    role: string;
    editor_admin_id: number;
    editor_name: string;
    share_type: string;
    share_percent: number | null;
    start_date: string;
    end_date: string | null;
    status: string;
  }>;
}

interface ContractApprovalTabProps {
  onError?: (error: string) => void;
  adminApiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
}

const ContractApprovalTab: React.FC<ContractApprovalTabProps> = ({ onError, adminApiRequest }) => {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    reviewStatus: '',
    hasChiefEditor: '',
    hasEditor: '',
    hasApplication: '',
    novelKeyword: '',
    authorKeyword: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0
  });
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    current_editor_admin_id: null as number | null,
    chief_editor_admin_id: null as number | null
  });
  const [assignmentData, setAssignmentData] = useState<EditorAssignmentData | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const [saving, setSaving] = useState(false);

  // 加载小说列表
  const loadNovels = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString()
      });
      
      if (filters.reviewStatus) params.append('reviewStatus', filters.reviewStatus);
      if (filters.hasChiefEditor) params.append('hasChiefEditor', filters.hasChiefEditor);
      if (filters.hasEditor) params.append('hasEditor', filters.hasEditor);
      if (filters.hasApplication) params.append('hasApplication', filters.hasApplication);
      if (filters.novelKeyword) params.append('novelKeyword', filters.novelKeyword);
      if (filters.authorKeyword) params.append('authorKeyword', filters.authorKeyword);
      
      const { data } = await adminApiRequest(`/admin/novels-for-contract-approval?${params.toString()}`);
      
      if (data.success) {
        setNovels(data.data.list);
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


  // 加载某小说的申请列表
  const loadApplications = async (novelId: number) => {
    try {
      const { data } = await adminApiRequest(`/admin/novels/${novelId}/applications`);
      if (data.success) {
        setApplications(data.data);
      }
    } catch (error: any) {
      if (onError) {
        onError(error.message || '加载申请列表失败');
      }
    }
  };

  useEffect(() => {
    loadNovels();
  }, [pagination.page]);

  // 打开申请查看弹窗
  const openApplicationModal = async (novel: Novel) => {
    setSelectedNovel(novel);
    await loadApplications(novel.id);
    setShowApplicationModal(true);
  };

  // 打开分配编辑弹窗
  const openAssignModal = async (novel: Novel) => {
    setSelectedNovel(novel);
    setLoadingAssignment(true);
    setShowAssignModal(true);
    
    try {
      // 获取编辑分配信息
      const { data } = await adminApiRequest(`/admin/novels/${novel.id}/editor-assignment`);
      
      if (data.success) {
        setAssignmentData(data.data);
        // 设置表单初始值
        setAssignForm({
          current_editor_admin_id: data.data.novel.current_editor_admin_id,
          chief_editor_admin_id: data.data.novel.chief_editor_admin_id
        });
      }
    } catch (error: any) {
      if (onError) {
        onError(error.message || '加载编辑分配信息失败');
      }
      setShowAssignModal(false);
    } finally {
      setLoadingAssignment(false);
    }
  };

  // 审批申请
  const handleApplication = async (applicationId: number, action: 'approve' | 'reject', role: 'editor' | 'chief_editor' = 'editor') => {
    try {
      const { data } = await adminApiRequest(`/admin/editor-applications/${applicationId}/handle`, {
        method: 'POST',
        body: JSON.stringify({ action, role })
      });
      if (data.success) {
        alert(action === 'approve' ? '申请已通过' : '申请已拒绝');
        if (selectedNovel) {
          await loadApplications(selectedNovel.id);
          loadNovels();
        }
      }
    } catch (error: any) {
      alert(error.message || '操作失败');
    }
  };

  // 保存分配
  const handleSaveAssign = async () => {
    if (!selectedNovel) return;
    
    // 检查是否有变化
    if (assignmentData) {
      const noChange = 
        assignForm.chief_editor_admin_id === assignmentData.novel.chief_editor_admin_id &&
        assignForm.current_editor_admin_id === assignmentData.novel.current_editor_admin_id;
      
      if (noChange) {
        if (window.confirm('没有变化，是否关闭弹窗？')) {
          setShowAssignModal(false);
        }
        return;
      }
    }
    
    try {
      setSaving(true);
      const { data } = await adminApiRequest(`/admin/novels/${selectedNovel.id}/editor-assignment`, {
        method: 'POST',
        body: JSON.stringify({
          chief_editor_admin_id: assignForm.chief_editor_admin_id || null,
          current_editor_admin_id: assignForm.current_editor_admin_id || null
        })
      });
      
      if (data.success) {
        alert('编辑分配已更新');
        setShowAssignModal(false);
        // 刷新列表
        loadNovels();
      }
    } catch (error: any) {
      if (error.message && error.message.includes('权限')) {
        alert('没有权限，只有超级管理员可以调整编辑分配');
      } else {
        alert(error.message || '保存失败，请稍后重试');
      }
    } finally {
      setSaving(false);
    }
  };

  // 搜索
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadNovels();
  };

  // 重置
  const handleReset = () => {
    setFilters({
      reviewStatus: '',
      hasChiefEditor: '',
      hasEditor: '',
      hasApplication: '',
      novelKeyword: '',
      authorKeyword: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getReviewStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'created': '草稿',
      'submitted': '已提交',
      'reviewing': '审核中',
      'approved': '审核通过',
      'published': '已上架',
      'unlisted': '已下架',
      'archived': '已归档',
      'locked': '已锁定'
    };
    return statusMap[status] || status;
  };

  const getReviewStatusClass = (status: string) => {
    const classMap: Record<string, string> = {
      'created': styles.reviewStatusCreated,
      'submitted': styles.reviewStatusSubmitted,
      'reviewing': styles.reviewStatusReviewing,
      'approved': styles.reviewStatusApproved,
      'published': styles.reviewStatusPublished,
      'unlisted': styles.reviewStatusUnlisted,
      'archived': styles.reviewStatusArchived,
      'locked': styles.reviewStatusLocked
    };
    return classMap[status] || '';
  };

  const getApplicationStatusClass = (status: string) => {
    const classMap: Record<string, string> = {
      'pending': styles.applicationStatusPending,
      'approved': styles.applicationStatusApproved,
      'rejected': styles.applicationStatusRejected,
      'cancelled': styles.applicationStatusCancelled
    };
    return classMap[status] || '';
  };

  return (
    <>
      {/* 筛选区 */}
      <div className={styles.filters}>
        <select
          value={filters.reviewStatus}
          onChange={(e) => setFilters(prev => ({ ...prev, reviewStatus: e.target.value }))}
          className={styles.filterSelect}
        >
          <option value="">全部审核状态</option>
          <option value="created">草稿</option>
          <option value="submitted">已提交</option>
          <option value="reviewing">审核中</option>
          <option value="approved">审核通过</option>
          <option value="published">已上架</option>
          <option value="unlisted">已下架</option>
          <option value="archived">已归档</option>
          <option value="locked">已锁定</option>
        </select>
        <select
          value={filters.hasChiefEditor}
          onChange={(e) => setFilters(prev => ({ ...prev, hasChiefEditor: e.target.value }))}
          className={styles.filterSelect}
        >
          <option value="">全部</option>
          <option value="1">有主编</option>
          <option value="0">无主编</option>
        </select>
        <select
          value={filters.hasEditor}
          onChange={(e) => setFilters(prev => ({ ...prev, hasEditor: e.target.value }))}
          className={styles.filterSelect}
        >
          <option value="">全部</option>
          <option value="1">有责任编辑</option>
          <option value="0">无责任编辑</option>
        </select>
        <select
          value={filters.hasApplication}
          onChange={(e) => setFilters(prev => ({ ...prev, hasApplication: e.target.value }))}
          className={styles.filterSelect}
        >
          <option value="">全部</option>
          <option value="1">有未处理申请</option>
          <option value="0">无申请</option>
        </select>
        <input
          type="text"
          placeholder="搜索小说标题/ID"
          value={filters.novelKeyword}
          onChange={(e) => setFilters(prev => ({ ...prev, novelKeyword: e.target.value }))}
          className={styles.searchInput}
        />
        <input
          type="text"
          placeholder="搜索作者"
          value={filters.authorKeyword}
          onChange={(e) => setFilters(prev => ({ ...prev, authorKeyword: e.target.value }))}
          className={styles.searchInput}
        />
        <button onClick={handleSearch} className={styles.searchButton}>搜索</button>
        <button onClick={handleReset} className={styles.resetButton}>重置</button>
      </div>

      {/* 列表 */}
      {loading && novels.length === 0 ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th>小说</th>
                <th>审核状态</th>
                <th>当前主编</th>
                <th>当前责任编辑</th>
                <th>是否需要主编终审</th>
                <th>当前有效合同数</th>
                <th>编辑申请情况</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {novels.map((novel) => (
                <tr key={novel.id}>
                  <td>{novel.title} (#{novel.id})</td>
                  <td>
                    <span className={`${styles.statusTag} ${getReviewStatusClass(novel.review_status)}`}>
                      {getReviewStatusText(novel.review_status)}
                    </span>
                  </td>
                  <td>
                    {novel.chief_editor_name ? (
                      novel.chief_editor_name
                    ) : (
                      <span style={{ color: '#999' }}>未分配</span>
                    )}
                  </td>
                  <td>
                    {novel.editor_name ? (
                      novel.editor_name
                    ) : (
                      <span style={{ color: '#999' }}>未分配</span>
                    )}
                  </td>
                  <td>{novel.requires_chief_edit === 1 ? '是' : '否'}</td>
                  <td>{novel.active_contract_count}</td>
                  <td>
                    {novel.pending_application_count > 0 ? (
                      <span>
                        {novel.pending_application_count} 个申请{' '}
                        <button 
                          onClick={() => openApplicationModal(novel)}
                          className={styles.editButton}
                          style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '12px' }}
                        >
                          查看
                        </button>
                      </span>
                    ) : (
                      <span style={{ color: '#999' }}>暂无申请</span>
                    )}
                  </td>
                  <td>{new Date(novel.created_at).toLocaleString('zh-CN')}</td>
                  <td>
                    <button onClick={() => openAssignModal(novel)} className={styles.editButton}>
                      分配/调整编辑
                    </button>
                    <button 
                      onClick={() => openApplicationModal(novel)}
                      className={styles.editButton}
                    >
                      查看申请
                    </button>
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

      {/* 申请查看弹窗 */}
      {showApplicationModal && selectedNovel && (
        <div className={styles.modal} onClick={() => setShowApplicationModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>编辑申请 - {selectedNovel.title}</h3>
            <div className={styles.tableContainer}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>申请编辑</th>
                    <th>状态</th>
                    <th>申请时间</th>
                    <th>审批时间</th>
                    <th>审批人</th>
                    <th>申请理由</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>暂无申请记录</td>
                    </tr>
                  ) : (
                    applications.map((app) => (
                      <tr key={app.id}>
                        <td>{app.editor_name}</td>
                        <td>
                          <span className={`${styles.statusTag} ${getApplicationStatusClass(app.status)}`}>
                            {app.status === 'pending' ? '待审批' :
                             app.status === 'approved' ? '已通过' :
                             app.status === 'rejected' ? '已拒绝' : '已取消'}
                          </span>
                        </td>
                        <td>{new Date(app.created_at).toLocaleString('zh-CN')}</td>
                        <td>{app.handled_at ? new Date(app.handled_at).toLocaleString('zh-CN') : '-'}</td>
                        <td>{app.handler_name || '-'}</td>
                        <td style={{ maxWidth: '200px', wordBreak: 'break-word' }}>
                          {app.reason || '-'}
                        </td>
                        <td>
                          {app.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleApplication(app.id, 'approve', 'editor')}
                                className={styles.saveButton}
                                style={{ marginRight: '4px', padding: '4px 8px', fontSize: '12px' }}
                              >
                                通过设为责任编辑
                              </button>
                              <button 
                                onClick={() => handleApplication(app.id, 'approve', 'chief_editor')}
                                className={styles.saveButton}
                                style={{ marginRight: '4px', padding: '4px 8px', fontSize: '12px' }}
                              >
                                通过设为主编
                              </button>
                              <button 
                                onClick={() => handleApplication(app.id, 'reject')}
                                className={styles.cancelButton}
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                              >
                                拒绝
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className={styles.formActions}>
              <button onClick={() => setShowApplicationModal(false)} className={styles.cancelButton}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 分配编辑弹窗 */}
      {showAssignModal && selectedNovel && (
        <div className={styles.modal} onClick={() => setShowAssignModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>分配/调整编辑 - {selectedNovel.title}</h3>
            
            {loadingAssignment ? (
              <div className={styles.loading}>加载中...</div>
            ) : assignmentData ? (
              <div className={styles.form}>
                <div className={styles.formGroup}>
                  <label>当前主编：</label>
                  <select
                    value={assignForm.chief_editor_admin_id || ''}
                    onChange={(e) => setAssignForm(prev => ({ 
                      ...prev, 
                      chief_editor_admin_id: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                  >
                    <option value="">-- 未分配 --</option>
                    {assignmentData.chiefEditorOptions.map(editor => (
                      <option key={editor.id} value={editor.id}>{editor.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className={styles.formGroup}>
                  <label>当前责任编辑：</label>
                  <select
                    value={assignForm.current_editor_admin_id || ''}
                    onChange={(e) => setAssignForm(prev => ({ 
                      ...prev, 
                      current_editor_admin_id: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                  >
                    <option value="">-- 未分配 --</option>
                    {assignmentData.editorOptions.map(editor => (
                      <option key={editor.id} value={editor.id}>{editor.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* 当前合同信息 */}
                {assignmentData.activeContracts.length > 0 && (
                  <div className={styles.formGroup}>
                    <label style={{ marginBottom: '8px' }}>当前合同：</label>
                    <div style={{ 
                      background: '#f5f5f5', 
                      padding: '12px', 
                      borderRadius: '4px',
                      fontSize: '13px',
                      color: '#666'
                    }}>
                      {assignmentData.activeContracts
                        .filter(c => c.status === 'active')
                        .map(contract => {
                          const sharePercent = contract.share_percent 
                            ? `${(contract.share_percent * 100).toFixed(2)}%` 
                            : '0%';
                          const shareTypeText = contract.share_type === 'percent_of_book' ? '整书分成' : '作者分成';
                          const startDate = new Date(contract.start_date).toLocaleDateString('zh-CN');
                          const roleText = contract.role === 'chief_editor' ? '主编' : '编辑';
                          
                          return (
                            <div key={contract.id} style={{ marginBottom: '8px', lineHeight: '1.6' }}>
                              - {roleText}：{contract.editor_name}（{sharePercent}，{shareTypeText}），
                              状态：<span className={`${styles.statusTag} ${styles.contractStatusActive}`} style={{ padding: '2px 6px', fontSize: '12px' }}>
                                活跃
                              </span>，
                              自 {startDate} 起
                            </div>
                          );
                        })}
                      {assignmentData.activeContracts.filter(c => c.status === 'active').length === 0 && (
                        <div style={{ color: '#999' }}>暂无活跃合同</div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className={styles.formActions}>
                  <button onClick={handleSaveAssign} disabled={saving} className={styles.saveButton}>
                    {saving ? '保存中...' : '保存修改'}
                  </button>
                  <button onClick={() => setShowAssignModal(false)} className={styles.cancelButton}>取消</button>
                </div>
              </div>
            ) : (
              <div className={styles.errorMessage} style={{ padding: '20px', textAlign: 'center' }}>
                加载失败，请重试
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ContractApprovalTab;


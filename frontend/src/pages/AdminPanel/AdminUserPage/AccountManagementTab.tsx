/**
 * Tab1: 账号管理
 * 管理 admin 账号的增删改查
 */

import React, { useState, useEffect } from 'react';
import styles from './AdminUserPage.module.css';


interface AdminUser {
  id: number;
  name: string;
  role: string;
  level: number;
  status: number;
  created_at: string;
}

interface AccountManagementTabProps {
  onError?: (error: string) => void;
  adminApiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
}

const AccountManagementTab: React.FC<AccountManagementTabProps> = ({ onError, adminApiRequest }) => {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    role: '',
    status: '',
    keyword: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0
  });
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    role: 'editor',
    level: 1,
    status: 1
  });
  const [saving, setSaving] = useState(false);

  // 加载管理员列表
  const loadAdminUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });
      
      if (filters.role) params.append('role', filters.role);
      if (filters.status !== '') params.append('status', filters.status);
      if (filters.keyword) params.append('keyword', filters.keyword);
      
      const { data } = await adminApiRequest(`/admin/admin-users?${params.toString()}`);
      
      if (data.success) {
        setAdminUsers(data.data.list);
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
    loadAdminUsers();
  }, [pagination.page, filters]);

  // 打开新增/编辑弹窗
  const openModal = (user?: AdminUser) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        password: '',
        role: user.role,
        level: user.level,
        status: user.status
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        password: '',
        role: 'editor',
        level: 1,
        status: 1
      });
    }
    setShowModal(true);
  };

  // 保存管理员
  const handleSave = async () => {
    if (!formData.name.trim() || formData.name.length < 3 || formData.name.length > 32) {
      alert('用户名必填，长度3-32字符，不能包含空格');
      return;
    }
    if (!editingUser && !formData.password) {
      alert('新增时密码必填，长度至少6位');
      return;
    }
    if (formData.password && formData.password.length < 6) {
      alert('密码长度至少6位');
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        role: formData.role,
        level: formData.level,
        status: formData.status
      };

      if (editingUser) {
        if (formData.password) {
          payload.password = formData.password;
        }
        const { data } = await adminApiRequest(`/admin/admin-users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        if (data.success) {
          alert('更新成功');
          setShowModal(false);
          loadAdminUsers();
        }
      } else {
        payload.name = formData.name;
        payload.password = formData.password;
        const { data } = await adminApiRequest('/admin/admin-users', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (data.success) {
          alert('创建成功');
          setShowModal(false);
          loadAdminUsers();
        }
      }
    } catch (error: any) {
      alert(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 切换启用/禁用
  const handleToggleStatus = async (user: AdminUser) => {
    const newStatus = user.status === 1 ? 0 : 1;
    const confirmMsg = newStatus === 0 
      ? '确定要禁用该管理员吗？禁用后将无法登录后台。'
      : '确定要启用该管理员吗？';
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      const { data } = await adminApiRequest(`/admin/admin-users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (data.success) {
        loadAdminUsers();
      }
    } catch (error: any) {
      alert(error.message || '操作失败');
    }
  };

  // 搜索
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadAdminUsers();
  };

  // 重置
  const handleReset = () => {
    setFilters({ role: '', status: '', keyword: '' });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getRoleText = (role: string) => {
    const roleMap: Record<string, string> = {
      'super_admin': '超级管理员',
      'chief_editor': '主编',
      'editor': '编辑',
      'finance': '财务',
      'operator': '运营'
    };
    return roleMap[role] || role;
  };

  const getRoleClass = (role: string) => {
    const classMap: Record<string, string> = {
      'super_admin': styles.roleSuperAdmin,
      'chief_editor': styles.roleChiefEditor,
      'editor': styles.roleEditor,
      'finance': styles.roleFinance,
      'operator': styles.roleOperator
    };
    return classMap[role] || '';
  };

  return (
    <>
      <div className={styles.header}>
        <h2>编辑管理</h2>
        <button className={styles.addButton} onClick={() => openModal()}>
          新增编辑账号
        </button>
      </div>

      {/* 筛选区 */}
      <div className={styles.filters}>
        <select
          value={filters.role}
          onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
          className={styles.filterSelect}
        >
          <option value="">全部角色</option>
          <option value="super_admin">super_admin</option>
          <option value="chief_editor">chief_editor</option>
          <option value="editor">editor</option>
          <option value="finance">finance</option>
          <option value="operator">operator</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          className={styles.filterSelect}
        >
          <option value="">全部状态</option>
          <option value="1">启用</option>
          <option value="0">禁用</option>
        </select>

        <input
          type="text"
          placeholder="搜索用户名"
          value={filters.keyword}
          onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
          className={styles.searchInput}
        />

        <button onClick={handleSearch} className={styles.searchButton}>搜索</button>
        <button onClick={handleReset} className={styles.resetButton}>重置</button>
      </div>

      {/* 列表 */}
      {loading && adminUsers.length === 0 ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>角色</th>
                <th>等级</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>
                    <span className={`${styles.roleTag} ${getRoleClass(user.role)}`}>
                      {getRoleText(user.role)}
                    </span>
                  </td>
                  <td>{user.level}</td>
                  <td>
                    <span className={`${styles.statusTag} ${user.status === 1 ? styles.statusEnabled : styles.statusDisabled}`}>
                      {user.status === 1 ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleString('zh-CN')}</td>
                  <td>
                    <button onClick={() => openModal(user)} className={styles.editButton}>编辑</button>
                    <button 
                      onClick={() => handleToggleStatus(user)} 
                      className={styles.toggleButton}
                    >
                      {user.status === 1 ? '禁用' : '启用'}
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

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <div className={styles.modal} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>{editingUser ? '编辑管理员' : '新增管理员'}</h3>
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label>用户名：</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!!editingUser}
                  className={editingUser ? styles.disabledInput : ''}
                />
                {editingUser && <span className={styles.hint}>（编辑时不可修改）</span>}
              </div>

              <div className={styles.formGroup}>
                <label>密码：</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={editingUser ? '留空则不修改密码' : ''}
                />
              </div>

              <div className={styles.formGroup}>
                <label>角色：</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="super_admin">super_admin</option>
                  <option value="chief_editor">chief_editor</option>
                  <option value="editor">editor</option>
                  <option value="finance">finance</option>
                  <option value="operator">operator</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>等级：</label>
                <input
                  type="number"
                  value={formData.level}
                  onChange={(e) => setFormData(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))}
                />
              </div>

              <div className={styles.formGroup}>
                <label>状态：</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: parseInt(e.target.value) }))}
                >
                  <option value="1">启用</option>
                  <option value="0">禁用</option>
                </select>
              </div>

              <div className={styles.formActions}>
                <button onClick={handleSave} disabled={saving} className={styles.saveButton}>
                  {saving ? '保存中...' : '保存'}
                </button>
                <button onClick={() => setShowModal(false)} className={styles.cancelButton}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AccountManagementTab;


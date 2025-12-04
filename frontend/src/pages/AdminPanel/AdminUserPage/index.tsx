import React, { useState } from 'react';
import styles from './AdminUserPage.module.css';
import AccountManagementTab from './AccountManagementTab';
import ContractManagementTab from './ContractManagementTab';
import ContractApprovalTab from './ContractApprovalTab';
import PermissionManagementTab from './PermissionManagementTab';

interface AdminUserPageProps {
  onError?: (error: string) => void;
  currentAdminRole?: string;
  adminToken?: string | null;
}

type AdminUserSubTab = 'account' | 'contract' | 'approval' | 'permission';

const AdminUserPage: React.FC<AdminUserPageProps> = ({ onError, currentAdminRole, adminToken }) => {
  const [noPermission, setNoPermission] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminUserSubTab>('account');

  // API 请求函数
  const adminApiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('adminToken');
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };
    
    if (!(options.body instanceof FormData) && !options.headers) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(`http://localhost:5000/api${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 403) {
      const data = await response.json();
      if (data.message && data.message.includes('权限')) {
        setNoPermission(true);
      }
      if (onError) {
        onError('没有权限访问编辑管理，请使用超级管理员账号登录。');
      }
      throw new Error('没有权限');
    }

    const data = await response.json();

    // 如果响应不成功，抛出错误（让调用方处理）
    if (!response.ok) {
      const error = new Error(data.message || `请求失败: ${response.status}`);
      (error as any).response = response;
      (error as any).data = data;
      throw error;
    }

    if (!data.success && data.message && 
        (data.message.includes('Token') || data.message.includes('token') || 
         data.message.includes('登录') || data.message.includes('无效') || 
         data.message.includes('过期'))) {
      if (onError) {
        onError('Token无效或已过期，请重新登录');
      }
      throw new Error(data.message || 'Token无效或已过期');
    }

    return { response, data };
  }


  if (noPermission) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.errorMessage}>
          <p>没有权限访问编辑管理，请使用超级管理员账号登录。</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.header}>
        <h2>编辑管理</h2>
      </div>

      {/* Tab 切换 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'account' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('account')}
        >
          账号管理
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'contract' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('contract')}
        >
          合同管理
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'approval' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('approval')}
        >
          合同审批
        </button>
        {currentAdminRole === 'super_admin' && (
          <button
            className={`${styles.tab} ${activeTab === 'permission' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('permission')}
          >
            账号权限管理
          </button>
        )}
      </div>

      {/* Tab 内容 */}
      <div className={styles.tabPanel}>
        {activeTab === 'account' && (
          <AccountManagementTab 
            onError={onError} 
            adminApiRequest={adminApiRequest}
          />
        )}
        {activeTab === 'contract' && (
          <ContractManagementTab 
            onError={onError} 
            adminApiRequest={adminApiRequest}
          />
        )}
        {activeTab === 'approval' && (
          <ContractApprovalTab 
            onError={onError} 
            adminApiRequest={adminApiRequest}
          />
        )}
        {activeTab === 'permission' && currentAdminRole === 'super_admin' && (
          <PermissionManagementTab
            adminToken={adminToken}
            onError={onError}
          />
        )}
      </div>

    </div>
  );
};

export default AdminUserPage;


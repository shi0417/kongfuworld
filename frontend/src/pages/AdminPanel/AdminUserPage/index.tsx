import React, { useState } from 'react';
import styles from './AdminUserPage.module.css';
import AccountManagementTab from './AccountManagementTab';
import ContractManagementTab from './ContractManagementTab';
import ContractApprovalTab from './ContractApprovalTab';
import PermissionManagementTab from './PermissionManagementTab';
import ApiService from '../../../services/ApiService';

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
    
    const result = await ApiService.request(endpoint, {
      ...options,
      headers
    });

    if (result.status === 403) {
      if (result.message && result.message.includes('权限')) {
        setNoPermission(true);
      }
      if (onError) {
        onError('没有权限访问编辑管理，请使用超级管理员账号登录。');
      }
      throw new Error('没有权限');
    }

    // 如果响应不成功，抛出错误（让调用方处理）
    if (!result.success) {
      const error = new Error(result.message || `请求失败: ${result.status || 500}`);
      (error as any).response = { status: result.status };
      (error as any).data = result;
      throw error;
    }

    if (!result.success && result.message && 
        (result.message.includes('Token') || result.message.includes('token') || 
         result.message.includes('登录') || result.message.includes('无效') || 
         result.message.includes('过期'))) {
      if (onError) {
        onError('Token无效或已过期，请重新登录');
      }
      throw new Error(result.message || 'Token无效或已过期');
    }

    return result;
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


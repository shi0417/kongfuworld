import React, { useState, useEffect } from 'react';
import styles from './EditorManagement.module.css';

interface Editor {
  id: number;
  name: string;
  role: string;
  status: number;
}

interface EditorManagementProps {
  onError?: (error: string) => void;
}

const EditorManagement: React.FC<EditorManagementProps> = ({ onError }) => {
  const [editors, setEditors] = useState<Editor[]>([]);
  const [loading, setLoading] = useState(false);

  // 通用的管理员 API 请求函数
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
      if (onError) {
        onError('Token无效或已过期，请重新登录');
      }
      throw new Error('Token无效或已过期');
    }

    const data = await response.json();

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
  };

  // 加载编辑列表
  const loadEditors = async () => {
    try {
      setLoading(true);
      const { data } = await adminApiRequest('/admin/list-editors');
      
      if (data.success) {
        setEditors(data.data || []);
        if (onError) {
          onError('');
        }
      } else {
        if (onError) {
          onError(data.message || '加载失败');
        }
      }
    } catch (err: any) {
      if (!err.message || !err.message.includes('Token')) {
        if (onError) {
          onError(err.message || '加载失败');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEditors();
  }, []);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>编辑管理</h2>
      </div>

      {loading && editors.length === 0 ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <div className={styles.editorList}>
          <table className={styles.editorTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>角色</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {editors.map((editor) => (
                <tr key={editor.id}>
                  <td>{editor.id}</td>
                  <td>{editor.name}</td>
                  <td>
                    <span className={styles.roleBadge}>{editor.role === 'editor' ? '编辑' : editor.role}</span>
                  </td>
                  <td>
                    <span className={editor.status === 1 ? styles.statusEnabled : styles.statusDisabled}>
                      {editor.status === 1 ? '启用' : '禁用'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

export default EditorManagement;


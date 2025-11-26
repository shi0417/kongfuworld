import React, { useState, useEffect } from 'react';
import styles from './EditorManagement.module.css';

interface Editor {
  id: number;
  name: string;
  display_name: string;
  role: string;
  status: number;
  supervisor_admin_id: number | null;
  supervisor: {
    id: number;
    name: string;
    display_name: string;
  } | null;
}

interface ChiefEditor {
  id: number;
  name: string;
  display_name: string;
  role: string;
  status: number;
}

interface EditorManagementProps {
  onError?: (error: string) => void;
}

const EditorManagement: React.FC<EditorManagementProps> = ({ onError }) => {
  const [editors, setEditors] = useState<Editor[]>([]);
  const [chiefEditors, setChiefEditors] = useState<ChiefEditor[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEditor, setEditingEditor] = useState<Editor | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

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

  // 加载主编列表
  const loadChiefEditors = async () => {
    try {
      const { data } = await adminApiRequest('/admin/list-chief-editors');
      
      if (data.success) {
        setChiefEditors(data.data || []);
      } else {
        if (onError) {
          onError(data.message || '加载主编列表失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载主编列表失败');
      }
    }
  };

  useEffect(() => {
    loadEditors();
    loadChiefEditors();
  }, []);

  // 打开编辑分配模态框
  const openAssignModal = (editor: Editor) => {
    setEditingEditor(editor);
    setSelectedSupervisorId(editor.supervisor_admin_id);
  };

  // 保存分配
  const saveAssignment = async () => {
    if (!editingEditor) return;

    try {
      setSaving(true);
      const { data } = await adminApiRequest(`/admin/editors/${editingEditor.id}/supervisor`, {
        method: 'PUT',
        body: JSON.stringify({ supervisor_admin_id: selectedSupervisorId })
      });

      if (data.success) {
        if (onError) {
          onError('');
        }
        setEditingEditor(null);
        setSelectedSupervisorId(null);
        loadEditors();
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
                <th>显示名称</th>
                <th>角色</th>
                <th>上级主编</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {editors.map((editor) => (
                <tr key={editor.id}>
                  <td>{editor.id}</td>
                  <td>{editor.name}</td>
                  <td>{editor.display_name}</td>
                  <td>
                    <span className={styles.roleBadge}>{editor.role === 'editor' ? '编辑' : editor.role}</span>
                  </td>
                  <td>
                    {editor.supervisor ? (
                      <span className={styles.supervisorName}>
                        {editor.supervisor.display_name} ({editor.supervisor.name})
                      </span>
                    ) : (
                      <span className={styles.noSupervisor}>未分配</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => openAssignModal(editor)}
                      className={styles.assignButton}
                    >
                      分配主编
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分配主编模态框 */}
      {editingEditor && (
        <div className={styles.modal} onClick={() => setEditingEditor(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>分配主编 - {editingEditor.display_name}</h3>
              <button onClick={() => setEditingEditor(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>当前主编：</label>
                <span className={styles.currentSupervisor}>
                  {editingEditor.supervisor 
                    ? `${editingEditor.supervisor.display_name} (${editingEditor.supervisor.name})`
                    : '未分配'}
                </span>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="supervisorSelect">选择主编：</label>
                <select
                  id="supervisorSelect"
                  value={selectedSupervisorId || ''}
                  onChange={(e) => setSelectedSupervisorId(e.target.value ? parseInt(e.target.value) : null)}
                  className={styles.select}
                >
                  <option value="">-- 未分配 --</option>
                  {chiefEditors.map((chief) => (
                    <option key={chief.id} value={chief.id}>
                      {chief.display_name} ({chief.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={() => setEditingEditor(null)}
                className={styles.cancelButton}
                disabled={saving}
              >
                取消
              </button>
              <button
                onClick={saveAssignment}
                className={styles.saveButton}
                disabled={saving || selectedSupervisorId === editingEditor.supervisor_admin_id}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 主编列表 */}
      <div className={styles.chiefEditorSection}>
        <h3>主编列表</h3>
        <div className={styles.chiefEditorList}>
          {chiefEditors.map((chief) => (
            <div key={chief.id} className={styles.chiefEditorCard}>
              <div className={styles.chiefEditorInfo}>
                <span className={styles.chiefEditorName}>{chief.display_name}</span>
                <span className={styles.chiefEditorUsername}>({chief.name})</span>
              </div>
              <div className={styles.chiefEditorStats}>
                <span>
                  管理编辑数: {editors.filter(e => e.supervisor_admin_id === chief.id).length}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EditorManagement;


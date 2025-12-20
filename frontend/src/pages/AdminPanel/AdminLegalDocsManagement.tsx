import React, { useEffect, useMemo, useState } from 'react';
import ApiService from '../../services/ApiService';
import styles from '../AdminPanel.module.css';
import localStyles from './AdminLegalDocsManagement.module.css';

type Props = {
  onError?: (msg: string) => void;
};

type LegalDocRow = {
  id: number;
  doc_key: string;
  language: string;
  title: string;
  version: string;
  content_md: string;
  status: 'draft' | 'published' | 'archived';
  is_current: number;
  effective_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: string;
  updated_at?: string;
};

const toMysqlDatetime = (value: string | null | undefined) => {
  if (!value) return null;
  // datetime-local: YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value.replace('T', ' ') + ':00';
  return value;
};

const toDatetimeLocal = (value: string | null | undefined) => {
  if (!value) return '';
  const s = String(value);
  // "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) return s.replace(' ', 'T').slice(0, 16);
  // ISO -> keep local part
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  return '';
};

const previewText = (content: string) => {
  const s = (content || '').replace(/\s+/g, ' ').trim();
  if (s.length <= 120) return s;
  return s.slice(0, 120) + '...';
};

const DOC_KEY_OPTIONS = [
  { value: 'terms_of_service', label: 'Terms of Service' },
  { value: 'privacy_policy', label: 'Privacy Policy' },
  { value: 'cookie_policy', label: 'Cookie Policy' },
  { value: 'writer_contract_policy', label: 'Writer Contract Policy' }
];

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' }
];

export default function AdminLegalDocsManagement({ onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LegalDocRow[]>([]);
  const [toast, setToast] = useState<string>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LegalDocRow | null>(null);
  const [formError, setFormError] = useState<string>('');

  const [filters, setFilters] = useState({
    doc_key: '',
    language: 'en',
    status: ''
  });

  const [form, setForm] = useState({
    doc_key: 'terms_of_service',
    language: 'en',
    title: '',
    version: '',
    content_md: '',
    effective_at: '',
    status: 'draft' as 'draft' | 'published' | 'archived'
  });

  const loadDocs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.doc_key) params.append('doc_key', filters.doc_key);
      if (filters.language) params.append('language', filters.language);
      if (filters.status) params.append('status', filters.status);
      
      const query = params.toString();
      const res = await ApiService.get(`/admin/legal-docs${query ? '?' + query : ''}`);
      const list = (res as any)?.data || [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e: any) {
      const msg = e?.message || '加载政策文档列表失败';
      onError?.(msg);
      setToast(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setForm({
      doc_key: 'terms_of_service',
      language: 'en',
      title: '',
      version: '',
      content_md: '',
      effective_at: '',
      status: 'draft'
    });
    setModalOpen(true);
  };

  const openEdit = (row: LegalDocRow) => {
    setEditing(row);
    setFormError('');
    setForm({
      doc_key: row.doc_key,
      language: row.language,
      title: row.title,
      version: row.version,
      content_md: row.content_md,
      effective_at: toDatetimeLocal(row.effective_at),
      status: row.status
    });
    setModalOpen(true);
  };

  const submit = async () => {
    try {
      setFormError('');
      
      // 校验必填字段
      if (!form.title.trim()) {
        setFormError('title 不能为空');
        return;
      }
      if (!form.version.trim()) {
        setFormError('version 不能为空');
        return;
      }
      if (!form.content_md.trim()) {
        setFormError('content_md 不能为空');
        return;
      }
      if (!form.doc_key) {
        setFormError('doc_key 不能为空');
        return;
      }
      if (!form.language) {
        setFormError('language 不能为空');
        return;
      }

      setLoading(true);

      if (editing) {
        // 更新
        await ApiService.request(`/admin/legal-docs/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: form.title.trim(),
            version: form.version.trim(),
            content_md: form.content_md.trim(),
            language: form.language,
            effective_at: toMysqlDatetime(form.effective_at),
            status: form.status
          })
        });
        setToast('更新成功');
      } else {
        // 创建
        await ApiService.request('/admin/legal-docs', {
          method: 'POST',
          body: JSON.stringify({
            doc_key: form.doc_key,
            language: form.language,
            title: form.title.trim(),
            version: form.version.trim(),
            content_md: form.content_md.trim(),
            effective_at: toMysqlDatetime(form.effective_at)
          })
        });
        setToast('创建成功');
      }

      setModalOpen(false);
      await loadDocs();
    } catch (e: any) {
      const m = e?.message || (editing ? '更新失败' : '创建失败');
      setFormError(m);
      onError?.(m);
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrent = async (row: LegalDocRow) => {
    if (!window.confirm(`确定要将此版本设为当前生效版本吗？`)) return;
    
    try {
      setLoading(true);
      await ApiService.request(`/admin/legal-docs/${row.id}/set-current`, {
        method: 'POST'
      });
      setToast('设置成功');
      await loadDocs();
    } catch (e: any) {
      const m = e?.message || '设置失败';
      setToast(m);
      onError?.(m);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (row: LegalDocRow) => {
    if (!window.confirm(`确定要删除此文档吗？`)) return;
    
    try {
      setLoading(true);
      await ApiService.request(`/admin/legal-docs/${row.id}`, {
        method: 'DELETE'
      });
      setToast('删除成功');
      await loadDocs();
    } catch (e: any) {
      const m = e?.message || '删除失败';
      setToast(m);
      onError?.(m);
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    return rows;
  }, [rows]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <div>
          <h2>站点政策管理</h2>
          <span className={localStyles.tableName}>表名: site_legal_documents</span>
        </div>
        <button className={styles.addButton} onClick={openCreate} disabled={loading}>
          + 新建版本
        </button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {/* 筛选区域 */}
      <div className={localStyles.filters}>
        <div className={localStyles.filterGroup}>
          <label>文档类型：</label>
          <select
            value={filters.doc_key}
            onChange={(e) => setFilters({ ...filters, doc_key: e.target.value })}
          >
            <option value="">全部</option>
            {DOC_KEY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className={localStyles.filterGroup}>
          <label>语言：</label>
          <select
            value={filters.language}
            onChange={(e) => setFilters({ ...filters, language: e.target.value })}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>
        <div className={localStyles.filterGroup}>
          <label>状态：</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全部</option>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 150 }}>文档类型</th>
              <th style={{ width: 80 }}>语言</th>
              <th style={{ width: 200 }}>标题</th>
              <th style={{ width: 100 }}>版本</th>
              <th>内容预览</th>
              <th style={{ width: 100 }}>状态</th>
              <th style={{ width: 80 }}>当前</th>
              <th style={{ width: 150 }}>生效时间</th>
              <th style={{ width: 150 }}>更新时间</th>
              <th style={{ width: 200 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id}>
                <td>
                  {DOC_KEY_OPTIONS.find(opt => opt.value === r.doc_key)?.label || r.doc_key}
                </td>
                <td>{r.language}</td>
                <td className={localStyles.titleCell}>
                  <div className={localStyles.title}>{r.title}</div>
                  <div className={localStyles.sub}>ID: {r.id}</div>
                </td>
                <td>{r.version}</td>
                <td className={localStyles.previewCell} title={r.content_md || ''}>
                  {previewText(r.content_md || '') || '-'}
                </td>
                <td>
                  <span className={localStyles.statusBadge} data-status={r.status}>
                    {STATUS_OPTIONS.find(opt => opt.value === r.status)?.label || r.status}
                  </span>
                </td>
                <td>
                  {r.is_current === 1 ? (
                    <span className={localStyles.currentBadge}>✓ 当前</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className={localStyles.timeCell}>
                  {r.effective_at ? new Date(r.effective_at).toLocaleString('zh-CN') : '-'}
                </td>
                <td className={localStyles.timeCell}>
                  {r.updated_at ? new Date(r.updated_at).toLocaleString('zh-CN') : '-'}
                </td>
                <td>
                  <div className={localStyles.actionButtons}>
                    {r.status === 'published' && r.is_current === 0 && (
                      <button 
                        className={styles.editButton} 
                        onClick={() => handleSetCurrent(r)} 
                        disabled={loading}
                        title="设为当前生效版本"
                      >
                        设为当前
                      </button>
                    )}
                    <button 
                      className={styles.editButton} 
                      onClick={() => openEdit(r)} 
                      disabled={loading}
                    >
                      编辑
                    </button>
                    {r.status === 'draft' && (
                      <button 
                        className={styles.deleteButton} 
                        onClick={() => remove(r)} 
                        disabled={loading}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                  暂无政策文档
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className={styles.modal} onClick={() => setModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editing ? '编辑政策文档' : '新建政策文档版本'}</h3>
              <button className={styles.closeButton} onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              {formError && <div className={styles.errorMessage}>{formError}</div>}

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>doc_key（必填）</label>
                  <select
                    value={form.doc_key}
                    onChange={(e) => setForm({ ...form, doc_key: e.target.value })}
                    disabled={!!editing}
                  >
                    {DOC_KEY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>language（必填）</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    disabled={!!editing}
                  >
                    <option value="en">English</option>
                    <option value="zh">中文</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>title（必填）</label>
                <input 
                  value={form.title} 
                  onChange={(e) => setForm({ ...form, title: e.target.value })} 
                  placeholder="文档标题"
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>version（必填）</label>
                  <input 
                    value={form.version} 
                    onChange={(e) => setForm({ ...form, version: e.target.value })} 
                    placeholder="例如：1.0.0"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>effective_at</label>
                <input
                  type="datetime-local"
                  value={form.effective_at}
                  onChange={(e) => setForm({ ...form, effective_at: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>content_md（必填）</label>
                <textarea
                  className={localStyles.textarea}
                  value={form.content_md}
                  onChange={(e) => setForm({ ...form, content_md: e.target.value })}
                  rows={12}
                  placeholder="Markdown 格式内容"
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelButton} onClick={() => setModalOpen(false)} disabled={loading}>
                取消
              </button>
              <button className={styles.saveButton} onClick={submit} disabled={loading}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


import React, { useEffect, useMemo, useState } from 'react';
import ApiService from '../../services/ApiService';
import styles from '../AdminPanel.module.css';
import localStyles from './AdminAnnouncementManagement.module.css';

type Props = {
  onError?: (msg: string) => void;
};

type AnnouncementRow = {
  id: number;
  title: string;
  content: string;
  content_format: 'markdown' | 'html';
  link_url?: string | null;
  display_order: number;
  is_active: number;
  start_date?: string | null;
  end_date?: string | null;
  target_audience?: 'reader' | 'writer';
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

export default function AdminAnnouncementManagement({ onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [toast, setToast] = useState<string>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [formError, setFormError] = useState<string>('');

  const [form, setForm] = useState({
    title: '',
    content_format: 'markdown' as 'markdown' | 'html',
    content: '',
    link_url: '',
    display_order: '0',
    is_active: true,
    start_date: '',
    end_date: '',
    target_audience: 'reader' as 'reader' | 'writer'
  });

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await ApiService.get('/admin/homepage-announcements');
      const list = (res as any)?.data || [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e: any) {
      const msg = e?.message || '加载公告列表失败';
      onError?.(msg);
      setToast(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setForm({
      title: '',
      content_format: 'markdown',
      content: '',
      link_url: '',
      display_order: '0',
      is_active: true,
      start_date: '',
      end_date: '',
      target_audience: 'reader'
    });
    setModalOpen(true);
  };

  const openEdit = (row: AnnouncementRow) => {
    setEditing(row);
    setFormError('');
    setForm({
      title: row.title || '',
      content_format: row.content_format || 'markdown',
      content: row.content || '',
      link_url: row.link_url || '',
      display_order: String(row.display_order ?? 0),
      is_active: row.is_active === 1,
      start_date: toDatetimeLocal(row.start_date),
      end_date: toDatetimeLocal(row.end_date),
      target_audience: row.target_audience || 'reader'
    });
    setModalOpen(true);
  };

  const validateForm = () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title) return 'title 必填';
    if (!content) return 'content 必填';
    if (form.content_format !== 'markdown' && form.content_format !== 'html') return 'content_format 只能为 markdown/html';
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date);
      const end = new Date(form.end_date);
      if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start.getTime() > end.getTime()) {
        return 'start_date 不能大于 end_date';
      }
    }
    return '';
  };

  const submit = async () => {
    const msg = validateForm();
    if (msg) {
      setFormError(msg);
      return;
    }
    setFormError('');
    try {
      setLoading(true);
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        content_format: form.content_format,
        link_url: form.link_url.trim() ? form.link_url.trim() : null,
        display_order: Number.isFinite(Number(form.display_order)) ? Number(form.display_order) : 0,
        is_active: form.is_active ? 1 : 0,
        start_date: toMysqlDatetime(form.start_date),
        end_date: toMysqlDatetime(form.end_date),
        target_audience: form.target_audience
      };

      if (editing) {
        await ApiService.put(`/admin/homepage-announcements/${editing.id}`, payload);
        setToast('更新成功');
      } else {
        await ApiService.post('/admin/homepage-announcements', payload);
        setToast('创建成功');
      }
      setModalOpen(false);
      await loadAnnouncements();
    } catch (e: any) {
      const m = e?.message || '保存失败';
      setFormError(m);
      onError?.(m);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (row: AnnouncementRow) => {
    try {
      setLoading(true);
      await ApiService.put(`/admin/homepage-announcements/${row.id}`, { is_active: row.is_active === 1 ? 0 : 1 });
      await loadAnnouncements();
    } catch (e: any) {
      const m = e?.message || '更新启用状态失败';
      setToast(m);
      onError?.(m);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (row: AnnouncementRow) => {
    const ok = window.confirm(`确定删除公告「${row.title}」吗？此操作不可恢复。`);
    if (!ok) return;
    try {
      setLoading(true);
      await ApiService.delete(`/admin/homepage-announcements/${row.id}`);
      setToast('删除成功');
      await loadAnnouncements();
    } catch (e: any) {
      const m = e?.message || '删除失败';
      setToast(m);
      onError?.(m);
    } finally {
      setLoading(false);
    }
  };

  const sortedRows = useMemo(() => {
    // 后端已排序，这里只兜底稳定排序
    return [...rows].sort((a, b) => (a.display_order - b.display_order) || (b.id - a.id));
  }, [rows]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>公告管理</h2>
        <button className={styles.addButton} onClick={openCreate} disabled={loading}>
          + 新建公告
        </button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 220 }}>标题</th>
              <th>内容预览</th>
              <th style={{ width: 110 }}>格式</th>
              <th style={{ width: 100 }}>受众</th>
              <th style={{ width: 220 }}>跳转链接</th>
              <th style={{ width: 220 }}>展示时间窗</th>
              <th style={{ width: 90 }}>顺序</th>
              <th style={{ width: 90 }}>启用</th>
              <th style={{ width: 160 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr 
                key={r.id}
                className={localStyles.tableRow}
                data-audience={r.target_audience || 'reader'}
              >
                <td className={localStyles.titleCell}>
                  <div className={localStyles.title}>{r.title}</div>
                  <div className={localStyles.sub}>ID: {r.id}</div>
                </td>
                <td className={localStyles.previewCell} title={r.content || ''}>
                  {previewText(r.content || '') || '-'}
                </td>
                <td>{r.content_format || 'markdown'}</td>
                <td>
                  <span className={localStyles.audienceBadge} data-audience={r.target_audience || 'reader'}>
                    {r.target_audience === 'writer' ? '作者端' : '读者端'}
                  </span>
                </td>
                <td className={localStyles.linkCell}>
                  {r.link_url ? (
                    <a href={r.link_url} target="_blank" rel="noreferrer" className={localStyles.link}>
                      {r.link_url}
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td className={localStyles.timeCell}>
                  <div>{r.start_date ? new Date(r.start_date).toLocaleString('zh-CN') : '-'}</div>
                  <div>{r.end_date ? new Date(r.end_date).toLocaleString('zh-CN') : '-'}</div>
                </td>
                <td>{r.display_order ?? 0}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={r.is_active === 1}
                    disabled={loading}
                    onChange={() => toggleActive(r)}
                    title="切换启用状态"
                  />
                </td>
                <td>
                  <button className={styles.editButton} onClick={() => openEdit(r)} disabled={loading}>
                    编辑
                  </button>
                  <button className={styles.deleteButton} onClick={() => remove(r)} disabled={loading}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                  暂无公告
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
              <h3>{editing ? '编辑公告' : '新建公告'}</h3>
              <button className={styles.closeButton} onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              {formError && <div className={styles.errorMessage}>{formError}</div>}

              <div className={styles.formGroup}>
                <label>title（必填）</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>content_format</label>
                  <select
                    value={form.content_format}
                    onChange={(e) => setForm({ ...form, content_format: e.target.value as any })}
                  >
                    <option value="markdown">markdown</option>
                    <option value="html">html</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>target_audience（受众）</label>
                  <select
                    value={form.target_audience}
                    onChange={(e) => setForm({ ...form, target_audience: e.target.value as 'reader' | 'writer' })}
                  >
                    <option value="reader">读者端</option>
                    <option value="writer">作者端</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>content（必填）</label>
                <textarea
                  className={localStyles.textarea}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={8}
                  placeholder="支持 markdown / html（由 content_format 决定）"
                />
              </div>

              <div className={styles.formGroup}>
                <label>link_url</label>
                <input
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="例如 /book/7 或 https://..."
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>display_order</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup} style={{ alignSelf: 'end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    启用
                  </label>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>start_date</label>
                  <input
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>end_date</label>
                  <input
                    type="datetime-local"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
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



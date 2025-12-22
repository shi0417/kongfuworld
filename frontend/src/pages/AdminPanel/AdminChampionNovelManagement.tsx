import React, { useEffect, useMemo, useState } from 'react';
import ApiService from '../../services/ApiService';
import { API_BASE_URL } from '../../config';
import styles from '../AdminPanel.module.css';

type Props = {
  onError?: (msg: string) => void;
};

type FeaturedRow = {
  id: number;
  novel_id: number;
  novel_title?: string | null;
  novel_cover?: string | null;
  novel_author?: string | null;
  section_type: string;
  display_order: number;
  is_active: number;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  updated_at?: string;
};

type NovelSearchItem = {
  id: number;
  title: string;
  author?: string | null;
  status?: string | null;
  review_status?: string | null;
};

const SECTION_TYPE = 'recommended';

const toMysqlDatetimeNullable = (value: string | null | undefined) => {
  if (!value) return null;
  // datetime-local: YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value.replace('T', ' ') + ':00';
  return value;
};

const normalizeImageUrl = (url: string | null | undefined) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
};

export default function AdminChampionNovelManagement({ onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FeaturedRow[]>([]);
  const [toast, setToast] = useState<string>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeaturedRow | null>(null);
  const [formError, setFormError] = useState<string>('');

  const [form, setForm] = useState({
    novel_id: '' as string,
    display_order: '0',
    is_active: true,
    start_date: '',
    end_date: ''
  });

  const [novelQuery, setNovelQuery] = useState('');
  const [novelOptions, setNovelOptions] = useState<NovelSearchItem[]>([]);
  const [novelSearching, setNovelSearching] = useState(false);

  const selectedNovelTitle = useMemo(() => {
    const id = Number(form.novel_id);
    if (!Number.isFinite(id) || id <= 0) return '';
    const found = novelOptions.find((n) => n.id === id);
    return found?.title || '';
  }, [form.novel_id, novelOptions]);

  const loadList = async () => {
    try {
      setLoading(true);
      const res = await ApiService.get(`/admin/homepage/featured-novels?section_type=${encodeURIComponent(SECTION_TYPE)}`);
      const list = (res as any)?.data || [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e: any) {
      const msg = e?.message || '加载 Champion 推荐小说列表失败';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // modal 打开时默认拉一批 published 小说用于下拉
  useEffect(() => {
    if (!modalOpen) return;
    (async () => {
      try {
        setNovelSearching(true);
        const res = await ApiService.get(`/admin/novels/search?publishedOnly=1&q=`);
        const list = (res as any)?.data || [];
        setNovelOptions(Array.isArray(list) ? list : []);
      } catch {
        setNovelOptions([]);
      } finally {
        setNovelSearching(false);
      }
    })();
  }, [modalOpen]);

  // 输入停顿 350ms 才发请求
  useEffect(() => {
    let timer: any = null;
    const q = novelQuery.trim();
    if (!q) {
      setNovelOptions([]);
      return;
    }
    timer = setTimeout(async () => {
      try {
        setNovelSearching(true);
        const res = await ApiService.get(`/admin/novels/search?q=${encodeURIComponent(q)}&publishedOnly=1`);
        const list = (res as any)?.data || [];
        setNovelOptions(Array.isArray(list) ? list : []);
      } catch {
        setNovelOptions([]);
      } finally {
        setNovelSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [novelQuery]);

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setNovelQuery('');
    setNovelOptions([]);
    setForm({
      novel_id: '',
      display_order: '0',
      is_active: true,
      start_date: '',
      end_date: ''
    });
    setModalOpen(true);
  };

  const openEdit = (row: FeaturedRow) => {
    setEditing(row);
    setFormError('');
    setNovelQuery('');
    setNovelOptions([]);
    setForm({
      novel_id: row.novel_id ? String(row.novel_id) : '',
      display_order: String(row.display_order ?? 0),
      is_active: (row.is_active ?? 1) === 1,
      start_date: row.start_date ? String(row.start_date).slice(0, 16).replace(' ', 'T') : '',
      end_date: row.end_date ? String(row.end_date).slice(0, 16).replace(' ', 'T') : ''
    });
    setModalOpen(true);
  };

  const validate = () => {
    const novelIdNum = form.novel_id ? Number(form.novel_id) : null;
    if (!novelIdNum || !Number.isFinite(novelIdNum) || novelIdNum <= 0) return 'novel_id 必填（仅支持 published 小说）';

    const start = form.start_date ? new Date(toMysqlDatetimeNullable(form.start_date)!.replace(' ', 'T')) : null;
    const end = form.end_date ? new Date(toMysqlDatetimeNullable(form.end_date)!.replace(' ', 'T')) : null;
    if (start && end && start.getTime() > end.getTime()) return 'start_date 不能大于 end_date';

    return '';
  };

  const save = async () => {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }

    const payload: any = {
      novel_id: Number(form.novel_id),
      section_type: SECTION_TYPE,
      display_order: Number(form.display_order || 0),
      is_active: form.is_active ? 1 : 0,
      start_date: toMysqlDatetimeNullable(form.start_date),
      end_date: toMysqlDatetimeNullable(form.end_date)
    };

    try {
      setLoading(true);
      if (editing?.id) {
        const res = await ApiService.put(`/admin/homepage/featured-novels/${editing.id}`, payload);
        if (!(res as any)?.success) throw new Error((res as any)?.message || '更新失败');
        setToast('更新成功');
      } else {
        const res = await ApiService.post(`/admin/homepage/featured-novels`, payload);
        if (!(res as any)?.success) throw new Error((res as any)?.message || '创建失败');
        setToast('创建成功');
      }
      setModalOpen(false);
      await loadList();
      setTimeout(() => setToast(''), 2000);
    } catch (e: any) {
      const msg = e?.message || '保存失败';
      setFormError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (row: FeaturedRow) => {
    if (!row?.id) return;
    // eslint-disable-next-line no-restricted-globals
    const ok = confirm(`确认删除 #${row.id} 吗？（物理删除）`);
    if (!ok) return;
    try {
      setLoading(true);
      const res = await ApiService.delete(`/admin/homepage/featured-novels/${row.id}`);
      if (!(res as any)?.success) throw new Error((res as any)?.message || '删除失败');
      setToast('删除成功');
      await loadList();
      setTimeout(() => setToast(''), 2000);
    } catch (e: any) {
      const msg = e?.message || '删除失败';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (row: FeaturedRow, next: boolean) => {
    try {
      const res = await ApiService.put(`/admin/homepage/featured-novels/${row.id}`, { is_active: next ? 1 : 0 });
      if (!(res as any)?.success) throw new Error((res as any)?.message || '更新失败');
      await loadList();
    } catch (e: any) {
      const msg = e?.message || '更新失败';
      onError?.(msg);
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>Champion小说管理</h2>
        <button className={styles.generateButton} onClick={openCreate} disabled={loading}>
          + 新增推荐小说
        </button>
      </div>

      {toast && (
        <div style={{ marginBottom: 12, padding: 10, background: '#e8f5e9', color: '#1b5e20', borderRadius: 6 }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: 10, color: '#666', fontSize: 13 }}>
        数据源：<code>homepage_featured_novels</code>（固定 <code>section_type = '{SECTION_TYPE}'</code>），仅允许绑定 <code>review_status = published</code> 的小说。
      </div>

      {loading && rows.length === 0 ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <div className={styles.paymentTable}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 88 }}>封面</th>
                <th>小说</th>
                <th style={{ width: 90 }}>顺序</th>
                <th style={{ width: 90 }}>启用</th>
                <th style={{ width: 240 }}>展示时间窗</th>
                <th style={{ width: 170 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={6}>暂无配置</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <img
                        src={normalizeImageUrl(r.novel_cover)}
                        alt={r.novel_title || String(r.novel_id)}
                        style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#333' }}>{r.novel_title || `小说ID: ${r.novel_id}`}</div>
                      <div style={{ color: '#888' }}>
                        #{r.novel_id}{r.novel_author ? ` · ${r.novel_author}` : ''}
                      </div>
                    </td>
                    <td>{r.display_order ?? 0}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={(r.is_active ?? 0) === 1}
                        onChange={(e) => toggleActive(r, e.target.checked)}
                      />
                    </td>
                    <td style={{ color: '#666' }}>
                      <div>start: {r.start_date ? String(r.start_date) : '-'}</div>
                      <div>end: {r.end_date ? String(r.end_date) : '-'}</div>
                    </td>
                    <td>
                      <button className={styles.viewButton} onClick={() => openEdit(r)} disabled={loading} style={{ marginRight: 8 }}>
                        编辑
                      </button>
                      <button className={styles.rejectButton} onClick={() => remove(r)} disabled={loading}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className={styles.modal} onClick={() => setModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className={styles.modalHeader}>
              <h2>{editing ? `编辑 #${editing.id}` : '新增推荐小说'}</h2>
              <button onClick={() => setModalOpen(false)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              {formError && <div className={styles.errorMessage}>{formError}</div>}

              <div className={styles.formGroup}>
                <label>novel_id（下拉搜索，仅 published）</label>
                <input
                  value={novelQuery}
                  onChange={(e) => setNovelQuery(e.target.value)}
                  placeholder="输入小说ID/标题/作者进行搜索"
                />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                  <select
                    value={form.novel_id}
                    onChange={(e) => setForm({ ...form, novel_id: e.target.value })}
                    style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ddd' }}
                  >
                    <option value="">（请选择）</option>
                    {novelOptions.map((n) => (
                      <option key={n.id} value={String(n.id)}>
                        #{n.id} {n.title}
                      </option>
                    ))}
                  </select>
                  <div style={{ color: '#666', fontSize: 12, minWidth: 120 }}>
                    {novelSearching ? '搜索中...' : selectedNovelTitle ? `已选：${selectedNovelTitle}` : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.formGroup}>
                  <label>display_order</label>
                  <input value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>is_active</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                    <span style={{ color: '#666' }}>{form.is_active ? '启用' : '禁用'}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.formGroup}>
                  <label>start_date</label>
                  <input type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>end_date</label>
                  <input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button className={styles.viewButton} onClick={() => setModalOpen(false)} disabled={loading}>
                  取消
                </button>
                <button className={styles.approveButton} onClick={save} disabled={loading}>
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



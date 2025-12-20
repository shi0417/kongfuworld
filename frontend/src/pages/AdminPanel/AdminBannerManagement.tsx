import React, { useEffect, useMemo, useRef, useState } from 'react';
import ApiService from '../../services/ApiService';
import { API_BASE_URL } from '../../config';
import styles from '../AdminPanel.module.css';

type Props = {
  onError?: (msg: string) => void;
};

type BannerRow = {
  id: number;
  novel_id: number | null;
  novel_title?: string | null;
  title: string;
  subtitle?: string | null;
  image_url: string;
  link_url?: string | null;
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
  description?: string | null;
  status?: string | null;
  review_status?: string | null;
};

const toMysqlDatetime = (value: string | null | undefined) => {
  if (!value) return null;
  // datetime-local: YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value.replace('T', ' ') + ':00';
  return value;
};

const normalizeImageUrl = (url: string) => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // 兼容后端存的 /covers/xxx 或 /avatars/xxx
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
};

export default function AdminBannerManagement({ onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [toast, setToast] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [formError, setFormError] = useState<string>('');

  const [form, setForm] = useState({
    image_url: '',
    title: '',
    subtitle: '',
    novel_id: '' as string, // keep as string for empty
    link_url: '',
    display_order: '0',
    is_active: true,
    start_date: '',
    end_date: ''
  });

  // published novel 下拉搜索
  const [novelQuery, setNovelQuery] = useState('');
  const [novelOptions, setNovelOptions] = useState<NovelSearchItem[]>([]);
  const [novelSearching, setNovelSearching] = useState(false);

  const selectedNovelTitle = useMemo(() => {
    const id = Number(form.novel_id);
    if (!Number.isFinite(id) || id <= 0) return '';
    const found = novelOptions.find((n) => n.id === id);
    return found?.title || '';
  }, [form.novel_id, novelOptions]);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const res = await ApiService.get('/admin/homepage/banners');
      const list = (res as any)?.data || [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e: any) {
      const msg = e?.message || '加载 Banner 列表失败';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // modal 打开时默认拉一批 published 小说用于下拉（数据来源：novel 表）
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

  // 轻量 debounce：输入停顿 350ms 才发请求
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

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await ApiService.request('/admin/homepage/banners/upload-image', {
        method: 'POST',
        body: formData
      });

      if (!(res as any)?.success) throw new Error((res as any)?.message || '上传失败');
      const imageUrl = (res as any)?.data?.image_url;
      if (!imageUrl) throw new Error('上传成功但未返回 image_url');

      setForm((prev) => ({ ...prev, image_url: imageUrl }));
      setToast('图片上传成功');
      setTimeout(() => setToast(''), 2000);
    } catch (e: any) {
      const msg = e?.message || '图片上传失败';
      setFormError(msg);
      onError?.(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setNovelQuery('');
    setNovelOptions([]);
    setForm({
      image_url: '',
      title: '',
      subtitle: '',
      novel_id: '',
      link_url: '',
      display_order: '0',
      is_active: true,
      start_date: '',
      end_date: ''
    });
    setModalOpen(true);
  };

  const openEdit = (row: BannerRow) => {
    setEditing(row);
    setFormError('');
    setNovelQuery('');
    setNovelOptions([]);
    setForm({
      image_url: row.image_url || '',
      title: row.title || '',
      subtitle: row.subtitle || '',
      novel_id: row.novel_id ? String(row.novel_id) : '',
      link_url: row.link_url || '',
      display_order: String(row.display_order ?? 0),
      is_active: (row.is_active ?? 1) === 1,
      start_date: row.start_date ? String(row.start_date).slice(0, 16).replace(' ', 'T') : '',
      end_date: row.end_date ? String(row.end_date).slice(0, 16).replace(' ', 'T') : ''
    });
    setModalOpen(true);
  };

  const validate = () => {
    const image_url = form.image_url.trim();
    const title = form.title.trim();
    const link_url = form.link_url.trim();
    const novelIdNum = form.novel_id ? Number(form.novel_id) : null;
    const hasNovel = novelIdNum && Number.isFinite(novelIdNum) && novelIdNum > 0;
    const hasLink = !!link_url;

    if (!image_url) return 'image_url 必填';
    if (!title) return 'title 必填';
    if (!hasNovel && !hasLink) return 'novel_id 与 link_url 至少填一个';

    const start = form.start_date ? new Date(toMysqlDatetime(form.start_date)!.replace(' ', 'T')) : null;
    const end = form.end_date ? new Date(toMysqlDatetime(form.end_date)!.replace(' ', 'T')) : null;
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
      image_url: form.image_url.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      novel_id: form.novel_id ? Number(form.novel_id) : null,
      link_url: form.link_url.trim() || null,
      display_order: Number(form.display_order || 0),
      is_active: form.is_active ? 1 : 0,
      start_date: toMysqlDatetime(form.start_date),
      end_date: toMysqlDatetime(form.end_date)
    };

    try {
      setLoading(true);
      if (editing?.id) {
        const res = await ApiService.put(`/admin/homepage/banners/${editing.id}`, payload);
        if (!(res as any)?.success) throw new Error((res as any)?.message || '更新失败');
        setToast('更新成功');
      } else {
        const res = await ApiService.post(`/admin/homepage/banners`, payload);
        if (!(res as any)?.success) throw new Error((res as any)?.message || '创建失败');
        setToast('创建成功');
      }
      setModalOpen(false);
      await loadBanners();
      setTimeout(() => setToast(''), 2000);
    } catch (e: any) {
      const msg = e?.message || '保存失败';
      setFormError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (row: BannerRow) => {
    if (!row?.id) return;
    // eslint-disable-next-line no-restricted-globals
    const ok = confirm(`确认删除 Banner #${row.id} 吗？（物理删除）`);
    if (!ok) return;
    try {
      setLoading(true);
      const res = await ApiService.delete(`/admin/homepage/banners/${row.id}`);
      if (!(res as any)?.success) throw new Error((res as any)?.message || '删除失败');
      setToast('删除成功');
      await loadBanners();
      setTimeout(() => setToast(''), 2000);
    } catch (e: any) {
      const msg = e?.message || '删除失败';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (row: BannerRow, next: boolean) => {
    try {
      const res = await ApiService.put(`/admin/homepage/banners/${row.id}`, { is_active: next ? 1 : 0 });
      if (!(res as any)?.success) throw new Error((res as any)?.message || '更新失败');
      await loadBanners();
    } catch (e: any) {
      const msg = e?.message || '更新失败';
      onError?.(msg);
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h2>Banner 管理</h2>
        <button className={styles.generateButton} onClick={openCreate} disabled={loading}>
          + 新建 Banner
        </button>
      </div>

      {toast && (
        <div style={{ marginBottom: 12, padding: 10, background: '#e8f5e9', color: '#1b5e20', borderRadius: 6 }}>
          {toast}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <div className={styles.paymentTable}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>图片</th>
                <th>标题</th>
                <th style={{ width: 220 }}>跳转目标</th>
                <th style={{ width: 220 }}>展示时间窗</th>
                <th style={{ width: 90 }}>顺序</th>
                <th style={{ width: 90 }}>启用</th>
                <th style={{ width: 160 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={7}>暂无 Banner</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <img
                        src={normalizeImageUrl(r.image_url)}
                        alt={r.title}
                        style={{ width: 96, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#333' }}>{r.title}</div>
                      {r.subtitle && <div style={{ color: '#888', marginTop: 4 }}>{r.subtitle}</div>}
                    </td>
                    <td>
                      {r.novel_id ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#333' }}>{r.novel_title || `小说ID: ${r.novel_id}`}</div>
                          <div style={{ color: '#888' }}>novel_id: {r.novel_id}</div>
                        </div>
                      ) : (
                        <div style={{ color: '#333' }}>{r.link_url || '-'}</div>
                      )}
                    </td>
                    <td style={{ color: '#666' }}>
                      <div>start: {r.start_date ? String(r.start_date) : '-'}</div>
                      <div>end: {r.end_date ? String(r.end_date) : '-'}</div>
                    </td>
                    <td>{r.display_order ?? 0}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={(r.is_active ?? 0) === 1}
                        onChange={(e) => toggleActive(r, e.target.checked)}
                      />
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
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820 }}>
            <div className={styles.modalHeader}>
              <h2>{editing ? `编辑 Banner #${editing.id}` : '新建 Banner'}</h2>
              <button onClick={() => setModalOpen(false)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              {formError && <div className={styles.errorMessage}>{formError}</div>}

              <div className={styles.formGroup}>
                <label>image_url（必填）</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="例如 /covers/xxx.jpg 或 https://..."
                    style={{ flex: 1 }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.viewButton}
                    disabled={uploading || loading}
                    onClick={() => fileInputRef.current?.click()}
                    title="支持 jpg/jpeg/png/gif/webp，最大 5MB"
                  >
                    {uploading ? '上传中...' : '选择图片上传'}
                  </button>
                </div>
                <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>
                  支持格式：jpg/jpeg/png/gif/webp（≤ 5MB），推荐尺寸1920✖️600规格，上传后会自动回填 image_url（/covers/...）
                </div>
              </div>

              {form.image_url && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: '#666', marginBottom: 8 }}>预览</div>
                  <img
                    src={normalizeImageUrl(form.image_url)}
                    alt="preview"
                    style={{ width: '100%', maxWidth: 520, height: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }}
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <label>title（必填）</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div className={styles.formGroup}>
                <label>subtitle</label>
                <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
              </div>

              <div className={styles.formGroup}>
                <label>novel_id（下拉搜索，仅 published）</label>
                <input
                  value={novelQuery}
                  onChange={(e) => setNovelQuery(e.target.value)}
                  placeholder="输入小说ID/标题/作者/主角名进行搜索"
                />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                  <select
                    value={form.novel_id}
                    onChange={(e) => setForm({ ...form, novel_id: e.target.value })}
                    style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ddd' }}
                  >
                    <option value="">（不选择小说）</option>
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
                <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>
                  下拉数据来源：novel 表（仅显示 review_status = published）
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>link_url（与 novel_id 至少填一个）</label>
                <input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />
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



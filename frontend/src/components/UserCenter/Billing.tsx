import React, { useEffect, useState } from 'react';
import styles from './Billing.module.css';
import { getBillingTransactions, type BillingRow, type BillingType } from '../../services/billingService';

const UI_TYPES = ['karma_purchase', 'karma_consumption', 'champion_new', 'champion_renew'] as const;
type UIType = typeof UI_TYPES[number];

const Billing: React.FC = () => {
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [q, setQ] = useState('');
  // typeFilter.length === 0 表示 All（不传 type）
  const [typeFilter, setTypeFilter] = useState<UIType[]>([]);

  const [selected, setSelected] = useState<BillingRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getBillingTransactions({
          page,
          pageSize,
          q: q.trim() || undefined,
          type: typeFilter.length ? typeFilter.map(t => t as BillingType) : undefined,
          // 固定只取 completed
          status: ['completed']
        });
        setRows(data.rows || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.total_pages || 1);
      } catch (e: any) {
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setError(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [page, pageSize, q, typeFilter.join(',')]);

  const toggleType = (t: UIType) => {
    setPage(1);
    setTypeFilter(prev => {
      if (prev.includes(t)) {
        const next = prev.filter(x => x !== t);
        return next; // next 为空即 All
      }
      return [...prev, t];
    });
  };

  const selectAllTypes = () => {
    setPage(1);
    setTypeFilter([]); // All
  };

  return (
    <div className={styles.billingContent}>
      <h1 className={styles.pageTitle}>Billing</h1>
      
      <div className={styles.billingSections}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Transaction History</h2>

          <div className={styles.toolbar}>
            <input
              className={styles.searchInput}
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="Search description / novel / provider ref"
            />

            <div className={styles.filters}>
              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>Type</div>
                <div className={styles.filterButtons}>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${typeFilter.length === 0 ? styles.filterBtnActive : ''}`}
                    onClick={selectAllTypes}
                  >
                    All
                  </button>
                  {UI_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.filterBtn} ${typeFilter.includes(t) ? styles.filterBtnActive : ''}`}
                      onClick={() => toggleType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.billingTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Delta</th>
                  <th>Before → After</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {error ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyRow}>
                      {error}
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyRow}>
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyRow}>
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.row_id} className={styles.row} onClick={() => setSelected(r)}>
                      <td>{new Date(r.occurred_at).toLocaleString()}</td>
                      <td>
                        <span className={styles.badge}>{r.type}</span>
                      </td>
                      <td>{r.description}</td>
                      <td>{r.delta_label || '—'}</td>
                      <td>{r.before_label && r.after_label ? `${r.before_label} → ${r.after_label}` : '—'}</td>
                      <td>{r.amount_paid == null ? '—' : `${r.currency || ''} ${Number(r.amount_paid).toFixed(2)}`}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[`status_${r.status}`] || ''}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              Page {page} / {totalPages} · Total {total}
            </div>
            <div className={styles.paginationBtns}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Transaction Details</div>
              <button className={styles.modalClose} type="button" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div>
                <b>Date:</b> {new Date(selected.occurred_at).toLocaleString()}
              </div>
              <div>
                <b>Source:</b> {selected.source}
              </div>
              <div>
                <b>Type:</b> {selected.type}
              </div>
              <div>
                <b>Status:</b> {selected.status}
              </div>
              <div>
                <b>Description:</b> {selected.description}
              </div>
              <div>
                <b>Provider:</b> {selected.provider || '—'}
              </div>
              <div>
                <b>Provider Ref:</b> {selected.provider_ref || '—'}
              </div>
              <div>
                <b>Novel:</b> {selected.novel_title || (selected.novel_id != null ? `#${selected.novel_id}` : '—')}
              </div>
              <div>
                <b>Chapter ID:</b> {selected.chapter_id != null ? selected.chapter_id : '—'}
              </div>
              <div>
                <b>Before:</b> {selected.before_label || '—'}
              </div>
              <div>
                <b>After:</b> {selected.after_label || '—'}
              </div>
              <div>
                <b>Delta:</b> {selected.delta_label || '—'}
              </div>
              <div>
                <b>Amount:</b>{' '}
                {selected.amount_paid == null ? '—' : `${selected.currency || ''} ${Number(selected.amount_paid).toFixed(2)}`}
              </div>
              <div>
                <b>Row ID:</b> {selected.row_id}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;

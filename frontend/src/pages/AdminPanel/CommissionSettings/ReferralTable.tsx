import React, { useState, useEffect } from 'react';
import styles from './CommissionSettings.module.css';

interface ReferralTableProps {
  onError?: (error: string) => void;
  readerPlans: any[];
  authorPlans: any[];
}

const ReferralTable: React.FC<ReferralTableProps> = ({
  onError,
  readerPlans,
  authorPlans,
}) => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsPage, setReferralsPage] = useState(1);
  const [referralsTotal, setReferralsTotal] = useState(0);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [selectedPlanDetail, setSelectedPlanDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingReferral, setEditingReferral] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // 加载推广关系列表
  const loadReferrals = async (page: number = 1) => {
    try {
      setReferralsLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/referrals?page=${page}&page_size=20`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setReferrals(data.data.list || []);
        setReferralsTotal(data.data.total || 0);
        if (onError) {
          onError(''); // 清除错误
        }
      } else {
        if (onError) {
          onError(data.message || '加载失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载失败');
      }
    } finally {
      setReferralsLoading(false);
    }
  };

  // 加载用户详情
  const loadUserDetail = async (userId: number) => {
    try {
      setDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedUserDetail(data.data);
      } else {
        if (onError) {
          onError(data.message || '加载用户详情失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载用户详情失败');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  // 加载方案详情（包含层级信息）
  const loadPlanDetail = async (planId: number) => {
    try {
      setDetailLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/commission-plans/${planId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedPlanDetail(data.data);
      } else {
        if (onError) {
          onError(data.message || '加载方案详情失败');
        }
      }
    } catch (err: any) {
      if (onError) {
        onError(err.message || '加载方案详情失败');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  // 保存推广关系修改
  const saveReferralEdit = async () => {
    if (!editingReferral) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5000/api/admin/referrals/${editingReferral.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          promoter_plan_id: editingReferral.promoter_plan_id || null,
          author_plan_id: editingReferral.author_plan_id || null
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadReferrals(referralsPage);
        setEditingReferral(null);
        if (onError) {
          onError('');
        }
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

  // 组件挂载以及分页变化时，自动调用 loadReferrals
  useEffect(() => {
    loadReferrals(referralsPage);
  }, [referralsPage]);

  return (
    <>
      <div className={styles.paymentTable}>
        <h3>推广关系列表 (referrals)</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>用户ID</th>
              <th>用户名称</th>
              <th>推荐人ID</th>
              <th>推荐人名称</th>
              <th>读者推广方案ID</th>
              <th>读者推广方案名称</th>
              <th>作者推广方案ID</th>
              <th>作者推广方案名称</th>
              <th>创建时间</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {referralsLoading ? (
              <tr>
                <td colSpan={12} className={styles.emptyCell}>加载中...</td>
              </tr>
            ) : referrals.length === 0 ? (
              <tr>
                <td colSpan={12} className={styles.emptyCell}>暂无数据</td>
              </tr>
            ) : (
              referrals.map((referral) => (
                <tr key={referral.id}>
                  <td>{referral.id}</td>
                  <td>
                    <span
                      onClick={() => loadUserDetail(referral.user_id)}
                      style={{
                        color: '#007bff',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                      title="点击查看用户详情"
                    >
                      {referral.user_id}
                    </span>
                  </td>
                  <td>{referral.user_name}</td>
                  <td>
                    {referral.referrer_id ? (
                      <span
                        onClick={() => loadUserDetail(referral.referrer_id)}
                        style={{
                          color: '#007bff',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        title="点击查看推荐人详情"
                      >
                        {referral.referrer_id}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{referral.referrer_name || '—'}</td>
                  <td>
                    {referral.promoter_plan_id ? (
                      <span
                        onClick={() => loadPlanDetail(referral.promoter_plan_id)}
                        style={{
                          color: '#007bff',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        title="点击查看方案详情"
                      >
                        {referral.promoter_plan_id}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{referral.promoter_plan_name || '—'}</td>
                  <td>
                    {referral.author_plan_id ? (
                      <span
                        onClick={() => loadPlanDetail(referral.author_plan_id)}
                        style={{
                          color: '#007bff',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        title="点击查看方案详情"
                      >
                        {referral.author_plan_id}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{referral.author_plan_name || '—'}</td>
                  <td>{new Date(referral.created_at).toLocaleString('zh-CN')}</td>
                  <td>{referral.updated_at ? new Date(referral.updated_at).toLocaleString('zh-CN') : '—'}</td>
                  <td>
                    <button
                      onClick={() => setEditingReferral({ ...referral })}
                      style={{
                        padding: '5px 10px',
                        fontSize: '12px',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      修改
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* 分页 */}
        {referralsTotal > 20 && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setReferralsPage(Math.max(1, referralsPage - 1))}
              disabled={referralsPage === 1}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                background: referralsPage === 1 ? '#f5f5f5' : 'white',
                cursor: referralsPage === 1 ? 'not-allowed' : 'pointer',
                borderRadius: '4px'
              }}
            >
              上一页
            </button>
            <span>
              第 {referralsPage} 页，共 {Math.ceil(referralsTotal / 20)} 页（共 {referralsTotal} 条）
            </span>
            <button
              onClick={() => setReferralsPage(Math.min(Math.ceil(referralsTotal / 20), referralsPage + 1))}
              disabled={referralsPage >= Math.ceil(referralsTotal / 20)}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                background: referralsPage >= Math.ceil(referralsTotal / 20) ? '#f5f5f5' : 'white',
                cursor: referralsPage >= Math.ceil(referralsTotal / 20) ? 'not-allowed' : 'pointer',
                borderRadius: '4px'
              }}
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {/* 用户详情模态框 */}
      {selectedUserDetail && (
        <div className={styles.modal} onClick={() => setSelectedUserDetail(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className={styles.modalHeader}>
              <h2>用户详情</h2>
              <button onClick={() => setSelectedUserDetail(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              {detailLoading ? (
                <div className={styles.loading}>加载中...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>基本信息</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#666' }}>用户ID:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.id}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>用户名:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.username || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>笔名:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.pen_name || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>邮箱:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.email || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>确认邮箱:</strong>
                        <span style={{ marginLeft: '10px', color: selectedUserDetail.confirmed_email ? '#28a745' : '#dc3545' }}>
                          {selectedUserDetail.confirmed_email ? '是' : '否'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>手机号:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.phone_number || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>QQ号:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.qq_number || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>微信号:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.wechat_number || '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>账户信息</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#666' }}>是否作者:</strong>
                        <span style={{ marginLeft: '10px', color: selectedUserDetail.is_author ? '#28a745' : '#666' }}>
                          {selectedUserDetail.is_author ? '是' : '否'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>是否VIP:</strong>
                        <span style={{ marginLeft: '10px', color: selectedUserDetail.is_vip ? '#ffc107' : '#666' }}>
                          {selectedUserDetail.is_vip ? '是' : '否'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>实名认证:</strong>
                        <span style={{ marginLeft: '10px', color: selectedUserDetail.is_real_name_verified ? '#28a745' : '#666' }}>
                          {selectedUserDetail.is_real_name_verified ? '是' : '否'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>账户余额:</strong>
                        <span style={{ marginLeft: '10px', color: '#333', fontWeight: 'bold' }}>${selectedUserDetail.balance?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>积分:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedUserDetail.points || 0}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>金色Karma:</strong>
                        <span style={{ marginLeft: '10px', color: '#ffc107', fontWeight: 'bold' }}>{selectedUserDetail.golden_karma || 0}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>VIP到期时间:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedUserDetail.vip_expire_at ? new Date(selectedUserDetail.vip_expire_at).toLocaleString('zh-CN') : '—'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>最后登录:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedUserDetail.last_login_at ? new Date(selectedUserDetail.last_login_at).toLocaleString('zh-CN') : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedUserDetail.bio && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>个人简介</h3>
                      <p style={{ color: '#666', lineHeight: '1.6' }}>{selectedUserDetail.bio}</p>
                    </div>
                  )}
                  <div style={{ gridColumn: '1 / -1', marginTop: '10px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', color: '#666' }}>
                      <div>
                        <strong>创建时间:</strong> {new Date(selectedUserDetail.created_at).toLocaleString('zh-CN')}
                      </div>
                      <div>
                        <strong>更新时间:</strong> {selectedUserDetail.updated_at ? new Date(selectedUserDetail.updated_at).toLocaleString('zh-CN') : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 编辑推广关系模态框 */}
      {editingReferral && (
        <div className={styles.modal} onClick={() => setEditingReferral(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h2>修改推广关系</h2>
              <button onClick={() => setEditingReferral(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#666' }}>关系ID:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>{editingReferral.id}</span>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#666' }}>用户:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>{editingReferral.user_name} (ID: {editingReferral.user_id})</span>
                </div>
                <div>
                  <strong style={{ color: '#666' }}>推荐人:</strong>
                  <span style={{ marginLeft: '10px', color: '#333' }}>
                    {editingReferral.referrer_name || '—'} {editingReferral.referrer_id ? `(ID: ${editingReferral.referrer_id})` : ''}
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    读者推广方案:
                  </label>
                  <select
                    value={editingReferral.promoter_plan_id || ''}
                    onChange={(e) => setEditingReferral({ 
                      ...editingReferral, 
                      promoter_plan_id: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    style={{ 
                      width: '100%', 
                      padding: '10px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">— 无 —</option>
                    {readerPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} (ID: {plan.id}) - {plan.plan_type === 'reader_promoter' ? '读者推广' : '作者推广'}
                      </option>
                    ))}
                  </select>
                  {editingReferral.promoter_plan_id && (
                    <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                      当前: {editingReferral.promoter_plan_name || '—'}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                    作者推广方案:
                  </label>
                  <select
                    value={editingReferral.author_plan_id || ''}
                    onChange={(e) => setEditingReferral({ 
                      ...editingReferral, 
                      author_plan_id: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    style={{ 
                      width: '100%', 
                      padding: '10px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">— 无 —</option>
                    {authorPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} (ID: {plan.id}) - {plan.plan_type === 'author_promoter' ? '作者推广' : '读者推广'}
                      </option>
                    ))}
                  </select>
                  {editingReferral.author_plan_id && (
                    <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                      当前: {editingReferral.author_plan_name || '—'}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.modalActions} style={{ marginTop: '25px' }}>
                <button
                  onClick={saveReferralEdit}
                  className={styles.approveButton}
                  disabled={saving}
                  style={{ marginRight: '10px' }}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditingReferral(null)}
                  className={styles.rejectButton}
                  disabled={saving}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 方案详情模态框 */}
      {selectedPlanDetail && (
        <div className={styles.modal} onClick={() => setSelectedPlanDetail(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className={styles.modalHeader}>
              <h2>推广分成方案详情</h2>
              <button onClick={() => setSelectedPlanDetail(null)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalBody}>
              {detailLoading ? (
                <div className={styles.loading}>加载中...</div>
              ) : (
                <>
                  <div style={{ marginBottom: '25px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>方案基本信息</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div>
                        <strong style={{ color: '#666' }}>方案ID:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedPlanDetail.plan.id}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>方案名称:</strong>
                        <span style={{ marginLeft: '10px', color: '#333', fontWeight: 'bold' }}>{selectedPlanDetail.plan.name}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>方案类型:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedPlanDetail.plan.plan_type === 'reader_promoter' ? '读者推广' : '作者推广'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>最大层级:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedPlanDetail.plan.max_level}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>是否定制:</strong>
                        <span style={{ marginLeft: '10px', color: selectedPlanDetail.plan.is_custom ? '#28a745' : '#666' }}>
                          {selectedPlanDetail.plan.is_custom ? '是' : '否'}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>拥有者用户ID:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>{selectedPlanDetail.plan.owner_user_id || '—'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>生效时间:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {new Date(selectedPlanDetail.plan.start_date).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#666' }}>结束时间:</strong>
                        <span style={{ marginLeft: '10px', color: '#333' }}>
                          {selectedPlanDetail.plan.end_date ? new Date(selectedPlanDetail.plan.end_date).toLocaleString('zh-CN') : '—'}
                        </span>
                      </div>
                      {selectedPlanDetail.plan.remark && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong style={{ color: '#666' }}>备注:</strong>
                          <p style={{ marginLeft: '10px', marginTop: '5px', color: '#666' }}>{selectedPlanDetail.plan.remark}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>层级比例设置</h3>
                    {selectedPlanDetail.levels && selectedPlanDetail.levels.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                          <tr style={{ background: '#f8f9fa' }}>
                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>层级</th>
                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>分成比例</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPlanDetail.levels.map((level: any, index: number) => (
                            <tr key={level.level} style={{ background: index % 2 === 0 ? 'white' : '#f8f9fa' }}>
                              <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                <strong style={{ color: '#007bff' }}>第 {level.level} 层</strong>
                              </td>
                              <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '16px' }}>
                                  {(level.percent * 100).toFixed(4)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>暂无层级数据</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReferralTable;

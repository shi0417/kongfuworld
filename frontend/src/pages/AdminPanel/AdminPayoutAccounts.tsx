/**
 * Admin 收款账户管理页面
 * 用于编辑/管理员管理自己的收款账户
 */
import React, { useState, useEffect, useCallback } from 'react';
import AdminEditorIncomeTab from './AdminEditorIncomeTab';
import AdminEditorSettlementTab from './AdminEditorSettlementTab';
import AdminMyContractsTab from './AdminMyContractsTab';
import styles from './AdminEditorIncome.module.css';

interface AdminPayoutAccountsProps {
  onError?: (error: string) => void;
}

const AdminPayoutAccounts: React.FC<AdminPayoutAccountsProps> = ({ onError }) => {
  const [editorTab, setEditorTab] = useState<'account' | 'editorIncome' | 'editorSettlement' | 'myContracts'>('account');
  const [payoutAccounts, setPayoutAccounts] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [accountForm, setAccountForm] = useState({
    method: 'PayPal',
    account_label: '',
    account_data: {} as any,
    is_default: false
  });

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

  // 加载收款账户列表
  const loadPayoutAccounts = useCallback(async () => {
    try {
      setAccountsLoading(true);
      const { data } = await adminApiRequest('/admin/payout-account/list');
      if (data.success) {
        setPayoutAccounts(data.data || []);
      }
    } catch (error: any) {
      console.error('加载收款账户列表失败:', error);
      if (onError) {
        onError(error.message || '加载失败');
      }
    } finally {
      setAccountsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadPayoutAccounts();
  }, [loadPayoutAccounts]);

  // 保存收款账户
  const savePayoutAccount = async () => {
    if (!accountForm.account_label) {
      alert('请填写账户标签');
      return;
    }
    
    // 根据支付方式验证必填字段
    let isValid = false;
    switch (accountForm.method) {
      case 'PayPal':
        isValid = !!(accountForm.account_data.email);
        if (!isValid) alert('请填写PayPal邮箱');
        break;
      case 'Alipay':
        isValid = !!(accountForm.account_data.account);
        if (!isValid) alert('请填写支付宝账号');
        break;
      case 'WeChat':
        isValid = !!(accountForm.account_data.wechat_id || accountForm.account_data.qrcode_url);
        if (!isValid) alert('请填写微信号或收款码URL');
        break;
      case 'Bank':
        isValid = !!(accountForm.account_data.bank_name && accountForm.account_data.account_name && accountForm.account_data.card_number);
        if (!isValid) alert('请填写完整的银行卡信息');
        break;
      default:
        isValid = false;
        alert('请选择支付方式');
    }
    
    if (!isValid) return;
    
    try {
      // 将前端的method值转换为数据库格式（小写）
      const methodMap: { [key: string]: string } = {
        'PayPal': 'paypal',
        'Alipay': 'alipay',
        'WeChat': 'wechat',
        'Bank': 'bank_transfer'
      };
      const dbMethod = methodMap[accountForm.method] || accountForm.method.toLowerCase();
      
      const { data } = await adminApiRequest('/admin/payout-account/save', {
        method: 'POST',
        body: JSON.stringify({
          id: editingAccount?.id,
          ...accountForm,
          method: dbMethod
        })
      });
      
      if (data.success) {
        alert(editingAccount ? '收款账户已更新' : '收款账户已创建');
        setShowAccountModal(false);
        setEditingAccount(null);
        setAccountForm({
          method: 'PayPal',
          account_label: '',
          account_data: {},
          is_default: false
        });
        await loadPayoutAccounts();
      }
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };
  
  // 设置默认收款账户
  const setDefaultAccount = async (accountId: number) => {
    try {
      const { data } = await adminApiRequest(`/admin/payout-account/${accountId}/set-default`, {
        method: 'PUT'
      });
      if (data.success) {
        alert('已设置为默认收款账户');
        await loadPayoutAccounts();
      }
    } catch (error: any) {
      alert(error.message || '设置失败');
    }
  };
  
  // 打开新增账户Modal
  const openAddAccountModal = () => {
    setEditingAccount(null);
    setAccountForm({
      method: 'PayPal',
      account_label: '',
      account_data: {},
      is_default: false
    });
    setShowAccountModal(true);
  };
  
  // 打开编辑账户Modal
  const openEditAccountModal = (account: any) => {
    setEditingAccount(account);
    setAccountForm({
      method: normalizeMethod(account.method),
      account_label: account.account_label,
      account_data: account.account_data || {},
      is_default: account.is_default
    });
    setShowAccountModal(true);
  };
  
  // 格式化银行卡号（中间打星）
  const formatCardNumber = (cardNumber: string) => {
    if (!cardNumber) return '';
    if (cardNumber.length <= 8) return cardNumber;
    const last4 = cardNumber.slice(-4);
    const first4 = cardNumber.slice(0, 4);
    return `${first4} **** ${last4}`;
  };
  
  // 获取支付方式显示名称
  const getMethodName = (method: string) => {
    const methodMap: { [key: string]: string } = {
      'PayPal': 'PayPal',
      'paypal': 'PayPal',
      'Alipay': '支付宝',
      'alipay': '支付宝',
      'WeChat': '微信支付',
      'wechat': '微信支付',
      'Bank': '银行卡',
      'bank_transfer': '银行卡',
      'bank': '银行卡'
    };
    return methodMap[method] || method;
  };
  
  // 标准化支付方式（将数据库的小写值转换为前端使用的大写值）
  const normalizeMethod = (method: string) => {
    const methodMap: { [key: string]: string } = {
      'paypal': 'PayPal',
      'alipay': 'Alipay',
      'wechat': 'WeChat',
      'bank_transfer': 'Bank',
      'bank': 'Bank'
    };
    return methodMap[method.toLowerCase()] || method;
  };
  
  // 删除收款账户
  const deletePayoutAccount = async (accountId: number) => {
    if (!window.confirm('确定要删除这个收款账户吗？')) {
      return;
    }
    
    try {
      const { data } = await adminApiRequest(`/admin/payout-account/${accountId}`, {
        method: 'DELETE'
      });
      if (data.success) {
        alert('收款账户已删除');
        await loadPayoutAccounts();
      }
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* 提示条 */}
      <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f7ff', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
        <p style={{ margin: 0, color: '#0066cc' }}>
          <strong>提示:</strong> 请提供准确的收款信息，否则无法收到结算费用。建议设置一个默认收款账户。
        </p>
      </div>

      {/* 子Tab导航 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${editorTab === 'account' ? styles.active : ''}`}
          onClick={() => setEditorTab('account')}
        >
          收款账户
        </button>
        <button
          className={`${styles.tab} ${editorTab === 'editorIncome' ? styles.active : ''}`}
          onClick={() => setEditorTab('editorIncome')}
        >
          编辑收入
        </button>
        <button
          className={`${styles.tab} ${editorTab === 'editorSettlement' ? styles.active : ''}`}
          onClick={() => setEditorTab('editorSettlement')}
        >
          编辑结算管理
        </button>
        <button
          className={`${styles.tab} ${editorTab === 'myContracts' ? styles.active : ''}`}
          onClick={() => setEditorTab('myContracts')}
        >
          我的合同
        </button>
      </div>

      {/* Tab内容 */}
      {editorTab === 'account' && (
        <>
      {/* 账户列表区域 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>我的收款账户</h3>
        <button
          onClick={openAddAccountModal}
          style={{
            padding: '8px 16px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          + 新增账户
        </button>
      </div>

      {accountsLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
      ) : payoutAccounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          <p style={{ fontSize: '16px', marginBottom: '10px' }}>还没有添加收款账户</p>
          <p style={{ fontSize: '14px' }}>点击右上角【新增账户】开始添加</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {payoutAccounts.map((account: any) => (
            <div
              key={account.id}
              style={{
                padding: '20px',
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: account.is_default ? '2px solid #007bff' : '1px solid #e0e0e0',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* 标题行 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                    {account.account_label}
                  </h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 10px',
                      background: '#f0f0f0',
                      color: '#666',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      {getMethodName(account.method)}
                    </span>
                    {account.is_default && (
                      <span style={{
                        padding: '4px 10px',
                        background: '#007bff',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        默认
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 内容区域 */}
              <div style={{ flex: 1, marginBottom: '15px', fontSize: '14px', color: '#666' }}>
                {(account.method === 'PayPal' || account.method === 'paypal') && (
                  <div>
                    <p style={{ margin: '4px 0' }}><strong>PayPal 邮箱:</strong> {account.account_data?.email || '-'}</p>
                  </div>
                )}
                {(account.method === 'Alipay' || account.method === 'alipay') && (
                  <div>
                    {account.account_data?.name && (
                      <p style={{ margin: '4px 0' }}><strong>姓名:</strong> {account.account_data.name}</p>
                    )}
                    <p style={{ margin: '4px 0' }}><strong>账号:</strong> {account.account_data?.account || '-'}</p>
                  </div>
                )}
                {(account.method === 'WeChat' || account.method === 'wechat') && (
                  <div>
                    {account.account_data?.name && (
                      <p style={{ margin: '4px 0' }}><strong>姓名:</strong> {account.account_data.name}</p>
                    )}
                    {account.account_data?.wechat_id && (
                      <p style={{ margin: '4px 0' }}><strong>微信号:</strong> {account.account_data.wechat_id}</p>
                    )}
                    {account.account_data?.qrcode_url && (
                      <div style={{ marginTop: '8px' }}>
                        <img
                          src={account.account_data.qrcode_url}
                          alt="收款码"
                          style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '4px' }}
                        />
                      </div>
                    )}
                  </div>
                )}
                {(account.method === 'Bank' || account.method === 'bank_transfer' || account.method === 'bank') && (
                  <div>
                    <p style={{ margin: '4px 0' }}><strong>开户行:</strong> {account.account_data?.bank_name || '-'}</p>
                    <p style={{ margin: '4px 0' }}><strong>户名:</strong> {account.account_data?.account_name || '-'}</p>
                    <p style={{ margin: '4px 0' }}><strong>卡号:</strong> {formatCardNumber(account.account_data?.card_number || '')}</p>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '15px', borderTop: '1px solid #f0f0f0' }}>
                {!account.is_default && (
                  <button
                    onClick={() => setDefaultAccount(account.id)}
                    style={{
                      padding: '6px 12px',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    设为默认
                  </button>
                )}
                <button
                  onClick={() => openEditAccountModal(account)}
                  style={{
                    padding: '6px 12px',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  编辑
                </button>
                <button
                  onClick={() => deletePayoutAccount(account.id)}
                  style={{
                    padding: '6px 12px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增/编辑账户Modal */}
      {showAccountModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => {
            setShowAccountModal(false);
            setEditingAccount(null);
            setAccountForm({
              method: 'PayPal',
              account_label: '',
              account_data: {},
              is_default: false
            });
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>{editingAccount ? '编辑收款账户' : '新增收款账户'}</h3>
              <button
                onClick={() => {
                  setShowAccountModal(false);
                  setEditingAccount(null);
                  setAccountForm({
                    method: 'PayPal',
                    account_label: '',
                    account_data: {},
                    is_default: false
                  });
                }}
                style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>支付方式:</label>
                <select
                  value={accountForm.method}
                  onChange={(e) => setAccountForm({ ...accountForm, method: e.target.value, account_data: {} })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="PayPal">PayPal</option>
                  <option value="Alipay">支付宝</option>
                  <option value="WeChat">微信支付</option>
                  <option value="Bank">银行卡</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>账户标签:</label>
                <input
                  type="text"
                  value={accountForm.account_label}
                  onChange={(e) => setAccountForm({ ...accountForm, account_label: e.target.value })}
                  placeholder="例如：我的PayPal账户"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              {/* 根据支付方式显示不同的输入字段 */}
              {accountForm.method === 'PayPal' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>PayPal邮箱:</label>
                  <input
                    type="email"
                    value={accountForm.account_data.email || ''}
                    onChange={(e) => setAccountForm({
                      ...accountForm,
                      account_data: { ...accountForm.account_data, email: e.target.value }
                    })}
                    placeholder="your@email.com"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
              )}

              {accountForm.method === 'Alipay' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>支付宝账号:</label>
                    <input
                      type="text"
                      value={accountForm.account_data.account || ''}
                      onChange={(e) => setAccountForm({
                        ...accountForm,
                        account_data: { ...accountForm.account_data, account: e.target.value }
                      })}
                      placeholder="手机号或邮箱"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>真实姓名 (选填):</label>
                    <input
                      type="text"
                      value={accountForm.account_data.name || ''}
                      onChange={(e) => setAccountForm({
                        ...accountForm,
                        account_data: { ...accountForm.account_data, name: e.target.value }
                      })}
                      placeholder="真实姓名"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                </>
              )}

              {accountForm.method === 'WeChat' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>微信号 (必填):</label>
                    <input
                      type="text"
                      value={accountForm.account_data.wechat_id || ''}
                      onChange={(e) => setAccountForm({
                        ...accountForm,
                        account_data: { ...accountForm.account_data, wechat_id: e.target.value }
                      })}
                      placeholder="微信号"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>真实姓名 (选填):</label>
                    <input
                      type="text"
                      value={accountForm.account_data.name || ''}
                      onChange={(e) => setAccountForm({
                        ...accountForm,
                        account_data: { ...accountForm.account_data, name: e.target.value }
                      })}
                      placeholder="真实姓名"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>收款码图片URL (选填):</label>
                    <input
                      type="text"
                      value={accountForm.account_data.qrcode_url || ''}
                      onChange={(e) => setAccountForm({
                        ...accountForm,
                        account_data: { ...accountForm.account_data, qrcode_url: e.target.value }
                      })}
                      placeholder="上传收款码后填入图片URL"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                </>
              )}

              {accountForm.method === 'Bank' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>开户行:</label>
                    <input
                      type="text"
                      value={accountForm.account_data.bank_name || ''}
                      onChange={(e) => setAccountForm({
                        ...accountForm,
                        account_data: { ...accountForm.account_data, bank_name: e.target.value }
                      })}
                      placeholder="例如：中国工商银行"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>账户名:</label>
                    <input
                      type="text"
                      value={accountForm.account_data.account_name || ''}
                      onChange={(e) => setAccountForm({
                        ...accountForm,
                        account_data: { ...accountForm.account_data, account_name: e.target.value }
                      })}
                      placeholder="账户持有人姓名"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>卡号:</label>
                    <input
                      type="text"
                      value={accountForm.account_data.card_number || ''}
                      onChange={(e) => setAccountForm({
                        ...accountForm,
                        account_data: { ...accountForm.account_data, card_number: e.target.value }
                      })}
                      placeholder="银行卡号"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={accountForm.is_default}
                    onChange={(e) => setAccountForm({ ...accountForm, is_default: e.target.checked })}
                  />
                  <span>设为默认收款账户</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  onClick={() => {
                    setShowAccountModal(false);
                    setEditingAccount(null);
                    setAccountForm({
                      method: 'PayPal',
                      account_label: '',
                      account_data: {},
                      is_default: false
                    });
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
                <button
                  onClick={savePayoutAccount}
                  style={{
                    padding: '8px 16px',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
      {editorTab === 'editorIncome' && (
        <AdminEditorIncomeTab onError={onError} />
      )}
      {editorTab === 'editorSettlement' && (
        <AdminEditorSettlementTab onError={onError} />
      )}
      {editorTab === 'myContracts' && (
        <AdminMyContractsTab onError={onError} />
      )}
    </div>
  );
};

export default AdminPayoutAccounts;


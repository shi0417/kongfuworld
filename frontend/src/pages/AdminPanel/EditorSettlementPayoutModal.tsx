/**
 * 编辑结算发起支付弹窗组件
 * 用于编辑结算的支付发起功能
 */
import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../../config';
import styles from '../AdminPanel.module.css';

interface EditorSettlementPayoutModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  settlementMonthly: any | null;
  allAccounts: any[];
  defaultAccount: any | null;
}

interface EditorPayoutForm {
  method: 'paypal' | 'alipay' | 'wechat' | 'bank_transfer' | 'manual';
  account_id: string;
  payout_currency: 'USD' | 'CNY';
  fx_rate: string;
  note: string;
}

const EditorSettlementPayoutModal: React.FC<EditorSettlementPayoutModalProps> = ({
  visible,
  onClose,
  onSuccess,
  settlementMonthly,
  allAccounts,
  defaultAccount
}) => {
  const [form, setForm] = useState<EditorPayoutForm>({
    method: 'paypal',
    account_id: '',
    payout_currency: 'USD',
    fx_rate: '1.0',
    note: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // 根据支付方式获取默认币种
  const getCurrencyByMethod = (method: string): 'USD' | 'CNY' => {
    if (method === 'alipay' || method === 'wechat') {
      return 'CNY';
    }
    return 'USD';
  };

  // 计算预计支付金额
  const calculateExpectedAmount = (): number => {
    if (!settlementMonthly || !settlementMonthly.total_income_usd) {
      return 0;
    }
    const baseAmount = parseFloat(String(settlementMonthly.total_income_usd));
    const fxRate = parseFloat(form.fx_rate) || 1.0;
    return Math.round(baseAmount * fxRate * 100) / 100;
  };

  // 初始化表单（当 visible 和 defaultAccount 变化时）
  useEffect(() => {
    if (visible && settlementMonthly) {
      if (defaultAccount) {
        const method = (defaultAccount.method || 'paypal').toLowerCase() as EditorPayoutForm['method'];
        const currency = getCurrencyByMethod(method);
        const fxRate = currency === 'CNY' ? '7.20' : '1.0';
        
        setForm({
          method,
          account_id: defaultAccount.id.toString(),
          payout_currency: currency,
          fx_rate: fxRate,
          note: ''
        });
      } else {
        // 没有默认账户，使用默认值
        setForm({
          method: 'paypal',
          account_id: '',
          payout_currency: 'USD',
          fx_rate: '1.0',
          note: ''
        });
      }
      setError('');
    }
  }, [visible, settlementMonthly, defaultAccount]);

  // 处理账户选择变化
  const handleAccountChange = (accountId: string) => {
    const selectedAccount = allAccounts.find(acc => acc.id.toString() === accountId);
    if (selectedAccount) {
      const method = (selectedAccount.method || 'paypal').toLowerCase() as EditorPayoutForm['method'];
      const currency = getCurrencyByMethod(method);
      const fxRate = currency === 'CNY' ? '7.20' : '1.0';
      
      setForm({
        ...form,
        account_id: accountId,
        method,
        payout_currency: currency,
        fx_rate: fxRate
      });
    } else {
      setForm({
        ...form,
        account_id: accountId
      });
    }
  };

  // 处理支付方式变化
  const handleMethodChange = (method: string) => {
    const currency = getCurrencyByMethod(method);
    const fxRate = currency === 'CNY' ? '7.20' : '1.0';
    
    setForm({
      ...form,
      method: method as EditorPayoutForm['method'],
      payout_currency: currency,
      fx_rate: fxRate
    });
  };

  // 处理币种变化
  const handleCurrencyChange = (currency: 'USD' | 'CNY') => {
    setForm({
      ...form,
      payout_currency: currency,
      fx_rate: currency === 'USD' ? '1.0' : form.fx_rate
    });
  };

  // 提交支付
  const handleSubmit = async () => {
    // 基本校验
    if (!settlementMonthly || !settlementMonthly.id) {
      setError('结算记录不存在');
      return;
    }

    if (!form.account_id) {
      setError('请选择收款账户');
      return;
    }

    const fxRate = parseFloat(form.fx_rate);
    if (isNaN(fxRate) || fxRate <= 0) {
      setError('请输入有效的汇率');
      return;
    }

    if (form.payout_currency === 'USD' && fxRate !== 1.0) {
      setError('USD支付的汇率必须为1.0');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const token = localStorage.getItem('adminToken');
      const base = getApiBaseUrl();
      if (!base) {
        throw new Error('API base url is not configured');
      }
      const response = await fetch(
        `${base}/admin/editor-settlements/${settlementMonthly.id}/pay`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            account_id: parseInt(form.account_id),
            method: form.method,
            payout_currency: form.payout_currency,
            fx_rate: form.fx_rate,
            note: form.note || ''
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        // 成功：通知父组件刷新，关闭弹窗
        onSuccess();
        onClose();
        // 可以显示成功提示（由父组件处理）
      } else {
        // 失败：显示错误信息，不关闭弹窗
        setError(data.message || '发起支付失败');
      }
    } catch (err: any) {
      console.error('发起支付失败:', err);
      setError(err.message || '发起支付失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) {
    return null;
  }

  const expectedAmount = calculateExpectedAmount();
  const selectedAccount = allAccounts.find(acc => acc.id.toString() === form.account_id);

  return (
    <div
      className={styles.modal}
      onClick={onClose}
    >
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px' }}
      >
        <div className={styles.modalHeader}>
          <h3>编辑发起支付</h3>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.modalBody}>
          {/* 上半部分信息区（只读） */}
          <div style={{ marginBottom: '15px' }}>
            <label><strong>编辑:</strong></label>
            <p>
              {settlementMonthly?.editor?.real_name || 
               settlementMonthly?.editor?.name || 
               `编辑${settlementMonthly?.editor_admin_id || ''}`} 
              (ID: {settlementMonthly?.editor_admin_id || '-'})
              {settlementMonthly?.role && ` - ${settlementMonthly.role === 'chief_editor' ? '主编' : settlementMonthly.role === 'editor' ? '编辑' : '校对'}`}
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label><strong>月份:</strong></label>
            <p>
              {settlementMonthly?.month 
                ? new Date(settlementMonthly.month).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' })
                : '-'}
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label><strong>本月应结算收入（USD）:</strong></label>
            <p style={{ color: '#e74c3c', fontSize: '18px' }}>
              ${(parseFloat(String(settlementMonthly?.total_income_usd || 0)) || 0).toFixed(2)}
            </p>
          </div>

          {/* 中间表单区 */}
          <div style={{ marginBottom: '15px' }}>
            <label><strong>收款账户:</strong></label>
            {allAccounts.length > 0 ? (
              <select
                value={form.account_id}
                onChange={(e) => handleAccountChange(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">请选择收款账户</option>
                {allAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_label || `账户${acc.id}`} ({acc.method}) {acc.is_default ? '(默认)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <p style={{ color: '#e74c3c', marginTop: '5px' }}>该编辑尚未设置收款账户</p>
            )}
            {selectedAccount && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                <p><strong>账户详情:</strong></p>
                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {JSON.stringify(selectedAccount.account_data, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label><strong>支付方式:</strong></label>
            <select
              value={form.method}
              onChange={(e) => handleMethodChange(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="paypal">PayPal</option>
              <option value="alipay">支付宝</option>
              <option value="wechat">微信</option>
              <option value="bank_transfer">银行转账</option>
              <option value="manual">手动</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label><strong>支付币种:</strong></label>
            <select
              value={form.payout_currency}
              onChange={(e) => handleCurrencyChange(e.target.value as 'USD' | 'CNY')}
              style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="USD">USD（美元）</option>
              <option value="CNY">CNY（人民币）</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label><strong>汇率 (1 USD = ? {form.payout_currency}):</strong></label>
            <input
              type="number"
              step="0.000001"
              min="0.000001"
              value={form.fx_rate}
              onChange={(e) => setForm({ ...form, fx_rate: e.target.value })}
              disabled={form.payout_currency === 'USD'}
              style={{
                width: '100%',
                padding: '8px',
                marginTop: '5px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                backgroundColor: form.payout_currency === 'USD' ? '#f5f5f5' : 'white'
              }}
            />
            {form.payout_currency === 'USD' && (
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>USD支付的汇率固定为1.0</p>
            )}
          </div>

          <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
            <label><strong>预计支付金额:</strong></label>
            <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#2e7d32', marginTop: '5px' }}>
              {form.payout_currency === 'USD'
                ? `$${expectedAmount.toFixed(2)}`
                : `¥${expectedAmount.toFixed(2)} ${form.payout_currency}`}
            </p>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              记账金额: ${(parseFloat(String(settlementMonthly?.total_income_usd || 0))).toFixed(2)} USD × 汇率 {form.fx_rate} = {form.payout_currency === 'USD' ? '$' : '¥'}{expectedAmount.toFixed(2)}
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label><strong>备注 (可选):</strong></label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="例如：结算收入"
              style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '60px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={onClose}
              className={styles.searchButton}
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className={styles.generateButton}
              disabled={submitting || !form.account_id}
            >
              {submitting ? '提交中...' : '确认发起支付'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorSettlementPayoutModal;


/**
 * 编辑支付详情弹窗组件
 */
import React from 'react';

interface AdminEditorPayoutDetailModalProps {
  detail: any;
  onClose: () => void;
}

const AdminEditorPayoutDetailModal: React.FC<AdminEditorPayoutDetailModalProps> = ({ detail, onClose }) => {
  // 格式化金额
  const formatCurrency = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '$0.00';
    return `$${num.toFixed(2)}`;
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          padding: '24px',
          borderRadius: '8px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3>支付记录详情 - #{detail.payout.id}</h3>
          <button 
            onClick={onClose} 
            style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
          >
            ×
          </button>
        </div>
        <div style={{ marginBottom: '15px' }}>
          <p><strong>月份:</strong> {detail.payout.month ? new Date(detail.payout.month).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' }) : '-'}</p>
          <p><strong>记账金额(USD):</strong> {formatCurrency(detail.payout.base_amount_usd || 0)}</p>
          <p><strong>实付金额:</strong> {detail.payout.payout_currency === 'USD' ? '$' : '¥'}{parseFloat(detail.payout.payout_amount || 0).toFixed(2)} {detail.payout.payout_currency || 'USD'}</p>
          <p><strong>汇率:</strong> {parseFloat(detail.payout.fx_rate || 1.0).toFixed(4)}</p>
          <p><strong>状态:</strong> {detail.payout.status}</p>
          <p><strong>收款方式:</strong> {detail.payout.method}</p>
          <p><strong>申请时间:</strong> {new Date(detail.payout.requested_at).toLocaleString('zh-CN')}</p>
          {detail.payout.paid_at && (
            <p><strong>支付时间:</strong> {new Date(detail.payout.paid_at).toLocaleString('zh-CN')}</p>
          )}
          {detail.payout.note && (
            <p><strong>备注:</strong> {detail.payout.note}</p>
          )}
        </div>
        {detail.gateway_transaction && (
          <div style={{ marginBottom: '15px', marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <h4>网关交易信息:</h4>
            <p><strong>支付网关:</strong> {detail.gateway_transaction.provider}</p>
            <p><strong>第三方交易号:</strong> {detail.gateway_transaction.provider_tx_id || '-'}</p>
            <p><strong>批次号:</strong> {detail.gateway_transaction.provider_batch_id || '-'}</p>
            <p><strong>状态:</strong> {detail.gateway_transaction.status}</p>
            {detail.gateway_transaction.base_amount_usd && (
              <>
                <p><strong>记账金额(USD):</strong> {formatCurrency(detail.gateway_transaction.base_amount_usd)}</p>
                <p><strong>实付金额:</strong> {detail.gateway_transaction.payout_currency === 'USD' ? '$' : '¥'}{parseFloat(detail.gateway_transaction.payout_amount || 0).toFixed(2)} {detail.gateway_transaction.payout_currency || 'USD'}</p>
                <p><strong>汇率:</strong> {parseFloat(detail.gateway_transaction.fx_rate || 1.0).toFixed(4)}</p>
              </>
            )}
            <p><strong>创建时间:</strong> {detail.gateway_transaction.created_at ? new Date(detail.gateway_transaction.created_at).toLocaleString('zh-CN') : '-'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEditorPayoutDetailModal;


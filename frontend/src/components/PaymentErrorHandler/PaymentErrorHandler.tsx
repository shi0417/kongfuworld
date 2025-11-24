import React, { useState, useEffect } from 'react';

interface PaymentErrorHandlerProps {
  error: string;
  onRetry?: () => void;
  onCancel?: () => void;
}

const PaymentErrorHandler: React.FC<PaymentErrorHandlerProps> = ({ 
  error, 
  onRetry, 
  onCancel 
}) => {
  const [errorDetails, setErrorDetails] = useState<{
    type: 'network' | 'api' | 'stripe' | 'validation' | 'unknown';
    message: string;
    suggestions: string[];
  }>({
    type: 'unknown',
    message: error,
    suggestions: []
  });

  useEffect(() => {
    // 分析错误类型并提供相应的建议
    const analyzeError = (errorMsg: string) => {
      const lowerError = errorMsg.toLowerCase();
      
      if (lowerError.includes('404') || lowerError.includes('not found')) {
        return {
          type: 'api' as const,
          message: 'API端点不存在或路由错误',
          suggestions: [
            '检查网络连接是否正常',
            '刷新页面后重试',
            '如果问题持续存在，请联系技术支持'
          ]
        };
      }
      
      if (lowerError.includes('stripe') || lowerError.includes('payment_intent')) {
        return {
          type: 'stripe' as const,
          message: 'Stripe支付处理错误',
          suggestions: [
            '检查支付信息是否正确',
            '确认银行卡有足够余额',
            '尝试使用其他支付方式',
            '检查网络连接是否稳定'
          ]
        };
      }
      
      if (lowerError.includes('network') || lowerError.includes('timeout')) {
        return {
          type: 'network' as const,
          message: '网络连接问题',
          suggestions: [
            '检查网络连接是否正常',
            '尝试刷新页面',
            '使用其他网络环境重试'
          ]
        };
      }
      
      if (lowerError.includes('validation') || lowerError.includes('required')) {
        return {
          type: 'validation' as const,
          message: '输入信息验证失败',
          suggestions: [
            '检查所有必填字段是否已填写',
            '确认输入格式是否正确',
            '重新填写支付信息'
          ]
        };
      }
      
      return {
        type: 'unknown' as const,
        message: errorMsg,
        suggestions: [
          '刷新页面后重试',
          '检查网络连接',
          '尝试使用其他支付方式',
          '联系客服获取帮助'
        ]
      };
    };

    setErrorDetails(analyzeError(error));
  }, [error]);

  const getErrorIcon = () => {
    switch (errorDetails.type) {
      case 'network':
        return '🌐';
      case 'api':
        return '🔧';
      case 'stripe':
        return '💳';
      case 'validation':
        return '📝';
      default:
        return '❌';
    }
  };

  const getErrorColor = () => {
    switch (errorDetails.type) {
      case 'network':
        return '#ff9800';
      case 'api':
        return '#f44336';
      case 'stripe':
        return '#9c27b0';
      case 'validation':
        return '#ff5722';
      default:
        return '#dc3545';
    }
  };

  return (
    <div style={{
      background: '#18191A',
      minHeight: '100vh',
      color: '#fff',
      fontFamily: 'inherit',
      padding: '20px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh'
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '600px',
          padding: '20px'
        }}>
          {/* 错误图标 */}
          <div style={{
            fontSize: '64px',
            marginBottom: '24px'
          }}>
            {getErrorIcon()}
          </div>
          
          {/* 错误标题 */}
          <h1 style={{
            fontSize: '32px',
            marginBottom: '16px',
            color: getErrorColor()
          }}>
            支付失败
          </h1>
          
          {/* 错误描述 */}
          <p style={{
            fontSize: '18px',
            marginBottom: '24px',
            color: '#ccc'
          }}>
            很抱歉，您的支付未能成功完成
          </p>
          
          {/* 错误详情 */}
          <div style={{
            background: '#4d1a1a',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '24px',
            border: `1px solid ${getErrorColor()}`
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              color: getErrorColor()
            }}>
              错误详情
            </h3>
            <p style={{
              margin: '0',
              fontSize: '14px',
              color: '#ffb3b3'
            }}>
              {errorDetails.message}
            </p>
          </div>

          {/* 解决建议 */}
          <div style={{
            background: '#2a2a2a',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '32px',
            border: '1px solid #444'
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              color: '#fff'
            }}>
              💡 解决建议
            </h3>
            <ul style={{
              margin: '0',
              paddingLeft: '20px',
              textAlign: 'left',
              fontSize: '14px',
              color: '#ccc'
            }}>
              {errorDetails.suggestions.map((suggestion, index) => (
                <li key={index} style={{ marginBottom: '4px' }}>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>

          {/* 操作按钮 */}
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                重试支付
              </button>
            )}
            {onCancel && (
              <button
                onClick={onCancel}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                取消支付
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentErrorHandler;

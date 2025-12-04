// Stripe fallback utility
// 当Stripe.js加载失败时提供备用方案

import type { Stripe } from '@stripe/stripe-js';

export const createStripeFallback = () => {
  console.warn('⚠️ Stripe.js加载失败，使用备用方案');
  
  return {
    // 模拟Stripe对象的基本方法
    confirmCardPayment: async (clientSecret: string, options: any) => {
      console.log('🔧 Stripe备用方案: 模拟支付确认');
      return {
        error: {
          type: 'card_error',
          code: 'payment_method_not_available',
          message: 'Stripe服务暂时不可用，请稍后重试或使用其他支付方式'
        },
        paymentIntent: null
      };
    },
    createPaymentMethod: async (options: any) => {
      console.log('🔧 Stripe备用方案: 模拟创建支付方法');
      return {
        error: {
          type: 'card_error',
          code: 'payment_method_not_available',
          message: 'Stripe服务暂时不可用'
        },
        paymentMethod: null
      };
    },
    retrievePaymentIntent: async (clientSecret: string) => {
      console.log('🔧 Stripe备用方案: 模拟获取支付意图');
      return {
        error: {
          type: 'api_error',
          message: 'Stripe服务暂时不可用'
        },
        paymentIntent: null
      };
    }
  };
};

export const loadStripeFallback = async (publishableKey: string): Promise<Stripe | null> => {
  try {
    // 尝试加载真实的Stripe
    const { loadStripe } = await import('@stripe/stripe-js');
    const stripe = await loadStripe(publishableKey);
    
    if (stripe) {
      console.log('✅ Stripe.js加载成功');
      return stripe;
    } else {
      console.warn('⚠️ Stripe.js返回null');
      return null;
    }
  } catch (error) {
    console.error('❌ Stripe.js加载失败:', error);
    return null;
  }
};

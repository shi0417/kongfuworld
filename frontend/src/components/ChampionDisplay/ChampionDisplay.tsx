import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import styles from './ChampionDisplay.module.css';
import PaymentModal from '../PaymentModal/PaymentModal';
import SmartPaymentModal from '../SmartPaymentModal/SmartPaymentModal';
import ApiService from '../../services/ApiService';

interface ChampionTier {
  tier_level: number;
  tier_name: string;
  monthly_price: number | string; // Can be string from database decimal field
  advance_chapters: number;
  description: string;
}

// ChampionConfig interface removed - no longer needed

interface ChampionDisplayProps {
  novelId: number;
  novelTitle: string;
  onSubscribe?: (tierLevel: number) => void;
}

interface PromotionInfo {
  id: number;
  promotion_type: string;
  discount_value: number;
  discount_percentage: number;
  start_at: string;
  end_at: string;
  time_remaining: number;
  time_remaining_formatted: string;
}

const ChampionDisplay: React.FC<ChampionDisplayProps> = ({ novelId, novelTitle, onSubscribe }) => {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<ChampionTier[]>([]);
  const [userStatus, setUserStatus] = useState<any>(null);
  const [promotion, setPromotion] = useState<PromotionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<{
    level: number;
    name: string;
    price: number;
    basePrice?: number;
    advanceChapters: number;
    description: string;
  } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSmartPaymentModal, setShowSmartPaymentModal] = useState(false);
  const [promotionTimeRemaining, setPromotionTimeRemaining] = useState<string | null>(null);
  const [autoRenew, setAutoRenew] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'stripe' | null>(null);
  const [subscriptionClientSecret, setSubscriptionClientSecret] = useState<string | null>(null);
  const [pendingSubscriptionId, setPendingSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    fetchChampionData();
  }, [novelId]);

  // 更新促销倒计时
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (promotion) {
      const updatePromotionTime = () => {
        const now = new Date();
        const endAt = new Date(promotion.end_at);
        const timeRemaining = endAt.getTime() - now.getTime();
        
        if (timeRemaining > 0) {
          const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
          const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
          setPromotionTimeRemaining(`${hours}h:${minutes.toString().padStart(2, '0')}m:${seconds.toString().padStart(2, '0')}s`);
        } else {
          setPromotionTimeRemaining('00h:00m:00s');
          // 促销已过期，刷新数据
          fetchChampionData();
        }
      };
      
      // 立即执行一次
      updatePromotionTime();
      
      // 每秒更新一次
      interval = setInterval(updatePromotionTime, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [promotion]);

  const fetchChampionData = async () => {
    try {
      setLoading(true);
      
      // 获取Champion配置
      const configResponse = await ApiService.request(`/champion/config/${novelId}`);
      
      if (configResponse.success) {
        setTiers(configResponse.data.tiers || []);
        setPromotion(configResponse.data.promotion || null);
      }

      // 获取用户状态
      const userId = user?.id;
      if (!userId) {
        console.error('用户未登录，无法获取Champion状态');
        return;
      }
      
      const statusResponse = await ApiService.request(`/champion/status/${novelId}?userId=${userId}`);
      
      if (statusResponse.success) {
        console.log('ChampionDisplay: 用户状态', statusResponse.data);
        setUserStatus(statusResponse.data);
      } else {
        console.error('ChampionDisplay: 获取用户状态失败', statusResponse.message);
      }
    } catch (error) {
      console.error('获取Champion数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算折扣价
  const calculateDiscountedPrice = (basePrice: number): number => {
    if (!promotion || basePrice <= 0) return basePrice;
    
    const discount = promotion.discount_value;
    if (discount === 0) {
      return 0; // 限时免费
    } else if (discount < 1) {
      // 折扣价：向上取整到分
      const discounted = Math.ceil(basePrice * discount * 100) / 100;
      return discounted < 0.01 ? 0.01 : discounted;
    }
    return basePrice;
  };

  const handleSubscribe = (tier: ChampionTier) => {
    const basePrice = Number(tier.monthly_price) || 0;
    const finalPrice = calculateDiscountedPrice(basePrice);
    
    // 转换字段名以匹配PaymentModal期望的接口
    const convertedTier = {
      level: tier.tier_level,
      name: tier.tier_name,
      price: finalPrice, // 使用折扣价
      basePrice: basePrice, // 保存原价
      advanceChapters: tier.advance_chapters,
      description: tier.description
    };
    setSelectedTier(convertedTier);
    setShowPaymentModal(true);
  };

  const handlePaymentConfirm = async (selectedPaymentMethod: string) => {
    if (!selectedTier) return;

    setPaymentMethod(selectedPaymentMethod as 'paypal' | 'stripe');

    try {
      if (selectedPaymentMethod === 'paypal') {
        // 处理PayPal支付（保持原有逻辑不变）
        await handlePayPalPayment();
      } else if (selectedPaymentMethod === 'stripe') {
        // Stripe支付：根据是否勾选自动续费选择不同流程
        if (autoRenew) {
          // 自动续费订阅流程
          await handleStripeSubscription();
        } else {
          // 一次性支付流程（保持原有逻辑）
          await handleStripePayment();
        }
      }
    } catch (error) {
      alert('支付失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 处理 Stripe 自动续费订阅
  const handleStripeSubscription = async () => {
    if (!selectedTier || !user || !user.id) {
      alert('请先登录后再进行支付');
      return;
    }

    try {
      const response = await ApiService.request('/payment/stripe/champion-subscription', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          novelId: novelId,
          tierLevel: selectedTier.level,
          tierName: selectedTier.name,
          autoRenew: true
        })
      }) as any; // 后端直接在顶层返回字段，使用类型断言

      if (response.success) {
        // 如果返回了 code: 'ALREADY_SUBSCRIBED'，说明用户已有 active 订阅
        // 策略 B：引导用户使用手动支付来延长/升级订阅
        if (response.code === 'ALREADY_SUBSCRIBED' || response.existingSubscription) {
          console.log('[订阅创建] 用户已有 active 订阅，切换到手动支付流程');
          // 关闭确认模态框，切换到手动支付流程
          setShowPaymentModal(false);
          setAutoRenew(false); // 关闭自动续费选项
          // 直接调用手动支付流程
          await handleStripePayment();
          return;
        }
        
        // 如果返回了 clientSecret，说明需要完成支付
        if (response.clientSecret && response.status === 'incomplete') {
          // 需要用户完成支付，打开 SmartPaymentModal
          console.log('[订阅创建] 需要完成支付，clientSecret:', response.clientSecret);
          setSubscriptionClientSecret(response.clientSecret);
          setPendingSubscriptionId(response.subscriptionId);
          setShowPaymentModal(false); // 关闭确认模态框
          setShowSmartPaymentModal(true); // 打开支付模态框
        } else {
          // 订阅已成功创建并激活
          const periodStart = response.currentPeriodStart ? new Date(response.currentPeriodStart).toLocaleDateString() : 'N/A';
          const periodEnd = response.currentPeriodEnd ? new Date(response.currentPeriodEnd).toLocaleDateString() : 'N/A';
          alert(`订阅创建成功！\n订阅ID: ${response.subscriptionId}\n当前周期开始: ${periodStart}\n当前周期结束: ${periodEnd}`);
          // 刷新页面数据
          fetchChampionData();
          setShowPaymentModal(false);
          setAutoRenew(false);
          setPaymentMethod(null);
        }
      } else {
        throw new Error(response.message || '创建订阅失败');
      }
    } catch (error) {
      throw new Error('创建订阅失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 处理 SmartPaymentModal 支付成功（订阅支付）
  const handleSmartPaymentSuccess = async (orderId: string) => {
    console.log('[订阅支付] 支付成功，订阅ID:', orderId);
    
    // 刷新页面数据
    await fetchChampionData();
    
    // 关闭支付模态框
    setShowSmartPaymentModal(false);
    setSubscriptionClientSecret(null);
    setPendingSubscriptionId(null);
    setShowPaymentModal(false);
    setAutoRenew(false);
    setPaymentMethod(null);
    
    // 跳转到支付成功页面（与 PayPal 使用相同的页面）
    window.location.href = `/payment/success?orderId=${orderId}`;
  };

  // 处理 SmartPaymentModal 支付错误
  const handleSmartPaymentError = (error: string) => {
    console.error('[订阅支付] 支付失败:', error);
    alert(`支付失败: ${error}`);
    // 不关闭模态框，让用户重试
  };

  const handlePayPalPayment = async () => {
    if (!selectedTier) return;

    // 检查用户是否已登录
    if (!user || !user.id) {
      alert('请先登录后再进行支付');
      return;
    }

    try {
      // 保存当前小说ID到localStorage，用于支付成功后的重定向
      localStorage.setItem('currentNovelId', novelId.toString());
      
      // 创建PayPal支付订单（使用折扣价）
      const response = await ApiService.request('/payment/paypal/create', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id, // 使用当前登录用户的ID
          amount: selectedTier.price, // 使用折扣价
          baseAmount: selectedTier.basePrice || selectedTier.price, // 原价（用于显示）
          currency: 'USD',
          description: `KongFuWorld Champion Subscription - ${selectedTier.name}${promotion ? ` (${promotion.discount_percentage}% OFF)` : ''}`,
          novelId: novelId, // 传递当前小说ID
          tierLevel: selectedTier.level, // 传递等级
          tierName: selectedTier.name // 传递等级名称
        })
      });
      
      if (response.success && (response as any).approvalUrl) {
        // 重定向到PayPal支付页面
        window.location.href = (response as any).approvalUrl;
      } else {
        alert('创建PayPal支付失败: ' + (response.message || '未知错误'));
      }
    } catch (error) {
      throw new Error('PayPal支付创建失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleStripePayment = () => {
    // 检查用户是否已登录
    if (!user || !user.id) {
      alert('请先登录后再进行支付');
      return;
    }

    // 保存当前小说ID到localStorage，用于支付成功后的重定向
    localStorage.setItem('currentNovelId', novelId.toString());
    
    setShowPaymentModal(false);
    setShowSmartPaymentModal(true);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>加载中...</p>
      </div>
    );
  }

  if (!tiers.length) {
    return (
      <div className={styles.error}>
        Champion配置加载失败
      </div>
    );
  }

  return (
    <div className={styles.championDisplay}>
      {/* 头部信息 */}
      <div className={styles.header}>
        <div className={styles.championLogo}>
          <span className={styles.logoIcon}>👑</span>
          <h2>Be a Champion</h2>
        </div>
        <p className={styles.subtitle}>
          Directly support authors and translators, and be rewarded for it!
        </p>
        <p className={styles.noWaiting}>No more waiting!</p>
      </div>

      {/* 访问权限说明 */}
      <div className={styles.accessInfo}>
        <div className={styles.freeAccess}>
          <div className={styles.accessTitle}>FREE</div>
          <div className={styles.accessDescription}>ALL Published Chapters</div>
        </div>
        <div className={styles.plusIcon}>+</div>
        <div className={styles.advanceAccess}>
          <div className={styles.accessTitle}>Early Access</div>
          <div className={styles.accessDescription}>
            up to <span className={styles.advanceNumber}>
              {tiers.length > 0 ? Math.max(...tiers.map(t => t.advance_chapters)) : 0}
            </span> Advance Chapters
          </div>
        </div>
      </div>

      {/* Champion等级选择 */}
      <div className={styles.tiersSection}>
        <h3>Choose Champion Tiers</h3>
        <div className={styles.tiersGrid}>
          {tiers.map((tier) => (
            <div key={tier.tier_level} className={styles.tierCard}>
              <div className={styles.tierHeader}>
                <div className={styles.tierName}>{tier.tier_name}</div>
                <div className={styles.tierPrice}>
                  {promotion ? (() => {
                    const basePrice = Number(tier.monthly_price) || 0;
                    const discountedPrice = calculateDiscountedPrice(basePrice);
                    return (
                      <div className={styles.promotionPrice}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span className={styles.originalPrice}>
                            ${basePrice.toFixed(2)}
                          </span>
                          <span className={styles.discountedPrice}>
                            ${discountedPrice.toFixed(2)}
                          </span>
                          <span className={styles.discountBadge}>
                            {promotion.discount_percentage}% OFF
                          </span>
                        </div>
                        <div className={styles.promotionTime}>
                          ⏰ {promotionTimeRemaining || promotion.time_remaining_formatted} remaining
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '2px' }}>/ month</div>
                      </div>
                    );
                  })() : (
                    <span>${(Number(tier.monthly_price) || 0).toFixed(2)} / month</span>
                  )}
                </div>
              </div>
              
              <div className={styles.tierContent}>
                <div className={styles.tierDescription}>
                  All Chapters + {tier.advance_chapters} Advance
                </div>
                <div className={styles.tierBenefit}>
                  {tier.description}
                </div>
              </div>
              
              <button 
                className={styles.subscribeButton}
                onClick={() => handleSubscribe(tier)}
                disabled={userStatus?.isChampion && userStatus?.tier?.level > tier.tier_level}
              >
                {userStatus?.isChampion && userStatus?.tier?.level > tier.tier_level 
                  ? 'Already Have Higher Tier' 
                  : 'SUBSCRIBE'
                }
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 用户当前状态 */}
      {userStatus?.isChampion && (
        <div className={styles.currentStatus}>
          <h4>当前Champion状态</h4>
          <div className={styles.statusInfo}>
            <span className={styles.statusTier}>{userStatus.tier.name}</span>
            <span className={styles.statusPrice}>${userStatus.tier.price}/月</span>
            <span className={styles.statusExpiry}>
              到期时间: {new Date(userStatus.tier.endDate).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      {/* 付款模态框 */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setAutoRenew(false);
          setPaymentMethod(null);
        }}
        tier={selectedTier!}
        novelTitle={novelTitle}
        onConfirm={handlePaymentConfirm}
        promotion={promotion ? {
          discount_percentage: promotion.discount_percentage,
          time_remaining_formatted: promotionTimeRemaining || promotion.time_remaining_formatted
        } : null}
        autoRenew={autoRenew}
        onAutoRenewChange={setAutoRenew}
      />

      {/* 智能支付模态框 */}
      {selectedTier && (
        <SmartPaymentModal
          isOpen={showSmartPaymentModal}
          onClose={() => {
            setShowSmartPaymentModal(false);
            setSubscriptionClientSecret(null);
            setPendingSubscriptionId(null);
          }}
          tier={{
            name: selectedTier.name,
            price: selectedTier.price,
            basePrice: selectedTier.basePrice,
            description: selectedTier.description,
            level: selectedTier.level // 传递等级
          }}
          novelId={novelId}
          onPaymentSuccess={handleSmartPaymentSuccess}
          onPaymentError={handleSmartPaymentError}
          promotion={promotion ? {
            discount_percentage: promotion.discount_percentage,
            time_remaining_formatted: promotionTimeRemaining || promotion.time_remaining_formatted
          } : null}
          clientSecret={subscriptionClientSecret || undefined}
          subscriptionId={pendingSubscriptionId || undefined}
        />
      )}
    </div>
  );
};

export default ChampionDisplay;
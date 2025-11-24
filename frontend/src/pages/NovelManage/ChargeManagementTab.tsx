import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import ApiService from '../../services/ApiService';
import Toast from '../../components/Toast/Toast';
import styles from './ChargeManagementTab.module.css';

// 解锁价格配置接口（只读）
interface UnlockPriceConfig {
  karma_per_1000: number;
  min_karma: number;
  max_karma: number;
  default_free_chapters: number;
}

// 促销活动接口
interface PricingPromotion {
  id: number;
  promotion_type: 'discount' | 'free';
  discount_value: number;
  start_at: string;
  end_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'active' | 'expired';
  remark?: string;
  review_note?: string; // 平台回复：运营审核后给作者的回复
  created_at?: string;
  approved_at?: string;
  approved_by?: number;
}

// 示例章节价格预览
interface SampleChapter {
  chapter_number: number;
  title: string;
  word_count: number;
  base_price: number;
  final_price: number;
  reason: string;
}

// 价格信息响应
interface PricingInfoResponse {
  unlock_config: UnlockPriceConfig;
  active_promotion: PricingPromotion | null;
  next_promotion: PricingPromotion | null;
  promotions: PricingPromotion[];
  sample_chapters: SampleChapter[];
  server_time: string;
}

interface ChargeManagementTabProps {
  novelId: number;
}

interface ChargeManagementTabProps {
  novelId: number;
}

const ChargeManagementTab: React.FC<ChargeManagementTabProps> = ({ novelId }) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pricingInfo, setPricingInfo] = useState<PricingInfoResponse | null>(null);
  
  // 促销申请表单状态
  const [submitting, setSubmitting] = useState(false);
  const [promotionModalVisible, setPromotionModalVisible] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState<number | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deletingPromotionId, setDeletingPromotionId] = useState<number | null>(null);
  const [promotionFormData, setPromotionFormData] = useState({
    promotion_type: 'discount' as 'discount' | 'free',
    discount_value: 0.8,
    start_at: '',
    end_at: '',
    note: ''
  });
  
  // Toast状态
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  // 加载价格信息
  useEffect(() => {
    if (!user?.id) return;
    
    const loadPricingInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 调用新的API获取价格信息
        const response = await ApiService.get(`/author/novels/${novelId}/pricing`);
        
        if (response.success && response.data) {
          setPricingInfo(response.data);
        } else {
          setError(response.message || (language === 'zh' ? '加载失败' : 'Load failed'));
        }
      } catch (err: any) {
        console.error('加载价格信息失败:', err);
        setError(err.message || (language === 'zh' ? '加载失败' : 'Load failed'));
      } finally {
        setLoading(false);
      }
    };
    
    loadPricingInfo();
  }, [novelId, user?.id, language]);

  // 打开修改弹窗
  const handleEditPromotion = (promo: PricingPromotion) => {
    if (promo.status !== 'pending') {
      showToast(
        language === 'zh' ? '只能修改待审核状态的促销活动' : 'Only pending promotions can be edited',
        'warning'
      );
      return;
    }
    
    setEditingPromotionId(promo.id);
    setPromotionFormData({
      promotion_type: promo.promotion_type,
      discount_value: promo.discount_value,
      start_at: promo.start_at.slice(0, 16), // 转换为datetime-local格式
      end_at: promo.end_at.slice(0, 16),
      note: promo.remark || ''
    });
    setPromotionModalVisible(true);
  };

  // 打开删除确认对话框
  const handleDeleteClick = (promoId: number) => {
    setDeletingPromotionId(promoId);
    setDeleteConfirmVisible(true);
  };

  // 确认删除促销活动
  const handleConfirmDelete = async () => {
    if (!deletingPromotionId) return;
    
    try {
      const response = await ApiService.delete(`/author/novels/${novelId}/pricing-promotion-requests/${deletingPromotionId}`);
      
      if (response.success) {
        showToast(
          language === 'zh' ? '删除成功' : 'Deleted successfully',
          'success'
        );
        
        // 关闭确认对话框
        setDeleteConfirmVisible(false);
        setDeletingPromotionId(null);
        
        // 重新加载数据
        const refreshResponse = await ApiService.get(`/author/novels/${novelId}/pricing`);
        if (refreshResponse.success && refreshResponse.data) {
          setPricingInfo(refreshResponse.data);
        }
      } else {
        showToast(response.message || (language === 'zh' ? '删除失败' : 'Delete failed'), 'error');
      }
    } catch (err: any) {
      console.error('删除促销活动失败:', err);
      showToast(err.message || (language === 'zh' ? '删除失败' : 'Delete failed'), 'error');
    }
  };

  // 取消删除
  const handleCancelDelete = () => {
    setDeleteConfirmVisible(false);
    setDeletingPromotionId(null);
  };

  // 提交促销申请或修改
  const handleSubmitPromotion = async () => {
    if (!user?.id) return;
    
    // 验证折扣值（作者只能申请0.3-1.0）
    if (promotionFormData.promotion_type === 'discount' && 
        (promotionFormData.discount_value < 0.3 || promotionFormData.discount_value > 1.0)) {
      showToast(
        language === 'zh' 
          ? '折扣值必须在0.3-1.0之间（30%-100%）' 
          : 'Discount value must be between 0.3-1.0 (30%-100%)',
        'warning'
      );
      return;
    }
    
    // 验证时间
    const startTime = new Date(promotionFormData.start_at);
    const endTime = new Date(promotionFormData.end_at);
    const now = new Date();
    
    if (startTime <= now) {
      showToast(language === 'zh' ? '开始时间必须大于当前时间' : 'Start time must be in the future', 'warning');
      return;
    }
    
    if (endTime <= startTime) {
      showToast(language === 'zh' ? '结束时间必须大于开始时间' : 'End time must be after start time', 'warning');
      return;
    }
    
    try {
      setSubmitting(true);
      
      let response;
      if (editingPromotionId) {
        // 修改
        response = await ApiService.put(`/author/novels/${novelId}/pricing-promotion-requests/${editingPromotionId}`, {
          promotion_type: promotionFormData.promotion_type,
          discount_value: promotionFormData.promotion_type === 'free' ? 0 : promotionFormData.discount_value,
          start_at: promotionFormData.start_at,
          end_at: promotionFormData.end_at,
          note: promotionFormData.note
        });
      } else {
        // 新增
        response = await ApiService.post(`/author/novels/${novelId}/pricing-promotion-requests`, {
          promotion_type: promotionFormData.promotion_type,
          discount_value: promotionFormData.promotion_type === 'free' ? 0 : promotionFormData.discount_value,
          start_at: promotionFormData.start_at,
          end_at: promotionFormData.end_at,
          note: promotionFormData.note
        });
      }
      
      if (response.success) {
        showToast(
          editingPromotionId 
            ? (language === 'zh' ? '修改成功' : 'Updated successfully')
            : (language === 'zh' ? '促销活动申请成功，等待审核' : 'Promotion application submitted, pending approval'),
          'success'
        );
        setPromotionModalVisible(false);
        setEditingPromotionId(null);
        setPromotionFormData({ promotion_type: 'discount', discount_value: 0.8, start_at: '', end_at: '', note: '' });
        
        // 重新加载数据
        const refreshResponse = await ApiService.get(`/author/novels/${novelId}/pricing`);
        if (refreshResponse.success && refreshResponse.data) {
          setPricingInfo(refreshResponse.data);
        }
      } else {
        showToast(response.message || (language === 'zh' ? '操作失败' : 'Operation failed'), 'error');
      }
    } catch (err: any) {
      console.error('操作失败:', err);
      showToast(err.message || (language === 'zh' ? '操作失败' : 'Operation failed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 关闭弹窗
  const handleCloseModal = () => {
    setPromotionModalVisible(false);
    setEditingPromotionId(null);
    setPromotionFormData({ promotion_type: 'discount', discount_value: 0.8, start_at: '', end_at: '', note: '' });
  };

  if (loading) {
    return <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>;
  }

  if (error || !pricingInfo) {
    return (
      <div className={styles.error}>
        {error || (language === 'zh' ? '加载失败' : 'Load failed')}
      </div>
    );
  }

  const { unlock_config, active_promotion, next_promotion, promotions, sample_chapters, server_time } = pricingInfo;

  return (
    <div className={styles.container}>
      {/* Toast提示 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}

      {/* Section 1: 收费规则只读展示 */}
      <div className={styles.settingsSection}>
        <h3 className={styles.sectionTitle}>
          {language === 'zh' ? '本书收费规则（平台统一按字数计价）' : 'Pricing Rules (Platform Unified Per-Word Pricing)'}
        </h3>
        <div className={styles.readOnlyConfig}>
          <div className={styles.configItem}>
            <span className={styles.configLabel}>
              {language === 'zh' ? '按字数计价：' : 'Per-word pricing: '}
            </span>
            <span className={styles.configValue}>
              {language === 'zh' ? '每 1000 字' : 'Per 1000 words'} <strong style={{ color: '#ff6b00' }}>{unlock_config.karma_per_1000}</strong> karma
            </span>
          </div>
          <div className={styles.configItem}>
            <span className={styles.configLabel}>
              {language === 'zh' ? '单章价格范围：' : 'Price range per chapter: '}
            </span>
            <span className={styles.configValue}>
              {unlock_config.min_karma} ~ {unlock_config.max_karma} karma
            </span>
          </div>
          <div className={styles.configItem}>
            <span className={styles.configLabel}>
              {language === 'zh' ? `前 ${unlock_config.default_free_chapters} 章：` : `First ${unlock_config.default_free_chapters} chapters: `}
            </span>
            <span className={styles.configValue}>
              {language === 'zh' ? '免费阅读' : 'Free reading'}
            </span>
          </div>
          <div className={styles.configHint}>
            {language === 'zh' 
              ? '系统会根据章节字数自动计算价格，并限制在上述范围内。计价规则由平台统一设置，作者无法单独修改单章价格。'
              : 'The system will automatically calculate prices based on chapter word count and limit them to the above range. Pricing rules are set uniformly by the platform, authors cannot modify individual chapter prices.'}
          </div>
        </div>
      </div>

      {/* Section 2: 章节价格预览（只读表格） */}
      <div className={styles.previewSection}>
        <h3 className={styles.sectionTitle}>
          {language === 'zh' ? '章节价格预览' : 'Chapter Price Preview'}
        </h3>
        {active_promotion ? (
          <div className={styles.activePromotionBanner}>
            {language === 'zh' ? '当前活动：' : 'Current promotion: '}
            {active_promotion.promotion_type === 'discount'
              ? `${language === 'zh' ? '折扣' : 'Discount'} ${Math.round(active_promotion.discount_value * 100)}%`
              : language === 'zh' ? '限时免费' : 'Limited Free'}
            {' '}
            ({new Date(active_promotion.start_at).toLocaleString()} ~ {new Date(active_promotion.end_at).toLocaleString()})
          </div>
        ) : (
          <div className={styles.noPromotionBanner}>
            {language === 'zh' ? '当前暂无线上活动。' : 'No active promotions.'}
          </div>
        )}
        <div className={styles.previewTable}>
          <table>
            <thead>
              <tr>
                <th>{language === 'zh' ? '章节' : 'Chapter'}</th>
                <th>{language === 'zh' ? '字数' : 'Words'}</th>
                <th>{language === 'zh' ? '基础价格' : 'Base Price'}</th>
                <th>{language === 'zh' ? '当前价格' : 'Current Price'}</th>
                <th>{language === 'zh' ? '说明' : 'Reason'}</th>
              </tr>
            </thead>
            <tbody>
              {sample_chapters.map((ch) => {
                // 翻译reason字段
                let translatedReason = ch.reason;
                if (language !== 'zh') {
                  if (ch.reason.includes('前') && ch.reason.includes('章免费')) {
                    const match = ch.reason.match(/前(\d+)章免费/);
                    if (match) {
                      translatedReason = `First ${match[1]} chapters free`;
                    }
                  } else if (ch.reason === '字数不足，使用最低价格') {
                    translatedReason = 'Insufficient words, using minimum price';
                  } else if (ch.reason === '按字数计算') {
                    translatedReason = 'Calculated by word count';
                  } else if (ch.reason === '限时免费活动') {
                    translatedReason = 'Limited-time free promotion';
                  } else if (ch.reason.includes('活动') && ch.reason.includes('%折扣生效')) {
                    const match = ch.reason.match(/活动(\d+)%折扣生效/);
                    if (match) {
                      translatedReason = `Promotion ${match[1]}% discount active`;
                    }
                  }
                }
                
                return (
                  <tr key={ch.chapter_number}>
                    <td>{language === 'zh' ? `第 ${ch.chapter_number} 章` : `Chapter ${ch.chapter_number}`}</td>
                    <td>{ch.word_count}</td>
                    <td>{ch.base_price} karma</td>
                    <td className={styles.finalPrice}>{ch.final_price} karma</td>
                    <td className={styles.reason}>{translatedReason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: 促销活动展示 & 申请表单 */}
      <div className={styles.promotionSection}>
        <div className={styles.promotionHeader}>
          <h3 className={styles.sectionTitle}>
            {language === 'zh' ? '限时活动 / 折扣申请' : 'Limited-Time Promotions / Discount Applications'}
          </h3>
          <button
            className={styles.applyPromotionButton}
            onClick={() => setPromotionModalVisible(true)}
          >
            {language === 'zh' ? '+ 申请促销活动' : '+ Apply Promotion'}
          </button>
        </div>
        
        <div className={styles.serverTime}>
          {language === 'zh' ? '服务器时间：' : 'Server time: '}{new Date(server_time).toLocaleString()}
        </div>
        
        {active_promotion && (
          <div className={styles.activePromotionCard}>
            <div className={styles.promotionCardHeader}>
              <span className={styles.promotionBadge}>
                {language === 'zh' ? '进行中活动' : 'Active Promotion'}
              </span>
            </div>
            <div className={styles.promotionCardBody}>
              <p>
                {active_promotion.promotion_type === 'discount'
                  ? `${language === 'zh' ? '折扣' : 'Discount'} ${Math.round(active_promotion.discount_value * 100)}%`
                  : language === 'zh' ? '限时免费' : 'Limited Free'}
              </p>
              <p className={styles.promotionTime}>
                {new Date(active_promotion.start_at).toLocaleString()} ~ {new Date(active_promotion.end_at).toLocaleString()}
              </p>
            </div>
          </div>
        )}
        
        {next_promotion && (
          <div className={styles.nextPromotionCard}>
            <div className={styles.promotionCardHeader}>
              <span className={styles.promotionBadge}>
                {language === 'zh' ? '已排期活动' : 'Scheduled Promotion'}
              </span>
            </div>
            <div className={styles.promotionCardBody}>
              <p>
                {next_promotion.promotion_type === 'discount'
                  ? `${language === 'zh' ? '折扣' : 'Discount'} ${Math.round(next_promotion.discount_value * 100)}%`
                  : language === 'zh' ? '限时免费' : 'Limited Free'}
              </p>
              <p className={styles.promotionTime}>
                {new Date(next_promotion.start_at).toLocaleString()} ~ {new Date(next_promotion.end_at).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* 促销活动列表 */}
        {pricingInfo.promotions && pricingInfo.promotions.length > 0 && (
          <div className={styles.promotionsListSection}>
            <h4 className={styles.promotionsListTitle}>
              {language === 'zh' ? '我的促销活动申请' : 'My Promotion Applications'}
            </h4>
            <div className={styles.promotionsList}>
              {pricingInfo.promotions.map((promo) => (
                <div key={promo.id} className={styles.promotionListItem}>
                  <div className={styles.promotionListItemHeader}>
                    <div className={styles.promotionListItemInfo}>
                      <span className={styles.promotionListItemType}>
                        {promo.promotion_type === 'discount'
                          ? `${language === 'zh' ? '折扣' : 'Discount'} ${Math.round(promo.discount_value * 100)}%`
                          : language === 'zh' ? '限时免费' : 'Limited Free'}
                      </span>
                      <span className={`${styles.promotionListItemStatus} ${styles[`status_${promo.status}`]}`}>
                        {language === 'zh' 
                          ? promo.status === 'pending' ? '待审核' 
                            : promo.status === 'approved' ? '已通过'
                            : promo.status === 'rejected' ? '已拒绝'
                            : promo.status === 'scheduled' ? '已排期'
                            : promo.status === 'active' ? '进行中'
                            : '已过期'
                          : promo.status}
                      </span>
                    </div>
                    {/* 操作按钮 */}
                    <div className={styles.promotionListItemActions}>
                      {(promo.status === 'pending' || promo.status === 'rejected') && (
                        <>
                          {promo.status === 'pending' && (
                            <button
                              className={styles.promotionActionButton}
                              onClick={() => handleEditPromotion(promo)}
                              title={language === 'zh' ? '修改' : 'Edit'}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11.333 2.00001C11.5084 1.82445 11.7163 1.68506 11.9448 1.59128C12.1733 1.4975 12.4176 1.45117 12.6643 1.45501C12.911 1.45885 13.1538 1.51277 13.3786 1.61348C13.6034 1.71419 13.8058 1.85945 13.9733 2.04001C14.1409 2.22057 14.2703 2.43272 14.3543 2.66432C14.4383 2.89592 14.4751 3.14214 14.4623 3.38801C14.4495 3.63388 14.3873 3.87422 14.2793 4.09401C14.1713 4.3138 14.0201 4.50856 13.8337 4.66668L13.3337 5.16668L10.8337 2.66668L11.333 2.00001ZM10 3.33334L12.5 5.83334L5.83333 12.5H3.33333V10L10 3.33334Z" fill="currentColor"/>
                              </svg>
                              <span>{language === 'zh' ? '修改' : 'Edit'}</span>
                            </button>
                          )}
                          <button
                            className={`${styles.promotionActionButton} ${styles.promotionActionButtonDanger}`}
                            onClick={() => handleDeleteClick(promo.id)}
                            title={language === 'zh' ? '删除' : 'Delete'}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5.5 5.5C5.77614 5.5 6 5.72386 6 6V12C6 12.2761 5.77614 12.5 5.5 12.5C5.22386 12.5 5 12.2761 5 12V6C5 5.72386 5.22386 5.5 5.5 5.5Z" fill="currentColor"/>
                              <path d="M8 5.5C8.27614 5.5 8.5 5.72386 8.5 6V12C8.5 12.2761 8.27614 12.5 8 12.5C7.72386 12.5 7.5 12.2761 7.5 12V6C7.5 5.72386 7.72386 5.5 8 5.5Z" fill="currentColor"/>
                              <path d="M11 6C11 5.72386 10.7761 5.5 10.5 5.5C10.2239 5.5 10 5.72386 10 6V12C10 12.2761 10.2239 12.5 10.5 12.5C10.7761 12.5 11 12.2761 11 12V6Z" fill="currentColor"/>
                              <path fillRule="evenodd" clipRule="evenodd" d="M10.5 2H5.5C4.67157 2 4 2.67157 4 3.5V13.5C4 14.3284 4.67157 15 5.5 15H10.5C11.3284 15 12 14.3284 12 13.5V3.5C12 2.67157 11.3284 2 10.5 2ZM5.5 3H10.5C10.7761 3 11 3.22386 11 3.5V13.5C11 13.7761 10.7761 14 10.5 14H5.5C5.22386 14 5 13.7761 5 13.5V3.5C5 3.22386 5.22386 3 5.5 3Z" fill="currentColor"/>
                              <path d="M2 4.5C2 4.22386 2.22386 4 2.5 4H3.5C3.77614 4 4 4.22386 4 4.5C4 4.77614 3.77614 5 3.5 5H2.5C2.22386 5 2 4.77614 2 4.5Z" fill="currentColor"/>
                              <path d="M13.5 4C13.2239 4 13 4.22386 13 4.5C13 4.77614 13.2239 5 13.5 5H14.5C14.7761 5 15 4.77614 15 4.5C15 4.22386 14.7761 4 14.5 4H13.5Z" fill="currentColor"/>
                            </svg>
                            <span>{language === 'zh' ? '删除' : 'Delete'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={styles.promotionListItemBody}>
                    <p className={styles.promotionListItemTime}>
                      {language === 'zh' ? '活动时间：' : 'Time: '}
                      {new Date(promo.start_at).toLocaleString()} ~ {new Date(promo.end_at).toLocaleString()}
                    </p>
                    {promo.remark && (
                      <p className={styles.promotionListItemRemark}>
                        {language === 'zh' ? '备注：' : 'Remark: '}{promo.remark}
                      </p>
                    )}
                    {promo.review_note && (
                      <p className={styles.promotionListItemReviewNote}>
                        {language === 'zh' ? '平台回复：' : 'Platform Reply: '}{promo.review_note}
                      </p>
                    )}
                    {promo.status === 'rejected' && promo.remark && (
                      <p className={styles.promotionListItemRejectReason}>
                        {language === 'zh' ? '拒绝原因：' : 'Rejection reason: '}{promo.remark}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!pricingInfo.promotions || pricingInfo.promotions.length === 0) && (
          <div className={styles.noPromotionsMessage}>
            {language === 'zh' ? '暂无促销活动申请记录' : 'No promotion applications yet'}
          </div>
        )}
      </div>

      {/* 促销活动申请弹窗 */}
      {promotionModalVisible && (
        <div 
          className={styles.modalOverlay}
          onClick={handleCloseModal}
        >
          <div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>{editingPromotionId ? (language === 'zh' ? '修改促销活动' : 'Edit Promotion') : (language === 'zh' ? '申请促销活动' : 'Apply Promotion')}</h3>
              <button className={styles.modalClose} onClick={handleCloseModal}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>
                  {language === 'zh' ? '活动类型' : 'Promotion Type'} <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  value={promotionFormData.promotion_type}
                  onChange={(e) => setPromotionFormData({ 
                    ...promotionFormData, 
                    promotion_type: e.target.value as 'discount' | 'free' 
                  })}
                  className={styles.formInput}
                >
                  <option value="discount">{language === 'zh' ? '折扣活动' : 'Discount'}</option>
                  <option value="free">{language === 'zh' ? '限时免费（需要平台审核）' : 'Limited Free (Requires Platform Approval)'}</option>
                </select>
              </div>
              
              {promotionFormData.promotion_type === 'discount' && (
                <div className={styles.formGroup}>
                  <label>
                    {language === 'zh' ? '期望折扣（0~1）' : 'Expected Discount (0~1)'} <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.3}
                    max={1}
                    value={promotionFormData.discount_value}
                    onChange={(e) => setPromotionFormData({ 
                      ...promotionFormData, 
                      discount_value: parseFloat(e.target.value) || 0.8 
                    })}
                    className={styles.formInput}
                  />
                  <span className={styles.inputHint}>
                    {language === 'zh' 
                      ? `当前约为 ${Math.round(promotionFormData.discount_value * 100)} 折`
                      : `Currently about ${Math.round(promotionFormData.discount_value * 100)}% off`}
                  </span>
                </div>
              )}
              
              <div className={styles.formGroup}>
                <label>
                  {language === 'zh' ? '期望开始时间' : 'Expected Start Time'} <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={promotionFormData.start_at}
                  onChange={(e) => setPromotionFormData({ ...promotionFormData, start_at: e.target.value })}
                  className={styles.formInput}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>
                  {language === 'zh' ? '期望结束时间' : 'Expected End Time'} <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={promotionFormData.end_at}
                  onChange={(e) => setPromotionFormData({ ...promotionFormData, end_at: e.target.value })}
                  className={styles.formInput}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>
                  {language === 'zh' ? '申请说明' : 'Application Note'}
                </label>
                <textarea
                  value={promotionFormData.note}
                  onChange={(e) => setPromotionFormData({ ...promotionFormData, note: e.target.value })}
                  rows={3}
                  className={styles.formInput}
                  placeholder={language === 'zh' ? '例如：新书上架，希望三天6折冲榜...' : 'e.g., New book launch, hoping for 3-day 60% discount to boost rankings...'}
                />
              </div>
              
              <div className={styles.formHint}>
                {language === 'zh' 
                  ? '提示：具体折扣和时间以平台审核结果为准，平台可能根据整体活动策略调整。'
                  : 'Note: Final discount and time are subject to platform approval, platform may adjust based on overall campaign strategy.'}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnCancel} onClick={handleCloseModal}>
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button 
                className={styles.modalBtnSubmit} 
                onClick={handleSubmitPromotion}
                disabled={submitting}
              >
                {submitting 
                  ? (language === 'zh' ? '提交中...' : 'Submitting...') 
                  : editingPromotionId 
                    ? (language === 'zh' ? '保存修改' : 'Save Changes')
                    : (language === 'zh' ? '提交活动申请' : 'Submit Application')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteConfirmVisible && (
        <div 
          className={styles.deleteConfirmOverlay}
          onClick={handleCancelDelete}
        >
          <div 
            className={styles.deleteConfirmModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.deleteConfirmIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 8L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className={styles.deleteConfirmTitle}>
              {language === 'zh' ? '确认删除' : 'Confirm Delete'}
            </h3>
            <p className={styles.deleteConfirmMessage}>
              {language === 'zh' 
                ? '确定要删除这个促销活动吗？删除后无法恢复。' 
                : 'Are you sure you want to delete this promotion? This action cannot be undone.'}
            </p>
            <div className={styles.deleteConfirmActions}>
              <button 
                className={styles.deleteConfirmCancel}
                onClick={handleCancelDelete}
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button 
                className={styles.deleteConfirmDelete}
                onClick={handleConfirmDelete}
              >
                {language === 'zh' ? '确认删除' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChargeManagementTab;

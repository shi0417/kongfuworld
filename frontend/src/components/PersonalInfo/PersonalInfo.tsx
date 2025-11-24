import React, { useState, useEffect } from 'react';
import ApiService from '../../services/ApiService';
import AuthService from '../../services/AuthService';
import Toast from '../Toast/Toast';
import styles from './PersonalInfo.module.css';

interface PersonalInfoData {
  id: number;
  username: string;
  email: string;
  pen_name: string | null;
  qq_number: string | null;
  wechat_number: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null; // 脱敏显示（带国家区号）
  emergency_contact_phone_raw: string | null; // 真实号码，用于编辑
  emergency_contact_phone_country_code: string | null; // 国家区号
  is_real_name_verified: boolean;
  phone_number: string | null; // 脱敏显示（带国家区号）
  phone_number_raw: string | null; // 真实号码，用于编辑
  phone_country_code: string | null; // 国家区号
  avatar: string | null;
  addresses: Address[];
  identity_verification: IdentityVerification | null;
  bank_cards: BankCard[];
}

interface Address {
  address_id: number;
  address_details: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  is_default: boolean;
}

interface IdentityVerification {
  verification_id: number;
  id_card_number: string | null; // 脱敏显示
  id_card_number_raw: string | null; // 真实号码，用于编辑
  real_name: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
}

interface BankCard {
  binding_id: number;
  platform_name: string;
  masked_card_number: string;
  bank_name: string | null;
  cardholder_name: string | null;
  full_card_number_raw: string | null; // 真实卡号，用于编辑
}

interface PersonalInfoProps {
  userId: number;
  language?: 'zh' | 'en';
  onPenNameUpdate?: () => void;
}

const PersonalInfo: React.FC<PersonalInfoProps> = ({ userId, language = 'zh', onPenNameUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PersonalInfoData | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editingPhoneNumber, setEditingPhoneNumber] = useState(false);
  const [phoneNumberValue, setPhoneNumberValue] = useState<string>('');
  const [phoneCountryCode, setPhoneCountryCode] = useState<string>('+86');
  const [editingPenName, setEditingPenName] = useState(false);
  const [penNameValue, setPenNameValue] = useState<string>('');
  const [editingEmergencyContact, setEditingEmergencyContact] = useState(false);
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState<string>('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>('');
  const [emergencyContactPhoneCountryCode, setEmergencyContactPhoneCountryCode] = useState<string>('+86');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [showBankCardModal, setShowBankCardModal] = useState(false);
  const [editingBankCardId, setEditingBankCardId] = useState<number | null>(null);
  const [originalBankCardData, setOriginalBankCardData] = useState<BankCard | null>(null);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [activeBankCardTab, setActiveBankCardTab] = useState<'manage' | 'logs'>('manage');
  const [bankCardChangeLogs, setBankCardChangeLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [autoLogoutOnBrowserClose, setAutoLogoutOnBrowserClose] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // 表单状态
  const [addressForm, setAddressForm] = useState({
    address_details: '',
    recipient_name: '',
    recipient_phone: '',
    is_default: false
  });
  const [bankCardForm, setBankCardForm] = useState({
    platform_name: '',
    full_card_number: '',
    bank_name: '',
    cardholder_name: ''
  });
  const [identityForm, setIdentityForm] = useState({
    id_card_number: '',
    real_name: ''
  });

  // 加载个人信息
  const loadPersonalInfo = async () => {
    try {
      setLoading(true);
      const response = await ApiService.get(`/personal-info/${userId}`);
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('加载个人信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonalInfo();
    loadUserSettings();
  }, [userId]);

  // 当切换到变更记录标签时加载数据
  useEffect(() => {
    if (activeBankCardTab === 'logs') {
      loadBankCardChangeLogs();
    }
  }, [activeBankCardTab, userId]);

  // 加载银行卡变更记录
  const loadBankCardChangeLogs = async () => {
    try {
      setLoadingLogs(true);
      const response = await ApiService.get(`/personal-info/${userId}/bank-cards/change-logs`);
      if (response.success) {
        setBankCardChangeLogs(response.data || []);
      }
    } catch (error) {
      console.error('加载银行卡变更记录失败:', error);
      setToast({ message: language === 'zh' ? '加载变更记录失败' : 'Failed to load change logs', type: 'error' });
    } finally {
      setLoadingLogs(false);
    }
  };

  // 设为当前的收款银行
  const handleSetAsCurrentBankCard = (log: any, isOld: boolean) => {
    // 获取银行卡数据
    const cardData = isOld ? {
      platform_name: log.platform_name || 'kongfuworld网站',
      full_card_number: log.old_card_number_raw || '',
      bank_name: log.old_bank_name || '',
      cardholder_name: log.old_cardholder_name || ''
    } : {
      platform_name: log.platform_name || 'kongfuworld网站',
      full_card_number: log.new_card_number_raw || '',
      bank_name: log.new_bank_name || '',
      cardholder_name: log.new_cardholder_name || ''
    };

    console.log('设为当前收款银行 - 银行卡数据:', cardData);
    console.log('变更记录原始数据:', log);
    console.log('旧卡号原始值:', log.old_card_number_raw);
    console.log('新卡号原始值:', log.new_card_number_raw);

    // 检查是否已有该平台的银行卡绑定
    const existingCard = data?.bank_cards.find(card => card.platform_name === cardData.platform_name);
    
    // 先设置表单数据
    const formData = {
      platform_name: cardData.platform_name,
      full_card_number: cardData.full_card_number,
      bank_name: cardData.bank_name,
      cardholder_name: cardData.cardholder_name
    };
    
    if (existingCard) {
      // 如果已存在，打开编辑模态框并填充数据
      setEditingBankCardId(existingCard.binding_id);
      setOriginalBankCardData(existingCard);
      setBankCardForm(formData);
      setShowBankCardModal(true);
      // 切换到管理标签
      setActiveBankCardTab('manage');
    } else {
      // 如果不存在，打开添加模态框并填充数据
      setEditingBankCardId(null);
      setOriginalBankCardData(null);
      setBankCardForm(formData);
      setShowBankCardModal(true);
      // 切换到管理标签
      setActiveBankCardTab('manage');
    }
  };

  // 加载用户设置
  const loadUserSettings = async () => {
    try {
      const response = await ApiService.get(`/personal-info/${userId}/settings`);
      if (response.success && response.data) {
        setAutoLogoutOnBrowserClose(response.data.auto_logout_on_browser_close || false);
        // 更新sessionStorage，用于浏览器关闭时检查
        AuthService.updateUserSettings(response.data);
      }
    } catch (error) {
      console.error('加载用户设置失败:', error);
    }
  };

  // 更新自动退出登录设置
  const updateAutoLogoutSetting = async (enabled: boolean) => {
    try {
      const response = await ApiService.put(`/personal-info/${userId}/settings`, {
        auto_logout_on_browser_close: enabled
      });
      if (response.success) {
        setAutoLogoutOnBrowserClose(enabled);
        // 更新sessionStorage，用于浏览器关闭时检查
        if (response.data) {
          AuthService.updateUserSettings(response.data);
        }
      }
    } catch (error) {
      console.error('更新设置失败:', error);
      alert(language === 'zh' ? '更新设置失败' : 'Failed to update settings');
    }
  };

  // 更新基础信息
  const updateBasicInfo = async (field: string, value: string) => {
    try {
      await ApiService.put(`/personal-info/${userId}/basic`, { [field]: value });
      await loadPersonalInfo();
      setEditingField(null);
    } catch (error) {
      console.error('更新失败:', error);
      alert(language === 'zh' ? '更新失败' : 'Update failed');
    }
  };

  // 保存紧急联系方式
  const saveEmergencyContact = async () => {
    try {
      await ApiService.put(`/personal-info/${userId}/basic`, {
        emergency_contact_relationship: emergencyContactRelationship,
        emergency_contact_phone: emergencyContactPhone,
        emergency_contact_phone_country_code: emergencyContactPhoneCountryCode
      });
      await loadPersonalInfo();
      setEditingEmergencyContact(false);
      setEmergencyContactRelationship('');
      setEmergencyContactPhone('');
      setEmergencyContactPhoneCountryCode('+86');
    } catch (error) {
      console.error('更新紧急联系方式失败:', error);
      alert(language === 'zh' ? '更新失败' : 'Update failed');
    }
  };

  // 取消编辑紧急联系方式
  const cancelEmergencyContactEdit = () => {
    setEditingEmergencyContact(false);
    setEmergencyContactRelationship('');
    setEmergencyContactPhone('');
    setEmergencyContactPhoneCountryCode('+86');
  };

  // 更新笔名
  const updatePenName = async () => {
    try {
      const response = await ApiService.put(`/personal-info/${userId}/pen-name`, { 
        pen_name: penNameValue.trim() 
      });
      if (response.success) {
        await loadPersonalInfo();
        setEditingPenName(false);
        setPenNameValue('');
        // 触发父组件更新
        if (onPenNameUpdate) {
          onPenNameUpdate();
        }
        // 触发全局事件（用于其他组件监听）
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('penNameUpdated', { 
            detail: { pen_name: penNameValue.trim() } 
          }));
        }
      }
    } catch (error: any) {
      console.error('更新笔名失败:', error);
      const errorMessage = error.message || (error.response?.data?.message) || 
        (language === 'zh' ? '更新笔名失败' : 'Failed to update pen name');
      alert(errorMessage);
    }
  };

  // 处理编辑
  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  // 保存编辑
  const handleSave = (field: string) => {
    updateBasicInfo(field, editValue);
  };

  // 取消编辑
  const handleCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  // 添加地址
  const handleAddAddress = async () => {
    try {
      await ApiService.post(`/personal-info/${userId}/addresses`, addressForm);
      await loadPersonalInfo();
      setShowAddressModal(false);
      setAddressForm({ address_details: '', recipient_name: '', recipient_phone: '', is_default: false });
    } catch (error) {
      console.error('添加地址失败:', error);
      alert(language === 'zh' ? '添加地址失败' : 'Failed to add address');
    }
  };

  // 开始编辑地址
  const handleEditAddress = (address: Address) => {
    setEditingAddressId(address.address_id);
    setAddressForm({
      address_details: address.address_details,
      recipient_name: address.recipient_name || '',
      recipient_phone: address.recipient_phone || '',
      is_default: address.is_default
    });
    setShowAddressModal(true);
  };

  // 更新地址
  const handleUpdateAddress = async () => {
    if (!editingAddressId) return;
    try {
      await ApiService.put(`/personal-info/${userId}/addresses/${editingAddressId}`, addressForm);
      await loadPersonalInfo();
      setShowAddressModal(false);
      setEditingAddressId(null);
      setAddressForm({ address_details: '', recipient_name: '', recipient_phone: '', is_default: false });
    } catch (error) {
      console.error('更新地址失败:', error);
      alert(language === 'zh' ? '更新地址失败' : 'Failed to update address');
    }
  };

  // 删除地址
  const handleDeleteAddress = async (addressId: number) => {
    if (!window.confirm(language === 'zh' ? '确定要删除这个地址吗？' : 'Are you sure you want to delete this address?')) {
      return;
    }
    try {
      await ApiService.delete(`/personal-info/${userId}/addresses/${addressId}`);
      await loadPersonalInfo();
    } catch (error) {
      console.error('删除地址失败:', error);
      alert(language === 'zh' ? '删除地址失败' : 'Failed to delete address');
    }
  };

  // 设置默认地址
  const handleSetDefaultAddress = async (addressId: number) => {
    try {
      await ApiService.put(`/personal-info/${userId}/addresses/${addressId}`, { is_default: true });
      await loadPersonalInfo();
    } catch (error) {
      console.error('设置默认地址失败:', error);
      alert(language === 'zh' ? '设置失败' : 'Failed to set default address');
    }
  };

  // 提交实名认证
  const handleSubmitIdentity = async () => {
    try {
      await ApiService.post(`/personal-info/${userId}/identity`, identityForm);
      setShowIdentityModal(false);
      setIdentityForm({ id_card_number: '', real_name: '' });
      await loadPersonalInfo();
      alert(language === 'zh' ? '实名认证信息已提交' : 'Identity verification submitted');
    } catch (error) {
      console.error('提交实名认证失败:', error);
      alert(language === 'zh' ? '提交失败' : 'Submission failed');
    }
  };

  // 编辑银行卡（打开模态框并填充数据）
  const handleEditBankCard = (card: BankCard) => {
    setEditingBankCardId(card.binding_id);
    // 保存原始数据用于对比
    setOriginalBankCardData(card);
    setBankCardForm({
      platform_name: card.platform_name,
      full_card_number: card.full_card_number_raw || '',
      bank_name: card.bank_name || '',
      cardholder_name: card.cardholder_name || ''
    });
    setShowBankCardModal(true);
  };

  // 添加银行卡
  const handleAddBankCard = async () => {
    try {
      // 固定使用kongfuworld网站作为平台名称
      const formData = {
        ...bankCardForm,
        platform_name: 'kongfuworld网站'
      };
      await ApiService.post(`/personal-info/${userId}/bank-cards`, formData);
      setShowBankCardModal(false);
      setEditingBankCardId(null);
      setOriginalBankCardData(null);
      setBankCardForm({ platform_name: '', full_card_number: '', bank_name: '', cardholder_name: '' });
      await loadPersonalInfo();
      setToast({ message: language === 'zh' ? '银行卡绑定成功' : 'Bank card bound successfully', type: 'success' });
    } catch (error) {
      console.error('绑定银行卡失败:', error);
      setToast({ message: language === 'zh' ? '绑定银行卡失败' : 'Failed to bind bank card', type: 'error' });
    }
  };

  // 更新银行卡
  const handleUpdateBankCard = async () => {
    if (!editingBankCardId || !originalBankCardData) return;

    // 对比新旧银行卡信息
    const hasCardNumberChange = bankCardForm.full_card_number !== (originalBankCardData.full_card_number_raw || '');
    const hasBankNameChange = bankCardForm.bank_name !== (originalBankCardData.bank_name || '');
    const hasCardholderNameChange = bankCardForm.cardholder_name !== (originalBankCardData.cardholder_name || '');

    // 检查是否有任何变化
    if (!hasCardNumberChange && !hasBankNameChange && !hasCardholderNameChange) {
      setToast({ message: language === 'zh' ? '银行卡信息没有更改，无需保存' : 'No changes detected, no need to save', type: 'info' });
      return;
    }

    try {
      await ApiService.put(`/personal-info/${userId}/bank-cards/${editingBankCardId}`, {
        full_card_number: bankCardForm.full_card_number,
        bank_name: bankCardForm.bank_name,
        cardholder_name: bankCardForm.cardholder_name
      });
      setShowBankCardModal(false);
      setEditingBankCardId(null);
      setOriginalBankCardData(null);
      setBankCardForm({ platform_name: '', full_card_number: '', bank_name: '', cardholder_name: '' });
      await loadPersonalInfo();
      // 如果当前在变更记录标签，重新加载变更记录
      if (activeBankCardTab === 'logs') {
        await loadBankCardChangeLogs();
      }
      setToast({ message: language === 'zh' ? '银行卡更新成功' : 'Bank card updated successfully', type: 'success' });
    } catch (error: any) {
      console.error('更新银行卡失败:', error);
      const errorMessage = error.response?.data?.message || error.message || (language === 'zh' ? '更新失败' : 'Failed to update bank card');
      setToast({ message: errorMessage, type: 'error' });
    }
  };

  // 更换银行卡（保留原功能，使用prompt）
  const handleReplaceBankCard = async (bindingId: number) => {
    const newCardNumber = prompt(language === 'zh' ? '请输入新卡号：' : 'Please enter new card number:');
    if (!newCardNumber) return;

    try {
      await ApiService.put(`/personal-info/${userId}/bank-cards/${bindingId}`, {
        full_card_number: newCardNumber
      });
      await loadPersonalInfo();
      setToast({ message: language === 'zh' ? '银行卡更换成功' : 'Bank card replaced successfully', type: 'success' });
    } catch (error) {
      console.error('更换银行卡失败:', error);
      setToast({ message: language === 'zh' ? '更换失败' : 'Failed to replace bank card', type: 'error' });
    }
  };

  if (loading) {
    return <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>;
  }

  if (!data) {
    return <div className={styles.error}>{language === 'zh' ? '加载失败' : 'Failed to load'}</div>;
  }

  return (
    <div className={styles.container}>
      {/* 用户头像和名称 */}
      <div className={styles.header}>
        <div className={styles.avatarSection}>
          <div className={styles.avatar}>
            {data.avatar ? (
              <img src={data.avatar.startsWith('http') ? data.avatar : `http://localhost:5000${data.avatar}`} alt="Avatar" />
            ) : (
              <div className={styles.avatarPlaceholder}>👤</div>
            )}
          </div>
          <div className={styles.nameSection}>
            {editingPenName ? (
              <>
                <input
                  type="text"
                  value={penNameValue}
                  onChange={(e) => setPenNameValue(e.target.value)}
                  className={styles.penNameInput}
                  placeholder={language === 'zh' ? '请输入笔名' : 'Enter pen name'}
                  autoFocus
                />
                <button 
                  className={styles.saveBtn}
                  onClick={updatePenName}
                >
                  {language === 'zh' ? '保存' : 'Save'}
                </button>
                <button 
                  className={styles.cancelBtn}
                  onClick={() => {
                    setEditingPenName(false);
                    setPenNameValue('');
                  }}
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
              </>
            ) : (
              <>
                <h2>{data.pen_name || data.username}</h2>
                <button 
                  className={styles.modifyBtn}
                  onClick={() => {
                    setEditingPenName(true);
                    setPenNameValue(data.pen_name || '');
                  }}
                >
                  {language === 'zh' ? '修改' : 'Modify'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 基础信息 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {language === 'zh' ? '基础信息' : 'Basic Information'}
        </h3>
        <div className={styles.infoList}>
          <InfoItem
            label={language === 'zh' ? 'QQ号码' : 'QQ Number'}
            value={data.qq_number || '-'}
            editing={editingField === 'qq_number'}
            editValue={editValue}
            onEdit={() => handleEdit('qq_number', data.qq_number || '')}
            onSave={() => handleSave('qq_number')}
            onCancel={handleCancel}
            onChange={setEditValue}
            language={language}
          />
          <InfoItem
            label={language === 'zh' ? '微信号码' : 'WeChat Number'}
            value={data.wechat_number || '-'}
            editing={editingField === 'wechat_number'}
            editValue={editValue}
            onEdit={() => handleEdit('wechat_number', data.wechat_number || '')}
            onSave={() => handleSave('wechat_number')}
            onCancel={handleCancel}
            onChange={setEditValue}
            language={language}
          />
          <InfoItem
            label={language === 'zh' ? '电子邮箱' : 'Email'}
            value={data.email}
            editing={editingField === 'email'}
            editValue={editValue}
            onEdit={() => handleEdit('email', data.email || '')}
            onSave={() => handleSave('email')}
            onCancel={handleCancel}
            onChange={setEditValue}
            language={language}
          />
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>
              <span className={styles.checkIcon}>✓</span>
              {language === 'zh' ? '紧急联系方式' : 'Emergency Contact'}
            </div>
            <div className={styles.infoValue}>
              {editingEmergencyContact ? (
                <div className={styles.emergencyContactEdit}>
                  <select
                    value={emergencyContactRelationship}
                    onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                    className={styles.relationshipSelect}
                  >
                    <option value="">{language === 'zh' ? '请选择关系' : 'Select Relationship'}</option>
                    <option value="家人">{language === 'zh' ? '家人' : 'Family'}</option>
                    <option value="朋友">{language === 'zh' ? '朋友' : 'Friend'}</option>
                    <option value="其他">{language === 'zh' ? '其他' : 'Other'}</option>
                  </select>
                  <div className={styles.phoneEditContainer}>
                    <select
                      value={emergencyContactPhoneCountryCode}
                      onChange={(e) => setEmergencyContactPhoneCountryCode(e.target.value)}
                      className={styles.countryCodeSelect}
                    >
                      <option value="+86">+86 (中国)</option>
                      <option value="+1">+1 (美国/加拿大)</option>
                      <option value="+44">+44 (英国)</option>
                      <option value="+81">+81 (日本)</option>
                      <option value="+82">+82 (韩国)</option>
                      <option value="+65">+65 (新加坡)</option>
                      <option value="+852">+852 (香港)</option>
                      <option value="+853">+853 (澳门)</option>
                      <option value="+886">+886 (台湾)</option>
                      <option value="+61">+61 (澳大利亚)</option>
                      <option value="+49">+49 (德国)</option>
                      <option value="+33">+33 (法国)</option>
                      <option value="+39">+39 (意大利)</option>
                      <option value="+34">+34 (西班牙)</option>
                      <option value="+7">+7 (俄罗斯)</option>
                      <option value="+91">+91 (印度)</option>
                      <option value="+55">+55 (巴西)</option>
                      <option value="+52">+52 (墨西哥)</option>
                      <option value="+27">+27 (南非)</option>
                      <option value="+971">+971 (阿联酋)</option>
                    </select>
                    <input
                      type="text"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      placeholder={language === 'zh' ? '请输入电话号码' : 'Enter phone number'}
                      className={styles.phoneInput}
                    />
                  </div>
                  <div className={styles.editActions}>
                    <button 
                      className={styles.cancelBtn}
                      onClick={cancelEmergencyContactEdit}
                    >
                      {language === 'zh' ? '取消' : 'Cancel'}
                    </button>
                    <button 
                      className={styles.confirmBtn}
                      onClick={saveEmergencyContact}
                    >
                      {language === 'zh' ? '确认信息' : 'Confirm Information'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className={styles.contactValue}>
                    {data.emergency_contact_relationship && data.emergency_contact_phone
                      ? `${data.emergency_contact_relationship} ${data.emergency_contact_phone}`
                      : '-'}
                  </span>
                  <button 
                    className={styles.modifyBtn}
                    onClick={() => {
                      setEditingEmergencyContact(true);
                      setEmergencyContactRelationship(data.emergency_contact_relationship || '');
                      setEmergencyContactPhone(data.emergency_contact_phone_raw || '');
                      setEmergencyContactPhoneCountryCode(data.emergency_contact_phone_country_code || '+86');
                    }}
                  >
                    {language === 'zh' ? '立即修改' : 'Modify Now'}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>
              {language === 'zh' ? '收货地址' : 'Shipping Address'}
            </div>
            <div className={styles.infoValue}>
              {data.addresses.length > 0 ? (
                <div className={styles.addressList}>
                  {data.addresses.map(addr => (
                    <div key={addr.address_id} className={styles.addressItem}>
                      {addr.is_default && <span className={styles.defaultTag}>{language === 'zh' ? '默认' : 'Default'}</span>}
                      <span>{addr.address_details}</span>
                      <button
                        className={styles.editBtn}
                        onClick={() => handleEditAddress(addr)}
                      >
                        {language === 'zh' ? '修改' : 'Edit'}
                      </button>
                      {!addr.is_default && (
                        <button
                          className={styles.setDefaultBtn}
                          onClick={() => handleSetDefaultAddress(addr.address_id)}
                        >
                          {language === 'zh' ? '设为默认' : 'Set as Default'}
                        </button>
                      )}
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteAddress(addr.address_id)}
                      >
                        {language === 'zh' ? '删除' : 'Delete'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span>-</span>
              )}
              <button
                className={styles.manageBtn}
                onClick={() => setShowAddressModal(true)}
              >
                {language === 'zh' ? '管理地址' : 'Manage Address'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 实名认证 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {language === 'zh' ? '实名认证' : 'Real-name Authentication'}
        </h3>
        <div className={styles.infoList}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>
              {language === 'zh' ? '认证状态' : 'Verification Status'}
            </div>
            <div className={styles.infoValue}>
              {data.identity_verification ? (
                <>
                  <span className={styles.verified}>
                    {language === 'zh' ? '已认证' : 'Verified'} ({data.identity_verification.id_card_number})
                  </span>
                  <button
                    className={styles.viewBtn}
                    onClick={() => setShowIdentityModal(true)}
                  >
                    {language === 'zh' ? '查看信息' : 'View Information'}
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.unverified}>
                    {language === 'zh' ? '未认证' : 'Not Verified'}
                  </span>
                  <button
                    className={styles.submitBtn}
                    onClick={() => setShowIdentityModal(true)}
                  >
                    {language === 'zh' ? '立即认证' : 'Verify Now'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 银行卡绑定 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            {language === 'zh' ? '银行卡绑定' : 'Bank Card Binding'}
          </h3>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeBankCardTab === 'manage' ? styles.active : ''}`}
              onClick={() => setActiveBankCardTab('manage')}
            >
              {language === 'zh' ? '银行卡管理' : 'Bank Card Management'}
            </button>
            <button
              className={`${styles.tab} ${activeBankCardTab === 'logs' ? styles.active : ''}`}
              onClick={() => setActiveBankCardTab('logs')}
            >
              {language === 'zh' ? '银行卡变更记录' : 'Change Records'}
            </button>
          </div>
        </div>
        {activeBankCardTab === 'manage' && (
          <div className={styles.bankCardList}>
            {data.bank_cards.length > 0 ? (
              data.bank_cards.map(card => (
                <div key={card.binding_id} className={styles.bankCardItem}>
                  <div className={styles.bankCardInfo}>
                    <span className={styles.platformName}>{card.platform_name}</span>
                    <span className={styles.cardNumber}>({card.masked_card_number})</span>
                  </div>
                  <button
                    className={styles.replaceBtn}
                    onClick={() => handleEditBankCard(card)}
                  >
                    {language === 'zh' ? '更改' : 'Change'}
                  </button>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                {language === 'zh' ? '暂无银行卡绑定' : 'No bank cards bound'}
              </div>
            )}
            <button
              className={styles.addBankCardBtn}
              onClick={() => {
                setEditingBankCardId(null);
                setOriginalBankCardData(null);
                setBankCardForm({ platform_name: '', full_card_number: '', bank_name: '', cardholder_name: '' });
                setShowBankCardModal(true);
              }}
            >
              {language === 'zh' ? '+ 添加银行卡' : '+ Add Bank Card'}
            </button>
          </div>
        )}
        {activeBankCardTab === 'logs' && (
          <div className={styles.changeLogs}>
            {loadingLogs ? (
              <div className={styles.loading}>{language === 'zh' ? '加载中...' : 'Loading...'}</div>
            ) : bankCardChangeLogs.length === 0 ? (
              <div className={styles.emptyState}>
                {language === 'zh' ? '暂无变更记录' : 'No change records'}
              </div>
            ) : (
              <div className={styles.logsTable}>
                <table className={styles.logsTableContent}>
                  <thead>
                    <tr>
                      <th>{language === 'zh' ? 'ID' : 'ID'}</th>
                      <th>{language === 'zh' ? '旧银行卡信息' : 'Old Bank Card'}</th>
                      <th>{language === 'zh' ? '新银行卡信息' : 'New Bank Card'}</th>
                      <th>{language === 'zh' ? '变更日期' : 'Change Date'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankCardChangeLogs.map((log) => (
                      <tr key={log.log_id}>
                        <td>{log.log_id}</td>
                        <td>
                          <div className={styles.cardDetails}>
                            <div><strong>{language === 'zh' ? '卡号' : 'Card Number'}:</strong> {log.old_masked_card_number || '-'}</div>
                            <div><strong>{language === 'zh' ? '开户银行' : 'Bank'}:</strong> {log.old_bank_name || '-'}</div>
                            <div><strong>{language === 'zh' ? '持卡人' : 'Cardholder'}:</strong> {log.old_cardholder_name || '-'}</div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.cardDetails}>
                            <div><strong>{language === 'zh' ? '卡号' : 'Card Number'}:</strong> {log.new_masked_card_number || '-'}</div>
                            <div><strong>{language === 'zh' ? '开户银行' : 'Bank'}:</strong> {log.new_bank_name || '-'}</div>
                            <div><strong>{language === 'zh' ? '持卡人' : 'Cardholder'}:</strong> {log.new_cardholder_name || '-'}</div>
                          </div>
                        </td>
                        <td>
                          {log.changed_at ? new Date(log.changed_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 账号安全 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {language === 'zh' ? '账号安全' : 'Account Security'}
        </h3>
        <div className={styles.infoList}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>
              {language === 'zh' ? '登录密码' : 'Login Password'}
            </div>
            <div className={styles.infoValue}>
              <span className={styles.unset}>
                {language === 'zh' ? '未设置' : 'Not Set'}
              </span>
              <button className={styles.setBtn}>
                {language === 'zh' ? '立即设置' : 'Set Now'}
              </button>
            </div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>
              {language === 'zh' ? '手机号' : 'Mobile Number'}
            </div>
            <div className={styles.infoValue}>
              {editingPhoneNumber ? (
                <>
                  <div className={styles.phoneEditContainer}>
                    <select
                      value={phoneCountryCode}
                      onChange={(e) => setPhoneCountryCode(e.target.value)}
                      className={styles.countryCodeSelect}
                    >
                      <option value="+86">+86 (中国)</option>
                      <option value="+1">+1 (美国/加拿大)</option>
                      <option value="+44">+44 (英国)</option>
                      <option value="+81">+81 (日本)</option>
                      <option value="+82">+82 (韩国)</option>
                      <option value="+65">+65 (新加坡)</option>
                      <option value="+852">+852 (香港)</option>
                      <option value="+853">+853 (澳门)</option>
                      <option value="+886">+886 (台湾)</option>
                      <option value="+61">+61 (澳大利亚)</option>
                      <option value="+49">+49 (德国)</option>
                      <option value="+33">+33 (法国)</option>
                      <option value="+39">+39 (意大利)</option>
                      <option value="+34">+34 (西班牙)</option>
                      <option value="+7">+7 (俄罗斯)</option>
                      <option value="+91">+91 (印度)</option>
                      <option value="+55">+55 (巴西)</option>
                      <option value="+52">+52 (墨西哥)</option>
                      <option value="+27">+27 (南非)</option>
                      <option value="+971">+971 (阿联酋)</option>
                    </select>
                    <input
                      type="text"
                      value={phoneNumberValue}
                      onChange={(e) => setPhoneNumberValue(e.target.value)}
                      placeholder={language === 'zh' ? '请输入手机号码' : 'Enter phone number'}
                      className={styles.phoneInput}
                    />
                  </div>
                  <button
                    onClick={() => {
                      ApiService.put(`/personal-info/${userId}/phone`, {
                        phone_number: phoneNumberValue,
                        phone_country_code: phoneCountryCode
                      })
                        .then(() => {
                          loadPersonalInfo();
                          setEditingPhoneNumber(false);
                          setPhoneNumberValue('');
                          setPhoneCountryCode('+86');
                        })
                        .catch(err => {
                          console.error('更新手机号失败:', err);
                          alert(language === 'zh' ? '更新失败' : 'Update failed');
                        });
                    }}
                    className={styles.saveBtn}
                  >
                    {language === 'zh' ? '保存' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPhoneNumber(false);
                      setPhoneNumberValue('');
                      setPhoneCountryCode('+86');
                    }}
                    className={styles.cancelBtn}
                  >
                    {language === 'zh' ? '取消' : 'Cancel'}
                  </button>
                </>
              ) : (
                <>
                  <span className={data.phone_number ? styles.verified : ''}>
                    {data.phone_number || '-'}
                  </span>
                  <button
                    onClick={() => {
                      setEditingPhoneNumber(true);
                      setPhoneNumberValue(data.phone_number_raw || '');
                      setPhoneCountryCode(data.phone_country_code || '+86');
                    }}
                    className={styles.modifyBtn}
                  >
                    {language === 'zh' ? '立即修改' : 'Modify Now'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 功能设置 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {language === 'zh' ? '功能设置' : 'Feature Settings'}
        </h3>
        <div className={styles.infoList}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>
              {language === 'zh' ? '关闭浏览器自动退出登录' : 'Log out automatically when browser is closed'}
            </div>
            <div className={styles.infoValue}>
              <label className={styles.toggle}>
                <input 
                  type="checkbox" 
                  checked={autoLogoutOnBrowserClose}
                  onChange={(e) => updateAutoLogoutSetting(e.target.checked)}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 地址管理模态框 */}
      {showAddressModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>{editingAddressId ? (language === 'zh' ? '修改地址' : 'Edit Address') : (language === 'zh' ? '管理地址' : 'Manage Address')}</h3>
            <div className={styles.formGroup}>
              <label>{language === 'zh' ? '地址详情' : 'Address Details'}</label>
              <textarea
                value={addressForm.address_details}
                onChange={(e) => setAddressForm({ ...addressForm, address_details: e.target.value })}
                placeholder={language === 'zh' ? '请输入完整地址' : 'Enter full address'}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{language === 'zh' ? '收货人姓名' : 'Recipient Name'}</label>
              <input
                type="text"
                value={addressForm.recipient_name}
                onChange={(e) => setAddressForm({ ...addressForm, recipient_name: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{language === 'zh' ? '收货人电话' : 'Recipient Phone'}</label>
              <input
                type="text"
                value={addressForm.recipient_phone}
                onChange={(e) => setAddressForm({ ...addressForm, recipient_phone: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={addressForm.is_default}
                  onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                  className={styles.checkbox}
                />
                <span>{language === 'zh' ? '设为默认地址' : 'Set as default address'}</span>
              </label>
            </div>
            <div className={styles.modalActions}>
              <button 
                onClick={editingAddressId ? handleUpdateAddress : handleAddAddress} 
                className={styles.saveBtn}
              >
                {language === 'zh' ? '保存' : 'Save'}
              </button>
              <button 
                onClick={() => {
                  setShowAddressModal(false);
                  setEditingAddressId(null);
                  setAddressForm({ address_details: '', recipient_name: '', recipient_phone: '', is_default: false });
                }} 
                className={styles.cancelBtn}
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 银行卡绑定模态框 */}
      {showBankCardModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>{editingBankCardId ? (language === 'zh' ? '更改银行卡' : 'Change Bank Card') : (language === 'zh' ? '绑定银行卡' : 'Bind Bank Card')}</h3>
            <div className={styles.formGroup}>
              <label>{language === 'zh' ? '平台名称' : 'Platform Name'}</label>
              <input
                type="text"
                value="kongfuworld网站"
                readOnly
                className={styles.readonlyInput}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{language === 'zh' ? '银行卡号' : 'Card Number'}</label>
              <input
                type="text"
                value={bankCardForm.full_card_number}
                onChange={(e) => setBankCardForm({ ...bankCardForm, full_card_number: e.target.value })}
                placeholder={language === 'zh' ? '请输入银行卡号' : 'Enter card number'}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{language === 'zh' ? '银行名称' : 'Bank Name'}</label>
              <input
                type="text"
                value={bankCardForm.bank_name}
                onChange={(e) => setBankCardForm({ ...bankCardForm, bank_name: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{language === 'zh' ? '持卡人姓名' : 'Cardholder Name'}</label>
              <input
                type="text"
                value={bankCardForm.cardholder_name}
                onChange={(e) => setBankCardForm({ ...bankCardForm, cardholder_name: e.target.value })}
              />
            </div>
            <div className={styles.modalActions}>
              <button 
                onClick={editingBankCardId ? handleUpdateBankCard : handleAddBankCard} 
                className={styles.saveBtn}
              >
                {editingBankCardId ? (language === 'zh' ? '保存' : 'Save') : (language === 'zh' ? '绑定' : 'Bind')}
              </button>
              <button 
                onClick={() => {
                  setShowBankCardModal(false);
                  setEditingBankCardId(null);
                  setOriginalBankCardData(null);
                  setBankCardForm({ platform_name: '', full_card_number: '', bank_name: '', cardholder_name: '' });
                }} 
                className={styles.cancelBtn}
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 实名认证模态框 */}
      {showIdentityModal && (
        <div className={styles.modal} onClick={(e) => {
          // 点击模态框背景关闭
          if (e.target === e.currentTarget) {
            setShowIdentityModal(false);
          }
        }}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{language === 'zh' ? '实名认证' : 'Identity Verification'}</h3>
              <button 
                className={styles.closeBtn}
                onClick={() => setShowIdentityModal(false)}
                title={language === 'zh' ? '关闭' : 'Close'}
              >
                ×
              </button>
            </div>
            {data.identity_verification && identityForm.real_name === '' ? (
              <div className={styles.identityInfo}>
                <p><strong>{language === 'zh' ? '真实姓名' : 'Real Name'}:</strong> {data.identity_verification.real_name}</p>
                <p><strong>{language === 'zh' ? '身份证号' : 'ID Card Number'}:</strong> {data.identity_verification.id_card_number}</p>
                <p><strong>{language === 'zh' ? '状态' : 'Status'}:</strong> {
                  data.identity_verification.verification_status === 'verified' 
                    ? (language === 'zh' ? '已认证' : 'Verified')
                    : data.identity_verification.verification_status === 'pending'
                    ? (language === 'zh' ? '已提交' : 'Submitted')
                    : (language === 'zh' ? '已拒绝' : 'Rejected')
                }</p>
                <div className={styles.modalActions}>
                  <button 
                    onClick={() => {
                      // 切换到编辑模式（填充真实姓名和完整的身份证号）
                      if (data.identity_verification) {
                        setIdentityForm({
                          id_card_number: data.identity_verification.id_card_number_raw || '',
                          real_name: data.identity_verification.real_name || ''
                        });
                      }
                    }} 
                    className={styles.modifyBtn}
                  >
                    {language === 'zh' ? '修改' : 'Modify'}
                  </button>
                  <button 
                    onClick={() => setShowIdentityModal(false)} 
                    className={styles.cancelBtn}
                  >
                    {language === 'zh' ? '关闭' : 'Close'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.formGroup}>
                  <label>{language === 'zh' ? '真实姓名' : 'Real Name'}</label>
                  <input
                    type="text"
                    value={identityForm.real_name}
                    onChange={(e) => setIdentityForm({ ...identityForm, real_name: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>{language === 'zh' ? '身份证号' : 'ID Card Number'}</label>
                  <input
                    type="text"
                    value={identityForm.id_card_number}
                    onChange={(e) => setIdentityForm({ ...identityForm, id_card_number: e.target.value })}
                    placeholder={language === 'zh' ? '请输入身份证号' : 'Enter ID card number'}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button onClick={handleSubmitIdentity} className={styles.saveBtn}>
                    {language === 'zh' ? '提交' : 'Submit'}
                  </button>
                  <button onClick={() => setShowIdentityModal(false)} className={styles.cancelBtn}>
                    {language === 'zh' ? '取消' : 'Cancel'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast提示 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

// 信息项组件
interface InfoItemProps {
  label: string;
  value: string;
  editing: boolean;
  editValue: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  language: 'zh' | 'en';
}

const InfoItem: React.FC<InfoItemProps> = ({
  label,
  value,
  editing,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onChange,
  language
}) => {
  return (
    <div className={styles.infoItem}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>
        {editing ? (
          <>
            <input
              type="text"
              value={editValue}
              onChange={(e) => onChange(e.target.value)}
              className={styles.editInput}
            />
            <button onClick={onSave} className={styles.saveBtn}>
              {language === 'zh' ? '保存' : 'Save'}
            </button>
            <button onClick={onCancel} className={styles.cancelBtn}>
              {language === 'zh' ? '取消' : 'Cancel'}
            </button>
          </>
        ) : (
          <>
            <span className={value !== '-' ? styles.verified : ''}>{value}</span>
            <button onClick={onEdit} className={styles.modifyBtn}>
              {language === 'zh' ? '立即修改' : 'Modify Now'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PersonalInfo;


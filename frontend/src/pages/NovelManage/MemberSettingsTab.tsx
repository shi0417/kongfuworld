import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { API_BASE_URL } from '../../config';
import ChampionActivationTab from './ChampionActivationTab';
import styles from './MemberSettingsTab.module.css';

interface ChampionTier {
  tier_level: number;
  tier_name: string;
  monthly_price: number;
  advance_chapters: number;
  description: string;
}

const MemberSettingsTab: React.FC<{ novelId: number }> = ({ novelId }) => {
  const { language } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'activation'>('settings');
  const [tiers, setTiers] = useState<ChampionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 自动生成description
  const generateDescription = (chapterCount: number): string => {
    const numberNames: { [key: number]: string } = {
      1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE', 6: 'SIX', 7: 'SEVEN', 8: 'EIGHT', 9: 'NINE', 10: 'TEN',
      11: 'ELEVEN', 12: 'TWELVE', 13: 'THIRTEEN', 14: 'FOURTEEN', 15: 'FIFTEEN', 20: 'TWENTY', 25: 'TWENTY-FIVE',
      30: 'THIRTY', 40: 'FORTY', 50: 'FIFTY', 65: 'SIXTY-FIVE'
    };
    const numberName = numberNames[chapterCount] || chapterCount.toString();
    return `${numberName} advance chapter${chapterCount !== 1 ? 's' : ''}`;
  };

  // 加载默认配置和当前配置
  useEffect(() => {
    loadTiers();
  }, [novelId]);

  const loadTiers = async () => {
    try {
      setLoading(true);
      
      // 先尝试获取当前小说的配置（从novel_champion_tiers表）
      const currentResponse = await fetch(`${API_BASE_URL}/api/champion/config/${novelId}`);
      const currentData = await currentResponse.json();
      
      if (currentData.success && currentData.data && currentData.data.tiers) {
        const tiers = currentData.data.tiers || [];
        
        if (tiers.length > 0) {
          // 如果有现有配置，使用现有配置（即使只有10条也显示10条）
          const formattedTiers = tiers.map((tier: any) => ({
            tier_level: tier.tier_level,
            tier_name: tier.tier_name,
            monthly_price: parseFloat(tier.monthly_price),
            advance_chapters: tier.advance_chapters,
            description: tier.description
          }));
          setTiers(formattedTiers);
          return; // 有数据就直接返回，不加载默认配置
        }
      }
      
      // 只有在novel_champion_tiers表中完全没有数据时，才加载默认配置供用户编辑
      const defaultResponse = await fetch(`${API_BASE_URL}/api/champion/default-tiers`);
      const defaultData = await defaultResponse.json();
      
      if (defaultData.success && defaultData.data) {
        const formattedTiers = defaultData.data.map((tier: any) => ({
          tier_level: tier.tier_level,
          tier_name: tier.tier_name,
          monthly_price: parseFloat(tier.monthly_price),
          advance_chapters: tier.advance_chapters,
          description: tier.description
        }));
        setTiers(formattedTiers);
      }
    } catch (error) {
      console.error('加载会员等级配置失败:', error);
      setMessage(language === 'zh' ? '加载配置失败' : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  // 更新单个等级字段
  const updateTier = (index: number, field: keyof ChampionTier, value: string | number) => {
    const newTiers = [...tiers];
    const numericValue = field === 'monthly_price' ? parseFloat(value as string) || 0 : 
                        field === 'tier_level' || field === 'advance_chapters' ? parseInt(value as string) || 0 : value;
    
    newTiers[index] = {
      ...newTiers[index],
      [field]: numericValue
    };
    
    // 如果更新的是advance_chapters，自动填充description（如果description为空或者是默认格式）
    if (field === 'advance_chapters') {
      const currentDescription = newTiers[index].description;
      const chapterCount = numericValue as number;
      
      // 如果description为空或者包含"advance chapter"关键词（认为是默认格式），则自动更新
      const containsAdvancePattern = /advance\s+chapters?/i;
      
      if (!currentDescription || (containsAdvancePattern.test(currentDescription) && chapterCount > 0)) {
        // 自动生成description
        newTiers[index].description = generateDescription(chapterCount);
      }
    }
    
    setTiers(newTiers);
  };

  // 删除等级
  const removeTier = (index: number) => {
    if (tiers.length <= 1) {
      setMessage(language === 'zh' ? '至少需要保留一个会员等级' : 'At least one tier must be kept');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    const newTiers = tiers.filter((_, i) => i !== index);
    // 重新编号tier_level，确保连续
    const renumberedTiers = newTiers.map((tier, i) => ({
      ...tier,
      tier_level: i + 1
    }));
    setTiers(renumberedTiers);
    setMessage(''); // 清除之前的消息
  };

  // 添加新等级
  const addTier = () => {
    // 计算新的tier_level（取当前最大tier_level + 1）
    const maxTierLevel = tiers.length > 0 
      ? Math.max(...tiers.map(t => t.tier_level))
      : 0;
    const newTierLevel = maxTierLevel + 1;
    
    const newTier: ChampionTier = {
      tier_level: newTierLevel,
      tier_name: '',
      monthly_price: 0,
      advance_chapters: 0,
      description: ''
    };
    setTiers([...tiers, newTier]);
    setMessage(''); // 清除之前的消息
  };

  // 恢复缺省设置
  const restoreDefaults = async () => {
    try {
      setLoading(true);
      setMessage('');
      
      const response = await fetch(`${API_BASE_URL}/api/champion/default-tiers`);
      const result = await response.json();
      
      if (result.success) {
        const formattedTiers = result.data.map((tier: any) => ({
          tier_level: tier.tier_level,
          tier_name: tier.tier_name,
          monthly_price: parseFloat(tier.monthly_price),
          advance_chapters: tier.advance_chapters,
          description: tier.description
        }));
        setTiers(formattedTiers);
        setMessage(language === 'zh' ? '已恢复缺省设置' : 'Default settings restored');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(result.message || (language === 'zh' ? '恢复失败' : 'Restore failed'));
      }
    } catch (error) {
      console.error('恢复缺省设置失败:', error);
      setMessage(language === 'zh' ? '恢复失败: ' + (error instanceof Error ? error.message : String(error)) : 'Restore failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  // 检查重复值
  const checkDuplicates = (): { hasDuplicates: boolean; message: string } => {
    const tierLevels = tiers.map(t => t.tier_level);
    const monthlyPrices = tiers.map(t => t.monthly_price);
    const advanceChapters = tiers.map(t => t.advance_chapters);
    
    const duplicateTierLevels = tierLevels.filter((val, idx) => tierLevels.indexOf(val) !== idx);
    const duplicatePrices = monthlyPrices.filter((val, idx) => monthlyPrices.indexOf(val) !== idx);
    const duplicateChapters = advanceChapters.filter((val, idx) => advanceChapters.indexOf(val) !== idx);
    
    if (duplicateTierLevels.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicateTierLevels));
      return {
        hasDuplicates: true,
        message: language === 'zh' 
          ? `等级(tier_level)有重复值: ${uniqueDuplicates.join(', ')}，请修改后再提交` 
          : `Duplicate tier_level values: ${uniqueDuplicates.join(', ')}, please modify before submitting`
      };
    }
    
    if (duplicatePrices.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicatePrices));
      return {
        hasDuplicates: true,
        message: language === 'zh' 
          ? `月费(monthly_price)有重复值: ${uniqueDuplicates.join(', ')}，请修改后再提交` 
          : `Duplicate monthly_price values: ${uniqueDuplicates.join(', ')}, please modify before submitting`
      };
    }
    
    if (duplicateChapters.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicateChapters));
      return {
        hasDuplicates: true,
        message: language === 'zh' 
          ? `预读章节数(advance_chapters)有重复值: ${uniqueDuplicates.join(', ')}，请修改后再提交` 
          : `Duplicate advance_chapters values: ${uniqueDuplicates.join(', ')}, please modify before submitting`
      };
    }
    
    return { hasDuplicates: false, message: '' };
  };

  // 保存配置
  const handleSave = async () => {
    // 验证数据完整性
    for (const tier of tiers) {
      if (!tier.tier_name || tier.monthly_price < 0 || tier.advance_chapters < 0) {
        setMessage(language === 'zh' ? '请填写完整的会员等级信息' : 'Please fill in complete tier information');
        return;
      }
    }
    
    // 检查重复值
    const duplicateCheck = checkDuplicates();
    if (duplicateCheck.hasDuplicates) {
      setMessage(duplicateCheck.message);
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      
      const response = await fetch(`${API_BASE_URL}/api/champion/tiers/${novelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tiers })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMessage(language === 'zh' ? '会员等级配置更新成功' : 'Member tier configuration updated successfully');
      } else {
        setMessage(result.message || (language === 'zh' ? '更新失败' : 'Update failed'));
      }
    } catch (error) {
      console.error('更新会员等级配置失败:', error);
      setMessage(language === 'zh' ? '更新失败: ' + (error instanceof Error ? error.message : String(error)) : 'Update failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          {language === 'zh' ? '加载中...' : 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h3>{language === 'zh' ? '会员设置' : 'Member Settings'}</h3>
            <p>{language === 'zh' ? '设置该小说的Champion会员等级配置' : 'Configure Champion member tiers for this novel'}</p>
          </div>
        </div>
      </div>

      {/* 子选项卡 */}
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTab} ${activeSubTab === 'settings' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('settings')}
        >
          {language === 'zh' ? '会员设置' : 'Member Settings'}
        </button>
        <button
          className={`${styles.subTab} ${activeSubTab === 'activation' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('activation')}
        >
          {language === 'zh' ? '会员激活' : 'Member Activation'}
        </button>
      </div>

      {/* 会员激活选项卡内容 */}
      {activeSubTab === 'activation' && (
        <ChampionActivationTab novelId={novelId} />
      )}

      {/* 会员设置选项卡内容 */}
      {activeSubTab === 'settings' && (
        <>
          <div className={styles.headerContent}>
            <div></div>
            <button
              onClick={restoreDefaults}
              disabled={loading}
              className={styles.restoreButton}
            >
              {language === 'zh' ? '恢复缺省设置' : 'Restore Default Settings'}
            </button>
          </div>

          {message && (
            <div className={`${styles.message} ${message.includes(language === 'zh' ? '成功' : 'success') || message.includes('successfully') ? styles.success : styles.error}`}>
              {message}
            </div>
          )}

      <div className={styles.tableContainer}>
        <table className={styles.tiersTable}>
          <thead>
            <tr>
              <th>{language === 'zh' ? '等级' : 'Level'}</th>
              <th>{language === 'zh' ? '等级名称' : 'Tier Name'}</th>
              <th>{language === 'zh' ? '月费' : 'Monthly Price'}</th>
              <th>{language === 'zh' ? '预读章节数' : 'Advance Chapters'}</th>
              <th>{language === 'zh' ? '描述' : 'Description'}</th>
              <th>{language === 'zh' ? '操作' : 'Action'}</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="number"
                    value={tier.tier_level}
                    onChange={(e) => updateTier(index, 'tier_level', parseInt(e.target.value) || 1)}
                    className={styles.input}
                    min="1"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={tier.tier_name}
                    onChange={(e) => updateTier(index, 'tier_name', e.target.value)}
                    className={styles.input}
                    placeholder={language === 'zh' ? '等级名称' : 'Tier name'}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={tier.monthly_price}
                    onChange={(e) => updateTier(index, 'monthly_price', e.target.value)}
                    className={styles.input}
                    min="0"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={tier.advance_chapters}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value) || 0;
                      updateTier(index, 'advance_chapters', newValue);
                    }}
                    className={styles.input}
                    min="0"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={tier.description}
                    onChange={(e) => updateTier(index, 'description', e.target.value)}
                    className={styles.input}
                    placeholder={language === 'zh' ? '描述' : 'Description'}
                  />
                </td>
                <td>
                  <button
                    onClick={() => removeTier(index)}
                    className={styles.deleteButton}
                    title={language === 'zh' ? '删除' : 'Delete'}
                  >
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.actions}>
        <button
          onClick={addTier}
          className={styles.addButton}
        >
          + {language === 'zh' ? '添加会员等级' : 'Add Member Tier'}
        </button>
      </div>

      <div className={styles.saveActions}>
        <button
          onClick={handleSave}
          disabled={saving}
          className={styles.saveButton}
        >
          {saving 
            ? (language === 'zh' ? '更新中...' : 'Updating...') 
            : (language === 'zh' ? '更新会员系统' : 'Update Member System')}
        </button>
      </div>
        </>
      )}
    </div>
  );
};

export default MemberSettingsTab;


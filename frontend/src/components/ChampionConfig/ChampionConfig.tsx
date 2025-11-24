import React, { useState, useEffect } from 'react';
import styles from './ChampionConfig.module.css';

interface ChampionTier {
  level: number;
  name: string;
  price: number;
  chapters: number;
  description: string;
  sort: number;
}

interface ChampionConfig {
  id: number;
  novel_id: number;
  max_advance_chapters: number;
  total_chapters: number;
  published_chapters: number;
  free_chapters_per_day: number;
  unlock_interval_hours: number;
  champion_theme: string;
  is_customized: boolean;
}

interface ChampionConfigProps {
  novelId: number;
  onConfigUpdate?: () => void;
}

const ChampionConfig: React.FC<ChampionConfigProps> = ({ novelId, onConfigUpdate }) => {
  const [config, setConfig] = useState<ChampionConfig | null>(null);
  const [tiers, setTiers] = useState<ChampionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 获取Champion配置
  useEffect(() => {
    fetchChampionConfig();
  }, [novelId]);

  const fetchChampionConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/champion/config/${novelId}`);
      const result = await response.json();
      
      if (result.success) {
        setConfig(result.data.config);
        setTiers(result.data.tiers);
      } else {
        setMessage('获取配置失败: ' + result.message);
      }
    } catch (error) {
      setMessage('获取配置失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  // 更新基础配置
  const handleConfigUpdate = async () => {
    if (!config) return;
    
    try {
      setSaving(true);
      const response = await fetch(`/api/champion/config/${novelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxAdvanceChapters: config.max_advance_chapters,
          totalChapters: config.total_chapters,
          publishedChapters: config.published_chapters,
          freeChaptersPerDay: config.free_chapters_per_day,
          unlockIntervalHours: config.unlock_interval_hours,
          championTheme: config.champion_theme
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setMessage('配置更新成功');
        onConfigUpdate?.();
      } else {
        setMessage('配置更新失败: ' + result.message);
      }
    } catch (error) {
      setMessage('配置更新失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSaving(false);
    }
  };

  // 更新等级配置
  const handleTiersUpdate = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/champion/tiers/${novelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tiers })
      });
      
      const result = await response.json();
      if (result.success) {
        setMessage('等级配置更新成功');
        onConfigUpdate?.();
      } else {
        setMessage('等级配置更新失败: ' + result.message);
      }
    } catch (error) {
      setMessage('等级配置更新失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSaving(false);
    }
  };

  // 重置为默认配置
  const handleReset = async () => {
    if (!confirm('确定要重置为默认配置吗？这将删除所有自定义设置。')) {
      return;
    }
    
    try {
      setSaving(true);
      const response = await fetch(`/api/champion/reset/${novelId}`, {
        method: 'POST'
      });
      
      const result = await response.json();
      if (result.success) {
        setMessage('已重置为默认配置');
        fetchChampionConfig(); // 重新获取配置
        onConfigUpdate?.();
      } else {
        setMessage('重置失败: ' + result.message);
      }
    } catch (error) {
      setMessage('重置失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSaving(false);
    }
  };

  // 添加新等级
  const addTier = () => {
    const newTier: ChampionTier = {
      level: tiers.length + 1,
      name: '',
      price: 0,
      chapters: 0,
      description: '',
      sort: tiers.length + 1
    };
    setTiers([...tiers, newTier]);
  };

  // 删除等级
  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  // 更新等级
  const updateTier = (index: number, field: keyof ChampionTier, value: any) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  };

  if (loading) {
    return <div className={styles.loading}>加载中...</div>;
  }

  if (!config) {
    return <div className={styles.error}>配置加载失败</div>;
  }

  return (
    <div className={styles.championConfig}>
      <h2>Champion会员配置</h2>
      
      {message && (
        <div className={styles.message}>
          {message}
        </div>
      )}

      {/* 基础配置 */}
      <div className={styles.configSection}>
        <h3>基础配置</h3>
        <div className={styles.configGrid}>
          <div className={styles.configItem}>
            <label>最大预读章节数:</label>
            <input
              type="number"
              value={config.max_advance_chapters}
              onChange={(e) => setConfig({...config, max_advance_chapters: parseInt(e.target.value)})}
            />
          </div>
          
          <div className={styles.configItem}>
            <label>总章节数:</label>
            <input
              type="number"
              value={config.total_chapters}
              onChange={(e) => setConfig({...config, total_chapters: parseInt(e.target.value)})}
            />
          </div>
          
          <div className={styles.configItem}>
            <label>已发布章节数:</label>
            <input
              type="number"
              value={config.published_chapters}
              onChange={(e) => setConfig({...config, published_chapters: parseInt(e.target.value)})}
            />
          </div>
          
          <div className={styles.configItem}>
            <label>每日免费章节数:</label>
            <input
              type="number"
              value={config.free_chapters_per_day}
              onChange={(e) => setConfig({...config, free_chapters_per_day: parseInt(e.target.value)})}
            />
          </div>
          
          <div className={styles.configItem}>
            <label>解锁间隔(小时):</label>
            <input
              type="number"
              value={config.unlock_interval_hours}
              onChange={(e) => setConfig({...config, unlock_interval_hours: parseInt(e.target.value)})}
            />
          </div>
          
          <div className={styles.configItem}>
            <label>主题风格:</label>
            <select
              value={config.champion_theme}
              onChange={(e) => setConfig({...config, champion_theme: e.target.value})}
            >
              <option value="martial">武侠风格</option>
              <option value="cultivation">修炼境界</option>
              <option value="fantasy">奇幻风格</option>
              <option value="custom">自定义</option>
            </select>
          </div>
        </div>
        
        <button 
          className={styles.saveButton}
          onClick={handleConfigUpdate}
          disabled={saving}
        >
          {saving ? '保存中...' : '保存基础配置'}
        </button>
      </div>

      {/* 等级配置 */}
      <div className={styles.tiersSection}>
        <div className={styles.tiersHeader}>
          <h3>Champion等级配置</h3>
          <div className={styles.tiersActions}>
            <button className={styles.addButton} onClick={addTier}>
              添加等级
            </button>
            <button className={styles.resetButton} onClick={handleReset}>
              重置为默认
            </button>
          </div>
        </div>
        
        <div className={styles.tiersList}>
          {tiers.map((tier, index) => (
            <div key={index} className={styles.tierItem}>
              <div className={styles.tierLevel}>
                <label>等级:</label>
                <input
                  type="number"
                  value={tier.level}
                  onChange={(e) => updateTier(index, 'level', parseInt(e.target.value))}
                />
              </div>
              
              <div className={styles.tierName}>
                <label>等级名称:</label>
                <input
                  type="text"
                  value={tier.name}
                  onChange={(e) => updateTier(index, 'name', e.target.value)}
                  placeholder="如: Martial Cultivator"
                />
              </div>
              
              <div className={styles.tierPrice}>
                <label>月费($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={tier.price}
                  onChange={(e) => updateTier(index, 'price', parseFloat(e.target.value))}
                />
              </div>
              
              <div className={styles.tierChapters}>
                <label>预读章节数:</label>
                <input
                  type="number"
                  value={tier.chapters}
                  onChange={(e) => updateTier(index, 'chapters', parseInt(e.target.value))}
                />
              </div>
              
              <div className={styles.tierDescription}>
                <label>描述:</label>
                <input
                  type="text"
                  value={tier.description}
                  onChange={(e) => updateTier(index, 'description', e.target.value)}
                  placeholder="如: ONE advance chapter"
                />
              </div>
              
              <button 
                className={styles.removeButton}
                onClick={() => removeTier(index)}
              >
                删除
              </button>
            </div>
          ))}
        </div>
        
        <button 
          className={styles.saveButton}
          onClick={handleTiersUpdate}
          disabled={saving}
        >
          {saving ? '保存中...' : '保存等级配置'}
        </button>
      </div>
    </div>
  );
};

export default ChampionConfig;

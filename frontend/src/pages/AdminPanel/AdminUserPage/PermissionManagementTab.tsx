import React, { useState, useEffect } from 'react';
import styles from './AdminUserPage.module.css';
import {
  incomeEditorMenuGroup,
  ALL_MENU_KEYS,
  topStandaloneMenus,
  bottomStandaloneMenus,
} from '../../adminMenuConfig';

interface PermissionManagementTabProps {
  adminToken?: string | null;
  onError?: (error: string) => void;
}

const PermissionManagementTab: React.FC<PermissionManagementTabProps> = ({ adminToken, onError }) => {
  const [selectedRole, setSelectedRole] = useState<'chief_editor' | 'editor' | 'finance' | 'operator'>('editor');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  // 角色切换时加载权限
  useEffect(() => {
    const fetchRolePermissions = async () => {
      if (!adminToken) return;

      setLoading(true);
      try {
        const res = await fetch(`http://localhost:5000/api/admin/menu-permissions/role/${selectedRole}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          }
        });

        const data = await res.json();
        if (!data.success) {
          if (onError) {
            onError(data.message || '加载角色菜单权限失败');
          }
          return;
        }

        const serverPermissions = data.data.permissions || {};
        const map: Record<string, boolean> = {};

        // 默认全部 true，再用服务端结果覆盖
        ALL_MENU_KEYS.forEach(key => {
          map[key] = serverPermissions.hasOwnProperty(key) ? !!serverPermissions[key] : true;
        });

        setPermissions(map);
      } catch (e) {
        console.error(e);
        if (onError) {
          onError('加载角色菜单权限失败');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRolePermissions();
  }, [selectedRole, adminToken, onError]);

  const togglePermission = (menuKey: string) => {
    setPermissions(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  const toggleGroupPermission = (groupKey: string) => {
    const group = incomeEditorMenuGroup;
    if (group.groupKey !== groupKey) return;

    const allGroupItems = group.items.map(item => item.key);
    const allEnabled = allGroupItems.every(key => permissions[key] !== false);

    // 如果全部启用，则全部禁用；否则全部启用
    const newValue = !allEnabled;
    const newPermissions = { ...permissions };
    allGroupItems.forEach(key => {
      newPermissions[key] = newValue;
    });
    // 同时切换分组本身的权限
    newPermissions[groupKey] = newValue;
    setPermissions(newPermissions);
  };

  const handleSave = async () => {
    if (!adminToken) return;

    setSaving(true);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/menu-permissions/role/${selectedRole}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ permissions })
      });

      const data = await res.json();
      if (!data.success) {
        if (onError) {
          onError(data.message || '保存菜单权限失败');
        }
        return;
      }

      alert('菜单权限保存成功');
    } catch (e) {
      console.error(e);
      if (onError) {
        onError('保存菜单权限失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const roleOptions = [
    { value: 'chief_editor', label: '主编' },
    { value: 'editor', label: '编辑' },
    { value: 'finance', label: '财务' },
    { value: 'operator', label: '运营' }
  ];

  const group = incomeEditorMenuGroup;
  const groupItems = group.items;
  const groupKey = group.groupKey;

  return (
    <div className={styles.permissionManagementContainer}>
      <div className={styles.permissionHeader}>
        <p className={styles.permissionDescription}>
          按角色配置后台左侧菜单可见范围，不同角色登录后仅看到被授权的功能模块。
        </p>
      </div>

      {/* 角色选择 */}
      <div className={styles.permissionFilters}>
        <div className={styles.filterItem}>
          <label>选择角色：</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as any)}
            className={styles.filterSelect}
            disabled={loading || saving}
          >
            {roleOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingMessage}>加载中...</div>
      ) : (
        <>
          {/* 菜单权限配置区域 */}
          <div className={styles.permissionCard}>
            {/* 分组标题 */}
            <div className={styles.permissionGroupHeader}>
              <div className={styles.permissionGroupTitle}>
                <span className={styles.groupIcon}>{group.icon}</span>
                <span className={styles.groupLabel}>{group.groupLabel}</span>
              </div>
              <div className={styles.groupToggle}>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={permissions[groupKey] !== false && groupItems.every(item => permissions[item.key] !== false)}
                    onChange={() => toggleGroupPermission(groupKey)}
                    className={styles.checkbox}
                  />
                  <span>全部可见</span>
                </label>
              </div>
            </div>

            {/* 菜单项列表 */}
            <div className={styles.permissionItemsGrid}>
              {groupItems.map(item => (
                <div key={item.key} className={styles.permissionItem}>
                  <label className={styles.permissionItemLabel}>
                    <input
                      type="checkbox"
                      checked={permissions[item.key] !== false}
                      onChange={() => togglePermission(item.key)}
                      className={styles.checkbox}
                    />
                    <span className={styles.itemIcon}>{item.icon}</span>
                    <span className={styles.itemLabel}>{item.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* 新增：基础功能菜单权限卡片 */}
          <div className={styles.permissionCard}>
            <div className={styles.permissionGroupHeader}>
              <div className={styles.permissionGroupTitle}>
                <span className={styles.groupIcon}>🧭</span>
                <span className={styles.groupLabel}>基础功能菜单</span>
              </div>
            </div>
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e8e8e8', fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
              控制内容审批与收款相关基础功能是否对当前角色可见。
            </div>
            <div className={styles.permissionItemsGrid}>
              {[...topStandaloneMenus, ...bottomStandaloneMenus].map(item => (
                <div key={item.key} className={styles.permissionItem}>
                  <label className={styles.permissionItemLabel}>
                    <input
                      type="checkbox"
                      checked={permissions[item.key] !== false}
                      onChange={() => togglePermission(item.key)}
                      className={styles.checkbox}
                    />
                    <span className={styles.itemIcon}>{item.icon}</span>
                    <span className={styles.itemLabel}>{item.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <div className={styles.permissionActions}>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className={styles.saveButton}
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PermissionManagementTab;


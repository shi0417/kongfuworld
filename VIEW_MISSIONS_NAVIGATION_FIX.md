# View Missions 导航修复

## 🎯 问题描述

用户反馈点击"View missions"按钮无法跳转到 `http://localhost:3000/user-center?tab=daily-rewards` 页面。

## ✅ 解决方案

### 修改内容
- **文件**：`frontend/src/components/NavBar/NavBar.tsx`
- **位置**：钻石下拉菜单中的"View missions"按钮
- **修改**：将导航目标从 `navigate(-1)` 改为 `navigate('/user-center?tab=daily-rewards')`

### 代码变更
```typescript
// 修改前
onClick={() => { setDiamondDropdownOpen(false); navigate(-1); }}

// 修改后
onClick={() => { setDiamondDropdownOpen(false); navigate('/user-center?tab=daily-rewards'); }}
```

## 🎯 功能说明

### 修改后的行为
- 点击"View missions"按钮
- 关闭钻石下拉菜单
- 跳转到 `http://localhost:3000/user-center?tab=daily-rewards` 页面
- 显示Daily Rewards选项卡内容

### 用户体验
- ✅ 点击红色框区域的"View missions"按钮
- ✅ 自动跳转到Daily Rewards页面
- ✅ 显示任务和奖励相关内容
- ✅ 导航行为符合用户期望

## 🧪 测试验证

### 测试步骤
1. 访问任意页面（如首页）
2. 点击右上角的钻石按钮（💎）
3. 在红色框区域点击"View missions"按钮
4. 验证是否跳转到 `http://localhost:3000/user-center?tab=daily-rewards`

### 预期结果
- ✅ 成功跳转到Daily Rewards页面
- ✅ 显示"Daily Rewards"选项卡
- ✅ 显示任务和奖励内容
- ✅ 页面加载正常

## 📋 总结

**修复状态**：✅ 已完成

- ✅ 修改了"View missions"按钮的导航行为
- ✅ 现在点击会跳转到正确的Daily Rewards页面
- ✅ 代码没有语法错误
- ✅ 用户体验得到改善

**重要提醒**：现在点击"View missions"按钮会正确跳转到 `http://localhost:3000/user-center?tab=daily-rewards` 页面！

# Karma 页面颜色区分功能实现

## 🎯 功能概述

为 Karma 页面的交易记录表格添加了基于 Amount 列的颜色区分功能，让用户能够快速识别购买和消耗的 Karma 数据。

## ✅ 实现内容

### 1. 前端组件更新

#### Karma.tsx 更新
- **基于 Amount 列判断**：根据 `amount_paid` 字段判断是购买还是消耗
- **动态行样式**：为整行添加背景色区分
- **动态类型标签**：显示 "Purchase" 或 "Spend" 标签

#### 关键代码变更
```tsx
// 基于Amount列的颜色区分逻辑
const isPurchase = (transaction.amount_paid || 0) > 0;
const rowClass = isPurchase ? styles.purchaseRow : styles.spendRow;
const typeClass = isPurchase ? styles.purchase : styles.spend;
const typeText = isPurchase ? 'Purchase' : 'Spend';

return (
  <tr key={transaction.id} className={rowClass}>
    <td>${transaction.amount_paid || 0}</td>
    <td>{transaction.karma_amount}</td>
    <td>
      <span className={`${styles.transactionType} ${typeClass}`}>
        {typeText}
      </span>
    </td>
    {/* 其他列... */}
  </tr>
);
```

### 2. CSS 样式添加

#### Karma.module.css 新增样式
```css
/* 基于Amount列的颜色区分 */
.purchaseRow {
  background: rgba(33, 150, 243, 0.1) !important; /* 蓝色背景 - 购买数据 */
}

.spendRow {
  background: rgba(255, 152, 0, 0.1) !important; /* 橙色背景 - 消耗数据 */
}

.purchaseRow:hover {
  background: rgba(33, 150, 243, 0.2) !important;
}

.spendRow:hover {
  background: rgba(255, 152, 0, 0.2) !important;
}

/* 交易类型颜色区分 */
.transactionType {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

/* 购买类型 - 蓝色 */
.transactionType.purchase {
  background: #2196F3;
  color: #ffffff;
}

/* 消耗类型 - 橙色 */
.transactionType.spend {
  background: #FF9800;
  color: #ffffff;
}
```

## 🎨 颜色方案

### 基于Amount列的颜色区分
| Amount | 背景色 | 标签色 | 用途 |
|--------|--------|--------|------|
| $0 | 橙色背景 | 橙色标签 | 消耗Karma数据 (解锁章节等) |
| > $0 | 蓝色背景 | 蓝色标签 | 购买Karma数据 (付费购买) |

## 📊 功能特点

### 1. 视觉一致性
- 与 Cultivation Keys 页面保持相同的设计风格
- 使用相同的颜色方案和样式规范
- 统一的标签设计和圆角处理

### 2. 用户体验
- 快速识别交易类型
- 清晰的视觉层次
- 响应式设计支持

### 3. 可扩展性
- 易于添加新的交易类型
- 统一的样式管理
- 支持动态类型映射

## 🧪 测试验证

### 测试文件
- `test_karma_color_distinction.html` - 颜色区分功能测试页面

### 测试内容
1. **Karma Acquired 表格**：验证购买和奖励类型的颜色显示
2. **Karma Spent 表格**：验证解锁类型的颜色显示
3. **所有类型示例**：展示所有支持的颜色类型

## 🚀 使用方法

### 1. 访问页面
```
http://localhost:3000/user-center?tab=karma
```

### 2. 查看效果
- Karma Acquired 表格中的 Type 列现在显示彩色标签
- Karma Spent 表格中的 Type 列现在显示彩色标签
- 不同类型的交易用不同颜色区分

### 3. 颜色含义
- **紫色**：购买Golden Karma
- **橙色**：解锁章节
- **绿色**：奖励获得
- **灰色**：退款
- **棕色**：管理员操作
- **蓝色**：其他类型

## 📋 实现总结

### ✅ 已完成
- [x] 前端组件更新
- [x] CSS 样式添加
- [x] 颜色方案设计
- [x] 测试页面创建
- [x] 文档编写

### 🎯 效果
- 用户现在可以快速识别不同类型的Karma交易
- 表格更加直观和易读
- 与现有设计风格保持一致

### 🔧 技术细节
- 使用动态类名实现颜色区分
- 响应式设计支持
- 无障碍访问友好
- 性能优化

---

**重要提醒**：现在Karma页面的交易记录表格已经支持颜色区分，用户可以更直观地识别不同类型的交易！

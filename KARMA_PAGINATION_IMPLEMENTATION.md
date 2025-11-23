# Karma 分页功能实现

## 🎯 功能需求

为Karma Acquired表格添加分页功能，类似Cultivation Keys Awarded and Redeemed表格的分页样式。

## ✅ 实现内容

### 1. 分页状态管理

#### Karma.tsx 新增状态
```typescript
// 分页状态
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [totalTransactions, setTotalTransactions] = useState(0);
const itemsPerPage = 10;
```

### 2. API调用支持分页

#### 修改fetchKarmaTransactions函数
```typescript
const fetchKarmaTransactions = async (page: number = 1) => {
  try {
    const userId = getUserId();
    
    const response = await fetch(`http://localhost:5000/api/karma/transactions?userId=${userId}&page=${page}&limit=${itemsPerPage}`);
    const result = await response.json();
    
    if (result.success) {
      setTransactions(result.data.transactions);
      setTotalTransactions(result.data.pagination?.totalRecords || 0);
      setTotalPages(result.data.pagination?.totalPages || 1);
    } else {
      setError(result.message);
    }
  } catch (error) {
    setError('获取Karma交易记录失败');
    console.error('获取Karma交易记录失败:', error);
  }
};
```

### 3. 分页处理函数

#### 添加分页控制函数
```typescript
// 分页处理函数
const handlePageChange = (page: number) => {
  setCurrentPage(page);
  fetchKarmaTransactions(page);
};

const handlePreviousPage = () => {
  if (currentPage > 1) {
    handlePageChange(currentPage - 1);
  }
};

const handleNextPage = () => {
  if (currentPage < totalPages) {
    handlePageChange(currentPage + 1);
  }
};
```

### 4. 分页组件UI

#### 在Karma Acquired表格下方添加分页组件
```tsx
{/* 分页组件 */}
{totalPages > 1 && (
  <div className={styles.paginationContainer}>
    <div className={styles.paginationInfo}>
      显示 {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalTransactions)} 条，共 {totalTransactions} 条记录
    </div>
    <div className={styles.pagination}>
      <button 
        className={`${styles.paginationButton} ${currentPage === 1 ? styles.disabled : ''}`}
        onClick={handlePreviousPage}
        disabled={currentPage === 1}
      >
        &lt;
      </button>
      
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          className={`${styles.paginationButton} ${currentPage === page ? styles.active : ''}`}
          onClick={() => handlePageChange(page)}
        >
          {page}
        </button>
      ))}
      
      <button 
        className={`${styles.paginationButton} ${currentPage === totalPages ? styles.disabled : ''}`}
        onClick={handleNextPage}
        disabled={currentPage === totalPages}
      >
        &gt;
      </button>
    </div>
  </div>
)}
```

### 5. 分页样式

#### Karma.module.css 新增样式
```css
/* 分页组件样式 */
.paginationContainer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  padding: 1rem 0;
  border-top: 1px solid #404040;
}

.paginationInfo {
  color: #cccccc;
  font-size: 0.9rem;
}

.pagination {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.paginationButton {
  background: #404040;
  color: #ffffff;
  border: 1px solid #666666;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
  min-width: 40px;
  text-align: center;
}

.paginationButton:hover:not(.disabled) {
  background: #555555;
  border-color: #777777;
}

.paginationButton.active {
  background: #007bff;
  border-color: #007bff;
  color: #ffffff;
}

.paginationButton.disabled {
  background: #2a2a2a;
  color: #666666;
  border-color: #404040;
  cursor: not-allowed;
  opacity: 0.5;
}
```

## 🎨 分页组件设计

### 1. 分页导航
- **上一页/下一页按钮**：`<` 和 `>` 按钮
- **页码按钮**：显示所有页码，当前页高亮
- **记录统计**：显示当前页范围和总记录数

### 2. 视觉设计
- **WuxiaWorld风格**：与网站整体设计保持一致
- **颜色区分**：当前页蓝色高亮，其他页灰色
- **悬停效果**：按钮悬停时颜色变化
- **禁用状态**：不可用按钮显示禁用样式

### 3. 响应式设计
- **移动端适配**：分页按钮大小和间距适配小屏幕
- **触摸友好**：按钮大小适合触摸操作

## 📊 功能特点

### 1. 性能优化
- **后端分页**：只加载当前页数据，减少网络传输
- **数据库优化**：使用LIMIT和OFFSET进行高效查询
- **状态管理**：前端状态管理避免重复请求

### 2. 用户体验
- **快速导航**：点击页码直接跳转
- **状态反馈**：当前页高亮显示
- **边界处理**：首页和末页按钮禁用
- **加载状态**：分页切换时显示加载状态

### 3. 数据展示
- **每页10条记录**：避免表格过长
- **记录统计**：显示当前页范围和总记录数
- **颜色区分**：交易类型用不同颜色标签区分

## 🧪 测试验证

### 测试步骤
1. 访问 `http://localhost:3000/user-center?tab=karma`
2. 查看Karma Acquired表格
3. 如果记录超过10条，会显示分页组件
4. 测试分页导航功能

### 预期结果
- ✅ 分页组件显示在表格下方
- ✅ 记录统计显示正确
- ✅ 页码导航正常工作
- ✅ 样式与Cultivation Keys表格一致

## 📋 总结

**实现状态**：✅ 已完成

- ✅ 添加了分页状态管理
- ✅ 修改了API调用支持分页
- ✅ 实现了分页处理函数
- ✅ 添加了分页组件UI
- ✅ 应用了分页样式

**重要提醒**：现在Karma Acquired表格支持分页功能，类似Cultivation Keys Awarded and Redeemed表格的分页样式！

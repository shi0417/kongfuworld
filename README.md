# 武侠世界小说上传系统

## 项目简介

这是一个基于React + Node.js的小说上传系统，支持Word文档自动解析、章节分割和灵活的章节配置。

## 功能特性

- 📄 Word文档(.docx)自动解析
- 📖 智能章节分割
- 🔄 小说续传功能（智能识别已有小说，支持续传和新建）
- 📈 智能章节编号（自动计算续传时的起始章节号）
- ⚙️ 灵活的章节配置（免费/付费、VIP专享、抢先版、可见性）
- 📊 实时上传进度显示
- 🎯 章节范围设置（所有章节或指定范围）
- 💾 本地文件处理流程

## 技术栈

### 前端
- React 19.1.0
- TypeScript
- React Router DOM
- CSS Modules

### 后端
- Node.js
- Express.js
- MySQL
- Multer (文件上传)
- Mammoth (Word文档解析)

## 快速启动

### 方法1：使用启动脚本（推荐）

#### Windows
```bash
# 双击运行
start-dev.bat

# 或者在命令行运行
.\start-dev.bat
```

#### Linux/Mac
```bash
# 运行启动脚本
./start-dev.sh
```

### 方法2：手动启动

#### 1. 启动后端服务器
```bash
cd backend
node server.js
```

#### 2. 启动前端服务器
```bash
cd frontend
npm start
```

## 访问地址

- **前端应用**: http://localhost:3000
- **后端API**: http://localhost:5000
- **小说上传页面**: http://localhost:3000/upload

## 数据库配置

### 1. 确保MySQL服务运行
```bash
# Windows
net start mysql

# Linux/Mac
sudo service mysql start
# 或
sudo systemctl start mysql
```

### 2. 创建数据库
```sql
CREATE DATABASE kongfuworld;
```

### 3. 创建表结构
```bash
cd backend
mysql -u root -p kongfuworld < create_novel_tables.sql
```

### 4. 修改数据库配置
编辑 `backend/server.js` 中的数据库连接配置：
```javascript
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '你的密码',  // 修改为你的MySQL密码
  database: 'kongfuworld'
});
```

## 使用说明

### 1. 访问上传页面
- 登录后在导航栏点击"上传小说"
- 或直接访问 http://localhost:3000/upload

### 2. 填写小说信息
- 小说标题、作者、描述等基本信息
- 设置免费章节数和金币范围
- **智能识别**：系统会自动检测是否有相似的小说，提示选择续传或新建

### 3. 选择上传模式
- **新建小说**：创建全新的小说记录
- **续传小说**：继续上传已有小说的后续章节
  - 自动填充小说信息
  - 智能计算起始章节号
  - 保持小说和卷的连续性

### 4. 上传文档
- 选择Word文档(.docx格式)
- 系统自动解析并分割章节

### 5. 配置章节设置
- **锁定章节**：设置需要付费解锁的章节
- **VIP专享**：设置仅VIP用户可读的章节
- **抢先版**：设置抢先版章节
- **可见性**：设置章节是否在列表中显示

### 6. 提交上传
- 确认设置无误后提交
- 系统将数据保存到数据库

## 文件处理流程

1. **文件上传** → 保存到 `novel/` 目录
2. **文档解析** → 使用mammoth解析Word文档
3. **章节分割** → 自动识别章节标题并分割
4. **数据配置** → 用户设置章节属性
5. **数据库保存** → 创建小说、卷和章节记录
6. **文件清理** → 删除临时文件

## API端点

### 小说上传
- `POST /api/novel/find-similar` - 查询相似小说
- `GET /api/novel/:novelId/info` - 获取小说信息（章节数、卷信息等）
- `POST /api/novel/parse-chapters` - 解析Word文档章节
- `POST /api/novel/upload` - 上传小说到数据库（支持新建和续传）

## 故障排除

### 前端启动失败
```bash
# 清除缓存
cd frontend
rm -rf node_modules package-lock.json
npm install
npm start
```

### 后端启动失败
```bash
# 检查端口占用
netstat -ano | findstr :5000

# 检查数据库连接
cd backend
node -e "const mysql = require('mysql2'); const db = mysql.createConnection({host:'localhost',user:'root',password:'123456',database:'kongfuworld'}); db.connect(err => {if(err) console.error(err); else console.log('数据库连接成功'); db.end();});"
```

### 文件上传失败
1. 确保文件是.docx格式
2. 检查文件大小（最大50MB）
3. 确保novel目录有写入权限
4. 查看浏览器控制台和后端控制台的错误信息

### API请求失败
1. 确保后端服务器运行在5000端口
2. 检查前端配置文件 `frontend/src/config.ts`
3. 确保CORS配置正确

## 开发说明

### 项目结构
```
wuxiaworld-clone/
├── frontend/                 # 前端React应用
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # 通用组件
│   │   └── config.ts        # API配置
│   └── package.json
├── backend/                  # 后端Node.js应用
│   ├── server.js            # 主服务器文件
│   ├── upload_novel.js      # 小说上传逻辑
│   ├── create_novel_tables.sql  # 数据库表结构
│   └── package.json
├── novel/                    # 上传文件存储目录
├── start-dev.bat            # Windows启动脚本
├── start-dev.sh             # Linux/Mac启动脚本
└── README.md
```

### 环境变量
创建 `.env` 文件配置环境变量：
```env
# 前端环境变量
REACT_APP_API_URL=http://localhost:5000

# 后端环境变量
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=kongfuworld
PORT=5000
```

## 许可证

MIT License 
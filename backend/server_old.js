const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
// 尝试加载环境变量，如果失败则使用默认值
try {
  require('dotenv').config({ path: './kongfuworld.env' });
} catch (error) {
  console.log('dotenv not available, using default values');
}
const uploadApi="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"
// 导入小说上传模块
const { 
  findSimilarNovelsAPI, 
  getAllNovelsAPI,
  searchNovelsAPI,
  getNovelInfoAPI, 
  getNovelChaptersAPI,
  parseChaptersAPI, 
  parseMultipleFilesWithGPTAPI,
  uploadNovelAPI, 
  upload: novelUpload,
  setDatabase,
  setOpenAIApiKey
} = require('./upload_novel');

// 导入支付路由
const paymentRoutes = require('./routes/payment');

// 导入Champion路由
const championRoutes = require('./routes/champion');

// 导入Karma路由
const karmaRoutes = require('./routes/karma');

// 导入Karma支付路由
const karmaPaymentRoutes = require('./routes/karmaPayment');

// 导入用户路由
const userRoutes = require('./routes/user');

// 导入新的任务管理系统
const missionV2Routes = require('./routes/mission_v2');
const readingWithMissionRoutes = require('./routes/reading_with_mission');
const dailyCheckinWithMission = require('./daily_checkin_with_mission');


const app = express();
app.use(cors());
app.use(bodyParser.json());

// JWT验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Please login first' });
  }

  jwt.verify(token, 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token invalid or expired' });
    }
    req.user = user;
    next();
  });
};

// 静态托管 avatars 目录
app.use('/avatars', express.static(path.join(__dirname, '../avatars')));

// 支付路由
app.use('/api/payment', paymentRoutes);

// Champion路由
app.use('/api/champion', championRoutes);

// Karma路由
app.use('/api/karma', karmaRoutes);

// Karma支付路由
app.use('/api/karma/payment', karmaPaymentRoutes);

// 用户路由
app.use('/api/user', userRoutes);

// 收藏路由
const favoriteRoutes = require('./routes/favorite');
app.use('/api/favorite', favoriteRoutes);

// 书签路由
const bookmarkRoutes = require('./routes/bookmark');
app.use('/api/bookmark', bookmarkRoutes);

// 书签页面路由
const bookmarksRoutes = require('./routes/bookmarks');
app.use('/api/bookmarks', bookmarksRoutes);

// 书签锁定路由
const bookmarklockedRoutes = require('./routes/bookmarklocked');
app.use('/api/bookmarklocked', bookmarklockedRoutes);

// 第三方登录路由
const socialAuthRoutes = require('./routes/social_auth');
app.use('/api/auth', socialAuthRoutes);

// 静态托管 covers 目录 - 使用avatars目录
app.use('/covers', express.static(path.join(__dirname, '../avatars')));

// 数据库连接池配置
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  connectionLimit: 10,
  charset: 'utf8mb4'
});

// 测试数据库连接
db.getConnection((err, connection) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('数据库连接成功');
  connection.release();
});

// 设置上传模块的数据库连接
setDatabase(db);

// 设置OpenAI API Key
setOpenAIApiKey(uploadApi);

// 导入每日签到API
const dailyCheckinAPI = require('./daily_checkin_api');
const optimizedCheckinAPI = require('./optimized_checkin_api');

// 头像上传配置
const avatarDir = path.join(__dirname, '../avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir);

// 封面图片上传配置 - 使用avatars目录
const coversDir = path.join(__dirname, '../avatars');
if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 根据文件类型决定存储目录
    if (req.path.includes('/cover')) {
      cb(null, coversDir);
    } else {
      cb(null, avatarDir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    if (req.path.includes('/cover')) {
      cb(null, `novel_cover_${req.params.id}_${timestamp}${ext}`);
    } else {
      cb(null, `user_${req.params.id}_${timestamp}${ext}`);
    }
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB for covers

// 小说上传API路由
app.post('/api/novel/find-similar', findSimilarNovelsAPI);
app.get('/api/novels', getAllNovelsAPI);
app.post('/api/novels/search', searchNovelsAPI);
app.get('/api/novel/:novelId/info', getNovelInfoAPI);
app.get('/api/novel/:novelId/chapters', getNovelChaptersAPI);
app.post('/api/novel/parse-chapters', novelUpload.single('file'), parseChaptersAPI);
// 创建带有更大字段限制的 multer 实例用于小说上传
const novelUploadWithLimits = multer({ 
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '../novel');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      cb(null, `${name}_${timestamp}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/pdf', // .pdf
      'text/plain', // .txt
      'application/msword' // .doc
    ];
    
    if (validTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持Word文档(.docx/.doc)、PDF(.pdf)和文本文件(.txt)'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 文件大小限制
    fieldSize: 10 * 1024 * 1024 // 10MB 字段大小限制，用于处理大量章节数据
  }
});

app.post('/api/novel/parse-multiple-files', novelUploadWithLimits.array('files'), parseMultipleFilesWithGPTAPI);
app.post('/api/novel/upload', novelUploadWithLimits.array('files'), uploadNovelAPI);

// 登录API
app.post('/api/login', (req, res) => {
  console.log('收到登录请求:', { username: req.body.username, password: req.body.password ? '***' : 'undefined' });
  const { username, password } = req.body;
  db.getConnection((err, connection) => {
    if (err) {
      console.error('获取数据库连接失败:', err);
      return res.status(500).json({ message: 'Database connection error' });
    }
    
    connection.query(
      'SELECT * FROM user WHERE username = ? OR email = ?',
      [username, username],
      (queryErr, results) => {
        connection.release();
        
        if (queryErr) {
          console.error('登录查询失败:', queryErr);
          return res.status(500).json({ message: 'Database error' });
        }
        
        if (results.length === 0) return res.status(401).json({ message: 'User not found' });

        const user = results[0];
        // 这里要用 password_hash 字段
        bcrypt.compare(password, user.password_hash, (bcryptErr, isMatch) => {
          if (bcryptErr) {
            console.error('密码比较失败:', bcryptErr);
            return res.status(500).json({ message: 'Password verification error' });
          }
          
          if (isMatch) {
            // 生成JWT token
            const token = jwt.sign(
              { userId: user.id, username: user.username },
              'your-secret-key',
              { expiresIn: '7d' }
            );
            
            res.json({ 
              success: true,
              message: 'Login successful', 
              user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, points: user.points, golden_karma: user.golden_karma },
              token: token
            });
          } else {
            res.status(401).json({ message: 'Incorrect password' });
          }
        });
      }
    );
  });
});

// 注册接口
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please fill in all required information' });
  }
  db.query('SELECT * FROM user WHERE username = ? OR email = ?', [username, email], (err, results) => {
    if (err) {
      console.error('注册查询Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error', error: err.code || String(err) });
    }
    if (results.length > 0) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.error('密码Encryption failed:', err);
        return res.status(500).json({ success: false, message: 'Encryption failed' });
      }
      db.query(
        'INSERT INTO user (username, email, password_hash, avatar, is_vip, balance, points, vip_expire_at, golden_karma, settings_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, email, hash, '', 0, 0, 0, null, 0, JSON.stringify({
          auto_unlock: true,
          paragraph_comments: true,
          notify_unlock_updates: true,
          notify_chapter_updates: true,
          accept_marketing: true
        })],
        (err, result) => {
          if (err) {
            console.error('Registration failed(插入用户)错误:', err);
            return res.status(500).json({ success: false, message: 'Registration failed', error: err.code || String(err) });
          }
          const newUserId = result.insertId;
          db.query('SELECT id, username, email, avatar, points, golden_karma FROM user WHERE id = ?', [newUserId], (uErr, uResults) => {
            if (uErr || uResults.length === 0) {
              if (uErr) console.error('注册后Failed to query user:', uErr);
              return res.json({ success: true, message: 'Registration successful!' });
            }
            const user = uResults[0];
            const token = jwt.sign(
              { userId: user.id, username: user.username },
              'your-secret-key',
              { expiresIn: '7d' }
            );
            return res.json({
              success: true,
              message: 'Registration successful!',
              data: { user, token }
            });
          });
        }
      );
    });
  });
});

// 获取用户详细信息
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  db.query('SELECT id, username, email, avatar, points, golden_karma, settings_json FROM user WHERE id = ?', [userId], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ message: 'User not found' });
    
    const user = results[0];
    // 解析 settings_json 字段
    let settings_json = null;
    if (user.settings_json) {
      if (typeof user.settings_json === 'string') {
        try {
          settings_json = JSON.parse(user.settings_json);
        } catch (e) {
          console.error('解析 settings_json 失败:', e);
          settings_json = null;
        }
      } else if (typeof user.settings_json === 'object') {
        // 如果已经是对象，直接使用
        settings_json = user.settings_json;
      }
    }
    
    res.json({ 
      success: true,
      data: {
        ...user,
        settings_json: settings_json
      }
    });
  });
});

// 保存用户设置
app.post('/api/user/:id/settings', (req, res) => {
  const userId = req.params.id;
  const { settings_json } = req.body;
  console.log('保存设置:', { userId, settings_json });
  db.query('UPDATE user SET settings_json = ? WHERE id = ?', [JSON.stringify(settings_json), userId], (err, result) => {
    if (err) {
      console.error('保存设置失败:', err);
      return res.status(500).json({ message: 'Save failed' });
    }
    console.log('设置Save successful');
    res.json({ message: 'Save successful' });
  });
});

// 修复数据库表结构（添加 settings_json 字段）
app.post('/api/fix-database', (req, res) => {
  console.log('开始修复数据库...');
  
  // 添加 settings_json 字段
  db.query('ALTER TABLE user ADD COLUMN IF NOT EXISTS settings_json TEXT', (err) => {
    if (err) {
      console.error('Failed to add field:', err);
      return res.status(500).json({ message: 'Failed to add field' });
    }
    
    console.log('字段添加成功');
    
    // 为现有用户设置默认值
    const defaultSettings = {
      auto_unlock: true,
      paragraph_comments: true,
      notify_unlock_updates: true,
      notify_chapter_updates: true,
      accept_marketing: true
    };
    
    db.query('UPDATE user SET settings_json = ? WHERE settings_json IS NULL OR settings_json = ""', 
      [JSON.stringify(defaultSettings)], (updateErr, result) => {
      if (updateErr) {
        console.error('Failed to update default settings:', updateErr);
        return res.status(500).json({ message: 'Failed to update default settings' });
      }
      
      console.log('数据库修复完成，更新了', result.affectedRows, '个用户');
      res.json({ message: 'Database repair successful', updatedUsers: result.affectedRows });
    });
  });
});

// 初始化用户设置（如果为空）
app.post('/api/user/:id/init-settings', (req, res) => {
  const userId = req.params.id;
  console.log('初始化用户设置，用户ID:', userId);
  
  const defaultSettings = {
    auto_unlock: true,
    paragraph_comments: true,
    notify_unlock_updates: true,
    notify_chapter_updates: true,
    accept_marketing: true
  };
  
  // 先检查用户是否存在
  db.query('SELECT id, settings_json FROM user WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Failed to query user:', err);
      return res.status(500).json({ message: 'Failed to query user' });
    }
    
    if (results.length === 0) {
      console.error('User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = results[0];
    console.log('当前用户设置:', user.settings_json);
    
    // 检查设置是否为空
    let existingSettings = null;
    if (user.settings_json) {
      if (typeof user.settings_json === 'string') {
        if (user.settings_json.trim() !== '') {
          try {
            existingSettings = JSON.parse(user.settings_json);
            console.log('用户Settings already exist，无需初始化');
            return res.json({ message: 'Settings already exist', settings: existingSettings });
          } catch (e) {
            console.log('解析现有设置失败，重新初始化');
          }
        }
      } else if (typeof user.settings_json === 'object') {
        // 如果已经是对象，直接使用
        existingSettings = user.settings_json;
        console.log('用户Settings already exist（对象格式），无需初始化');
        return res.json({ message: 'Settings already exist', settings: existingSettings });
      }
    }
    
    // 更新设置
    const settingsJson = JSON.stringify(defaultSettings);
    console.log('准备更新的设置:', settingsJson);
    
    db.query('UPDATE user SET settings_json = ? WHERE id = ?', [settingsJson, userId], (updateErr, result) => {
      if (updateErr) {
        console.error('Failed to update settings:', updateErr);
        return res.status(500).json({ message: 'Failed to update settings' });
      }
      
      console.log('设置Initialization successful，影响行数:', result.affectedRows);
      res.json({ message: 'Initialization successful', settings: defaultSettings });
    });
  });
});

// 上传头像
app.post('/api/user/:id/avatar', upload.single('avatar'), (req, res) => {
  const userId = req.params.id;
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `/avatars/${req.file.filename}`;
  db.query('UPDATE user SET avatar = ? WHERE id = ?', [url, userId], (err) => {
    if (err) return res.status(500).json({ message: 'Save failed' });
    res.json({ url });
  });
});
// 删除头像
app.delete('/api/user/:id/avatar', (req, res) => {
  const userId = req.params.id;
  db.query('SELECT avatar FROM user WHERE id = ?', [userId], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ message: 'User not found' });
    const avatarPath = results[0].avatar ? path.join(avatarDir, path.basename(results[0].avatar)) : null;
    db.query('UPDATE user SET avatar = "" WHERE id = ?', [userId], (err2) => {
      if (err2) return res.status(500).json({ message: 'Delete failed' });
      if (avatarPath && fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
      res.json({ success: true });
    });
  });
});

// 获取用户通知列表（包含时间解锁记录）- 使用UNION查询
app.get('/api/user/:id/notifications', (req, res) => {
  const userId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const type = req.query.type || 'unlock';
  const offset = (page - 1) * limit;
  
  console.log('获取通知请求:', { userId, page, limit, type, offset });
  
  // 首先检查用户的解锁更新通知设置
  db.query('SELECT settings_json FROM user WHERE id = ?', [userId], (err, userResults) => {
    if (err) {
      console.error('获取用户设置失败:', err);
      return res.status(500).json({ message: '获取用户设置失败' });
    }
    
    if (userResults.length === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    const user = userResults[0];
    let notifyUnlockUpdates = false;
    
    // 解析用户设置
    if (user.settings_json) {
      try {
        const settings = typeof user.settings_json === 'string' 
          ? JSON.parse(user.settings_json) 
          : user.settings_json;
        notifyUnlockUpdates = settings.notify_unlock_updates === true;
      } catch (e) {
        console.error('解析用户设置失败:', e);
      }
    }
    
    console.log('用户解锁更新通知设置:', notifyUnlockUpdates);
    
    // 根据类型分别查询不同的表
    if (type === 'unlock') {
      // 查询时间解锁记录
      if (!notifyUnlockUpdates) {
        return res.json({
          success: true,
          data: {
            notifications: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              total: 0,
              limit
            }
          }
        });
      }
      
      const timeUnlockQuery = `
        SELECT 
          CONCAT('time_unlock_', cu.id) as id,
          cu.user_id,
          cu.chapter_id,
          cu.unlock_at,
          cu.status,
          cu.created_at,
          cu.updated_at,
          cu.readed,
          n.title as novel_title,
          c.chapter_number,
          c.title as chapter_title,
          c.novel_id,
          'notify_unlock_updates' as type,
          CONCAT('/novel/', c.novel_id, '/chapter/', cu.chapter_id) as link,
          cu.readed as is_read,
          CONCAT('Chapter ', c.chapter_number, ': "', c.title, '" ', 
                 CASE 
                   WHEN cu.status = 'unlocked' OR cu.unlock_at <= NOW() 
                   THEN CONCAT('has been released at ', DATE_FORMAT(cu.unlock_at, '%Y/%m/%d %H:%i:%s'))
                   ELSE CONCAT('will be released at ', DATE_FORMAT(cu.unlock_at, '%Y/%m/%d %H:%i:%s'))
                 END) as message,
          TIMESTAMPDIFF(HOUR, cu.created_at, NOW()) as hours_ago,
          TIMESTAMPDIFF(DAY, cu.created_at, NOW()) as days_ago,
          1 as isTimeUnlock,
          CASE WHEN cu.status = 'unlocked' OR cu.unlock_at <= NOW() THEN 1 ELSE 0 END as isUnlocked
        FROM chapter_unlocks cu
        JOIN chapter c ON cu.chapter_id = c.id
        JOIN novel n ON c.novel_id = n.id
        WHERE cu.user_id = ? 
          AND cu.unlock_method = 'time_unlock'
          AND cu.status IN ('pending', 'unlocked')
        ORDER BY cu.updated_at DESC
        LIMIT ? OFFSET ?
      `;
      
      db.query(timeUnlockQuery, [userId, limit, offset], (err, results) => {
        if (err) {
          console.error('获取时间解锁记录失败:', err);
          return res.status(500).json({ message: '获取通知失败' });
        }
        
        console.log('查询到的时间解锁记录数量:', results.length);
        
        // 格式化时间
        const notifications = results.map(notification => {
          let timeAgo = '';
          if (notification.days_ago > 0) {
            timeAgo = notification.days_ago === 1 ? 'a day ago' : `${notification.days_ago} days ago`;
          } else if (notification.hours_ago > 0) {
            timeAgo = `${notification.hours_ago} hours ago`;
          } else {
            timeAgo = 'just now';
          }
          
          // 对于时间解锁记录，计算正确的时间显示
          const unlockAt = new Date(notification.unlock_at);
          const now = new Date();
          const isUnlocked = notification.status === 'unlocked' || unlockAt <= now;
          
          if (isUnlocked) {
            // 已解锁：计算解锁后过了多长时间
            const timeDiff = now - unlockAt;
            const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
            const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            
            if (daysAgo > 0) {
              timeAgo = daysAgo === 1 ? 'a day ago' : `${daysAgo} days ago`;
            } else if (hoursAgo > 0) {
              timeAgo = `${hoursAgo} hours ago`;
            } else {
              timeAgo = 'just now';
            }
          } else {
            // 未解锁：计算距离解锁还有多长时间
            const timeDiff = unlockAt - now;
            const hoursLater = Math.floor(timeDiff / (1000 * 60 * 60));
            const daysLater = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            
            if (daysLater > 0) {
              timeAgo = `${daysLater} days later unlock`;
            } else if (hoursLater > 0) {
              timeAgo = `${hoursLater} hours later unlock`;
            } else {
              timeAgo = 'unlocking soon';
            }
          }
          
          return {
            ...notification,
            timeAgo,
            readed: notification.readed || 0
          };
        });
        
        // 获取总数
        const countQuery = `
          SELECT COUNT(*) as total FROM chapter_unlocks cu
          WHERE cu.user_id = ? 
            AND cu.unlock_method = 'time_unlock'
            AND cu.status IN ('pending', 'unlocked')
        `;
        
        db.query(countQuery, [userId], (err, countResults) => {
          if (err) {
            console.error('获取时间解锁记录总数失败:', err);
            return res.status(500).json({ message: '获取通知失败' });
          }
          
          const total = countResults[0].total;
          const totalPages = Math.ceil(total / limit);
          console.log('时间解锁记录总数:', total, '总页数:', totalPages);
          
          res.json({
            success: true,
            data: {
              notifications,
              pagination: {
                currentPage: page,
                totalPages,
                total,
                limit
              }
            }
          });
        });
      });
    } else if (type === 'chapter_marketing') {
      // 查询普通通知（章节更新和营销）
      const notificationQuery = `
        SELECT 
          n.id,
          n.user_id,
          n.chapter_id,
          NULL as unlock_at,
          NULL as status,
          n.created_at,
          n.updated_at,
          NULL as readed,
          n.novel_title,
          NULL as chapter_number,
          n.chapter_title,
          n.novel_id,
          n.type,
          n.link,
          n.is_read,
          n.message,
          TIMESTAMPDIFF(HOUR, n.created_at, NOW()) as hours_ago,
          TIMESTAMPDIFF(DAY, n.created_at, NOW()) as days_ago,
          0 as isTimeUnlock,
          NULL as isUnlocked
        FROM notifications n
        WHERE n.user_id = ?
        ORDER BY n.updated_at DESC
        LIMIT ? OFFSET ?
      `;
      
      db.query(notificationQuery, [userId, limit, offset], (err, results) => {
        if (err) {
          console.error('获取通知失败:', err);
          return res.status(500).json({ message: '获取通知失败' });
        }
        
        console.log('查询到的通知数量:', results.length);
        
        // 格式化时间
        const notifications = results.map(notification => {
          let timeAgo = '';
          if (notification.days_ago > 0) {
            timeAgo = notification.days_ago === 1 ? 'a day ago' : `${notification.days_ago} days ago`;
          } else if (notification.hours_ago > 0) {
            timeAgo = `${notification.hours_ago} hours ago`;
          } else {
            timeAgo = 'just now';
          }
          
          return {
            ...notification,
            timeAgo,
            readed: notification.readed || 0
          };
        });
        
        // 获取总数
        const countQuery = 'SELECT COUNT(*) as total FROM notifications n WHERE n.user_id = ?';
        
        db.query(countQuery, [userId], (err, countResults) => {
          if (err) {
            console.error('获取通知总数失败:', err);
            return res.status(500).json({ message: '获取通知失败' });
          }
          
          const total = countResults[0].total;
          const totalPages = Math.ceil(total / limit);
          console.log('通知总数:', total, '总页数:', totalPages);
          
          res.json({
            success: true,
            data: {
              notifications,
              pagination: {
                currentPage: page,
                totalPages,
                total,
                limit
              }
            }
          });
        });
      });
    } else {
      return res.status(400).json({ message: '无效的通知类型' });
    }
  });
});

// 标记通知为已读
          timeUnlockRecords = timeResults.map(record => {
            const unlockAt = new Date(record.unlock_at);
            const now = new Date();
            const isUnlocked = record.status === 'unlocked' || unlockAt <= now;
            
            let timeAgo;
            if (isUnlocked) {
              // 已解锁：计算解锁后过了多长时间
              const timeDiff = now - unlockAt;
              const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
              const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
              
              if (daysAgo > 0) {
                timeAgo = daysAgo === 1 ? 'a day ago' : `${daysAgo} days ago`;
              } else if (hoursAgo > 0) {
                timeAgo = `${hoursAgo} hours ago`;
              } else {
                timeAgo = 'just now';
              }
            } else {
              // 未解锁：计算距离解锁还有多长时间
              const timeDiff = unlockAt - now;
              const hoursLater = Math.floor(timeDiff / (1000 * 60 * 60));
              const daysLater = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
              
              if (daysLater > 0) {
                timeAgo = `${daysLater} days later unlock`;
              } else if (hoursLater > 0) {
                timeAgo = `${hoursLater} hours later unlock`;
              } else {
                timeAgo = 'unlocking soon';
              }
            }
            
            return {
              id: `time_unlock_${record.id}`,
              novel_id: record.novel_id,
              chapter_id: record.chapter_id,
              novel_title: record.novel_title,
              chapter_title: record.chapter_title,
              message: isUnlocked 
                ? `Chapter ${record.chapter_number}: "${record.chapter_title}" has been released at ${unlockAt.toLocaleString()}`
                : `Chapter ${record.chapter_number}: "${record.chapter_title}" will be released at ${unlockAt.toLocaleString()}`,
              type: 'notify_unlock_updates',
              link: `/novel/${record.novel_id}/chapter/${record.chapter_id}`,
              is_read: record.readed || 0,
              created_at: record.created_at,
              unlock_at: record.unlock_at,
              timeAgo,
              isTimeUnlock: true,
              isUnlocked,
              readed: record.readed || 0
            };
          });
        
        // 继续处理普通通知
        processNotifications();
      });
    } else if (type === 'chapter_marketing') {
      // 查询普通通知（章节更新和营销）
      processNotifications();
    } else {
      return res.status(400).json({ message: '无效的通知类型' });
    }
    
    function processNotifications() {
      // 构建查询条件
      let whereClause = 'WHERE n.user_id = ?';
      let params = [userId];
      
      if (type !== 'all') {
        whereClause += ' AND n.type = ?';
        params.push(type);
      }
      
      // 获取总数
      const countQuery = `SELECT COUNT(*) as total FROM notifications n ${whereClause}`;
      db.query(countQuery, params, (err, countResults) => {
        if (err) {
          console.error('获取通知总数失败:', err);
          return res.status(500).json({ message: '获取通知失败' });
        }
        
        const total = countResults[0].total;
        const totalPages = Math.ceil(total / limit);
        console.log('通知总数:', total, '总页数:', totalPages);
      
        // 获取通知列表
        const listQuery = `
          SELECT 
            n.id,
            n.novel_id,
            n.chapter_id,
            n.novel_title,
            n.chapter_title,
            n.message,
            n.type,
            n.link,
            n.is_read,
            n.created_at,
            n.updated_at,
            TIMESTAMPDIFF(HOUR, n.created_at, NOW()) as hours_ago,
            TIMESTAMPDIFF(DAY, n.created_at, NOW()) as days_ago
          FROM notifications n 
          ${whereClause}
          ORDER BY n.created_at DESC
          LIMIT ? OFFSET ?
        `;
        
        db.query(listQuery, [...params, limit, offset], (err, results) => {
          if (err) {
            console.error('获取通知列表失败:', err);
            return res.status(500).json({ message: '获取通知失败', error: err.message });
          }
          
          console.log('查询到的通知数量:', results.length);
          console.log('原始通知数据:', results);
          
          // 格式化时间
          const notifications = results.map(notification => {
            let timeAgo = '';
            if (notification.days_ago > 0) {
              timeAgo = notification.days_ago === 1 ? 'a day ago' : `${notification.days_ago} days ago`;
            } else if (notification.hours_ago > 0) {
              timeAgo = `${notification.hours_ago} hours ago`;
            } else {
              timeAgo = 'just now';
            }
            
            return {
              ...notification,
              timeAgo,
              isTimeUnlock: false
            };
          });
          
          // 合并时间解锁记录和普通通知
          const allNotifications = [...timeUnlockRecords, ...notifications];
          
          // 按时间排序
          allNotifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          
          // 分页处理
          const startIndex = (page - 1) * limit;
          const endIndex = startIndex + limit;
          const paginatedNotifications = allNotifications.slice(startIndex, endIndex);
          
          res.json({
            success: true,
            data: {
              notifications: paginatedNotifications,
              pagination: {
                currentPage: page,
                totalPages: Math.ceil(allNotifications.length / limit),
                total: allNotifications.length,
                limit
              }
            }
          });
        });
      });
    }
  });
});

// 标记通知为已读
app.post('/api/user/:id/notifications/:notificationId/read', (req, res) => {
  const userId = req.params.id;
  const notificationId = req.params.notificationId;
  
  // 检查是否是时间解锁记录
  if (notificationId.startsWith('time_unlock_')) {
    const chapterUnlockId = notificationId.replace('time_unlock_', '');
    
    // 更新 chapter_unlocks 表的 readed 字段
    db.query('UPDATE chapter_unlocks SET readed = 1 WHERE id = ? AND user_id = ?', 
      [chapterUnlockId, userId], (err, result) => {
      if (err) {
        console.error('标记时间解锁记录已读失败:', err);
        return res.status(500).json({ message: 'Operation failed' });
      }
      res.json({ success: true });
    });
  } else {
    // 更新普通通知
    db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', 
      [notificationId, userId], (err, result) => {
      if (err) {
        console.error('标记已读失败:', err);
        return res.status(500).json({ message: 'Operation failed' });
      }
      res.json({ success: true });
    });
  }
});

// 标记所有通知为已读
app.post('/api/user/:id/notifications/mark-all-read', (req, res) => {
  const userId = req.params.id;
  
  db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId], (err, result) => {
    if (err) {
      console.error('标记全部已读失败:', err);
      return res.status(500).json({ message: 'Operation failed' });
    }
    res.json({ success: true, updatedCount: result.affectedRows });
  });
});

// 创建测试通知数据
app.post('/api/create-test-notifications', (req, res) => {
  const testNotifications = [
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6642,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6642: One Hand has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6642'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6641,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6641: So Magical has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6641'
    },
    {
      user_id: 2,
      novel_id: 2,
      chapter_id: 140,
      title: 'World\'s No. 1 Swordsman',
      message: 'Chapter 140: The Opening of the Grand Conference, the Clash of Three Swords has been released!',
      type: 'chapter',
      link: '/novel/2/chapter/140'
    },
    {
      user_id: 2,
      novel_id: 2,
      chapter_id: 139,
      title: 'World\'s No. 1 Swordsman',
      message: 'Chapter 139: The Sacred Mountain Becomes Lively has been released!',
      type: 'chapter',
      link: '/novel/2/chapter/139'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6639,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6639: Exchanging The Tribulations has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6639'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: 6640,
      title: 'Emperor\'s Domination',
      message: 'Chapter 6640: Not Right has been released!',
      type: 'chapter',
      link: '/novel/1/chapter/6640'
    },
    {
      user_id: 2,
      novel_id: 3,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'The Sovereign\'s Ascension',
      type: 'news',
      link: '/novel/3'
    },
    {
      user_id: 2,
      novel_id: 4,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'Dragon War God',
      type: 'news',
      link: '/novel/4'
    },
    {
      user_id: 2,
      novel_id: 1,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'Emperor\'s Domination',
      type: 'news',
      link: '/novel/1'
    },
    {
      user_id: 2,
      novel_id: 5,
      chapter_id: null,
      title: 'Read Now for FREE',
      message: 'Overgeared',
      type: 'news',
      link: '/novel/5'
    }
  ];
  
  // 设置不同的创建时间
  const now = new Date();
  const notificationsWithTime = testNotifications.map((notification, index) => {
    const createdAt = new Date(now.getTime() - (index * 60 * 60 * 1000)); // 每小时递减
    return {
      ...notification,
      created_at: createdAt.toISOString().slice(0, 19).replace('T', ' ')
    };
  });
  
  const values = notificationsWithTime.map(n => [
    n.user_id, n.novel_id, n.chapter_id, n.title, n.message, n.type, n.link, n.is_read, n.created_at
  ]);
  
  db.query(`
    INSERT INTO notifications (user_id, novel_id, chapter_id, title, message, type, link, is_read, created_at) 
    VALUES ?
  `, [values], (err, result) => {
    if (err) {
      console.error('创建测试通知失败:', err);
      return res.status(500).json({ message: 'Failed to create test data' });
    }
    res.json({ message: 'Test notification created successfully', count: result.affectedRows });
  });
});

// 根据小说名称搜索小说
app.post('/api/novel/search-by-title', (req, res) => {
  const { title } = req.body;
  
  if (!title || title.trim() === '') {
    return res.status(400).json({ message: 'Please enter novel name' });
  }
  
  const query = `
    SELECT id, title, author, translator, description, chapters, licensed_from, status, cover, rating, reviews
    FROM novel 
    WHERE title LIKE ? 
    ORDER BY title ASC
  `;
  
  db.query(query, [`%${title.trim()}%`], (err, results) => {
    if (err) {
      console.error('搜索小说失败:', err);
      return res.status(500).json({ message: 'Search failed' });
    }
    
    res.json({ novels: results });
  });
});

// 获取小说详细信息
app.get('/api/novel/:id/details', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT id, title, author, translator, description, chapters, licensed_from, status, cover, rating, reviews
    FROM novel 
    WHERE id = ?
  `;
  
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Failed to get novel details:', err);
      return res.status(500).json({ message: 'Failed to get novel details' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    res.json({ novel: results[0] });
  });
});

// 获取小说的章节数量
app.get('/api/novel/:id/chapter-count', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT COUNT(*) as chapter_count
    FROM chapter 
    WHERE novel_id = ? AND is_visible = 1
  `;
  
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Failed to get chapter count:', err);
      return res.status(500).json({ message: 'Failed to get chapter count' });
    }
    
    res.json({ chapterCount: results[0].chapter_count });
  });
});

// 更新小说信息
app.put('/api/novel/:id/update', (req, res) => {
  const { id } = req.params;
  const { title, author, translator, description, chapters, licensed_from } = req.body;
  
  const query = `
    UPDATE novel 
    SET title = ?, author = ?, translator = ?, description = ?, chapters = ?, licensed_from = ?
    WHERE id = ?
  `;
  
  db.query(query, [title, author, translator, description, chapters, licensed_from, id], (err, result) => {
    if (err) {
      console.error('更新小说失败:', err);
      return res.status(500).json({ message: 'Update failed' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    res.json({ message: 'Update successful' });
  });
});

// 上传小说封面图片
app.post('/api/novel/:id/cover', upload.single('cover'), (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ message: 'Please select image file' });
  }
  
  // 验证文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ message: 'Only JPG, PNG, GIF format images are supported' });
  }
  
  // 验证文件大小 (5MB)
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ message: 'Image file size cannot exceed 5MB' });
  }
  
  const coverUrl = `/covers/${req.file.filename}`;
  
  // 更新数据库中的封面字段
  const query = `UPDATE novel SET cover = ? WHERE id = ?`;
  
  db.query(query, [coverUrl, id], (err, result) => {
    if (err) {
      console.error('Failed to update cover:', err);
      return res.status(500).json({ message: 'Failed to update cover' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    res.json({ 
      message: 'Cover upload successful', 
      coverUrl: coverUrl 
    });
  });
});

// 获取小说的卷信息 - 简单版本（已废弃，使用下面的完整版本）
// app.get('/api/novel/:id/volumes', (req, res) => {
//   const { id } = req.params;
//   
//   const query = `
//     SELECT id, novel_id, volume_id, title, start_chapter, end_chapter, chapter_count
//     FROM volume 
//     WHERE novel_id = ?
//     ORDER BY volume_id ASC
//   `;
//   
//   db.query(query, [id], (err, results) => {
//     if (err) {
//       console.error('获取卷信息失败:', err);
//       return res.status(500).json({ message: '获取卷信息失败' });
//     }
//     
//     res.json({ volumes: results });
//   });
// });

// 更新或创建卷信息
app.post('/api/novel/:id/volumes', (req, res) => {
  const { id } = req.params;
  const { volumes } = req.body;
  
  if (!volumes || !Array.isArray(volumes)) {
    return res.status(400).json({ message: 'Please provide volume information' });
  }
  
  // 开始事务
  db.beginTransaction((err) => {
    if (err) {
      console.error('开始事务失败:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    
    let completedOperations = 0;
    const totalOperations = volumes.length;
    let hasError = false;
    
    const checkAndProcessVolume = (volumeIndex) => {
      if (hasError || volumeIndex >= volumes.length) {
        if (completedOperations === totalOperations) {
          if (hasError) {
            db.rollback(() => {
              res.status(500).json({ message: 'Failed to process volume information' });
            });
          } else {
            db.commit((commitErr) => {
              if (commitErr) {
                console.error('提交事务失败:', commitErr);
                return res.status(500).json({ message: 'Save failed' });
              }
              res.json({ message: '卷信息Update successful' });
            });
          }
        }
        return;
      }
      
      const volume = volumes[volumeIndex];
      const { volume_id, title, start_chapter, end_chapter, chapter_count } = volume;
      
      // 检查是否已存在相同的组合（novel_id + volume_id）
      const checkQuery = `
        SELECT id FROM volume 
        WHERE novel_id = ? AND volume_id = ?
      `;
      
      db.query(checkQuery, [id, volume_id], (checkErr, checkResults) => {
        if (checkErr) {
          hasError = true;
          completedOperations++;
          checkAndProcessVolume(volumeIndex + 1);
          return;
        }
        
        if (checkResults.length > 0) {
          // 更新现有记录
          const updateQuery = `
            UPDATE volume 
            SET title = ?, start_chapter = ?, end_chapter = ?, chapter_count = ?
            WHERE novel_id = ? AND volume_id = ?
          `;
          
          db.query(updateQuery, [title, start_chapter, end_chapter, chapter_count, id, volume_id], (updateErr) => {
            if (updateErr) {
              hasError = true;
            }
            completedOperations++;
            checkAndProcessVolume(volumeIndex + 1);
          });
        } else {
          // 创建新记录
          const insertQuery = `
            INSERT INTO volume (novel_id, volume_id, title, start_chapter, end_chapter, chapter_count)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          
          db.query(insertQuery, [id, volume_id, title, start_chapter, end_chapter, chapter_count], (insertErr) => {
            if (insertErr) {
              hasError = true;
            }
            completedOperations++;
            checkAndProcessVolume(volumeIndex + 1);
          });
        }
      });
    };
    
    // 开始处理第一个卷
    checkAndProcessVolume(0);
  });
});

// 更新小说卷轴信息
app.put('/api/novels/:novelId/volumes', (req, res) => {
  const { novelId } = req.params;
  const { volumes } = req.body;

  console.log('收到更新卷轴请求:', { novelId, volumes });

  // 首先删除该小说的所有现有卷轴信息
  db.query('DELETE FROM volume WHERE novel_id = ?', [novelId], (deleteErr) => {
    if (deleteErr) {
      console.error('Failed to delete existing volume information:', deleteErr);
      return res.status(500).json({ success: false, message: 'Failed to delete existing volume information' });
    }

    console.log('成功删除现有卷轴信息');

    // 如果没有新的卷轴信息，直接返回成功
    if (!volumes || volumes.length === 0) {
      return res.json({ success: true, message: '卷轴信息Update successful' });
    }

    // 插入新的卷轴信息
    let completedInserts = 0;
    let hasError = false;

    volumes.forEach((volume, index) => {
      const insertQuery = `
        INSERT INTO volume (novel_id, volume_id, title, start_chapter, end_chapter, chapter_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.query(insertQuery, [
        volume.novel_id,
        volume.volume_id,
        volume.title,
        volume.start_chapter,
        volume.end_chapter,
        volume.chapter_count
      ], (insertErr) => {
        if (insertErr) {
          console.error(`插入卷轴信息失败 (索引 ${index}):`, insertErr);
          hasError = true;
        }
        
        completedInserts++;
        
        // 当所有插入操作完成时
        if (completedInserts === volumes.length) {
          if (hasError) {
            res.status(500).json({ success: false, message: 'Failed to insert some volume information' });
          } else {
            console.log('所有卷轴信息插入成功');
            res.json({ success: true, message: '卷轴信息Update successful' });
          }
        }
      });
    });
  });
});

// 更新章节的volume_id
app.put('/api/novels/:novelId/chapters/volume-id', (req, res) => {
  const { novelId } = req.params;
  const { chapterUpdates } = req.body;

  console.log('收到更新章节volume_id请求:', { novelId, chapterUpdates });

  if (!chapterUpdates || chapterUpdates.length === 0) {
    return res.json({ success: true, message: '章节volume_idUpdate successful' });
  }

  // 批量更新章节的volume_id
  let completedUpdates = 0;
  let hasError = false;

  chapterUpdates.forEach((update, index) => {
    const updateQuery = `
      UPDATE chapter 
      SET volume_id = ? 
      WHERE novel_id = ? AND chapter_number = ?
    `;
    
    db.query(updateQuery, [update.volume_id, update.novel_id, update.chapter_number], (updateErr) => {
      if (updateErr) {
        console.error(`更新章节volume_id失败 (索引 ${index}):`, updateErr);
        hasError = true;
      }
      
      completedUpdates++;
      
      // 当所有更新操作完成时
      if (completedUpdates === chapterUpdates.length) {
        if (hasError) {
          res.status(500).json({ success: false, message: '部分章节volume_idUpdate failed' });
        } else {
          console.log('所有章节volume_idUpdate successful');
          res.json({ success: true, message: '章节volume_idUpdate successful' });
        }
      }
    });
  });
});

// ==================== 首页相关API ====================

// 1. 获取首页推荐小说
app.get('/api/homepage/featured-novels/:section', (req, res) => {
  const { section } = req.params;
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      hfn.display_order, hfn.section_type
    FROM homepage_featured_novels hfn
    JOIN novel n ON hfn.novel_id = n.id
    WHERE hfn.section_type = ? 
      AND hfn.is_active = 1 
      AND (hfn.start_date IS NULL OR hfn.start_date <= NOW())
      AND (hfn.end_date IS NULL OR hfn.end_date >= NOW())
    ORDER BY hfn.display_order ASC, n.rating DESC
    LIMIT ?
  `;
  
  db.query(query, [section, parseInt(limit)], (err, results) => {
    if (err) {
      console.error('Failed to get recommended novels:', err);
      return res.status(500).json({ message: 'Failed to get recommended novels' });
    }
    
    res.json({ novels: results });
  });
});

// 2. 获取首页轮播图
app.get('/api/homepage/banners', (req, res) => {
  const query = `
    SELECT 
      hb.id, hb.title, hb.subtitle, hb.image_url, hb.link_url,
      n.id as novel_id, n.title as novel_title
    FROM homepage_banners hb
    LEFT JOIN novel n ON hb.novel_id = n.id
    WHERE hb.is_active = 1 
      AND (hb.start_date IS NULL OR hb.start_date <= NOW())
      AND (hb.end_date IS NULL OR hb.end_date >= NOW())
    ORDER BY hb.display_order ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to get carousel images:', err);
      return res.status(500).json({ message: 'Failed to get carousel images' });
    }
    
    res.json({ banners: results });
  });
});

// 3. 获取本周热门小说（基于统计数据）
app.get('/api/homepage/popular-this-week', (req, res) => {
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      COALESCE(SUM(ns.views), 0) as weekly_views,
      COALESCE(SUM(ns.reads), 0) as weekly_reads
    FROM novel n
    LEFT JOIN novel_statistics ns ON n.id = ns.novel_id 
      AND ns.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY n.id
    HAVING weekly_views > 0
    ORDER BY weekly_views DESC, weekly_reads DESC
    LIMIT ?
  `;
  
  db.query(query, [parseInt(limit)], (err, results) => {
    if (err) {
      console.error('Failed to get weekly popular:', err);
      return res.status(500).json({ message: 'Failed to get weekly popular' });
    }
    
    res.json({ novels: results });
  });
});

// 4. 获取最新发布的小说
app.get('/api/homepage/new-releases', (req, res) => {
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      MAX(c.created_at) as latest_chapter_date
    FROM novel n
    LEFT JOIN chapter c ON n.id = c.novel_id
    WHERE n.status = 'Ongoing'
    GROUP BY n.id
    ORDER BY latest_chapter_date DESC, n.id DESC
    LIMIT ?
  `;
  
  db.query(query, [parseInt(limit)], (err, results) => {
    if (err) {
      console.error('Failed to get latest releases:', err);
      return res.status(500).json({ message: 'Failed to get latest releases' });
    }
    
    res.json({ novels: results });
  });
});

// 5. 获取评分最高的小说
app.get('/api/homepage/top-series', (req, res) => {
  const { limit = 6 } = req.query;
  
  const query = `
    SELECT 
      n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
      n.chapters
    FROM novel n
    WHERE n.rating > 0 AND n.reviews > 0
    ORDER BY n.rating DESC, n.reviews DESC
    LIMIT ?
  `;
  
  db.query(query, [parseInt(limit)], (err, results) => {
    if (err) {
      console.error('Failed to get high-rated novels:', err);
      return res.status(500).json({ message: 'Failed to get high-rated novels' });
    }
    
    res.json({ novels: results });
  });
});

// 6. 记录小说访问统计
app.post('/api/novel/:id/view', (req, res) => {
  const { id } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  const query = `
    INSERT INTO novel_statistics (novel_id, date, views) 
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE views = views + 1
  `;
  
  db.query(query, [id, today], (err, result) => {
    if (err) {
      console.error('Failed to record access statistics:', err);
      return res.status(500).json({ message: 'Failed to record access statistics' });
    }
    
    res.json({ success: true });
  });
});

// 7. 获取首页配置
app.get('/api/homepage/config', (req, res) => {
  const query = `
    SELECT section_name, section_title, display_limit, sort_by, is_active, description
    FROM homepage_config
    WHERE is_active = 1
    ORDER BY id ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to get homepage configuration:', err);
      return res.status(500).json({ message: 'Failed to get homepage configuration' });
    }
    
    res.json({ configs: results });
  });
});

// 8. 管理首页推荐小说（管理员接口）
app.post('/api/admin/homepage/featured-novels', (req, res) => {
  const { novel_id, section_type, display_order, start_date, end_date } = req.body;
  
  const query = `
    INSERT INTO homepage_featured_novels 
    (novel_id, section_type, display_order, start_date, end_date)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    display_order = VALUES(display_order),
    start_date = VALUES(start_date),
    end_date = VALUES(end_date),
    is_active = 1
  `;
  
  db.query(query, [novel_id, section_type, display_order, start_date, end_date], (err, result) => {
    if (err) {
      console.error('Failed to add recommended novel:', err);
      return res.status(500).json({ message: 'Failed to add recommended novel' });
    }
    
    res.json({ success: true, id: result.insertId });
  });
});

// 9. 获取所有首页数据（组合接口）
app.get('/api/homepage/all', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    
    // 并行获取所有数据
    const [bannersResult, popularResult, newReleasesResult, topSeriesResult, configResult] = await Promise.all([
      new Promise((resolve, reject) => {
        db.query(`
          SELECT 
            hb.id, hb.title, hb.subtitle, hb.image_url, hb.link_url,
            n.id as novel_id, n.title as novel_title
          FROM homepage_banners hb
          LEFT JOIN novel n ON hb.novel_id = n.id
          WHERE hb.is_active = 1 
            AND (hb.start_date IS NULL OR hb.start_date <= NOW())
            AND (hb.end_date IS NULL OR hb.end_date >= NOW())
          ORDER BY hb.display_order ASC
        `, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        db.query(`
          SELECT 
            n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
            COALESCE(SUM(ns.views), 0) as weekly_views,
            COALESCE(SUM(ns.reads), 0) as weekly_reads
          FROM novel n
          LEFT JOIN novel_statistics ns ON n.id = ns.novel_id 
            AND ns.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          GROUP BY n.id
          HAVING weekly_views > 0
          ORDER BY weekly_views DESC, weekly_reads DESC
          LIMIT ?
        `, [parseInt(limit)], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        db.query(`
          SELECT 
            n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
            MAX(c.created_at) as latest_chapter_date
          FROM novel n
          LEFT JOIN chapter c ON n.id = c.novel_id
          WHERE n.status = 'Ongoing'
          GROUP BY n.id
          ORDER BY latest_chapter_date DESC, n.id DESC
          LIMIT ?
        `, [parseInt(limit)], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        db.query(`
          SELECT 
            n.id, n.title, n.author, n.cover, n.rating, n.reviews, n.status,
            n.chapters
          FROM novel n
          WHERE n.rating > 0 AND n.reviews > 0
          ORDER BY n.rating DESC, n.reviews DESC
          LIMIT ?
        `, [parseInt(limit)], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        db.query(`
          SELECT section_name, section_title, display_limit, sort_by, is_active, description
          FROM homepage_config
          WHERE is_active = 1
          ORDER BY id ASC
        `, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      })
    ]);

    res.json({
      success: true,
      data: {
        banners: bannersResult,
        popularNovels: popularResult,
        newReleases: newReleasesResult,
        topSeries: topSeriesResult,
        config: configResult
      }
    });

  } catch (error) {
    console.error('Failed to get homepage data:', error);
    res.status(500).json({ message: 'Failed to get homepage data' });
  }
});

// ==================== 每日签到API ====================

// 检查用户今日签到状态（支持时区）
app.get('/api/checkin/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { timezone = 'UTC' } = req.query;
    
    const todayCheckin = await dailyCheckinAPI.checkTodayCheckin(userId, timezone);
    const userStats = await dailyCheckinAPI.getUserCheckinStats(userId);
    
    res.json({
      success: true,
      data: {
        hasCheckedInToday: !!todayCheckin,
        todayCheckin,
        userStats,
        timezone: timezone
      }
    });
  } catch (error) {
    console.error('Failed to get check-in status:', error);
    res.status(500).json({ success: false, message: 'Failed to get check-in status' });
  }
});

// 执行签到（支持时区 + 任务系统集成）
app.post('/api/checkin/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { timezone = 'UTC' } = req.body;
    
    const result = await dailyCheckinWithMission.performCheckin(userId, timezone);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Check-in failed:', error);
    res.status(500).json({ success: false, message: 'Check-in failed' });
  }
});

// 获取用户签到历史
app.get('/api/checkin/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 30 } = req.query;
    const history = await dailyCheckinWithMission.getUserCheckinHistory(userId, parseInt(limit));
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Failed to get check-in history:', error);
    res.status(500).json({ success: false, message: 'Failed to get check-in history' });
  }
});

// ==================== 新的任务管理系统API ====================

// 获取用户任务列表（自动初始化）
app.get('/api/mission-v2/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;
    
    const { checkAndInitializeTodayMissions, checkMissionCompletion } = require('./mission_manager');
    
    // 1. 检查并初始化今日任务
    const initResult = await checkAndInitializeTodayMissions(userId);
    
    if (!initResult.success) {
      return res.status(400).json({
        success: false,
        message: initResult.message
      });
    }
    
    // 2. 获取用户任务列表
    const mysql = require('mysql2/promise');
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld',
      charset: 'utf8mb4'
    });
    
    const targetDate = date || new Date().toISOString().slice(0, 10);
    
    const [missions] = await db.execute(`
      SELECT 
        mc.id,
        mc.mission_key,
        mc.title,
        mc.description,
        mc.target_value,
        mc.reward_keys,
        mc.reward_karma,
        mc.reset_type,
        ump.current_progress,
        ump.is_completed,
        ump.is_claimed,
        ump.progress_date
      FROM mission_config mc
      LEFT JOIN user_mission_progress ump ON mc.id = ump.mission_id 
        AND ump.user_id = ? AND ump.progress_date = ?
      WHERE mc.is_active = 1
      ORDER BY mc.id ASC
    `, [userId, targetDate]);
    
    await db.end();
    
    // 3. 处理任务数据
    const processedMissions = missions.map(mission => ({
      id: mission.id,
      missionKey: mission.mission_key,
      title: mission.title,
      description: mission.description,
      targetValue: mission.target_value,
      rewardKeys: mission.reward_keys,
      rewardKarma: mission.reward_karma,
      resetType: mission.reset_type,
      currentProgress: mission.current_progress || 0,
      isCompleted: mission.is_completed || false,
      isClaimed: mission.is_claimed || false,
      progressDate: mission.progress_date || targetDate,
      progressPercentage: Math.min(100, Math.round((mission.current_progress || 0) / mission.target_value * 100))
    }));
    
    // 4. 检查任务完成状态
    const completionStatus = await checkMissionCompletion(userId);
    
    res.json({
      success: true,
      data: {
        missions: processedMissions,
        date: targetDate,
        userMissionStatus: initResult.status,
        allTasksCompleted: completionStatus.isCompleted,
        completionMessage: completionStatus.message
      }
    });
    
  } catch (error) {
    console.error('Failed to get user missions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user missions',
      error: error.message
    });
  }
});

// 更新任务进度（新版本）
app.post('/api/mission-v2/progress', async (req, res) => {
  try {
    const { userId, missionKey, progressValue = 1 } = req.body;
    
    if (!userId || !missionKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    const { updateMissionProgress } = require('./mission_manager');
    const result = await updateMissionProgress(userId, missionKey, progressValue);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Failed to update mission progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update mission progress',
      error: error.message
    });
  }
});

// 检查任务完成状态
app.get('/api/mission-v2/completion/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { checkMissionCompletion } = require('./mission_manager');
    
    const result = await checkMissionCompletion(userId);
    res.json(result);
    
  } catch (error) {
    console.error('Failed to check mission completion status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check mission completion status',
      error: error.message
    });
  }
});

// 获取用户最后阅读章节
app.get('/api/user/:userId/novel/:novelId/last-read', (req, res) => {
  const { userId, novelId } = req.params;
  
  // 查询用户在该小说中的最后阅读记录
  const query = `
    SELECT 
      rl.chapter_id,
      rl.read_at,
      c.chapter_number,
      c.title as chapter_title,
      c.is_locked,
      c.is_visible
    FROM reading_log rl
    JOIN chapter c ON rl.chapter_id = c.id
    WHERE rl.user_id = ? AND c.novel_id = ?
    ORDER BY rl.read_at DESC
    LIMIT 1
  `;
  
  db.query(query, [userId, novelId], (err, results) => {
    if (err) {
      console.error('Failed to get last read chapter:', err);
      return res.status(500).json({ message: 'Failed to get last read chapter' });
    }
    
    if (results.length === 0) {
      // 用户未阅读过该小说，返回第一章信息
      const firstChapterQuery = `
        SELECT 
          id as chapter_id,
          chapter_number,
          title as chapter_title,
          is_locked,
          is_visible
        FROM chapter 
        WHERE novel_id = ? AND is_visible = 1
        ORDER BY chapter_number ASC
        LIMIT 1
      `;
      
      db.query(firstChapterQuery, [novelId], (err2, firstChapterResults) => {
        if (err2) {
          console.error('Failed to get first chapter:', err2);
          return res.status(500).json({ message: 'Failed to get first chapter' });
        }
        
        if (firstChapterResults.length === 0) {
          return res.status(404).json({ message: 'This novel has no chapters yet' });
        }
        
        res.json({
          success: true,
          data: {
            chapter_id: firstChapterResults[0].chapter_id,
            chapter_number: firstChapterResults[0].chapter_number,
            chapter_title: firstChapterResults[0].chapter_title,
            is_locked: firstChapterResults[0].is_locked,
            is_visible: firstChapterResults[0].is_visible,
            is_first_read: true
          }
        });
      });
    } else {
      const lastRead = results[0];
      
      // 检查用户是否已解锁该章节
      const unlockQuery = `
        SELECT COUNT(*) as unlocked
        FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ?
      `;
      
      db.query(unlockQuery, [userId, lastRead.chapter_id], (err3, unlockResults) => {
        if (err3) {
          console.error('Failed to check unlock status:', err3);
          return res.status(500).json({ message: 'Failed to check unlock status' });
        }
        
        const isUnlocked = unlockResults[0].unlocked > 0;
        
        res.json({
          success: true,
          data: {
            chapter_id: lastRead.chapter_id,
            chapter_number: lastRead.chapter_number,
            chapter_title: lastRead.chapter_title,
            is_locked: lastRead.is_locked,
            is_visible: lastRead.is_visible,
            is_unlocked: isUnlocked,
            read_at: lastRead.read_at,
            is_first_read: false
          }
        });
      });
    }
  });
});

// 获取章节内容
app.get('/api/chapter/:chapterId', (req, res) => {
  const { chapterId } = req.params;
  
  const query = `
    SELECT 
      c.id,
      c.novel_id,
      c.volume_id,
      c.chapter_number,
      c.title,
      c.content,
      c.is_locked,
      c.is_visible,
      c.translator_note,
      n.title as novel_title,
      n.author,
      n.translator,
      v.title as volume_title,
      v.volume_id,
      (SELECT id FROM chapter WHERE novel_id = c.novel_id AND chapter_number = c.chapter_number - 1 AND is_visible = 1 LIMIT 1) as prev_chapter_id,
      (SELECT id FROM chapter WHERE novel_id = c.novel_id AND chapter_number = c.chapter_number + 1 AND is_visible = 1 LIMIT 1) as next_chapter_id
    FROM chapter c
    JOIN novel n ON c.novel_id = n.id
    LEFT JOIN volume v ON c.volume_id = v.volume_id
    WHERE c.id = ? AND c.is_visible = 1
  `;
  
  db.query(query, [chapterId], (err, results) => {
    if (err) {
      console.error('Failed to get chapter content:', err);
      return res.status(500).json({ message: 'Failed to get chapter content' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Chapter not found or hidden' });
    }
    
    const chapter = results[0];
    
    res.json({
      success: true,
      data: {
        id: chapter.id,
        novel_id: chapter.novel_id,
        volume_id: chapter.volume_id,
        chapter_number: chapter.chapter_number,
        title: chapter.title,
        content: chapter.content,
        is_locked: chapter.is_locked,
        is_visible: chapter.is_visible,
        translator_note: chapter.translator_note,
        novel_title: chapter.novel_title,
        author: chapter.author,
        translator: chapter.translator,
        volume_title: chapter.volume_title,
        volume_id: chapter.volume_id,
        has_prev: !!chapter.prev_chapter_id,
        has_next: !!chapter.next_chapter_id,
        prev_chapter_id: chapter.prev_chapter_id,
        next_chapter_id: chapter.next_chapter_id
      }
    });
  });
});

// 记录用户阅读章节（修正版 - 使用正确的新章节判断逻辑）
app.post('/api/user/:userId/read-chapter', async (req, res) => {
  const { userId } = req.params;
  const { chapterId } = req.body;
  
  if (!chapterId) {
    return res.status(400).json({ message: 'Please provide chapter ID' });
  }
  
  let db;
  try {
    // 使用新的数据库连接
    const mysql = require('mysql2/promise');
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld',
      charset: 'utf8mb4'
    });
    
    // 1. 检查章节是否存在
    const [chapters] = await db.execute('SELECT id, novel_id, is_premium FROM chapter WHERE id = ?', [chapterId]);
    if (chapters.length === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }
    const chapter = chapters[0];
    
    // 2. 获取用户信息
    const [userResults] = await db.execute('SELECT id, points, golden_karma, username FROM user WHERE id = ?', [userId]);
    if (userResults.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userResults[0];
    
    // 3. 先检查并处理时间解锁状态（关键修复）
    await checkAndUpdateTimeUnlock(db, userId, chapterId);
    
    // 4. 判断章节解锁状态（修复免费章节处理）
    let isUnlocked, unlockTime, hasValidChampion = false;
    
    if (!chapter.is_premium) {
      // 免费章节：默认解锁，解锁时间为当前时间
      isUnlocked = true;
      unlockTime = new Date();
      hasValidChampion = false; // 免费章节不需要Champion会员
      console.log(`[DEBUG] 免费章节 ${chapterId}，解锁状态: ${isUnlocked}, 解锁时间: ${unlockTime}`);
    } else {
      // 付费章节：检查解锁记录和Champion会员
      const [unlockInfo] = await db.execute(`
        SELECT 
          CASE 
            WHEN COUNT(*) > 0 THEN 1 
            ELSE 0 
          END as is_unlocked,
          MAX(unlocked_at) as unlock_time
        FROM chapter_unlocks 
        WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
      `, [userId, chapterId]);
      
      const [championSubs] = await db.execute(`
        SELECT * FROM user_champion_subscription 
        WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
      `, [userId, chapter.novel_id]);
      
      hasValidChampion = championSubs.length > 0;
      
      isUnlocked = unlockInfo[0].is_unlocked || hasValidChampion;
      unlockTime = unlockInfo[0].unlock_time || (hasValidChampion ? new Date() : null);
      console.log(`[DEBUG] 付费章节 ${chapterId}，解锁状态: ${isUnlocked}, 解锁时间: ${unlockTime}, Champion会员: ${hasValidChampion}`);
    }
    
    // 5. 检查是否有历史阅读记录
    const [existingRecords] = await db.execute(`
      SELECT COUNT(*) as count FROM reading_log 
      WHERE user_id = ? AND chapter_id = ?
    `, [userId, chapterId]);
    
    const hasHistoryRecords = existingRecords[0].count > 0;
    
    // 6. 记录阅读日志（每次访问都插入新记录）
    const [insertResult] = await db.execute(`
      INSERT INTO reading_log (user_id, chapter_id, read_at, is_unlocked, unlock_time, page_enter_time) 
      VALUES (?, ?, NOW(), ?, ?, NOW())
    `, [userId, chapterId, isUnlocked, unlockTime]);
    
    const recordId = insertResult.insertId;
    console.log(`[DEBUG] 用户 ${userId} 访问章节 ${chapterId}，创建新记录 ID: ${recordId}，解锁状态: ${isUnlocked}, 解锁时间: ${unlockTime}`);
    
    // 6. 使用正确的新章节判断逻辑（在记录阅读日志之后）
    const newChapterCheck = await checkIsNewChapterImproved(db, userId, chapterId, hasValidChampion);
    
    // 5. 更新任务进度（使用新的任务管理系统）
    if (newChapterCheck.isNewChapter) {
      try {
        const { updateMissionProgress } = require('./mission_manager');
        const missionKeys = ['read_2_chapters', 'read_5_chapters', 'read_10_chapters'];
        
        for (const missionKey of missionKeys) {
          const result = await updateMissionProgress(userId, missionKey, 1, chapterId);
          if (result.success) {
            console.log(`[DEBUG] 任务 ${missionKey} 进度Update successful:`, result.data);
          } else {
            console.log(`[DEBUG] 任务 ${missionKey} 进度Update failed:`, result.message);
          }
        }
      } catch (error) {
        console.error('Failed to update mission progress:', error);
      }
    }
    
    res.json({
      success: true,
      message: 'Reading record saved',
      recordId: recordId,  // 返回记录ID供前端时间追踪使用
      isNewChapter: newChapterCheck.isNewChapter,
      reason: newChapterCheck.reason,
      details: newChapterCheck.details
    });
    
  } catch (error) {
    console.error('Failed to record reading log:', error);
    res.status(500).json({ message: 'Failed to record reading log', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 检查并处理时间解锁状态
async function checkAndUpdateTimeUnlock(db, userId, chapterId) {
  try {
    const now = new Date();
    
    // 1. 查询章节的时间解锁记录
    const [timeUnlockRecords] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, chapterId]);
    
    if (timeUnlockRecords.length > 0) {
      const timeUnlock = timeUnlockRecords[0];
      const unlockAt = new Date(timeUnlock.unlock_at);
      
      // 2. 检查时间解锁是否已到期
      if (now >= unlockAt) {
        console.log(`时间解锁已到期，更新解锁状态: 章节${chapterId}`);
        
        // 3. 更新解锁状态
        await db.execute(`
          UPDATE chapter_unlocks 
          SET status = 'unlocked', unlocked_at = ?
          WHERE id = ?
        `, [now, timeUnlock.id]);
        
        console.log(`章节${chapterId}时间解锁已完成`);
      } else {
        console.log(`章节${chapterId}时间解锁尚未到期，解锁时间: ${unlockAt.toISOString()}`);
      }
    }
  } catch (error) {
    console.error('检查时间解锁状态失败:', error);
  }
}

// 正确的新章节判断逻辑
// A. 付费章节判断:
//    无Champion会员或已过期: 只有今天解锁且今天首次阅读才算新章节
//    有有效Champion会员: 只有今天首次阅读才算新章节
// B. 免费章节判断:
//    免费章节: 只有今天首次阅读才算新章节
async function checkIsNewChapterImproved(db, userId, chapterId, hasValidChampion = null) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. 查询章节基本信息
    const [chapters] = await db.execute(`
      SELECT id, novel_id, is_premium
      FROM chapter 
      WHERE id = ?
    `, [chapterId]);
    
    if (chapters.length === 0) {
      return {
        isNewChapter: false,
        reason: 'Chapter not found',
        details: {}
      };
    }
    
    const chapter = chapters[0];
    
    // 2. 查询用户Champion会员状态（如果未提供参数则查询）
    if (hasValidChampion === null) {
      const [championStatus] = await db.execute(`
        SELECT 
          ucs.*,
          CASE 
            WHEN ucs.end_date > NOW() THEN 1
            ELSE 0
          END as is_valid
        FROM user_champion_subscription ucs
        WHERE ucs.user_id = ? AND ucs.novel_id = ? AND ucs.is_active = 1
        ORDER BY ucs.end_date DESC
        LIMIT 1
      `, [userId, chapter.novel_id]);
      
      hasValidChampion = championStatus.length > 0 && championStatus[0].is_valid === 1;
    }
    
    // 3. 查询该章节的所有有效阅读记录（只统计已解锁的阅读记录）
    const [allReadingRecords] = await db.execute(`
      SELECT id, read_at, DATE(read_at) as read_date, is_unlocked
      FROM reading_log 
      WHERE user_id = ? AND chapter_id = ? AND is_unlocked = 1
      ORDER BY read_at ASC
    `, [userId, chapterId]);
    
    // 4. 查询该章节的解锁记录
    const [unlockRecords] = await db.execute(`
      SELECT id, unlock_method, status, unlocked_at, created_at
      FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY created_at ASC
    `, [userId, chapterId]);
    
    // 5. 检查Champion会员解锁状态（使用之前查询的结果）
    // 注意：hasValidChampion已经在第1913行定义过了
    
    // 5. 分析阅读记录
    const todayReadingRecords = allReadingRecords.filter(record => {
      // 使用UTC时间避免时区问题
      const recordDate = new Date(record.read_at).toISOString().slice(0, 10);
      return recordDate === today;
    });
    const historyReadingRecords = allReadingRecords.filter(record => {
      const recordDate = new Date(record.read_at).toISOString().slice(0, 10);
      return recordDate !== today;
    });
    
    // 6. 检查今天是否有解锁记录
    const todayUnlockRecords = unlockRecords.filter(record => {
      const unlockDate = new Date(record.unlocked_at || record.created_at).toISOString().slice(0, 10);
      return unlockDate === today && record.status === 'unlocked';
    });
    
    // 7. 检查Champion会员解锁（今天首次阅读且有效Champion会员）
    const isChampionUnlocked = hasValidChampion && todayReadingRecords.length === 1 && historyReadingRecords.length === 0;
    
    // 7. 判断是否为新章节
    let isNewChapter = false;
    let reason = '';
    let details = {
      totalRecords: allReadingRecords.length,
      todayRecords: todayReadingRecords.length,
      historyRecords: historyReadingRecords.length,
      isTodayFirstRead: todayReadingRecords.length === 1,
      hasTodayUnlock: todayUnlockRecords.length > 0,
      hasValidChampion: hasValidChampion,
      isPremium: chapter.is_premium
    };
    
    if (chapter.is_premium) {
      // A. 付费章节判断
      if (hasValidChampion) {
        // 有有效Champion会员: 只有今天首次阅读才算新章节
        if (todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
          isNewChapter = true;
          reason = '有有效Champion会员，今天首次阅读该章节';
        } else if (todayReadingRecords.length === 1 && historyReadingRecords.length > 0) {
          isNewChapter = false;
          reason = '有有效Champion会员，但以前阅读过该章节';
        } else if (todayReadingRecords.length > 1) {
          isNewChapter = false;
          reason = '有有效Champion会员，但今天已经阅读过该章节';
        } else {
          isNewChapter = false;
          reason = '有有效Champion会员，但今天没有阅读该章节';
        }
      } else {
        // 无Champion会员或已过期: 今天解锁且今天首次阅读才算新章节
        if (todayUnlockRecords.length > 0 && todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
          isNewChapter = true;
          reason = '付费章节，无Champion会员或会员过期，今天解锁该章节并首次阅读';
        } else if (todayUnlockRecords.length > 0 && (todayReadingRecords.length > 1 || historyReadingRecords.length > 0)) {
          isNewChapter = false;
          reason = '付费章节，无Champion会员或会员过期，今天解锁该章节但非首次阅读';
        } else if (todayUnlockRecords.length === 0) {
          isNewChapter = false;
          reason = '付费章节，无Champion会员或会员过期，今天未解锁该章节';
        } else {
          isNewChapter = false;
          reason = '付费章节，无Champion会员或会员过期，今天没有阅读该章节';
        }
      }
    } else {
      // B. 免费章节判断: 只有今天首次阅读才算新章节
      if (todayReadingRecords.length === 1 && historyReadingRecords.length === 0) {
        isNewChapter = true;
        reason = '免费章节，今天首次阅读该章节';
      } else if (todayReadingRecords.length === 1 && historyReadingRecords.length > 0) {
        isNewChapter = false;
        reason = '免费章节，但以前阅读过该章节';
      } else if (todayReadingRecords.length > 1) {
        isNewChapter = false;
        reason = '免费章节，但今天已经阅读过该章节';
      } else {
        isNewChapter = false;
        reason = '免费章节，但今天没有阅读该章节';
      }
    }
    
    // 8. 特殊处理：Champion会员解锁的章节
    if (isChampionUnlocked) {
      isNewChapter = true;
      reason = 'Champion会员解锁，今天首次阅读该章节';
    }
    
    return {
      isNewChapter,
      reason,
      details
    };
    
  } catch (error) {
    console.error('检查新章节失败:', error);
    return {
      isNewChapter: false,
      reason: '检查失败: ' + error.message
    };
  }
}

// 检查章节解锁状态的辅助函数
async function checkChapterUnlockStatus(db, userId, chapterId, chapter, user) {
  try {
    // 1. 检查章节是否免费
    const now = new Date();
    const isFree = !chapter.is_premium;
    
    if (isFree) {
      return {
        isUnlocked: true,
        unlockMethod: 'free',
        reason: '免费章节'
      };
    }
    
    // 2. 检查用户Champion会员状态
    const [championResults] = await db.execute(`
      SELECT * FROM user_champion_subscription 
      WHERE user_id = ? AND novel_id = ? AND is_active = 1 AND end_date > NOW()
    `, [userId, chapter.novel_id]);
    
    if (championResults.length > 0) {
      return {
        isUnlocked: true,
        unlockMethod: 'champion',
        reason: 'Champion会员永久解锁'
      };
    }
    
    // 3. 检查付费解锁记录
    const [unlockResults] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND status = 'unlocked'
    `, [userId, chapterId]);
    
    if (unlockResults.length > 0) {
      const unlock = unlockResults[0];
      return {
        isUnlocked: true,
        unlockMethod: unlock.unlock_method,
        reason: `通过${getUnlockMethodName(unlock.unlock_method)}解锁`
      };
    }
    
    // 4. 检查时间解锁状态
    const [timeUnlockResults] = await db.execute(`
      SELECT * FROM chapter_unlocks 
      WHERE user_id = ? AND chapter_id = ? AND unlock_method = 'time_unlock' AND status = 'pending'
    `, [userId, chapterId]);
    
    if (timeUnlockResults.length > 0) {
      const timeUnlock = timeUnlockResults[0];
      const unlockAt = new Date(timeUnlock.unlock_at);
      
      if (now >= unlockAt) {
        // 时间解锁已到期，自动解锁
        await db.execute(`
          UPDATE chapter_unlocks 
          SET status = 'unlocked', unlocked_at = ?, updated_at = ?
          WHERE id = ?
        `, [now, now, timeUnlock.id]);
        
        return {
          isUnlocked: true,
          unlockMethod: 'time_unlock',
          reason: '时间解锁已完成'
        };
      } else {
        return {
          isUnlocked: false,
          unlockMethod: 'time_unlock',
          reason: '时间解锁等待中',
          unlockAt: unlockAt
        };
      }
    }
    
    // 5. 章节未解锁
    return {
      isUnlocked: false,
      unlockMethod: 'none',
      reason: '章节未解锁'
    };
    
  } catch (error) {
    console.error('Failed to check unlock status:', error);
    return {
      isUnlocked: false,
      unlockMethod: 'error',
      reason: 'Failed to check unlock status: ' + error.message
    };
  }
}

// 获取解锁方法的中文名称
function getUnlockMethodName(method) {
  const methodNames = {
    'free': '免费',
    'champion': 'Champion会员',
    'key': '钥匙解锁',
    'karma': 'Karma解锁',
    'time_unlock': '时间解锁',
    'subscription': '订阅解锁'
  };
  return methodNames[method] || method;
}

// 获取签到奖励配置
app.get('/api/checkin/rewards', (req, res) => {
  res.json({
    success: true,
    data: dailyCheckinAPI.REWARDS
  });
});

// 获取支持的时区列表
app.get('/api/timezone/supported', (req, res) => {
  const timezoneHandler = require('./utils/timezone');
  res.json({
    success: true,
    data: timezoneHandler.getSupportedTimezones()
  });
});

// 获取用户时区信息
app.get('/api/timezone/info/:timezone', (req, res) => {
  const { timezone } = req.params;
  const timezoneHandler = require('./utils/timezone');
  
  try {
    const info = timezoneHandler.getTimezoneInfo(timezone);
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid timezone'
    });
  }
});

// 任务系统路由 (已迁移到 mission-v2)
// const missionRoutes = require('./routes/mission');
// app.use('/api/mission', missionRoutes);

// 新的任务管理系统路由
app.use('/api/mission-v2', missionV2Routes);
app.use('/api/reading-mission', readingWithMissionRoutes);

// 章节解锁系统路由
const chapterUnlockRoutes = require('./routes/chapter_unlock');
app.use('/api/chapter-unlock', chapterUnlockRoutes);

// Key交易记录路由
const keyTransactionRoutes = require('./routes/key_transaction');
app.use('/api/key-transaction', keyTransactionRoutes);

// 时间解锁系统路由（优化版 - 按需检查）
const timeUnlockRoutes = require('./routes/time_unlock_optimized');
app.use('/api/time-unlock', timeUnlockRoutes);

// 阅读时间追踪路由
const readingTimingRoutes = require('./routes/reading_timing');
app.use('/api/reading-timing', readingTimingRoutes);

// API文档页面
app.get('/api', (req, res) => {
  res.send(`
    <h2>API文档</h2>
    <ul>
      <li>
        <b>POST /api/login</b><br/>
        <pre>
请求体: { "username": "xxx", "password": "xxx" }
返回: { "message": "Login successful", "user": { ... } }
        </pre>
      </li>
      <li>
        <b>GET /api/homepage/all</b><br/>
        <pre>
获取首页所有数据
返回: { "success": true, "data": { "banners": [...], "popularNovels": [...], ... } }
        </pre>
      </li>
      <li>
        <b>GET /api/checkin/status/:userId</b><br/>
        <pre>
获取用户签到状态
返回: { "success": true, "data": { "hasCheckedInToday": false, ... } }
        </pre>
      </li>
      <li>
        <b>POST /api/checkin/:userId</b><br/>
        <pre>
执行签到
返回: { "success": true, "message": "Check-in successful", "data": { "keysEarned": 3, ... } }
        </pre>
      </li>
    </ul>
  `);
});

// ==================== 评论系统API ====================

// 获取小说的评论列表
app.get('/api/novel/:novelId/reviews', (req, res) => {
  const { novelId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      r.id,
      r.content,
      r.rating,
      r.created_at,
      r.likes,
      r.dislikes,
      r.comments,
      r.views,
      r.is_recommended,
      u.username,
      u.avatar,
      u.is_vip
    FROM review r
    JOIN user u ON r.user_id = u.id
    WHERE r.novel_id = ?
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.query(query, [novelId, parseInt(limit), parseInt(offset)], (err, results) => {
    if (err) {
      console.error('获取评论失败:', err);
      return res.status(500).json({ message: '获取评论失败' });
    }

    // 获取总数
    db.query('SELECT COUNT(*) as total FROM review WHERE novel_id = ?', [novelId], (err2, countResult) => {
      if (err2) {
        console.error('获取评论总数失败:', err2);
        return res.status(500).json({ message: '获取评论总数失败' });
      }

      res.json({
        success: true,
        data: {
          reviews: results,
          total: countResult[0].total,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    });
  });
});

// 获取小说的评论统计
app.get('/api/novel/:novelId/review-stats', (req, res) => {
  const { novelId } = req.params;

  const query = `
    SELECT 
      COUNT(*) as total_reviews,
      AVG(rating) as average_rating,
      SUM(CASE WHEN is_recommended = 1 THEN 1 ELSE 0 END) as recommended_count,
      SUM(likes) as total_likes
    FROM review 
    WHERE novel_id = ?
  `;

  db.query(query, [novelId], (err, results) => {
    if (err) {
      console.error('获取评论统计失败:', err);
      return res.status(500).json({ message: '获取评论统计失败' });
    }

    const stats = results[0];
    res.json({
      success: true,
      data: {
        total_reviews: stats.total_reviews || 0,
        average_rating: Math.round((stats.average_rating || 0) * 10) / 10,
        recommended_count: stats.recommended_count || 0,
        total_likes: stats.total_likes || 0,
        recommendation_rate: stats.total_reviews > 0 ? 
          Math.round((stats.recommended_count / stats.total_reviews) * 100) : 0
      }
    });
  });
});

// 提交评论
app.post('/api/novel/:novelId/review', authenticateToken, (req, res) => {
  const { novelId } = req.params;
  const { content, rating, is_recommended } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 100) {
    return res.status(400).json({ message: '评论内容至少需要100个字符' });
  }

  // 检查用户是否已经评论过这部小说
  db.query('SELECT id FROM review WHERE novel_id = ? AND user_id = ?', [novelId, userId], (err, existingReview) => {
    if (err) {
      console.error('检查现有评论失败:', err);
      return res.status(500).json({ message: '检查现有评论失败' });
    }

    if (existingReview.length > 0) {
      return res.status(400).json({ message: '您已经评论过这部小说了' });
    }

    // 插入新评论
    const insertQuery = `
      INSERT INTO review (novel_id, user_id, content, rating, is_recommended, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;

    db.query(insertQuery, [novelId, userId, content, rating || null, is_recommended || 0], (err2, result) => {
      if (err2) {
        console.error('提交评论失败:', err2);
        return res.status(500).json({ message: '提交评论失败' });
      }

      // 更新小说的评论数
      db.query('UPDATE novel SET reviews = reviews + 1 WHERE id = ?', [novelId], (err3) => {
        if (err3) {
          console.error('更新小说评论数失败:', err3);
        }
      });

      res.json({
        success: true,
        message: '评论提交成功',
        data: {
          review_id: result.insertId
        }
      });
    });
  });
});

// 点赞评论 - 简化版本
app.post('/api/review/:reviewId/like', authenticateToken, (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  // 检查是否已经点赞
  db.query('SELECT id FROM review_like WHERE review_id = ? AND user_id = ?', [reviewId, userId], (err, existingLike) => {
    if (err) {
      console.error('检查点赞状态失败:', err);
      return res.status(500).json({ message: '检查点赞状态失败' });
    }

    // 如果已经点赞，直接返回
    if (existingLike.length > 0) {
      return res.json({
        success: true,
        message: '已经点赞过了',
        action: 'already_liked'
      });
    }

    // 检查是否有点踩记录（互斥逻辑）
    db.query('SELECT id FROM review_dislike WHERE review_id = ? AND user_id = ?', [reviewId, userId], (err2, existingDislike) => {
      if (err2) {
        console.error('检查点踩状态失败:', err2);
        return res.status(500).json({ message: '检查点踩状态失败' });
      }

      // 如果有点踩记录，先删除
      if (existingDislike.length > 0) {
        db.query('DELETE FROM review_dislike WHERE review_id = ? AND user_id = ?', [reviewId, userId], (err3) => {
          if (err3) {
            console.error('删除点踩记录失败:', err3);
            return res.status(500).json({ message: '删除点踩记录失败' });
          }

          // 更新点踩数
          db.query('UPDATE review SET dislikes = dislikes - 1 WHERE id = ?', [reviewId], (err4) => {
            if (err4) {
              console.error('更新点踩数失败:', err4);
            }
          });
        });
      }

      // 添加点赞记录
      db.query('INSERT INTO review_like (review_id, user_id, created_at) VALUES (?, ?, NOW())', [reviewId, userId], (err5) => {
        if (err5) {
          console.error('点赞失败:', err5);
          return res.status(500).json({ message: '点赞失败' });
        }

        // 更新评论的点赞数
        db.query('UPDATE review SET likes = likes + 1 WHERE id = ?', [reviewId], (err6) => {
          if (err6) {
            console.error('更新点赞数失败:', err6);
          }
        });

        res.json({
          success: true,
          message: '点赞成功',
          action: 'liked'
        });
      });
    });
  });
});

// 不喜欢评价 - 简化版本
app.post('/api/review/:reviewId/dislike', authenticateToken, (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  // 检查是否已经点踩
  db.query('SELECT id FROM review_dislike WHERE review_id = ? AND user_id = ?', [reviewId, userId], (err, existingDislike) => {
    if (err) {
      console.error('检查点踩状态失败:', err);
      return res.status(500).json({ message: '检查点踩状态失败' });
    }

    // 如果已经点踩，直接返回
    if (existingDislike.length > 0) {
      return res.json({
        success: true,
        message: '已经点踩过了',
        action: 'already_disliked'
      });
    }

    // 检查是否有点赞记录（互斥逻辑）
    db.query('SELECT id FROM review_like WHERE review_id = ? AND user_id = ?', [reviewId, userId], (err2, existingLike) => {
      if (err2) {
        console.error('检查点赞状态失败:', err2);
        return res.status(500).json({ message: '检查点赞状态失败' });
      }

      // 如果有点赞记录，先删除
      if (existingLike.length > 0) {
        db.query('DELETE FROM review_like WHERE review_id = ? AND user_id = ?', [reviewId, userId], (err3) => {
          if (err3) {
            console.error('删除点赞记录失败:', err3);
            return res.status(500).json({ message: '删除点赞记录失败' });
          }

          // 更新点赞数
          db.query('UPDATE review SET likes = likes - 1 WHERE id = ?', [reviewId], (err4) => {
            if (err4) {
              console.error('更新点赞数失败:', err4);
            }
          });
        });
      }

      // 添加点踩记录
      db.query('INSERT INTO review_dislike (review_id, user_id, created_at) VALUES (?, ?, NOW())', [reviewId, userId], (err5) => {
        if (err5) {
          console.error('点踩失败:', err5);
          return res.status(500).json({ message: '点踩失败' });
        }

        // 更新评价点踩数
        db.query('UPDATE review SET dislikes = dislikes + 1 WHERE id = ?', [reviewId], (err6) => {
          if (err6) {
            console.error('更新点踩数失败:', err6);
          }
        });

        res.json({
          success: true,
          message: '点踩成功',
          action: 'disliked'
        });
      });
    });
  });
});

// 获取评论的回复
app.get('/api/review/:reviewId/comments', (req, res) => {
  const { reviewId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      c.id,
      c.content,
      c.created_at,
      c.likes,
      c.dislikes,
      u.username,
      u.avatar,
      u.is_vip
    FROM comment c
    JOIN user u ON c.user_id = u.id
    WHERE c.target_type = 'review' AND c.target_id = ?
    ORDER BY c.created_at ASC
    LIMIT ? OFFSET ?
  `;

  db.query(query, [reviewId, parseInt(limit), parseInt(offset)], (err, results) => {
    if (err) {
      console.error('获取评论回复失败:', err);
      return res.status(500).json({ message: '获取评论回复失败' });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// 回复评论
app.post('/api/review/:reviewId/comment', authenticateToken, (req, res) => {
  const { reviewId } = req.params;
  const { content } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 10) {
    return res.status(400).json({ message: '回复内容至少需要10个字符' });
  }

  const insertQuery = `
    INSERT INTO comment (user_id, target_type, target_id, content, created_at)
    VALUES (?, 'review', ?, ?, NOW())
  `;

  db.query(insertQuery, [userId, reviewId, content], (err, result) => {
    if (err) {
      console.error('回复评论失败:', err);
      return res.status(500).json({ message: '回复评论失败' });
    }

    // 更新评论的回复数
    db.query('UPDATE review SET comments = comments + 1 WHERE id = ?', [reviewId], (err2) => {
      if (err2) {
        console.error('更新回复数失败:', err2);
      }
    });

    res.json({
      success: true,
      message: '回复成功',
      data: {
        comment_id: result.insertId
      }
    });
  });
});

// ==================== 章节评论API ====================

// 获取章节评论
app.get('/api/chapter/:chapterId/comments', (req, res) => {
  const { chapterId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  // 获取评论列表
  const commentsQuery = `
    SELECT 
      c.id,
      c.content,
      c.created_at,
      c.likes,
      c.dislikes,
      c.parent_comment_id,
      u.username,
      u.avatar,
      u.is_vip
    FROM comment c
    JOIN user u ON c.user_id = u.id
    WHERE c.target_type = 'chapter' AND c.target_id = ?
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.query(commentsQuery, [chapterId, parseInt(limit), parseInt(offset)], (err, comments) => {
    if (err) {
      console.error('获取章节评论失败:', err);
      return res.status(500).json({ message: '获取章节评论失败' });
    }

    // 获取评论统计
    const statsQuery = `
      SELECT 
        COUNT(*) as total_comments,
        SUM(CASE WHEN likes > 0 THEN 1 ELSE 0 END) as liked_comments,
        SUM(likes) as total_likes
      FROM comment 
      WHERE target_type = 'chapter' AND target_id = ?
    `;

    db.query(statsQuery, [chapterId], (err2, stats) => {
      if (err2) {
        console.error('获取评论统计失败:', err2);
        return res.status(500).json({ message: '获取评论统计失败' });
      }

      const stat = stats[0];
      const likeRate = stat.total_comments > 0 ? 
        Math.round((stat.liked_comments / stat.total_comments) * 100) : 0;

      res.json({
        success: true,
        data: {
          comments: comments,
          total: stat.total_comments,
          like_rate: likeRate,
          total_likes: stat.total_likes
        }
      });
    });
  });
});

// 提交章节评论
app.post('/api/chapter/:chapterId/comment', authenticateToken, (req, res) => {
  const { chapterId } = req.params;
  const { content } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 10) {
    return res.status(400).json({ message: '评论内容至少需要10个字符' });
  }

  const insertQuery = `
    INSERT INTO comment (user_id, target_type, target_id, content, created_at)
    VALUES (?, 'chapter', ?, ?, NOW())
  `;

  db.query(insertQuery, [userId, chapterId, content], (err, result) => {
    if (err) {
      console.error('提交章节评论失败:', err);
      return res.status(500).json({ message: '提交章节评论失败' });
    }

    res.json({
      success: true,
      message: '评论提交成功',
      data: {
        comment_id: result.insertId
      }
    });
  });
});

// 点赞章节评论 - 简化版本
app.post('/api/comment/:commentId/like', authenticateToken, (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  // 检查是否已经点赞
  db.query('SELECT id FROM comment_like WHERE comment_id = ? AND user_id = ?', [commentId, userId], (err, existingLike) => {
    if (err) {
      console.error('检查点赞状态失败:', err);
      return res.status(500).json({ message: '检查点赞状态失败' });
    }

    // 如果已经点赞，直接返回
    if (existingLike.length > 0) {
      return res.json({
        success: true,
        message: '已经点赞过了',
        action: 'already_liked'
      });
    }

    // 检查是否有点踩记录（互斥逻辑）
    db.query('SELECT id FROM comment_dislike WHERE comment_id = ? AND user_id = ?', [commentId, userId], (err2, existingDislike) => {
      if (err2) {
        console.error('检查点踩状态失败:', err2);
        return res.status(500).json({ message: '检查点踩状态失败' });
      }

      // 如果有点踩记录，先删除
      if (existingDislike.length > 0) {
        db.query('DELETE FROM comment_dislike WHERE comment_id = ? AND user_id = ?', [commentId, userId], (err3) => {
          if (err3) {
            console.error('删除点踩记录失败:', err3);
            return res.status(500).json({ message: '删除点踩记录失败' });
          }

          // 更新点踩数
          db.query('UPDATE comment SET dislikes = dislikes - 1 WHERE id = ?', [commentId], (err4) => {
            if (err4) {
              console.error('更新点踩数失败:', err4);
            }
          });
        });
      }

      // 添加点赞记录
      db.query('INSERT INTO comment_like (comment_id, user_id, created_at) VALUES (?, ?, NOW())', [commentId, userId], (err5) => {
        if (err5) {
          console.error('点赞失败:', err5);
          return res.status(500).json({ message: '点赞失败' });
        }

        // 更新评论点赞数
        db.query('UPDATE comment SET likes = likes + 1 WHERE id = ?', [commentId], (err6) => {
          if (err6) {
            console.error('更新点赞数失败:', err6);
          }
        });

        res.json({
          success: true,
          message: '点赞成功',
          action: 'liked'
        });
      });
    });
  });
});

// 回复章节评论
app.post('/api/comment/:commentId/reply', authenticateToken, (req, res) => {
  console.log('🔍 回复API被调用');
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user?.userId;

  console.log('🔍 参数:', { commentId, content, userId });

  if (!userId) {
    console.log('❌ 用户未登录');
    return res.status(401).json({ message: 'Please login first' });
  }

  if (!content || content.trim().length < 10) {
    console.log('❌ 回复内容太短:', content?.length);
    return res.status(400).json({ message: '回复内容至少需要10个字符' });
  }

  // 获取原评论的章节ID
  db.query('SELECT target_id FROM comment WHERE id = ? AND target_type = "chapter"', [commentId], (err, parentComment) => {
    if (err) {
      console.error('获取原评论失败:', err);
      return res.status(500).json({ message: '获取原评论失败' });
    }

    if (parentComment.length === 0) {
      return res.status(404).json({ message: '原评论不存在' });
    }

    const chapterId = parentComment[0].target_id;

    // 插入回复
    const insertQuery = `
      INSERT INTO comment (user_id, target_type, target_id, parent_comment_id, content, created_at)
      VALUES (?, 'chapter', ?, ?, ?, NOW())
    `;

    db.query(insertQuery, [userId, chapterId, commentId, content], (err2, result) => {
      if (err2) {
        console.error('回复评论失败:', err2);
        return res.status(500).json({ message: '回复评论失败' });
      }

      res.json({
        success: true,
        message: '回复成功',
        data: {
          reply_id: result.insertId
        }
      });
    });
  });
});

// 获取评论的回复
app.get('/api/comment/:commentId/replies', (req, res) => {
  const { commentId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      c.id,
      c.content,
      c.created_at,
      c.likes,
      c.dislikes,
      u.username,
      u.avatar,
      u.is_vip
    FROM comment c
    JOIN user u ON c.user_id = u.id
    WHERE c.parent_comment_id = ?
    ORDER BY c.created_at ASC
    LIMIT ? OFFSET ?
  `;

  db.query(query, [commentId, parseInt(limit), parseInt(offset)], (err, results) => {
    if (err) {
      console.error('获取评论回复失败:', err);
      return res.status(500).json({ message: '获取评论回复失败' });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// 不喜欢章节评论 - 简化版本
app.post('/api/comment/:commentId/dislike', authenticateToken, (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Please login first' });
  }

  // 检查是否已经点踩
  db.query('SELECT id FROM comment_dislike WHERE comment_id = ? AND user_id = ?', [commentId, userId], (err, existingDislike) => {
    if (err) {
      console.error('检查点踩状态失败:', err);
      return res.status(500).json({ message: '检查点踩状态失败' });
    }

    // 如果已经点踩，直接返回
    if (existingDislike.length > 0) {
      return res.json({
        success: true,
        message: '已经点踩过了',
        action: 'already_disliked'
      });
    }

    // 检查是否有点赞记录（互斥逻辑）
    db.query('SELECT id FROM comment_like WHERE comment_id = ? AND user_id = ?', [commentId, userId], (err2, existingLike) => {
      if (err2) {
        console.error('检查点赞状态失败:', err2);
        return res.status(500).json({ message: '检查点赞状态失败' });
      }

      // 如果有点赞记录，先删除
      if (existingLike.length > 0) {
        db.query('DELETE FROM comment_like WHERE comment_id = ? AND user_id = ?', [commentId, userId], (err3) => {
          if (err3) {
            console.error('删除点赞记录失败:', err3);
            return res.status(500).json({ message: '删除点赞记录失败' });
          }

          // 更新点赞数
          db.query('UPDATE comment SET likes = likes - 1 WHERE id = ?', [commentId], (err4) => {
            if (err4) {
              console.error('更新点赞数失败:', err4);
            }
          });
        });
      }

      // 添加点踩记录
      db.query('INSERT INTO comment_dislike (comment_id, user_id, created_at) VALUES (?, ?, NOW())', [commentId, userId], (err5) => {
        if (err5) {
          console.error('点踩失败:', err5);
          return res.status(500).json({ message: '点踩失败' });
        }

        // 更新评论点踩数
        db.query('UPDATE comment SET dislikes = dislikes + 1 WHERE id = ?', [commentId], (err6) => {
          if (err6) {
            console.error('更新点踩数失败:', err6);
          }
        });

        res.json({
          success: true,
          message: '点踩成功',
          action: 'disliked'
        });
      });
    });
  });
});

// ==================== 段落评论API ====================

// 获取章节的段落评论统计
app.get('/api/chapter/:chapterId/paragraph-comments', (req, res) => {
  const { chapterId } = req.params;
  
  const query = `
    SELECT 
      paragraph_index,
      COUNT(*) as comment_count
    FROM paragraph_comment 
    WHERE chapter_id = ? AND is_deleted = 0
    GROUP BY paragraph_index
    ORDER BY paragraph_index
  `;
  
  db.query(query, [chapterId], (err, results) => {
    if (err) {
      console.error('获取段落评论统计失败:', err);
      return res.status(500).json({ message: '获取段落评论统计失败' });
    }
    
    // 转换为对象格式，便于前端使用
    const commentStats = {};
    results.forEach(row => {
      commentStats[row.paragraph_index] = row.comment_count;
    });
    
    res.json({
      success: true,
      data: commentStats
    });
  });
});

// 获取指定段落的评论（支持嵌套结构）
app.get('/api/chapter/:chapterId/paragraph/:paragraphIndex/comments', (req, res) => {
  const { chapterId, paragraphIndex } = req.params;
  const { page = 1, limit = 20 } = req.query;
  
  const offset = (page - 1) * limit;
  
  // 获取顶级评论（parent_id为NULL）
  const query = `
    SELECT 
      pc.id,
      pc.content,
      pc.created_at,
      COALESCE(pc.like_count, 0) as like_count,
      COALESCE(pc.dislike_count, 0) as dislike_count,
      pc.parent_id,
      u.username,
      u.avatar
    FROM paragraph_comment pc
    JOIN user u ON pc.user_id = u.id
    WHERE pc.chapter_id = ? AND pc.paragraph_index = ? AND pc.is_deleted = 0 AND pc.parent_id IS NULL
    ORDER BY pc.created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  db.query(query, [chapterId, paragraphIndex, parseInt(limit), parseInt(offset)], (err, topLevelComments) => {
    if (err) {
      console.error('获取段落评论失败:', err);
      return res.status(500).json({ message: '获取段落评论失败' });
    }
    
    // 获取每个顶级评论的回复
    const getReplies = async (comments) => {
      for (let comment of comments) {
        const repliesQuery = `
          SELECT 
            pc.id,
            pc.content,
            pc.created_at,
            COALESCE(pc.like_count, 0) as like_count,
            COALESCE(pc.dislike_count, 0) as dislike_count,
            pc.parent_id,
            u.username,
            u.avatar
          FROM paragraph_comment pc
          JOIN user u ON pc.user_id = u.id
          WHERE pc.parent_id = ? AND pc.is_deleted = 0
          ORDER BY pc.created_at ASC
        `;
        
        const replies = await new Promise((resolve, reject) => {
          db.query(repliesQuery, [comment.id], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        
        comment.replies = replies;
      }
      return comments;
    };
    
    getReplies(topLevelComments).then(commentsWithReplies => {
      // 获取评论总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM paragraph_comment 
        WHERE chapter_id = ? AND paragraph_index = ? AND is_deleted = 0 AND parent_id IS NULL
      `;
      
      db.query(countQuery, [chapterId, paragraphIndex], (err2, countResult) => {
        if (err2) {
          console.error('获取评论总数失败:', err2);
          return res.status(500).json({ message: '获取评论总数失败' });
        }
        
        res.json({
          success: true,
          data: {
            comments: commentsWithReplies,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: countResult[0].total,
              pages: Math.ceil(countResult[0].total / limit)
            }
          }
        });
      });
    }).catch(err => {
      console.error('获取回复失败:', err);
      return res.status(500).json({ message: '获取回复失败' });
    });
  });
});

// 添加段落评论（支持回复）
app.post('/api/chapter/:chapterId/paragraph/:paragraphIndex/comments', (req, res) => {
  const { chapterId, paragraphIndex } = req.params;
  const { content, userId, parentId } = req.body;
  
  if (!content || !userId) {
    return res.status(400).json({ message: '评论内容和用户ID不能为空' });
  }
  
  const query = `
    INSERT INTO paragraph_comment (chapter_id, paragraph_index, user_id, content, parent_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.query(query, [chapterId, paragraphIndex, userId, content, parentId || null], (err, result) => {
    if (err) {
      console.error('添加段落评论失败:', err);
      return res.status(500).json({ message: '添加段落评论失败' });
    }
    
    res.json({
      success: true,
      data: {
        id: result.insertId,
        message: '评论添加成功'
      }
    });
  });
});

// 点赞/点踩评论
app.post('/api/paragraph-comment/:commentId/like', (req, res) => {
  const { commentId } = req.params;
  const { userId, isLike } = req.body; // isLike: 1=点赞, 0=点踩
  
  if (!userId || isLike === undefined) {
    return res.status(400).json({ message: '用户ID和点赞状态不能为空' });
  }
  
  // 检查是否已经点赞/点踩过
  const checkQuery = `
    SELECT id, is_like FROM paragraph_comment_like 
    WHERE comment_id = ? AND user_id = ?
  `;
  
  db.query(checkQuery, [commentId, userId], (err, existing) => {
    if (err) {
      console.error('检查点赞状态失败:', err);
      return res.status(500).json({ message: '检查点赞状态失败' });
    }
    
    if (existing.length > 0) {
      // 如果已经点赞/点踩过，更新状态
      const updateQuery = `
        UPDATE paragraph_comment_like SET is_like = ? WHERE id = ?
      `;
      
      db.query(updateQuery, [isLike, existing[0].id], (err) => {
        if (err) {
          console.error('更新点赞状态失败:', err);
          return res.status(500).json({ message: '更新点赞状态失败' });
        }
        updateCommentCounts(commentId, res);
      });
    } else {
      // 新增点赞/点踩记录
      const insertQuery = `
        INSERT INTO paragraph_comment_like (comment_id, user_id, is_like)
        VALUES (?, ?, ?)
      `;
      
      db.query(insertQuery, [commentId, userId, isLike], (err) => {
        if (err) {
          console.error('添加点赞记录失败:', err);
          return res.status(500).json({ message: '添加点赞记录失败' });
        }
        updateCommentCounts(commentId, res);
      });
    }
  });
});

// 更新评论的点赞/点踩数量
function updateCommentCounts(commentId, res) {
  const countQuery = `
    SELECT 
      SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) as like_count,
      SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) as dislike_count
    FROM paragraph_comment_like 
    WHERE comment_id = ?
  `;
  
  db.query(countQuery, [commentId], (err, counts) => {
    if (err) {
      console.error('获取点赞数量失败:', err);
      return res.status(500).json({ message: '获取点赞数量失败' });
    }
    
    const updateQuery = `
      UPDATE paragraph_comment 
      SET like_count = ?, dislike_count = ? 
      WHERE id = ?
    `;
    
    db.query(updateQuery, [counts[0].like_count || 0, counts[0].dislike_count || 0, commentId], (err) => {
      if (err) {
        console.error('更新评论数量失败:', err);
        return res.status(500).json({ message: '更新评论数量失败' });
      }
      
      res.json({
        success: true,
        data: {
          like_count: counts[0].like_count || 0,
          dislike_count: counts[0].dislike_count || 0
        }
      });
    });
  });
}

// ==================== 章节展示API ====================

// 获取小说的卷和章节信息
app.get('/api/novel/:novelId/volumes', (req, res) => {
  const { novelId } = req.params;
  const { sort = 'newest' } = req.query;

  let orderBy = 'v.volume_id DESC';
  if (sort === 'oldest') {
    orderBy = 'v.volume_id ASC';
  } else if (sort === 'newest') {
    orderBy = 'v.volume_id DESC';
  }

  const volumesQuery = `
    SELECT 
      v.id,
      v.volume_id,
      v.title,
      v.start_chapter,
      v.end_chapter,
      v.chapter_count,
      COUNT(c.id) as actual_chapter_count,
      MAX(c.created_at) as latest_chapter_date
    FROM volume v
    LEFT JOIN chapter c ON v.volume_id = c.volume_id AND c.novel_id = v.novel_id AND c.is_visible = 1
    WHERE v.novel_id = ?
    GROUP BY v.id, v.volume_id, v.title, v.start_chapter, v.end_chapter, v.chapter_count
    ORDER BY ${orderBy}
  `;

  db.query(volumesQuery, [novelId], (err, volumes) => {
    if (err) {
      console.error('获取卷信息失败:', err);
      return res.status(500).json({ message: '获取卷信息失败' });
    }

    // 获取最新章节信息
    const latestChapterQuery = `
      SELECT 
        c.id,
        c.chapter_number,
        c.title,
        c.created_at,
        v.volume_number
      FROM chapter c
      JOIN volume v ON c.volume_id = v.volume_id AND v.novel_id = c.novel_id
      WHERE c.novel_id = ? AND c.is_visible = 1
      ORDER BY c.created_at DESC
      LIMIT 1
    `;

    db.query(latestChapterQuery, [novelId], (err2, latestChapter) => {
      if (err2) {
        console.error('获取最新章节失败:', err2);
        return res.status(500).json({ message: '获取最新章节失败' });
      }

      res.json({
        success: true,
        data: {
          volumes,
          latest_chapter: latestChapter[0] || null,
          total_volumes: volumes.length
        }
      });
    });
  });
});

// 获取指定卷的章节列表
app.get('/api/volume/:volumeId/chapters', (req, res) => {
  const { volumeId } = req.params;
  const { sort = 'chapter_number' } = req.query;
  const { page = 1, limit = 50 } = req.query;

  const offset = (page - 1) * limit;

  // 获取卷信息
  const volumeQuery = `
    SELECT v.*, n.title as novel_title
    FROM volume v
    JOIN novel n ON v.novel_id = n.id
    WHERE v.id = ?
  `;

  db.query(volumeQuery, [volumeId], (err, volumeInfo) => {
    if (err) {
      console.error('获取卷信息失败:', err);
      return res.status(500).json({ message: '获取卷信息失败' });
    }

    if (volumeInfo.length === 0) {
      return res.status(404).json({ message: '卷不存在' });
    }

    // 获取章节列表
    let orderBy = 'c.chapter_number ASC';
    if (sort === 'newest') {
      orderBy = 'c.created_at DESC';
    } else if (sort === 'oldest') {
      orderBy = 'c.created_at ASC';
    }

    const chaptersQuery = `
      SELECT 
        c.id,
        c.chapter_number,
        c.title,
        c.created_at,
        c.is_locked,
        c.is_vip_only,
        c.is_advance,
        c.unlock_price,
        CASE 
          WHEN c.is_locked = 1 THEN 'locked'
          WHEN c.is_vip_only = 1 THEN 'vip_only'
          WHEN c.is_advance = 1 THEN 'advance'
          ELSE 'free'
        END as access_status
      FROM chapter c
      JOIN volume v ON c.volume_id = v.volume_id AND v.novel_id = c.novel_id
      WHERE v.id = ? AND c.is_visible = 1
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    db.query(chaptersQuery, [volumeId, parseInt(limit), parseInt(offset)], (err2, chapters) => {
      if (err2) {
        console.error('获取章节列表失败:', err2);
        return res.status(500).json({ message: '获取章节列表失败' });
      }

      // 获取章节总数
      const totalQuery = `
        SELECT COUNT(*) as total
        FROM chapter c
        JOIN volume v ON c.volume_id = v.volume_id AND v.novel_id = c.novel_id
        WHERE v.id = ? AND c.is_visible = 1
      `;

      db.query(totalQuery, [volumeId], (err3, totalResult) => {
        if (err3) {
          console.error('获取章节总数失败:', err3);
          return res.status(500).json({ message: '获取章节总数失败' });
        }

        res.json({
          success: true,
          data: {
            volume: volumeInfo[0],
            chapters,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: totalResult[0].total,
              pages: Math.ceil(totalResult[0].total / limit)
            }
          }
        });
      });
    });
  });
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
}); 
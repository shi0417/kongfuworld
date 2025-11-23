// 简化的通知API测试服务器
const express = require('express');
const mysql = require('mysql2');
require('dotenv').config({ path: './kongfuworld.env' });

const app = express();
app.use(express.json());

// CORS配置
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 创建数据库连接
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
});

// 连接数据库
db.connect((err) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('数据库连接成功');
});

// 获取用户通知列表 - 简化版本
app.get('/api/user/:id/notifications', (req, res) => {
  const userId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const type = req.query.type || 'unlock';
  const offset = (page - 1) * limit;
  
  console.log('获取通知请求:', { userId, page, limit, type, offset });
  
  if (type === 'unlock') {
    // 查询时间解锁记录
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

// 首页API端点 - 简化版本
app.get('/api/homepage/banners', (req, res) => {
  res.json({ success: true, data: [] });
});

app.get('/api/homepage/new-releases', (req, res) => {
  res.json({ success: true, data: [] });
});

app.get('/api/homepage/top-series', (req, res) => {
  res.json({ success: true, data: [] });
});

app.get('/api/homepage/popular-this-week', (req, res) => {
  res.json({ success: true, data: [] });
});

app.get('/api/homepage/config', (req, res) => {
  res.json({ success: true, data: {} });
});

// 用户API端点 - 简化版本
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ 
    success: true, 
    data: { 
      id: userId, 
      username: 'testuser',
      settings_json: JSON.stringify({
        notify_unlock_updates: true,
        notify_chapter_updates: true,
        accept_marketing: true
      })
    } 
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`简化API服务器运行在端口 ${PORT}`);
  console.log('支持的通知类型: unlock, chapter_marketing');
});

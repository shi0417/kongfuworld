// 新的通知API实现 - 使用UNION查询
const express = require('express');
const mysql = require('mysql2');
require('dotenv').config({ path: './kongfuworld.env' });

const app = express();
app.use(express.json());

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

// 获取用户通知列表（包含时间解锁记录）- 使用UNION查询
app.get('/api/user/:id/notifications', (req, res) => {
  const userId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const type = req.query.type || 'all';
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
    
    // 构建UNION查询来合并两个表的数据
    let unionQuery = '';
    let params = [];
    
    if (notifyUnlockUpdates) {
      // 包含时间解锁记录的UNION查询
      unionQuery = `
        (
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
        )
        UNION ALL
        (
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
        )
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [userId, userId, limit, offset];
    } else {
      // 只查询普通通知
      unionQuery = `
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
      params = [userId, limit, offset];
    }
    
    // 添加类型过滤
    if (type !== 'all') {
      if (notifyUnlockUpdates) {
        // 对于UNION查询，需要在每个子查询中添加WHERE条件
        unionQuery = unionQuery.replace(
          'WHERE n.user_id = ?',
          `WHERE n.user_id = ? AND n.type = '${type}'`
        );
      } else {
        unionQuery = unionQuery.replace(
          'WHERE n.user_id = ?',
          `WHERE n.user_id = ? AND n.type = '${type}'`
        );
        params.splice(params.length - 2, 0, type);
      }
    }
    
    console.log('执行查询:', unionQuery);
    console.log('查询参数:', params);
    
    db.query(unionQuery, params, (err, results) => {
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
        
        // 对于时间解锁记录，计算正确的时间显示
        if (notification.isTimeUnlock) {
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
        }
        
        return {
          ...notification,
          timeAgo,
          readed: notification.readed || 0
        };
      });
      
      // 获取总数（用于分页）
      let countQuery = '';
      let countParams = [];
      
      if (notifyUnlockUpdates) {
        countQuery = `
          SELECT COUNT(*) as total FROM (
            SELECT cu.id FROM chapter_unlocks cu
            WHERE cu.user_id = ? 
              AND cu.unlock_method = 'time_unlock'
              AND cu.status IN ('pending', 'unlocked')
            UNION ALL
            SELECT n.id FROM notifications n
            WHERE n.user_id = ?
          ) as combined
        `;
        countParams = [userId, userId];
      } else {
        countQuery = 'SELECT COUNT(*) as total FROM notifications n WHERE n.user_id = ?';
        countParams = [userId];
      }
      
      // 添加类型过滤到计数查询
      if (type !== 'all') {
        if (notifyUnlockUpdates) {
          countQuery = countQuery.replace(
            'WHERE n.user_id = ?',
            `WHERE n.user_id = ? AND n.type = '${type}'`
          );
        } else {
          countQuery = countQuery.replace(
            'WHERE n.user_id = ?',
            `WHERE n.user_id = ? AND n.type = '${type}'`
          );
          countParams.push(type);
        }
      }
      
      db.query(countQuery, countParams, (err, countResults) => {
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
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`UNION API服务器运行在端口 ${PORT}`);
});

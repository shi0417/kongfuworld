const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const https = require('https');
const fetch = require('node-fetch');
// 导入登录日志记录工具
const { logUserLoginAsync } = require('../utils/loginLogger');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 第三方登录处理
router.post('/social-login', async (req, res) => {
  const { provider, userData } = req.body;
  
  try {
    console.log('Social login request:', { provider, userData });
    const db = await mysql.createConnection(dbConfig);
    
    let user = null;
    let email = '';
    let name = '';
    let avatar = '';
    
    // 根据不同的第三方提供商处理用户数据
    switch (provider) {
      case 'Google':
        // Google登录返回的数据结构可能不同，需要解析credential
        if (userData.credential) {
          // 如果返回的是JWT credential，需要解码
          try {
            const payload = JSON.parse(atob(userData.credential.split('.')[1]));
            email = payload.email || '';
            name = payload.name || '';
            avatar = payload.picture || '';
          } catch (e) {
            console.error('Failed to decode Google credential:', e);
            email = userData.email || '';
            name = userData.name || '';
            avatar = userData.picture || '';
          }
        } else {
          email = userData.email || '';
          name = userData.name || '';
          avatar = userData.picture || '';
        }
        break;
      case 'Facebook':
        // Facebook登录可能只返回accessToken，需要从Graph API获取用户信息
        if (userData.accessToken && !userData.email) {
          try {
            // 使用accessToken从Facebook Graph API获取用户信息
            const graphApiUrl = `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture.width(200).height(200)&access_token=${userData.accessToken}`;
            const fbResponse = await fetch(graphApiUrl);
            const fbUser = await fbResponse.json();
            
            if (fbUser.error) {
              throw new Error(fbUser.error.message || 'Facebook API错误');
            }
            
            email = fbUser.email || '';
            name = fbUser.name || '';
            avatar = fbUser.picture?.data?.url || '';
            
            // 保存Facebook用户ID用于后续验证
            userData.id = fbUser.id;
            userData.name = fbUser.name;
            userData.email = fbUser.email;
            userData.picture = fbUser.picture;
            
            console.log('从Facebook Graph API获取的用户信息:', { email, name, avatar });
          } catch (fbError) {
            console.error('从Facebook Graph API获取用户信息失败:', fbError.message || fbError);
            // 如果Graph API调用失败，尝试使用response中的信息
            email = userData.email || '';
            name = userData.name || '';
            avatar = userData.picture?.data?.url || userData.picture?.url || '';
          }
        } else {
          // 如果已经包含用户信息，直接使用
          email = userData.email || '';
          name = userData.name || '';
          avatar = userData.picture?.data?.url || userData.picture?.url || '';
        }
        break;
      case 'Apple':
        email = userData.email || '';
        name = userData.name || '';
        avatar = '';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: '不支持的第三方登录提供商'
        });
    }
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: '无法获取用户邮箱信息'
      });
    }
    
    // 检查用户是否已存在
    const [existingUsers] = await db.execute(
      'SELECT * FROM user WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      // 用户已存在，直接登录
      user = existingUsers[0];
    } else {
      // 创建新用户
      // 生成唯一用户名（如果用户名已存在，添加随机后缀）
      let username = name || email.split('@')[0];
      username = username.replace(/[^a-zA-Z0-9_]/g, ''); // 移除特殊字符
      
      // 检查用户名是否已存在
      let finalUsername = username;
      let counter = 1;
      while (true) {
        const [existingUsernames] = await db.execute(
          'SELECT id FROM user WHERE username = ?',
          [finalUsername]
        );
        if (existingUsernames.length === 0) {
          break;
        }
        finalUsername = `${username}${counter}`;
        counter++;
      }
      
      const [result] = await db.execute(
        'INSERT INTO user (username, email, avatar, social_provider, social_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [finalUsername, email, avatar, provider, userData.id || userData.sub || '', new Date()]
      );
      
      // 获取新创建的用户
      const [newUsers] = await db.execute(
        'SELECT * FROM user WHERE id = ?',
        [result.insertId]
      );
      user = newUsers[0];
    }
    
    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    // 记录第三方登录日志（异步，不阻塞响应）
    try {
      await logUserLoginAsync(db, user.id, req, provider.toLowerCase(), 'success');
    } catch (logError) {
      // 记录失败不影响登录流程
      console.error('记录第三方登录日志失败:', logError);
    }
    
    await db.end();
    
    res.json({
      success: true,
      message: '第三方登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          points: user.points || 0,
          golden_karma: user.golden_karma || 0,
          checkinday: user.checkinday
        },
        token
      }
    });
    
  } catch (error) {
    console.error('第三方登录错误:', error);
    res.status(500).json({
      success: false,
      message: '第三方登录失败',
      error: error.message
    });
  }
});

module.exports = router;

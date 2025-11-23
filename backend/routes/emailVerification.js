// 邮箱验证路由
const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const { sendVerificationCode } = require('../services/emailService');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

// 存储验证码（实际项目中应该使用Redis）
const verificationCodes = new Map();

// 生成6位随机验证码
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 验证码有效期（10分钟）
const CODE_EXPIRY = 10 * 60 * 1000;

// 发送验证码
router.post('/send-code', async (req, res) => {
  let connection;
  
  try {
    const { email } = req.body;
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address / 无效的邮箱地址'
      });
    }

    connection = await mysql.createConnection(dbConfig);

    // 检查用户是否登录（从token中获取用户ID）
    // 支持多种token传递方式：Authorization header或query参数
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : req.query.token || req.body.token;
    let userId = null;

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, 'your-secret-key');
        userId = decoded.userId;
      } catch (error) {
        // token验证失败，但继续允许发送验证码（允许未登录用户验证邮箱）
        console.log('Token验证失败，继续发送验证码（允许未登录状态）');
      }
    }

    // 如果提供了userId，验证邮箱是否属于该用户
    if (userId) {
      const [users] = await connection.execute(
        'SELECT id, email FROM user WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'User not found / 用户不存在'
        });
      }

      // 允许用户更新邮箱
      // 如果邮箱不同，可以更新用户邮箱
    }

    // 生成验证码
    const code = generateVerificationCode();
    
    // 存储验证码（使用email作为key）
    verificationCodes.set(email, {
      code,
      expiresAt: Date.now() + CODE_EXPIRY,
      userId: userId
    });

    // 发送邮件
    try {
      await sendVerificationCode(email, code);
      
      res.json({
        success: true,
        message: 'Verification code sent / 验证码已发送'
      });
    } catch (emailError) {
      console.error('发送邮件失败:', emailError);
      // 清理验证码
      verificationCodes.delete(email);
      
      res.status(500).json({
        success: false,
        message: 'Failed to send verification code / 发送验证码失败。请检查邮件配置或联系管理员。'
      });
    }

  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error / 服务器内部错误'
    });
  } finally {
    if (connection) await connection.end();
  }
});

// 验证验证码
router.post('/verify', async (req, res) => {
  let connection;
  
  try {
    const { email, code } = req.body;

    // 验证输入
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required / 邮箱和验证码不能为空'
      });
    }

    // 检查验证码
    const stored = verificationCodes.get(email);
    
    if (!stored) {
      return res.status(400).json({
        success: false,
        message: 'Verification code not found or expired / 验证码不存在或已过期'
      });
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        message: 'Verification code expired / 验证码已过期'
      });
    }

    if (stored.code !== code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code / 验证码错误'
      });
    }

    // 验证码正确，更新用户数据
    connection = await mysql.createConnection(dbConfig);

    // 获取用户ID（从token或email）
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : req.query.token || req.body.token;
    let userId = stored.userId;

    if (!userId && token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, 'your-secret-key');
        userId = decoded.userId;
      } catch (error) {
        // 如果token无效，尝试通过email查找用户
        const [users] = await connection.execute(
          'SELECT id FROM user WHERE email = ?',
          [email]
        );
        if (users.length > 0) {
          userId = users[0].id;
        }
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not found / 用户不存在'
      });
    }

    // 更新用户邮箱、confirmed_email（存储验证通过的邮箱地址），并设置为作者
    await connection.execute(
      'UPDATE user SET email = ?, confirmed_email = ?, is_author = 1 WHERE id = ?',
      [email, email, userId]
    );

    // 删除验证码
    verificationCodes.delete(email);

    res.json({
      success: true,
      message: 'Email verified successfully / 邮箱验证成功'
    });

  } catch (error) {
    console.error('验证验证码错误:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error / 服务器内部错误'
    });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;


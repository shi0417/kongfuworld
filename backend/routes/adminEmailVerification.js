/**
 * 管理员/编辑邮箱验证路由
 * 专门用于 admin 注册时的邮箱验证码功能
 */
const express = require('express');
const router = express.Router();
const { sendVerificationCode } = require('../services/emailService');

// 存储 admin 验证码（实际项目中应该使用Redis）
// key: email, value: { code, expiresAt }
const adminVerificationCodes = new Map();

// 生成6位随机验证码
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 验证码有效期（10分钟）
const CODE_EXPIRY = 10 * 60 * 1000;

/**
 * 发送 admin 注册验证码
 * POST /api/admin/email-verification/send-code
 */
router.post('/send-code', async (req, res) => {
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

    // 生成验证码
    const code = generateVerificationCode();
    
    // 存储验证码（使用email作为key）
    adminVerificationCodes.set(email, {
      code,
      expiresAt: Date.now() + CODE_EXPIRY
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
      adminVerificationCodes.delete(email);
      
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
  }
});

/**
 * 验证 admin 注册验证码（供注册接口调用）
 * @param {string} email - 邮箱
 * @param {string} code - 验证码
 * @returns {boolean} 是否验证通过
 */
function verifyAdminCode(email, code) {
  const stored = adminVerificationCodes.get(email);
  
  if (!stored) {
    return false;
  }

  if (Date.now() > stored.expiresAt) {
    adminVerificationCodes.delete(email);
    return false;
  }

  if (stored.code !== code.trim()) {
    return false;
  }

  // 验证通过，删除验证码（防止重复使用）
  adminVerificationCodes.delete(email);
  return true;
}

// 导出验证函数供注册接口使用
module.exports = router;
module.exports.verifyAdminCode = verifyAdminCode;


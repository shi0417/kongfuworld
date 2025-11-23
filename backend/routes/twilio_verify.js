// Twilio Verify 短信验证码集成
const express = require('express');
const twilio = require('twilio');
const mysql = require('mysql2/promise');
const router = express.Router();

// Twilio配置
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'your_account_sid';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'your_auth_token';
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID || 'your_service_sid';

// 初始化Twilio客户端
const client = twilio(accountSid, authToken);

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 发送验证码
router.post('/send-code', async (req, res) => {
  let db;
  try {
    const { phoneNumber, countryCode = '+1' } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // 格式化手机号
    const formattedPhone = countryCode + phoneNumber.replace(/\D/g, '');
    
    console.log(`📱 Sending verification code to: ${formattedPhone}`);
    
    // 发送验证码
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications
      .create({
        to: formattedPhone,
        channel: 'sms'
      });

    console.log(`✅ Verification sent: ${verification.sid}`);
    
    res.json({
      success: true,
      message: 'Verification code sent successfully',
      verificationSid: verification.sid,
      phoneNumber: formattedPhone
    });

  } catch (error) {
    console.error('❌ Send verification code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code',
      error: error.message
    });
  }
});

// 验证验证码
router.post('/verify-code', async (req, res) => {
  let db;
  try {
    const { phoneNumber, countryCode = '+1', code, userId } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and verification code are required'
      });
    }

    // 格式化手机号
    const formattedPhone = countryCode + phoneNumber.replace(/\D/g, '');
    
    console.log(`🔍 Verifying code for: ${formattedPhone}`);
    
    // 验证验证码
    const verificationCheck = await client.verify.v2
      .services(serviceSid)
      .verificationChecks
      .create({
        to: formattedPhone,
        code: code
      });

    if (verificationCheck.status === 'approved') {
      console.log(`✅ Verification successful: ${verificationCheck.sid}`);
      
      // 如果提供了userId，更新用户的手机号验证状态
      if (userId) {
        db = await mysql.createConnection(dbConfig);
        
        await db.execute(`
          UPDATE user 
          SET phone_verified = 1, phone_number = ?, updated_at = NOW()
          WHERE id = ?
        `, [formattedPhone, userId]);
        
        console.log(`📱 User ${userId} phone verified: ${formattedPhone}`);
      }
      
      res.json({
        success: true,
        message: 'Phone number verified successfully',
        verificationSid: verificationCheck.sid,
        phoneNumber: formattedPhone
      });
    } else {
      console.log(`❌ Verification failed: ${verificationCheck.status}`);
      res.status(400).json({
        success: false,
        message: 'Invalid verification code',
        status: verificationCheck.status
      });
    }

  } catch (error) {
    console.error('❌ Verify code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify code',
      error: error.message
    });
  } finally {
    if (db) await db.end();
  }
});

// 发送语音验证码
router.post('/send-voice-code', async (req, res) => {
  try {
    const { phoneNumber, countryCode = '+1' } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // 格式化手机号
    const formattedPhone = countryCode + phoneNumber.replace(/\D/g, '');
    
    console.log(`📞 Sending voice verification to: ${formattedPhone}`);
    
    // 发送语音验证码
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications
      .create({
        to: formattedPhone,
        channel: 'call'
      });

    console.log(`✅ Voice verification sent: ${verification.sid}`);
    
    res.json({
      success: true,
      message: 'Voice verification sent successfully',
      verificationSid: verification.sid,
      phoneNumber: formattedPhone
    });

  } catch (error) {
    console.error('❌ Send voice verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send voice verification',
      error: error.message
    });
  }
});

// 检查验证状态
router.get('/check-status/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { countryCode = '+1' } = req.query;
    
    // 格式化手机号
    const formattedPhone = countryCode + phoneNumber.replace(/\D/g, '');
    
    console.log(`🔍 Checking verification status for: ${formattedPhone}`);
    
    // 获取验证状态
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications(formattedPhone)
      .fetch();

    res.json({
      success: true,
      phoneNumber: formattedPhone,
      status: verification.status,
      channel: verification.channel,
      createdAt: verification.dateCreated
    });

  } catch (error) {
    console.error('❌ Check verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check verification status',
      error: error.message
    });
  }
});

// 取消验证
router.post('/cancel-verification', async (req, res) => {
  try {
    const { phoneNumber, countryCode = '+1' } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // 格式化手机号
    const formattedPhone = countryCode + phoneNumber.replace(/\D/g, '');
    
    console.log(`🚫 Canceling verification for: ${formattedPhone}`);
    
    // 取消验证
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications(formattedPhone)
      .update({ status: 'canceled' });

    console.log(`✅ Verification canceled: ${verification.sid}`);
    
    res.json({
      success: true,
      message: 'Verification canceled successfully',
      verificationSid: verification.sid,
      phoneNumber: formattedPhone
    });

  } catch (error) {
    console.error('❌ Cancel verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel verification',
      error: error.message
    });
  }
});

module.exports = router;


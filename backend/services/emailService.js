// 邮件发送服务
const nodemailer = require('nodemailer');

// 邮件配置
// QQ企业邮箱（腾讯企业邮箱）配置
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.exmail.qq.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true, // QQ企业邮箱使用SSL，端口465需要设置为true
  auth: {
    user: process.env.SMTP_USER || 'admin@kongfuworld.com',
    pass: process.env.SMTP_PASSWORD || '' // 需要在环境变量中设置（使用授权码，不是登录密码）
  },
  // QQ企业邮箱特殊配置
  tls: {
    rejectUnauthorized: false // 某些情况下需要设置为false
  }
};

// 创建邮件传输器
let transporter = null;

function createTransporter() {
  if (!transporter) {
    const config = {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure, // true for 465, false for other ports
      auth: emailConfig.auth
    };

    // 如果是SSL端口(465)，secure=true，不需要额外tls配置
    // 如果是TLS端口(587)，secure=false，需要tls配置
    if (emailConfig.port === 465) {
      // QQ企业邮箱SSL配置
      config.secure = true;
      config.tls = {
        rejectUnauthorized: false // 允许自签名证书
      };
    } else if (emailConfig.port === 587) {
      // TLS配置
      config.secure = false;
      config.requireTLS = true;
      config.tls = {
        rejectUnauthorized: false
      };
    }

    transporter = nodemailer.createTransport(config);
    
    // 验证连接
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ 邮件服务配置验证失败:', error.message);
        console.error('请检查SMTP配置是否正确');
      } else {
        console.log('✅ 邮件服务配置验证成功');
      }
    });
  }
  return transporter;
}

/**
 * 发送验证码邮件
 * @param {string} to - 收件人邮箱
 * @param {string} code - 验证码
 * @returns {Promise}
 */
async function sendVerificationCode(to, code) {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"KongFuWorld" <${emailConfig.auth.user}>`,
      to: to,
      subject: 'Email Verification Code / 邮箱验证码',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ff8800; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .code-box { background: #fff; border: 2px solid #ff8800; padding: 20px; text-align: center; margin: 20px 0; font-size: 32px; font-weight: bold; color: #ff8800; letter-spacing: 8px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>KongFuWorld Email Verification</h1>
              <h2>武侠世界 邮箱验证</h2>
            </div>
            <div class="content">
              <p>Hello / 您好,</p>
              <p>Your verification code is / 您的验证码是:</p>
              <div class="code-box">${code}</div>
              <p>This code will expire in 10 minutes / 此验证码将在10分钟后过期。</p>
              <p>If you did not request this code, please ignore this email / 如果您没有请求此验证码，请忽略此邮件。</p>
            </div>
            <div class="footer">
              <p>© 2025 KongFuWorld. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        KongFuWorld Email Verification / 武侠世界 邮箱验证
        
        Your verification code is / 您的验证码是: ${code}
        
        This code will expire in 10 minutes / 此验证码将在10分钟后过期。
        
        If you did not request this code, please ignore this email / 如果您没有请求此验证码，请忽略此邮件。
        
        © 2025 KongFuWorld. All rights reserved.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ 验证码邮件已发送:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ 发送邮件失败:', error);
    throw error;
  }
}

module.exports = {
  sendVerificationCode,
  createTransporter
};


// 测试邮件配置脚本
const nodemailer = require('nodemailer');

// 尝试加载环境变量
try {
  require('dotenv').config({ path: './kongfuworld.env' });
} catch (error) {
  console.log('dotenv not available, using default values');
}

const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.exmail.qq.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true, // QQ企业邮箱使用SSL，端口465需要设置为true
  auth: {
    user: process.env.SMTP_USER || 'admin@kongfuworld.com',
    pass: process.env.SMTP_PASSWORD || ''
  },
  tls: {
    rejectUnauthorized: false
  }
};

console.log('📧 邮件配置测试');
console.log('─'.repeat(50));
console.log('SMTP服务器:', emailConfig.host);
console.log('端口:', emailConfig.port);
console.log('SSL/TLS:', emailConfig.secure ? '启用 (SSL)' : '禁用');
console.log('发件人:', emailConfig.auth.user);
console.log('密码:', emailConfig.auth.pass ? '***已设置***' : '❌ 未设置');
console.log('─'.repeat(50));

if (!emailConfig.auth.pass) {
  console.error('\n❌ 错误: SMTP_PASSWORD 未设置！');
  console.error('请在 kongfuworld.env 文件中设置 SMTP_PASSWORD');
  console.error('注意: 需要使用授权码，不是登录密码\n');
  process.exit(1);
}

const transporter = nodemailer.createTransport(emailConfig);

// 验证配置
console.log('\n🔍 正在验证SMTP配置...');
transporter.verify((error, success) => {
  if (error) {
    console.error('\n❌ SMTP配置验证失败!');
    console.error('错误信息:', error.message);
    console.error('\n可能的原因:');
    console.error('1. SMTP_PASSWORD 设置错误（应使用授权码，不是登录密码）');
    console.error('2. SMTP服务未开启（需要在企业邮箱设置中开启IMAP/SMTP服务）');
    console.error('3. 网络连接问题');
    console.error('4. 防火墙阻止了连接');
    console.error('\n请检查:');
    console.error('- 是否在QQ企业邮箱中开启了"IMAP/SMTP服务"');
    console.error('- SMTP_PASSWORD是否使用了授权码（16位字符）');
    console.error('- 服务器是否能访问 smtp.exmail.qq.com:465');
    process.exit(1);
  } else {
    console.log('✅ SMTP配置验证成功！\n');
    
    // 发送测试邮件
    console.log('📤 正在发送测试邮件...');
    const testEmail = emailConfig.auth.user; // 发送给自己
    
    transporter.sendMail({
      from: `"KongFuWorld Test" <${emailConfig.auth.user}>`,
      to: testEmail,
      subject: 'KongFuWorld 邮件服务测试 / Email Service Test',
      html: `
        <h2>邮件服务配置测试</h2>
        <p>如果您收到此邮件，说明SMTP配置成功！</p>
        <p>This is a test email. If you received this, your SMTP configuration is correct!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          发送时间 / Sent at: ${new Date().toLocaleString('zh-CN')}<br>
          服务器 / Server: ${emailConfig.host}:${emailConfig.port}
        </p>
      `,
      text: `
KongFuWorld 邮件服务测试 / Email Service Test

如果您收到此邮件，说明SMTP配置成功！
If you received this email, your SMTP configuration is correct!

发送时间 / Sent at: ${new Date().toLocaleString('zh-CN')}
服务器 / Server: ${emailConfig.host}:${emailConfig.port}
      `
    }).then(info => {
      console.log('✅ 测试邮件发送成功！');
      console.log('邮件ID:', info.messageId);
      console.log('\n📬 请检查邮箱收件箱，应该会收到一封测试邮件');
      console.log('收件箱:', testEmail);
      process.exit(0);
    }).catch(err => {
      console.error('\n❌ 发送测试邮件失败！');
      console.error('错误信息:', err.message);
      console.error('\n可能的原因:');
      console.error('1. 授权码错误');
      console.error('2. 发件人地址不正确');
      console.error('3. 邮件服务限制（如发送频率限制）');
      process.exit(1);
    });
  }
});


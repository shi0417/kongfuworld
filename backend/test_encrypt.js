const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';
const IV_LENGTH = 16;

// 加密函数
function encrypt(text) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('加密错误:', error.message);
    throw error;
  }
}

// 测试
try {
  const test = encrypt('330123199001011234');
  console.log('加密成功:', test);
} catch (error) {
  console.error('测试失败:', error);
}


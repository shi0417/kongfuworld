const mysql = require('mysql2/promise');
const crypto = require('crypto');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld'
};

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
    console.error('加密错误:', error);
    throw error;
  }
}

async function testIdentityAPI() {
  let db;
  try {
    const userId = 1;
    const id_card_number = '330123199001011234';
    const real_name = '测试姓名';
    
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    if (!id_card_number || !real_name) {
      console.log('❌ 身份证号和真实姓名不能为空');
      return;
    }

    // 测试加密
    console.log('🔐 测试加密...');
    const encryptedIdCard = encrypt(id_card_number);
    console.log('✅ 加密成功:', encryptedIdCard.substring(0, 50) + '...');

    // 检查是否已有认证记录
    console.log('🔍 检查现有认证记录...');
    const [existing] = await db.execute(
      'SELECT * FROM user_identity_verifications WHERE user_id = ? AND verification_status = "verified"',
      [userId]
    );
    console.log('现有记录数:', existing.length);

    if (existing.length > 0) {
      console.log('⚠️  用户已经完成实名认证');
      return;
    }

    // 创建新的认证记录
    console.log('📝 创建认证记录...');
    await db.execute(
      `INSERT INTO user_identity_verifications (user_id, id_card_number, real_name, verification_status)
       VALUES (?, ?, ?, 'pending')`,
      [userId, encryptedIdCard, real_name]
    );
    console.log('✅ 认证记录创建成功');

    // 更新user表的认证状态
    console.log('🔄 更新用户表...');
    await db.execute(
      'UPDATE user SET is_real_name_verified = 0 WHERE id = ?',
      [userId]
    );
    console.log('✅ 用户表更新成功');

    console.log('\n✅ 所有操作成功！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    if (db) await db.end();
    console.log('🔌 数据库连接已关闭');
  }
}

testIdentityAPI();


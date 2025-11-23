const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const crypto = require('crypto');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

// 加密密钥（应该从环境变量读取）
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

// 解密函数
function decrypt(text) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('解密错误:', error);
    throw error;
  }
}

// 脱敏函数
function maskCardNumber(cardNumber) {
  if (!cardNumber || cardNumber.length < 8) return cardNumber;
  return cardNumber.slice(0, 4) + '****' + cardNumber.slice(-4);
}

function maskIdCard(idCard) {
  if (!idCard || idCard.length < 8) return idCard;
  return idCard.slice(0, 3) + '****' + idCard.slice(-4);
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

// ==================== 基础信息 ====================

// 获取用户完整个人信息
router.get('/:userId', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    db = await mysql.createConnection(dbConfig);

    // 获取用户基础信息
    const [users] = await db.execute(
      `SELECT id, username, email, qq_number, wechat_number, 
       emergency_contact_relationship, emergency_contact_phone, emergency_contact_phone_country_code,
       is_real_name_verified, phone_number, phone_country_code, avatar, pen_name
       FROM user WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const user = users[0];

    // 获取收货地址
    const [addresses] = await db.execute(
      'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [userId]
    );

    // 获取实名认证信息
    const [verifications] = await db.execute(
      'SELECT * FROM user_identity_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    // 获取银行卡绑定
    const [bankCards] = await db.execute(
      'SELECT * FROM user_bank_card_bindings WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC',
      [userId]
    );

    // 脱敏处理
    // 注意：phone_number_raw 和 emergency_contact_phone_raw 用于编辑时显示真实号码
    // phone_number 和 emergency_contact_phone 用于显示时脱敏
    const maskedData = {
      ...user,
      emergency_contact_phone: user.emergency_contact_phone ? (user.emergency_contact_phone_country_code || '+86') + ' ' + maskPhone(user.emergency_contact_phone) : null, // 脱敏显示，带国家区号
      emergency_contact_phone_raw: user.emergency_contact_phone || null, // 真实号码，用于编辑
      emergency_contact_phone_country_code: user.emergency_contact_phone_country_code || '+86', // 国家区号
      phone_number: user.phone_number ? (user.phone_country_code || '+86') + ' ' + maskPhone(user.phone_number) : null, // 脱敏显示，带国家区号
      phone_number_raw: user.phone_number || null, // 真实号码，用于编辑
      phone_country_code: user.phone_country_code || '+86', // 国家区号
      addresses: addresses,
      identity_verification: verifications.length > 0 ? (() => {
        const verification = verifications[0];
        // 保存原始的加密身份证号（用于解密）
        const originalIdCardNumber = verification.id_card_number;
        
        return {
          ...verification,
          // 使用存储的脱敏身份证号，如果没有则使用加密字符串的脱敏（向后兼容）
          id_card_number: verification.masked_id_card || 
            (originalIdCardNumber && originalIdCardNumber.includes(':') 
              ? '已加密' 
              : (originalIdCardNumber ? maskIdCard(originalIdCardNumber) : null)),
          // 真实的身份证号（解密），用于编辑
          id_card_number_raw: originalIdCardNumber && originalIdCardNumber.includes(':')
            ? (() => {
                try {
                  return decrypt(originalIdCardNumber);
                } catch (error) {
                  console.error('解密身份证号失败:', error);
                  return null;
                }
              })()
            : (originalIdCardNumber || null)
        };
      })() : null,
      bank_cards: bankCards.map(card => ({
        ...card,
        masked_card_number: card.masked_card_number || '已加密（无法显示）',
        // 不返回加密的完整卡号
        full_card_number: undefined,
        // 返回解密的银行卡号，用于编辑
        full_card_number_raw: card.full_card_number && card.full_card_number.includes(':')
          ? (() => {
              try {
                return decrypt(card.full_card_number);
              } catch (error) {
                console.error('解密银行卡号失败:', error);
                return null;
              }
            })()
          : null
      }))
    };

    res.json({ success: true, data: maskedData });
  } catch (error) {
    console.error('获取个人信息失败:', error);
    res.status(500).json({ success: false, message: '获取个人信息失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 更新用户基础信息
router.put('/:userId/basic', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const { qq_number, wechat_number, emergency_contact_relationship, emergency_contact_phone, emergency_contact_phone_country_code } = req.body;
    db = await mysql.createConnection(dbConfig);

    const updateFields = [];
    const updateValues = [];

    if (qq_number !== undefined) {
      updateFields.push('qq_number = ?');
      updateValues.push(qq_number);
    }
    if (wechat_number !== undefined) {
      updateFields.push('wechat_number = ?');
      updateValues.push(wechat_number);
    }
    if (emergency_contact_relationship !== undefined) {
      updateFields.push('emergency_contact_relationship = ?');
      updateValues.push(emergency_contact_relationship);
    }
    if (emergency_contact_phone !== undefined) {
      // 验证：不允许存储脱敏的手机号（包含****）
      if (emergency_contact_phone && emergency_contact_phone.includes('****')) {
        return res.status(400).json({ success: false, message: '请输入真实的紧急联系人手机号码，不能包含脱敏字符' });
      }
      updateFields.push('emergency_contact_phone = ?');
      updateValues.push(emergency_contact_phone);
    }
    if (emergency_contact_phone_country_code !== undefined) {
      // 验证国家区号
      const countryCode = emergency_contact_phone_country_code || '+86';
      if (!countryCode.startsWith('+')) {
        return res.status(400).json({ success: false, message: '国家区号格式不正确，应以+开头' });
      }
      updateFields.push('emergency_contact_phone_country_code = ?');
      updateValues.push(countryCode);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    updateValues.push(userId);
    await db.execute(
      `UPDATE user SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新基础信息失败:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: 'QQ号或微信号已被使用' });
    } else {
      res.status(500).json({ success: false, message: '更新失败', error: error.message });
    }
  } finally {
    if (db) await db.end();
  }
});

// 更新笔名
router.put('/:userId/pen-name', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const { pen_name } = req.body;
    db = await mysql.createConnection(dbConfig);

    if (pen_name === undefined || pen_name === null) {
      return res.status(400).json({ success: false, message: '笔名不能为空' });
    }

    // 去除首尾空格
    const trimmedPenName = pen_name.trim();

    if (trimmedPenName === '') {
      return res.status(400).json({ success: false, message: '笔名不能为空' });
    }

    // 检查笔名是否已被其他用户使用
    const [existing] = await db.execute(
      'SELECT id FROM user WHERE pen_name = ? AND id != ?',
      [trimmedPenName, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: '该笔名已被使用，请选择其他笔名' });
    }

    // 更新笔名
    await db.execute(
      'UPDATE user SET pen_name = ? WHERE id = ?',
      [trimmedPenName, userId]
    );

    res.json({ success: true, message: '笔名更新成功', data: { pen_name: trimmedPenName } });
  } catch (error) {
    console.error('更新笔名失败:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: '该笔名已被使用，请选择其他笔名' });
    } else {
      res.status(500).json({ success: false, message: '更新笔名失败', error: error.message });
    }
  } finally {
    if (db) await db.end();
  }
});

// ==================== 收货地址 ====================

// 获取收货地址列表
router.get('/:userId/addresses', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    db = await mysql.createConnection(dbConfig);

    const [addresses] = await db.execute(
      'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [userId]
    );

    res.json({ success: true, data: addresses });
  } catch (error) {
    console.error('获取地址列表失败:', error);
    res.status(500).json({ success: false, message: '获取地址列表失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 添加收货地址
router.post('/:userId/addresses', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const { address_details, recipient_name, recipient_phone, is_default } = req.body;
    db = await mysql.createConnection(dbConfig);

    // 如果设置为默认地址，先取消其他默认地址
    if (is_default) {
      await db.execute(
        'UPDATE user_addresses SET is_default = 0 WHERE user_id = ?',
        [userId]
      );
    }

    const [result] = await db.execute(
      `INSERT INTO user_addresses (user_id, address_details, recipient_name, recipient_phone, is_default)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, address_details, recipient_name || null, recipient_phone || null, is_default ? 1 : 0]
    );

    res.json({ success: true, message: '地址添加成功', data: { address_id: result.insertId } });
  } catch (error) {
    console.error('添加地址失败:', error);
    res.status(500).json({ success: false, message: '添加地址失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 更新收货地址
router.put('/:userId/addresses/:addressId', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const addressId = parseInt(req.params.addressId);
    const { address_details, recipient_name, recipient_phone, is_default } = req.body;
    db = await mysql.createConnection(dbConfig);

    // 如果设置为默认地址，先取消其他默认地址
    if (is_default) {
      await db.execute(
        'UPDATE user_addresses SET is_default = 0 WHERE user_id = ? AND address_id != ?',
        [userId, addressId]
      );
    }

    const updateFields = [];
    const updateValues = [];

    if (address_details !== undefined) {
      updateFields.push('address_details = ?');
      updateValues.push(address_details);
    }
    if (recipient_name !== undefined) {
      updateFields.push('recipient_name = ?');
      updateValues.push(recipient_name);
    }
    if (recipient_phone !== undefined) {
      updateFields.push('recipient_phone = ?');
      updateValues.push(recipient_phone);
    }
    if (is_default !== undefined) {
      updateFields.push('is_default = ?');
      updateValues.push(is_default ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    updateValues.push(userId, addressId);
    await db.execute(
      `UPDATE user_addresses SET ${updateFields.join(', ')} WHERE user_id = ? AND address_id = ?`,
      updateValues
    );

    res.json({ success: true, message: '地址更新成功' });
  } catch (error) {
    console.error('更新地址失败:', error);
    res.status(500).json({ success: false, message: '更新地址失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 删除收货地址
router.delete('/:userId/addresses/:addressId', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const addressId = parseInt(req.params.addressId);
    db = await mysql.createConnection(dbConfig);

    await db.execute(
      'DELETE FROM user_addresses WHERE user_id = ? AND address_id = ?',
      [userId, addressId]
    );

    res.json({ success: true, message: '地址删除成功' });
  } catch (error) {
    console.error('删除地址失败:', error);
    res.status(500).json({ success: false, message: '删除地址失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 实名认证 ====================

// 获取实名认证信息
router.get('/:userId/identity', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    db = await mysql.createConnection(dbConfig);

    const [verifications] = await db.execute(
      'SELECT * FROM user_identity_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (verifications.length === 0) {
      return res.json({ success: true, data: null });
    }

    const verification = verifications[0];
    // 保存原始的加密身份证号（用于解密）
    const originalIdCardNumber = verification.id_card_number;
    
    // 使用存储的脱敏身份证号，如果没有则显示提示
    verification.id_card_number = verification.masked_id_card || 
      (originalIdCardNumber && originalIdCardNumber.includes(':') 
        ? '已加密（无法显示）' 
        : (originalIdCardNumber ? maskIdCard(originalIdCardNumber) : null));
    
    // 真实的身份证号（解密），用于编辑
    verification.id_card_number_raw = originalIdCardNumber && originalIdCardNumber.includes(':')
      ? (() => {
          try {
            return decrypt(originalIdCardNumber);
          } catch (error) {
            console.error('解密身份证号失败:', error);
            return null;
          }
        })()
      : (originalIdCardNumber || null);

    res.json({ success: true, data: verification });
  } catch (error) {
    console.error('获取实名认证信息失败:', error);
    res.status(500).json({ success: false, message: '获取实名认证信息失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 提交实名认证
router.post('/:userId/identity', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const { id_card_number, real_name } = req.body;
    db = await mysql.createConnection(dbConfig);

    if (!id_card_number || !real_name) {
      return res.status(400).json({ success: false, message: '身份证号和真实姓名不能为空' });
    }

    // 加密存储身份证号
    const encryptedIdCard = encrypt(id_card_number);
    const maskedIdCard = maskIdCard(id_card_number);

    // 检查是否已有认证记录（允许修改pending状态的记录）
    const [existing] = await db.execute(
      'SELECT * FROM user_identity_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (existing.length > 0) {
      const existingVerification = existing[0];
      // 如果已有verified状态的记录，则不允许修改
      if (existingVerification.verification_status === 'verified') {
        return res.status(400).json({ success: false, message: '您已经完成实名认证，无法修改' });
      }
      // 如果是pending状态，则更新记录
      if (existingVerification.verification_status === 'pending') {
        await db.execute(
          `UPDATE user_identity_verifications 
           SET id_card_number = ?, masked_id_card = ?, real_name = ?, updated_at = NOW()
           WHERE verification_id = ?`,
          [encryptedIdCard, maskedIdCard, real_name, existingVerification.verification_id]
        );
        res.json({ success: true, message: '实名认证信息已更新', data: { masked_id_card: maskedIdCard } });
        return;
      }
    }

    // 创建新的认证记录（同时保存加密和脱敏的身份证号）
    // 设置为已提交状态
    await db.execute(
      `INSERT INTO user_identity_verifications (user_id, id_card_number, masked_id_card, real_name, verification_status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, encryptedIdCard, maskedIdCard, real_name]
    );

    // 更新user表的认证状态（已提交）
    await db.execute(
      'UPDATE user SET is_real_name_verified = 0 WHERE id = ?',
      [userId]
    );

    res.json({ success: true, message: '实名认证信息已提交', data: { masked_id_card: maskedIdCard } });
  } catch (error) {
    console.error('提交实名认证失败:', error);
    res.status(500).json({ success: false, message: '提交实名认证失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 银行卡绑定 ====================

// 获取银行卡绑定列表
router.get('/:userId/bank-cards', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    db = await mysql.createConnection(dbConfig);

    const [bankCards] = await db.execute(
      'SELECT * FROM user_bank_card_bindings WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC',
      [userId]
    );

    // 脱敏处理
    // 注意：full_card_number 是加密后的字符串，不能直接脱敏
    // 应该使用已存储的 masked_card_number，如果没有则返回提示
    const maskedCards = bankCards.map(card => ({
      ...card,
      masked_card_number: card.masked_card_number || '已加密（无法显示）',
      // 不返回加密的完整卡号
      full_card_number: undefined,
      // 返回解密的银行卡号，用于编辑
      full_card_number_raw: card.full_card_number && card.full_card_number.includes(':')
        ? (() => {
            try {
              return decrypt(card.full_card_number);
            } catch (error) {
              console.error('解密银行卡号失败:', error);
              return null;
            }
          })()
        : null
    }));

    res.json({ success: true, data: maskedCards });
  } catch (error) {
    console.error('获取银行卡列表失败:', error);
    res.status(500).json({ success: false, message: '获取银行卡列表失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 添加银行卡绑定
router.post('/:userId/bank-cards', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const { platform_name, full_card_number, bank_name, cardholder_name } = req.body;
    db = await mysql.createConnection(dbConfig);

    if (!platform_name || !full_card_number) {
      return res.status(400).json({ success: false, message: '平台名称和卡号不能为空' });
    }

    // 检查该平台是否已绑定
    const [existing] = await db.execute(
      'SELECT * FROM user_bank_card_bindings WHERE user_id = ? AND platform_name = ? AND is_active = 1',
      [userId, platform_name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: '该平台已绑定银行卡，请先更换' });
    }

    // 加密存储完整卡号
    const encryptedCardNumber = encrypt(full_card_number);
    const maskedCardNumber = maskCardNumber(full_card_number);

    // 插入新绑定
    await db.execute(
      `INSERT INTO user_bank_card_bindings 
       (user_id, platform_name, masked_card_number, full_card_number, bank_name, cardholder_name, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [userId, platform_name, maskedCardNumber, encryptedCardNumber, bank_name || null, cardholder_name || null]
    );

    res.json({ success: true, message: '银行卡绑定成功', data: { masked_card_number: maskedCardNumber } });
  } catch (error) {
    console.error('绑定银行卡失败:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: '该平台已绑定银行卡' });
    } else {
      res.status(500).json({ success: false, message: '绑定银行卡失败', error: error.message });
    }
  } finally {
    if (db) await db.end();
  }
});

// 更换银行卡
router.put('/:userId/bank-cards/:bindingId', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const bindingId = parseInt(req.params.bindingId);
    const { full_card_number, bank_name, cardholder_name } = req.body;
    db = await mysql.createConnection(dbConfig);

    // 获取旧卡信息（用于记录变更日志和对比）
    const [oldCard] = await db.execute(
      'SELECT platform_name, masked_card_number, full_card_number, bank_name, cardholder_name FROM user_bank_card_bindings WHERE binding_id = ? AND user_id = ?',
      [bindingId, userId]
    );

    if (oldCard.length === 0) {
      return res.status(404).json({ success: false, message: '银行卡绑定不存在' });
    }

    const oldCardData = oldCard[0];

    // 检查是否有变化
    let hasChanges = false;
    const changes = [];

    // 检查卡号变化
    if (full_card_number) {
      // 解密旧卡号进行对比
      let oldCardNumber = null;
      if (oldCardData.full_card_number && oldCardData.full_card_number.includes(':')) {
        try {
          oldCardNumber = decrypt(oldCardData.full_card_number);
        } catch (error) {
          console.error('解密旧卡号失败:', error);
        }
      }
      if (oldCardNumber !== full_card_number) {
        hasChanges = true;
        changes.push('卡号');
      }
    }

    // 检查银行名称变化
    if (bank_name !== undefined && bank_name !== oldCardData.bank_name) {
      hasChanges = true;
      changes.push('银行名称');
    }

    // 检查持卡人姓名变化
    if (cardholder_name !== undefined && cardholder_name !== oldCardData.cardholder_name) {
      hasChanges = true;
      changes.push('持卡人姓名');
    }

    if (!hasChanges) {
      return res.status(400).json({ success: false, message: '银行卡信息没有更改，无需保存' });
    }

    // 加密新卡号
    const encryptedCardNumber = full_card_number ? encrypt(full_card_number) : oldCardData.full_card_number;
    const maskedCardNumber = full_card_number ? maskCardNumber(full_card_number) : oldCardData.masked_card_number;

    // 更新银行卡
    const updateFields = [];
    const updateValues = [];

    if (full_card_number) {
      updateFields.push('full_card_number = ?');
      updateValues.push(encryptedCardNumber);
      updateFields.push('masked_card_number = ?');
      updateValues.push(maskedCardNumber);
    }
    if (bank_name !== undefined) {
      updateFields.push('bank_name = ?');
      updateValues.push(bank_name);
    }
    if (cardholder_name !== undefined) {
      updateFields.push('cardholder_name = ?');
      updateValues.push(cardholder_name);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    updateValues.push(userId, bindingId);
    await db.execute(
      `UPDATE user_bank_card_bindings SET ${updateFields.join(', ')} WHERE user_id = ? AND binding_id = ?`,
      updateValues
    );

    // 记录变更日志（保存完整的新旧银行卡信息）
    await db.execute(
      `INSERT INTO user_bank_card_change_logs 
       (user_id, platform_name, 
        old_masked_card_number, old_full_card_number, old_bank_name, old_cardholder_name,
        new_masked_card_number, new_full_card_number, new_bank_name, new_cardholder_name,
        change_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        oldCardData.platform_name,
        oldCardData.masked_card_number, 
        oldCardData.full_card_number, 
        oldCardData.bank_name || null, 
        oldCardData.cardholder_name || null,
        maskedCardNumber, 
        encryptedCardNumber, 
        bank_name !== undefined ? bank_name : oldCardData.bank_name || null, 
        cardholder_name !== undefined ? cardholder_name : oldCardData.cardholder_name || null,
        '用户更换银行卡'
      ]
    );

    res.json({ success: true, message: '银行卡更换成功', data: { masked_card_number: maskedCardNumber } });
  } catch (error) {
    console.error('更换银行卡失败:', error);
    res.status(500).json({ success: false, message: '更换银行卡失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 删除银行卡绑定
router.delete('/:userId/bank-cards/:bindingId', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const bindingId = parseInt(req.params.bindingId);
    db = await mysql.createConnection(dbConfig);

    // 软删除（设置为非激活）
    await db.execute(
      'UPDATE user_bank_card_bindings SET is_active = 0 WHERE user_id = ? AND binding_id = ?',
      [userId, bindingId]
    );

    res.json({ success: true, message: '银行卡解绑成功' });
  } catch (error) {
    console.error('解绑银行卡失败:', error);
    res.status(500).json({ success: false, message: '解绑银行卡失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 获取银行卡变更记录
router.get('/:userId/bank-cards/change-logs', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    db = await mysql.createConnection(dbConfig);

    const [logs] = await db.execute(
      `SELECT log_id, user_id, platform_name,
       old_masked_card_number, old_full_card_number, old_bank_name, old_cardholder_name,
       new_masked_card_number, new_full_card_number, new_bank_name, new_cardholder_name,
       change_reason, changed_at
       FROM user_bank_card_change_logs 
       WHERE user_id = ? 
       ORDER BY changed_at DESC 
       LIMIT 50`,
      [userId]
    );

    // 处理数据，解密卡号用于显示（如果需要）
    const processedLogs = logs.map(log => {
      // 解密旧卡号（用于设为当前收款银行时填充）
      let oldCardNumberRaw = null;
      if (log.old_full_card_number) {
        if (log.old_full_card_number.includes(':')) {
          // 加密的数据，需要解密
          try {
            oldCardNumberRaw = decrypt(log.old_full_card_number);
          } catch (error) {
            console.error('解密旧卡号失败:', error);
            oldCardNumberRaw = null;
          }
        } else {
          // 未加密的数据，直接使用
          oldCardNumberRaw = log.old_full_card_number;
        }
      }

      // 解密新卡号（用于设为当前收款银行时填充）
      let newCardNumberRaw = null;
      if (log.new_full_card_number) {
        if (log.new_full_card_number.includes(':')) {
          // 加密的数据，需要解密
          try {
            newCardNumberRaw = decrypt(log.new_full_card_number);
          } catch (error) {
            console.error('解密新卡号失败:', error);
            newCardNumberRaw = null;
          }
        } else {
          // 未加密的数据，直接使用
          newCardNumberRaw = log.new_full_card_number;
        }
      }

      return {
        ...log,
        old_card_number_raw: oldCardNumberRaw,
        new_card_number_raw: newCardNumberRaw
      };
    });

    res.json({ success: true, data: processedLogs });
  } catch (error) {
    console.error('获取变更记录失败:', error);
    res.status(500).json({ success: false, message: '获取变更记录失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 账号安全 ====================

// 更新手机号
router.put('/:userId/phone', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const { phone_number, phone_country_code } = req.body;
    db = await mysql.createConnection(dbConfig);

    // 验证：不允许存储脱敏的手机号（包含****）
    if (phone_number && phone_number.includes('****')) {
      return res.status(400).json({ success: false, message: '请输入真实的手机号码，不能包含脱敏字符' });
    }

    // 验证国家区号
    const countryCode = phone_country_code || '+86';
    if (!countryCode.startsWith('+')) {
      return res.status(400).json({ success: false, message: '国家区号格式不正确，应以+开头' });
    }

    // 存储真实的手机号码和国家区号（不加密，不脱敏）
    const updateFields = ['phone_number = ?', 'phone_country_code = ?'];
    const updateValues = [phone_number, countryCode];
    
    await db.execute(
      `UPDATE user SET ${updateFields.join(', ')} WHERE id = ?`,
      [...updateValues, userId]
    );

    res.json({ success: true, message: '手机号更新成功' });
  } catch (error) {
    console.error('更新手机号失败:', error);
    res.status(500).json({ success: false, message: '更新手机号失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// ==================== 用户设置 ====================

// 获取用户设置
router.get('/:userId/settings', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    db = await mysql.createConnection(dbConfig);

    const [users] = await db.execute(
      'SELECT settings_json FROM user WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    let settings = {};
    if (users[0].settings_json) {
      try {
        settings = typeof users[0].settings_json === 'string' 
          ? JSON.parse(users[0].settings_json) 
          : users[0].settings_json;
      } catch (error) {
        console.error('解析settings_json失败:', error);
        settings = {};
      }
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('获取用户设置失败:', error);
    res.status(500).json({ success: false, message: '获取用户设置失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

// 更新用户设置
router.put('/:userId/settings', async (req, res) => {
  let db;
  try {
    const userId = parseInt(req.params.userId);
    const { auto_logout_on_browser_close } = req.body;
    db = await mysql.createConnection(dbConfig);

    // 获取现有设置
    const [users] = await db.execute(
      'SELECT settings_json FROM user WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 解析现有设置
    let settings = {};
    if (users[0].settings_json) {
      try {
        settings = typeof users[0].settings_json === 'string' 
          ? JSON.parse(users[0].settings_json) 
          : users[0].settings_json;
      } catch (error) {
        console.error('解析现有settings_json失败:', error);
        settings = {};
      }
    }

    // 更新设置
    if (auto_logout_on_browser_close !== undefined) {
      settings.auto_logout_on_browser_close = Boolean(auto_logout_on_browser_close);
    }

    // 保存到数据库
    await db.execute(
      'UPDATE user SET settings_json = ? WHERE id = ?',
      [JSON.stringify(settings), userId]
    );

    res.json({ success: true, message: '设置更新成功', data: settings });
  } catch (error) {
    console.error('更新用户设置失败:', error);
    res.status(500).json({ success: false, message: '更新用户设置失败', error: error.message });
  } finally {
    if (db) await db.end();
  }
});

module.exports = router;


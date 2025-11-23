const mysql = require('mysql2/promise');

class KarmaPaymentService {
  constructor() {
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'kongfuworld'
    });
  }

  // 处理Karma支付成功
  async handleKarmaPaymentSuccess(userId, packageId, amount, paymentMethod, paymentRecordId, transactionId = null) {
    try {
      console.log(`[Karma支付处理] 开始处理支付 - 用户: ${userId}, 套餐: ${packageId}, 金额: $${amount}, paymentRecordId: ${paymentRecordId}, transactionId: ${transactionId}`);
      
      // 获取套餐信息
      const [packages] = await this.db.execute(
        'SELECT * FROM karma_packages WHERE id = ? AND is_active = 1',
        [packageId]
      );

      if (packages.length === 0) {
        throw new Error('套餐不存在或已停用');
      }

      const packageInfo = packages[0];
      
      // 获取用户当前余额
      const [users] = await this.db.execute(
        'SELECT golden_karma FROM user WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        throw new Error('用户不存在');
      }

      const currentBalance = users[0].golden_karma || 0;
      const totalKarma = packageInfo.karma_amount + packageInfo.bonus_karma;
      const newBalance = currentBalance + totalKarma;

      // 使用连接池的事务处理
      const connection = await this.db.getConnection();
      
      try {
        await connection.beginTransaction();

        // 更新用户Golden Karma余额
        await connection.execute(
          'UPDATE user SET golden_karma = ? WHERE id = ?',
          [newBalance, userId]
        );

        // 记录交易 - 使用prepared statement
        await connection.execute(
          `INSERT INTO user_karma_transactions 
           (user_id, transaction_type, karma_amount, karma_type, payment_method, 
            description, reason, balance_before, balance_after, status, amount_paid, currency, payment_record_id, transaction_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId, 'purchase', totalKarma, packageInfo.karma_type, paymentMethod,
            `购买${packageInfo.package_name}`, 'Karma购买', currentBalance, newBalance,
            'completed', amount, packageInfo.currency, paymentRecordId, transactionId  // 使用实际支付金额和Transaction ID
          ]
        );

        await connection.commit();
        
        console.log(`[Karma支付处理] 成功 - 用户 ${userId} 获得 ${totalKarma} Karma，余额从 ${currentBalance} 增加到 ${newBalance}`);
        console.log(`[Karma支付处理] 交易记录已保存 - paymentRecordId: ${paymentRecordId}, transactionId: ${transactionId}`);
        
        return {
          success: true,
          data: {
            packageName: packageInfo.package_name,
            karmaAmount: totalKarma,
            newBalance: newBalance,
            bonusKarma: packageInfo.bonus_karma
          }
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('[Karma支付处理] 失败:', error);
      throw error;
    }
  }

  // 创建Karma支付记录
  async createKarmaPaymentRecord(userId, packageId, amount, paymentMethod, orderId = null) {
    try {
      const [packages] = await this.db.execute(
        'SELECT * FROM karma_packages WHERE id = ? AND is_active = 1',
        [packageId]
      );

      if (packages.length === 0) {
        throw new Error('套餐不存在');
      }

      const packageInfo = packages[0];
      
      // 创建支付记录，包含订单ID（PayPal或Stripe）
      let description;
      if (orderId) {
        if (paymentMethod === 'paypal') {
          description = `Karma购买-${packageInfo.package_name}-PayPal:${orderId}`;
        } else if (paymentMethod === 'stripe') {
          description = `Karma购买-${packageInfo.package_name}-Stripe:${orderId}`;
        } else {
          description = `Karma购买-${packageInfo.package_name}-${orderId}`;
        }
      } else {
        description = `Karma购买-${packageInfo.package_name}`;
      }
      
      console.log(`[Karma支付记录创建] 创建记录 - description: ${description}`);
      
      const [result] = await this.db.execute(`
        INSERT INTO payment_record 
        (user_id, amount, payment_method, status, description, type, package_id, created_at)
        VALUES (${userId}, ${amount}, '${paymentMethod}', 'pending', 
                '${description}', 'karma_reward', ${packageId}, NOW())
      `);

      return result.insertId;
    } catch (error) {
      console.error('[Karma支付记录] 创建失败:', error);
      throw error;
    }
  }
}

module.exports = KarmaPaymentService;

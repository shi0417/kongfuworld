// 创建Key变动记录表
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kongfuworld',
  charset: 'utf8mb4'
};

async function createKeyTransactionTable() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    
    console.log('\n🔑 创建Key变动记录表\n');
    
    // 创建key_transaction表
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS key_transaction (
        id int PRIMARY KEY AUTO_INCREMENT,
        user_id int NOT NULL,
        transaction_type enum('checkin', 'mission', 'unlock', 'purchase', 'refund', 'admin') NOT NULL,
        amount int NOT NULL COMMENT '变动数量，正数为增加，负数为减少',
        balance_before int NOT NULL COMMENT '变动前余额',
        balance_after int NOT NULL COMMENT '变动后余额',
        reference_id int NULL COMMENT '关联ID（如任务ID、章节ID等）',
        reference_type varchar(50) NULL COMMENT '关联类型（mission, chapter, checkin等）',
        description varchar(255) NULL COMMENT '交易描述',
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_transaction_type (transaction_type),
        INDEX idx_created_at (created_at),
        INDEX idx_reference (reference_id, reference_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await db.execute(createTableSQL);
    console.log('✅ key_transaction表创建成功');
    
    // 查看表结构
    const [columns] = await db.execute(`DESCRIBE key_transaction`);
    console.log('\n📊 表结构:');
    columns.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Default ? `DEFAULT ${column.Default}` : ''} ${column.Comment ? `COMMENT '${column.Comment}'` : ''}`);
    });
    
    // 创建Key变动记录的辅助函数
    const helperFunction = `
      -- 创建记录Key变动的存储过程
      DELIMITER //
      CREATE PROCEDURE IF NOT EXISTS RecordKeyTransaction(
        IN p_user_id INT,
        IN p_transaction_type VARCHAR(20),
        IN p_amount INT,
        IN p_reference_id INT,
        IN p_reference_type VARCHAR(50),
        IN p_description VARCHAR(255)
      )
      BEGIN
        DECLARE v_balance_before INT DEFAULT 0;
        DECLARE v_balance_after INT DEFAULT 0;
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
          ROLLBACK;
          RESIGNAL;
        END;
        
        START TRANSACTION;
        
        -- 获取当前余额
        SELECT points INTO v_balance_before FROM user WHERE id = p_user_id;
        
        -- 计算变动后余额
        SET v_balance_after = v_balance_before + p_amount;
        
        -- 检查余额是否足够（如果是减少）
        IF p_amount < 0 AND v_balance_after < 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '余额不足';
        END IF;
        
        -- 更新用户余额
        UPDATE user SET points = v_balance_after WHERE id = p_user_id;
        
        -- 记录变动
        INSERT INTO key_transaction (
          user_id, transaction_type, amount, balance_before, balance_after,
          reference_id, reference_type, description
        ) VALUES (
          p_user_id, p_transaction_type, p_amount, v_balance_before, v_balance_after,
          p_reference_id, p_reference_type, p_description
        );
        
        COMMIT;
      END //
      DELIMITER ;
    `;
    
    await db.execute(helperFunction);
    console.log('✅ 存储过程创建成功');
    
    // 创建查询用户Key变动的视图
    const createViewSQL = `
      CREATE OR REPLACE VIEW user_key_transactions AS
      SELECT 
        kt.*,
        u.username,
        CASE 
          WHEN kt.transaction_type = 'checkin' THEN CONCAT('签到奖励: +', kt.amount, ' keys')
          WHEN kt.transaction_type = 'mission' THEN CONCAT('任务奖励: +', kt.amount, ' keys')
          WHEN kt.transaction_type = 'unlock' THEN CONCAT('解锁章节: -', ABS(kt.amount), ' keys')
          WHEN kt.transaction_type = 'purchase' THEN CONCAT('购买获得: +', kt.amount, ' keys')
          WHEN kt.transaction_type = 'refund' THEN CONCAT('退款: +', kt.amount, ' keys')
          ELSE CONCAT('其他: ', kt.amount > 0 ? '+' : '', kt.amount, ' keys')
        END as transaction_description
      FROM key_transaction kt
      JOIN user u ON kt.user_id = u.id
      ORDER BY kt.created_at DESC
    `;
    
    await db.execute(createViewSQL);
    console.log('✅ 视图创建成功');
    
    console.log('\n🎯 使用示例:');
    console.log('1. 记录签到奖励:');
    console.log('   CALL RecordKeyTransaction(1, "checkin", 5, NULL, "daily_checkin", "每日签到奖励");');
    console.log('2. 记录任务奖励:');
    console.log('   CALL RecordKeyTransaction(1, "mission", 2, 1, "mission", "完成任务奖励");');
    console.log('3. 记录解锁消费:');
    console.log('   CALL RecordKeyTransaction(1, "unlock", -1, 100, "chapter", "解锁章节消费");');
    
  } catch (error) {
    console.error('创建失败:', error);
  } finally {
    if (db) await db.end();
  }
}

// 运行创建
createKeyTransactionTable();

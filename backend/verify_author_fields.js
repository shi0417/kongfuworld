// 验证author相关字段是否已添加
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'kongfuworld',
  charset: 'utf8mb4'
};

async function verifyFields() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [columns] = await connection.execute('DESCRIBE user');
    
    console.log('\n📊 User表所有字段:');
    console.log('─'.repeat(60));
    columns.forEach(col => {
      const isNew = ['is_author', 'pen_name', 'bio', 'confirmed_email', 'social_links'].includes(col.Field);
      const marker = isNew ? '✨' : '  ';
      console.log(`${marker} ${col.Field.padEnd(20)} ${col.Type.padEnd(20)} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}  ${col.Default !== null ? `DEFAULT: ${col.Default}` : ''}`);
    });
    
    const newFields = columns.filter(c => 
      ['is_author', 'pen_name', 'bio', 'confirmed_email', 'social_links'].includes(c.Field)
    );
    
    console.log('\n✅ 新添加的字段:');
    newFields.forEach(f => {
      console.log(`   - ${f.Field}: ${f.Type}`);
    });
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

verifyFields().catch(console.error);


const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'kongfuworld'
});

db.query('DESCRIBE chapter', (err, results) => {
  if (err) {
    console.error('Error:', err);
    db.end();
    return;
  }
  
  console.log('Chapter table structure:');
  console.log('='.repeat(80));
  results.forEach(col => {
    console.log(`${col.Field.padEnd(20)} ${col.Type.padEnd(20)} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'.padEnd(8)} ${col.Default !== null ? `DEFAULT: ${col.Default}` : ''}`);
  });
  
  // 检查关键字段
  const requiredFields = ['is_premium', 'key_cost', 'word_count'];
  const existingFields = results.map(r => r.Field);
  console.log('\nRequired fields check:');
  requiredFields.forEach(field => {
    if (existingFields.includes(field)) {
      console.log(`✓ ${field} exists`);
    } else {
      console.log(`✗ ${field} MISSING!`);
    }
  });
  
  db.end();
});


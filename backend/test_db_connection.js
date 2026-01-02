const mysql = require('mysql2/promise');
require('./config/loadEnv.js');

console.log('Testing database connection...');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);

async function testConnection() {
  try {
    const isLocalhost = process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1';
    const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: sslConfig
    });
    
    console.log('✅ Database connection successful!');
    await connection.ping();
    console.log('✅ Database ping successful!');
    
    const [rows] = await connection.execute('SELECT 1 as result');
    console.log('✅ Query successful:', rows);
    
    await connection.end();
    console.log('✅ Connection closed successfully!');
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testConnection();

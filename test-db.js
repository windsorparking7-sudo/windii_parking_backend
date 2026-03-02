require('dotenv').config();
const mysql = require('mysql2/promise');

const testConnection = async () => {
  console.log('🔍 Testing database connection...');
  console.log('Config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ? '***' : '(empty)',
    database: process.env.DB_NAME
  });

  try {
    const config = {
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    };

    // Use socket if available, otherwise use TCP
    if (process.env.DB_SOCKET) {
      config.socketPath = process.env.DB_SOCKET;
      console.log('🔌 Using MySQL socket connection');
    } else {
      config.host = process.env.DB_HOST || 'localhost';
      config.port = parseInt(process.env.DB_PORT) || 3306;
      console.log('🌐 Using MySQL TCP connection');
    }

    const connection = await mysql.createConnection(config);

    console.log('✅ Connected to MySQL server');
    
    await connection.execute('SELECT 1');
    console.log('✅ Basic query successful');
    
    const dbName = process.env.DB_NAME || 'windii_parking';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' created/verified`);
    
    await connection.end();
    console.log('✅ Connection closed successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 MySQL is not running. Start MySQL server first.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Access denied. Check username/password.');
      console.log('Try these common passwords: "", "root", "password", "1234"');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Host not found. Check DB_HOST setting.');
    }
  }
};

testConnection();

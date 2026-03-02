require('dotenv').config();
const mysql = require('mysql2/promise');

const scanPorts = async () => {
  console.log('🔍 Scanning for MySQL on all common ports...');
  
  const ports = [3306, 3307, 3308, 3309, 3310, 8889, 8888, 8887, 8080, 8081];
  
  for (const port of ports) {
    try {
      console.log(`Testing port ${port}...`);
      
      const connection = await mysql.createConnection({
        host: 'localhost',
        port: port,
        user: 'root',
        password: process.env.DB_PASSWORD || '',
        connectTimeout: 2000 // 2 second timeout
      });
      
      console.log(`✅ Found MySQL on port ${port}!`);
      
      // Test basic query
      await connection.execute('SELECT 1');
      console.log('✅ Connection works!');
      
      await connection.end();
      
      console.log('\n🎯 Update your .env with:');
      console.log(`DB_PORT=${port}`);
      
      return port;
      
    } catch (error) {
      if (error.code !== 'ECONNREFUSED' && error.code !== 'ETIMEDOUT') {
        console.log(`❌ Port ${port}: ${error.message}`);
      }
    }
  }
  
  console.log('\n❌ MySQL not found on any common TCP port');
  console.log('💡 MySQL is probably configured for socket-only access');
};

scanPorts();

require('dotenv').config();
const mysql = require('mysql2/promise');

const testPorts = [3306, 8889, 8888, 8887, 8080, 3307];

const findMySQL = async () => {
  console.log('🔍 Searching for MySQL on common ports...');
  
  for (const port of testPorts) {
    try {
      console.log(`Testing port ${port}...`);
      
      const connection = await mysql.createConnection({
        host: 'localhost',
        port: port,
        user: 'root',
        password: ''
      });
      
      console.log(`✅ Found MySQL on port ${port} with empty password!`);
      
      // Test basic query
      await connection.execute('SELECT 1');
      console.log('✅ Connection works!');
      
      await connection.end();
      
      console.log('\n🎯 Use these settings in your .env:');
      console.log(`DB_HOST=localhost`);
      console.log(`DB_PORT=${port}`);
      console.log(`DB_USER=root`);
      console.log(`DB_PASSWORD=`);
      console.log(`DB_NAME=windii_parking`);
      
      return port;
      
    } catch (error) {
      // Try with password 'root'
      try {
        const connection = await mysql.createConnection({
          host: 'localhost',
          port: port,
          user: 'root',
          password: 'root'
        });
        
        console.log(`✅ Found MySQL on port ${port} with password 'root'!`);
        
        await connection.execute('SELECT 1');
        console.log('✅ Connection works!');
        
        await connection.end();
        
        console.log('\n🎯 Use these settings in your .env:');
        console.log(`DB_HOST=localhost`);
        console.log(`DB_PORT=${port}`);
        console.log(`DB_USER=root`);
        console.log(`DB_PASSWORD=root`);
        console.log(`DB_NAME=windii_parking`);
        
        return port;
        
      } catch (error2) {
        console.log(`❌ Port ${port}: ${error.message}`);
      }
    }
  }
  
  console.log('\n❌ MySQL not found on common ports');
  console.log('💡 Check your phpMyAdmin settings for the correct port');
};

findMySQL();

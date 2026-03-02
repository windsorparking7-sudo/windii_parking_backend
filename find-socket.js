require('dotenv').config();
const mysql = require('mysql2/promise');

const socketPaths = [
  '/tmp/mysql.sock',
  '/var/lib/mysql/mysql.sock',
  '/var/run/mysqld/mysqld.sock',
  '/usr/local/mysql/tmp/mysql.sock',
  '/Applications/MAMP/tmp/mysql/mysql.sock',
  '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock',
  '/opt/local/var/run/mysql8/mysqld.sock',
  '/opt/homebrew/var/run/mysql.sock'
];

const findSocket = async () => {
  console.log('🔍 Searching for MySQL socket...');
  
  for (const socketPath of socketPaths) {
    try {
      console.log(`Testing socket: ${socketPath}`);
      
      const connection = await mysql.createConnection({
        user: 'root',
        password: process.env.DB_PASSWORD || '',
        socketPath: socketPath
      });
      
      console.log(`✅ Found MySQL socket at: ${socketPath}`);
      
      // Test basic query
      await connection.execute('SELECT 1');
      console.log('✅ Connection works!');
      
      await connection.end();
      
      console.log('\n🎯 Update your .env with:');
      console.log(`DB_SOCKET=${socketPath}`);
      
      return socketPath;
      
    } catch (error) {
      console.log(`❌ ${socketPath}: ${error.message}`);
    }
  }
  
  console.log('\n❌ MySQL socket not found');
  console.log('💡 Try using TCP connection instead');
};

findSocket();

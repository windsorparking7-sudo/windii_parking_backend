const mysql = require('mysql2/promise');

let pool = null;

const connectDB = async () => {
  try {
    const config = {
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'windii_parking',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      // Add authentication method for remote connections
      authPlugins: {
        mysql_native_password: () => () => Buffer.alloc(0)
      },
      // Disable SSL for cPanel connections (often required)
      ssl: false,
      // Add timeout settings
      acquireTimeout: 60000,
      timeout: 60000
    };

    // Use socket if available, otherwise use TCP
    if (process.env.DB_SOCKET) {
      config.socketPath = process.env.DB_SOCKET;
      console.log('🔌 Using MySQL socket connection');
    } else {
      config.host = process.env.DB_HOST || 'localhost';
      config.port = parseInt(process.env.DB_PORT) || 3306;
      console.log('🌐 Using MySQL TCP connection to', config.host + ':' + config.port);
    }

    pool = mysql.createPool(config);

    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database connected successfully');
    connection.release();

    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDB first.');
  }
  return pool;
};

const query = async (sql, params) => {
  const pool = getPool();
  const [results] = await pool.execute(sql, params);
  return results;
};

const getConnection = async () => {
  const pool = getPool();
  return await pool.getConnection();
};

module.exports = {
  connectDB,
  getPool,
  query,
  getConnection
};

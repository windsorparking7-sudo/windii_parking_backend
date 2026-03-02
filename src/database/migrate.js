require('dotenv').config();
const mysql = require('mysql2/promise');

const migrate = async () => {
  let connection;
  
  try {
    // First, create database if it doesn't exist
    const config = {
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    };

    // Use socket if available, otherwise use TCP
    if (process.env.DB_SOCKET) {
      config.socketPath = process.env.DB_SOCKET;
    } else {
      config.host = process.env.DB_HOST || 'localhost';
      config.port = parseInt(process.env.DB_PORT) || 3306;
    }

    connection = await mysql.createConnection(config);

    const dbName = process.env.DB_NAME || 'windii_parking';
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);
    
    console.log(`✅ Database '${dbName}' ready`);

    // Create tables
    const tables = [
      // Super Admins table (for Admin Panel)
      `CREATE TABLE IF NOT EXISTS super_admins (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Companies table
      `CREATE TABLE IF NOT EXISTS companies (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        address TEXT NOT NULL,
        contact VARCHAR(50) NOT NULL,
        status ENUM('active', 'pending', 'inactive') DEFAULT 'pending',
        has_access BOOLEAN DEFAULT FALSE,
        access_granted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Company Users table (Admin & Managers for Company Portal)
      `CREATE TABLE IF NOT EXISTS company_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager') NOT NULL,
        location VARCHAR(255),
        phone VARCHAR(50),
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      )`,

      // Parking Sessions table
      `CREATE TABLE IF NOT EXISTS parking_sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_id INT NOT NULL,
        manager_id INT NOT NULL,
        token VARCHAR(50) UNIQUE NOT NULL,
        plate_number VARCHAR(50) NOT NULL,
        vehicle_model VARCHAR(100),
        vehicle_color VARCHAR(50),
        vehicle_type ENUM('car', 'suv', 'motorcycle', 'truck') DEFAULT 'car',
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        spot VARCHAR(20),
        entry_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        exit_time TIMESTAMP NULL,
        total_fee DECIMAL(10, 2) DEFAULT 0,
        status ENUM('open', 'closed', 'cancelled') DEFAULT 'open',
        whatsapp_sent BOOLEAN DEFAULT FALSE,
        qr_generated BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (manager_id) REFERENCES company_users(id) ON DELETE CASCADE
      )`,

      // Car Requests table
      `CREATE TABLE IF NOT EXISTS car_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_id INT NOT NULL,
        session_id INT NOT NULL,
        manager_id INT,
        token VARCHAR(50) NOT NULL,
        plate_number VARCHAR(50) NOT NULL,
        status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES parking_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (manager_id) REFERENCES company_users(id) ON DELETE SET NULL
      )`,

      // Revenue Records table (for analytics)
      `CREATE TABLE IF NOT EXISTS revenue_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_id INT NOT NULL,
        manager_id INT,
        session_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        recorded_at DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (manager_id) REFERENCES company_users(id) ON DELETE SET NULL,
        FOREIGN KEY (session_id) REFERENCES parking_sessions(id) ON DELETE CASCADE
      )`,

      // Parking Rates table
      `CREATE TABLE IF NOT EXISTS parking_rates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_id INT NOT NULL,
        vehicle_type ENUM('car', 'suv', 'motorcycle', 'truck') NOT NULL,
        rate_per_hour DECIMAL(10, 2) NOT NULL,
        minimum_charge DECIMAL(10, 2) DEFAULT 5.00,
        overnight_rate DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        UNIQUE KEY unique_company_vehicle (company_id, vehicle_type)
      )`,

      // Activity Logs table
      `CREATE TABLE IF NOT EXISTS activity_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_type ENUM('super_admin', 'company_user') NOT NULL,
        user_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        description TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await connection.query(table);
    }

    console.log('✅ All tables created successfully');

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_parking_sessions_company ON parking_sessions(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_parking_sessions_manager ON parking_sessions(manager_id)',
      'CREATE INDEX IF NOT EXISTS idx_parking_sessions_status ON parking_sessions(status)',
      'CREATE INDEX IF NOT EXISTS idx_parking_sessions_entry_time ON parking_sessions(entry_time)',
      'CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_car_requests_company ON car_requests(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_car_requests_status ON car_requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_revenue_records_company ON revenue_records(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_revenue_records_date ON revenue_records(recorded_at)'
    ];

    for (const index of indexes) {
      try {
        await connection.query(index);
      } catch (err) {
        // Index might already exist, that's ok
      }
    }

    console.log('✅ Indexes created successfully');
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

migrate();

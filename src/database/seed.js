require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const seed = async () => {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'windii_parking'
    });

    console.log('🌱 Starting database seeding...');

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const managerPassword = await bcrypt.hash('manager123', 10);

    // Seed Super Admin
    await connection.execute(
      `INSERT INTO super_admins (name, email, password, status) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      ['Super Admin', 'admin@windii.com', hashedPassword, 'active']
    );
    console.log('✅ Super Admin created (email: admin@windii.com, password: admin123)');

    // Seed Companies
    const companies = [
      ['ParkEasy Solutions', 'admin@parkeasy.com', '123 Main St, Downtown, NY 10001', '+1 (555) 123-4567', 'active', true],
      ['QuickPark Inc', 'contact@quickpark.com', '456 Business Ave, Midtown, NY 10002', '+1 (555) 987-6543', 'active', true],
      ['Metro Parking Co', 'info@metroparking.com', '789 Commerce Blvd, Uptown, NY 10003', '+1 (555) 456-7890', 'pending', false]
    ];

    for (const company of companies) {
      await connection.execute(
        `INSERT INTO companies (name, email, address, contact, status, has_access) 
         VALUES (?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        company
      );
    }
    console.log('✅ Companies seeded');

    // Get company IDs
    const [companyRows] = await connection.execute('SELECT id, email FROM companies');
    const companyMap = {};
    companyRows.forEach(c => companyMap[c.email] = c.id);

    // Seed Company Users (Admins and Managers)
    const companyUsers = [
      // ParkEasy Solutions users
      [companyMap['admin@parkeasy.com'], 'John Smith', 'john.smith@parkeasy.com', hashedPassword, 'admin', 'Main Office', '+1 (555) 111-2222'],
      [companyMap['admin@parkeasy.com'], 'Sarah Johnson', 'sarah.johnson@parkeasy.com', managerPassword, 'manager', 'Downtown', '+1 (555) 333-4444'],
      [companyMap['admin@parkeasy.com'], 'Mike Wilson', 'mike.wilson@parkeasy.com', managerPassword, 'manager', 'Airport', '+1 (555) 444-5555'],
      
      // QuickPark Inc users
      [companyMap['contact@quickpark.com'], 'Mike Davis', 'mike.davis@quickpark.com', hashedPassword, 'admin', 'HQ', '+1 (555) 555-6666'],
      [companyMap['contact@quickpark.com'], 'Lisa Chen', 'lisa.chen@quickpark.com', managerPassword, 'manager', 'Shopping Mall', '+1 (555) 777-8888'],
      [companyMap['contact@quickpark.com'], 'Emily Brown', 'emily.brown@quickpark.com', managerPassword, 'manager', 'City Center', '+1 (555) 888-9999'],
      
      // Metro Parking Co users
      [companyMap['info@metroparking.com'], 'Robert Wilson', 'robert.wilson@metroparking.com', hashedPassword, 'admin', 'Operations', '+1 (555) 999-0000']
    ];

    for (const user of companyUsers) {
      await connection.execute(
        `INSERT INTO company_users (company_id, name, email, password, role, location, phone) 
         VALUES (?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        user
      );
    }
    console.log('✅ Company users seeded');

    // Get user IDs
    const [userRows] = await connection.execute('SELECT id, email, company_id FROM company_users WHERE role = "manager"');
    
    // Seed Parking Sessions
    const generateToken = () => `TK${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    const parkingSessions = [];
    const now = new Date();
    
    // Generate sessions for each manager
    for (const user of userRows) {
      // Open sessions
      for (let i = 0; i < 2; i++) {
        const entryTime = new Date(now.getTime() - Math.random() * 4 * 60 * 60 * 1000);
        parkingSessions.push([
          user.company_id,
          user.id,
          generateToken(),
          `ABC${Math.floor(Math.random() * 1000)}`,
          ['Toyota Camry', 'Honda Civic', 'BMW X5', 'Tesla Model 3'][Math.floor(Math.random() * 4)],
          ['Red', 'Blue', 'Black', 'White', 'Silver'][Math.floor(Math.random() * 5)],
          ['car', 'suv', 'motorcycle'][Math.floor(Math.random() * 3)],
          `Customer ${Math.floor(Math.random() * 100)}`,
          `+1 (555) ${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
          `${String.fromCharCode(65 + Math.floor(Math.random() * 4))}-${Math.floor(Math.random() * 30 + 1)}`,
          entryTime,
          null,
          0,
          'open'
        ]);
      }
      
      // Closed sessions (historical)
      for (let i = 0; i < 5; i++) {
        const entryTime = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000);
        const exitTime = new Date(entryTime.getTime() + (Math.random() * 6 + 1) * 60 * 60 * 1000);
        const hours = Math.ceil((exitTime - entryTime) / (1000 * 60 * 60));
        const fee = Math.max(hours * 5, 5);
        
        parkingSessions.push([
          user.company_id,
          user.id,
          generateToken(),
          `XYZ${Math.floor(Math.random() * 1000)}`,
          ['Toyota Camry', 'Honda Civic', 'BMW X5', 'Tesla Model 3', 'Ford F-150'][Math.floor(Math.random() * 5)],
          ['Red', 'Blue', 'Black', 'White', 'Silver', 'Gray'][Math.floor(Math.random() * 6)],
          ['car', 'suv', 'motorcycle', 'truck'][Math.floor(Math.random() * 4)],
          `Customer ${Math.floor(Math.random() * 100)}`,
          `+1 (555) ${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
          `${String.fromCharCode(65 + Math.floor(Math.random() * 4))}-${Math.floor(Math.random() * 30 + 1)}`,
          entryTime,
          exitTime,
          fee,
          'closed'
        ]);
      }
    }

    for (const session of parkingSessions) {
      await connection.execute(
        `INSERT INTO parking_sessions 
         (company_id, manager_id, token, plate_number, vehicle_model, vehicle_color, vehicle_type, customer_name, customer_phone, spot, entry_time, exit_time, total_fee, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        session
      );
    }
    console.log('✅ Parking sessions seeded');

    // Seed Parking Rates
    const vehicleTypes = ['car', 'suv', 'motorcycle', 'truck'];
    const rates = [5.00, 7.00, 3.00, 8.00];
    
    for (const companyId of Object.values(companyMap)) {
      for (let i = 0; i < vehicleTypes.length; i++) {
        await connection.execute(
          `INSERT INTO parking_rates (company_id, vehicle_type, rate_per_hour, minimum_charge, overnight_rate) 
           VALUES (?, ?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE rate_per_hour = VALUES(rate_per_hour)`,
          [companyId, vehicleTypes[i], rates[i], 5.00, rates[i] * 10]
        );
      }
    }
    console.log('✅ Parking rates seeded');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Super Admin:');
    console.log('  Email: admin@windii.com');
    console.log('  Password: admin123');
    console.log('\nCompany Admin (ParkEasy):');
    console.log('  Email: john.smith@parkeasy.com');
    console.log('  Password: admin123');
    console.log('\nCompany Manager (ParkEasy):');
    console.log('  Email: sarah.johnson@parkeasy.com');
    console.log('  Password: manager123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

seed();

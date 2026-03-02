const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate, isSuperAdmin } = require('../middleware/auth');
const { registerCompanyValidator, idParamValidator } = require('../middleware/validators');
const { emitToAdmin, emitToCompany } = require('../socket');

const router = express.Router();

// Apply authentication and super admin check to all routes
router.use(authenticate, isSuperAdmin);

// Get all companies
router.get('/companies', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = 'SELECT * FROM companies WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await query(countSql, params);
    const total = countResult?.total || 0;

    // Add pagination
    sql += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

    const companies = await query(sql, params);

    res.json({
      success: true,
      data: {
        companies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch companies'
    });
  }
});

// Get single company details
router.get('/companies/:id', idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;

    const companies = await query('SELECT * FROM companies WHERE id = ?', [id]);

    if (companies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const company = companies[0];

    // Get managers
    const managers = await query(
      'SELECT id, name, email, role, location, phone, status, created_at FROM company_users WHERE company_id = ?',
      [id]
    );

    // Get live parking count
    const [liveParking] = await query(
      'SELECT COUNT(*) as count FROM parking_sessions WHERE company_id = ? AND status = ?',
      [id, 'open']
    );

    // Get total revenue
    const [revenue] = await query(
      'SELECT SUM(total_fee) as total FROM parking_sessions WHERE company_id = ? AND status = ?',
      [id, 'closed']
    );

    res.json({
      success: true,
      data: {
        ...company,
        managers,
        liveParkingCount: liveParking?.count || 0,
        totalRevenue: revenue?.total || 0
      }
    });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company'
    });
  }
});

// Register new company
router.post('/companies', registerCompanyValidator, async (req, res) => {
  try {
    const { name, email, address, contact } = req.body;

    // Check if email already exists
    const existing = await query('SELECT id FROM companies WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Company with this email already exists'
      });
    }

    const result = await query(
      'INSERT INTO companies (name, email, address, contact, status, has_access) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, address, contact, 'pending', false]
    );

    const newCompany = {
      id: result.insertId,
      name,
      email,
      address,
      contact,
      status: 'pending',
      has_access: false
    };

    // Emit to admin dashboard
    emitToAdmin('company-added', newCompany);

    res.status(201).json({
      success: true,
      message: 'Company registered successfully',
      data: newCompany
    });
  } catch (error) {
    console.error('Register company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register company'
    });
  }
});

// Update company
router.put('/companies/:id', idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, address, contact, status } = req.body;

    const companies = await query('SELECT * FROM companies WHERE id = ?', [id]);
    if (companies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== companies[0].email) {
      const existing = await query('SELECT id FROM companies WHERE email = ? AND id != ?', [email, id]);
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another company'
        });
      }
    }

    await query(
      'UPDATE companies SET name = COALESCE(?, name), email = COALESCE(?, email), address = COALESCE(?, address), contact = COALESCE(?, contact), status = COALESCE(?, status) WHERE id = ?',
      [name, email, address, contact, status, id]
    );

    const updatedCompany = await query('SELECT * FROM companies WHERE id = ?', [id]);

    emitToAdmin('company-updated', updatedCompany[0]);

    res.json({
      success: true,
      message: 'Company updated successfully',
      data: updatedCompany[0]
    });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update company'
    });
  }
});

// Grant access to company
router.post('/companies/:id/grant-access', idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminEmail, adminPassword } = req.body;

    const companies = await query('SELECT * FROM companies WHERE id = ?', [id]);
    if (companies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const company = companies[0];

    if (company.has_access) {
      return res.status(400).json({
        success: false,
        message: 'Company already has access'
      });
    }

    // Create company admin user if credentials provided
    if (adminEmail && adminPassword) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await query(
        'INSERT INTO company_users (company_id, name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [id, `${company.name} Admin`, adminEmail, hashedPassword, 'admin', 'active']
      );
    }

    await query(
      'UPDATE companies SET has_access = TRUE, status = ?, access_granted_at = NOW() WHERE id = ?',
      ['active', id]
    );

    emitToAdmin('company-access-granted', { companyId: id });

    res.json({
      success: true,
      message: 'Access granted successfully'
    });
  } catch (error) {
    console.error('Grant access error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to grant access'
    });
  }
});

// Revoke access from company
router.post('/companies/:id/revoke-access', idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE companies SET has_access = FALSE, status = ? WHERE id = ?',
      ['inactive', id]
    );

    emitToAdmin('company-access-revoked', { companyId: id });

    res.json({
      success: true,
      message: 'Access revoked successfully'
    });
  } catch (error) {
    console.error('Revoke access error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke access'
    });
  }
});

// Get company managers
router.get('/companies/:id/managers', idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;

    const managers = await query(
      'SELECT id, name, email, role, location, phone, status, created_at FROM company_users WHERE company_id = ?',
      [id]
    );

    res.json({
      success: true,
      data: managers
    });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch managers'
    });
  }
});

// Get company live parking
router.get('/companies/:id/live-parking', idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;

    const sessions = await query(
      `SELECT ps.*, cu.name as manager_name 
       FROM parking_sessions ps 
       LEFT JOIN company_users cu ON ps.manager_id = cu.id 
       WHERE ps.company_id = ? AND ps.status = ? 
       ORDER BY ps.entry_time DESC`,
      [id, 'open']
    );

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Get live parking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live parking'
    });
  }
});

// Get company parking history
router.get('/companies/:id/parking-history', idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT ps.*, cu.name as manager_name 
               FROM parking_sessions ps 
               LEFT JOIN company_users cu ON ps.manager_id = cu.id 
               WHERE ps.company_id = ? AND ps.status = ?`;
    const params = [id, 'closed'];

    if (startDate) {
      sql += ' AND DATE(ps.exit_time) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND DATE(ps.exit_time) <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY ps.exit_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const sessions = await query(sql, params);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Get parking history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parking history'
    });
  }
});

// Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [totalCompanies] = await query('SELECT COUNT(*) as count FROM companies');
    const [activeCompanies] = await query('SELECT COUNT(*) as count FROM companies WHERE status = ?', ['active']);
    const [pendingCompanies] = await query('SELECT COUNT(*) as count FROM companies WHERE status = ?', ['pending']);
    const [liveParking] = await query('SELECT COUNT(*) as count FROM parking_sessions WHERE status = ?', ['open']);
    const [totalRevenue] = await query('SELECT SUM(total_fee) as total FROM parking_sessions WHERE status = ?', ['closed']);

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const [todayRevenue] = await query(
      'SELECT SUM(total_fee) as total FROM parking_sessions WHERE status = ? AND DATE(exit_time) = ?',
      ['closed', today]
    );
    const [todaySessions] = await query(
      'SELECT COUNT(*) as count FROM parking_sessions WHERE DATE(entry_time) = ?',
      [today]
    );

    // Recent companies
    const recentCompanies = await query(
      'SELECT id, name, email, status, created_at FROM companies ORDER BY created_at DESC LIMIT 5'
    );

    res.json({
      success: true,
      data: {
        totalCompanies: totalCompanies?.count || 0,
        activeCompanies: activeCompanies?.count || 0,
        pendingCompanies: pendingCompanies?.count || 0,
        liveParking: liveParking?.count || 0,
        totalRevenue: totalRevenue?.total || 0,
        todayRevenue: todayRevenue?.total || 0,
        todaySessions: todaySessions?.count || 0,
        recentCompanies
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
});

module.exports = router;

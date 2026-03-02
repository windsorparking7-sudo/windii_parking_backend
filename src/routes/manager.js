const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate, isCompanyAdmin } = require('../middleware/auth');
const { addManagerValidator, idParamValidator } = require('../middleware/validators');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Get all managers (company users)
router.get('/', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, role, search } = req.query;

    let sql = 'SELECT id, name, email, role, location, phone, status, created_at FROM company_users WHERE company_id = ?';
    const params = [companyId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';

    const users = await query(sql, params);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch managers'
    });
  }
});

// Get single manager
router.get('/:id', idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const users = await query(
      'SELECT id, name, email, role, location, phone, status, created_at FROM company_users WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Manager not found'
      });
    }

    // Get manager stats
    const [totalSessions] = await query(
      'SELECT COUNT(*) as count FROM parking_sessions WHERE manager_id = ?',
      [id]
    );

    const [totalRevenue] = await query(
      'SELECT SUM(total_fee) as total FROM parking_sessions WHERE manager_id = ? AND status = ?',
      [id, 'closed']
    );

    const [openSessions] = await query(
      'SELECT COUNT(*) as count FROM parking_sessions WHERE manager_id = ? AND status = ?',
      [id, 'open']
    );

    res.json({
      success: true,
      data: {
        ...users[0],
        stats: {
          totalSessions: totalSessions?.count || 0,
          totalRevenue: totalRevenue?.total || 0,
          openSessions: openSessions?.count || 0
        }
      }
    });
  } catch (error) {
    console.error('Get manager error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch manager'
    });
  }
});

// Add new manager (admin only)
router.post('/', isCompanyAdmin, addManagerValidator, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { name, email, password, role = 'manager', location, phone } = req.body;

    // Check if email already exists
    const existing = await query('SELECT id FROM company_users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      'INSERT INTO company_users (company_id, name, email, password, role, location, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [companyId, name, email, hashedPassword, role, location, phone, 'active']
    );

    res.status(201).json({
      success: true,
      message: 'Manager created successfully',
      data: {
        id: result.insertId,
        name,
        email,
        role,
        location,
        phone,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Add manager error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create manager'
    });
  }
});

// Update manager (admin only)
router.put('/:id', isCompanyAdmin, idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { name, email, location, phone, role } = req.body;

    const users = await query(
      'SELECT * FROM company_users WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Manager not found'
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== users[0].email) {
      const existing = await query(
        'SELECT id FROM company_users WHERE email = ? AND id != ?',
        [email, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    await query(
      `UPDATE company_users 
       SET name = COALESCE(?, name), 
           email = COALESCE(?, email), 
           location = COALESCE(?, location), 
           phone = COALESCE(?, phone),
           role = COALESCE(?, role)
       WHERE id = ?`,
      [name, email, location, phone, role, id]
    );

    const updatedUser = await query(
      'SELECT id, name, email, role, location, phone, status, created_at FROM company_users WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Manager updated successfully',
      data: updatedUser[0]
    });
  } catch (error) {
    console.error('Update manager error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update manager'
    });
  }
});

// Update manager status (admin only)
router.patch('/:id/status', isCompanyAdmin, idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "active" or "inactive"'
      });
    }

    const users = await query(
      'SELECT * FROM company_users WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Manager not found'
      });
    }

    // Prevent deactivating the last admin
    if (users[0].role === 'admin' && status === 'inactive') {
      const [adminCount] = await query(
        'SELECT COUNT(*) as count FROM company_users WHERE company_id = ? AND role = ? AND status = ? AND id != ?',
        [companyId, 'admin', 'active', id]
      );
      
      if (adminCount.count === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last active admin'
        });
      }
    }

    await query(
      'UPDATE company_users SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({
      success: true,
      message: `Manager ${status === 'active' ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Update manager status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update manager status'
    });
  }
});

// Reset manager password (admin only)
router.post('/:id/reset-password', isCompanyAdmin, idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const users = await query(
      'SELECT * FROM company_users WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Manager not found'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await query(
      'UPDATE company_users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

// Get manager's parking sessions
router.get('/:id/sessions', idParamValidator, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Verify manager belongs to company
    const users = await query(
      'SELECT id FROM company_users WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Manager not found'
      });
    }

    let sql = 'SELECT * FROM parking_sessions WHERE manager_id = ?';
    const params = [id];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY entry_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const sessions = await query(sql, params);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Get manager sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch manager sessions'
    });
  }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { loginValidator } = require('../middleware/validators');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token
const generateToken = (user, userType) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      userType 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Super Admin Login (Admin Panel)
router.post('/admin/login', loginValidator, async (req, res) => {
  try {
    const { email, password } = req.body;

    const users = await query(
      'SELECT * FROM super_admins WHERE email = ? AND status = ?',
      [email, 'active']
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = generateToken(user, 'super_admin');

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_type, user_id, action, description, ip_address) VALUES (?, ?, ?, ?, ?)',
      ['super_admin', user.id, 'LOGIN', 'Super admin logged in', req.ip]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'super_admin'
        }
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Company User Login (Company Portal)
router.post('/company/login', loginValidator, async (req, res) => {
  try {
    const { email, password } = req.body;

    const users = await query(
      `SELECT u.*, c.name as company_name, c.has_access, c.status as company_status 
       FROM company_users u 
       JOIN companies c ON u.company_id = c.id 
       WHERE u.email = ? AND u.status = ?`,
      [email, 'active']
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Check if company has access
    if (!user.has_access) {
      return res.status(403).json({
        success: false,
        message: 'Company access not granted yet. Please contact administrator.'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = generateToken(user, 'company_user');

    // Log activity
    await query(
      'INSERT INTO activity_logs (user_type, user_id, action, description, ip_address) VALUES (?, ?, ?, ?, ?)',
      ['company_user', user.id, 'LOGIN', `${user.role} logged in`, req.ip]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          location: user.location,
          companyId: user.company_id,
          companyName: user.company_name
        }
      }
    });
  } catch (error) {
    console.error('Company login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'super_admin',
        userType: user.userType,
        ...(user.company_id && {
          companyId: user.company_id,
          companyName: user.company_name,
          location: user.location
        })
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
});

// Change password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const table = user.userType === 'super_admin' ? 'super_admins' : 'company_users';

    await query(
      `UPDATE ${table} SET password = ? WHERE id = ?`,
      [hashedPassword, user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// Logout (for activity logging)
router.post('/logout', authenticate, async (req, res) => {
  try {
    const user = req.user;

    await query(
      'INSERT INTO activity_logs (user_type, user_id, action, description, ip_address) VALUES (?, ?, ?, ?, ?)',
      [user.userType, user.id, 'LOGOUT', 'User logged out', req.ip]
    );

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

module.exports = router;

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    let user;
    if (decoded.userType === 'super_admin') {
      const users = await query(
        'SELECT * FROM super_admins WHERE id = ? AND status = ?',
        [decoded.id, 'active']
      );
      user = users[0];
      if (user) user.userType = 'super_admin';
    } else if (decoded.userType === 'company_user') {
      const users = await query(
        'SELECT u.*, c.id as company_id, c.name as company_name FROM company_users u JOIN companies c ON u.company_id = c.id WHERE u.id = ? AND u.status = ?',
        [decoded.id, 'active']
      );
      user = users[0];
      if (user) user.userType = 'company_user';
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Middleware to check if user is super admin
const isSuperAdmin = (req, res, next) => {
  if (req.user.userType !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super admin privileges required.'
    });
  }
  next();
};

// Middleware to check if user is company admin
const isCompanyAdmin = (req, res, next) => {
  if (req.user.userType !== 'company_user' || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Company admin privileges required.'
    });
  }
  next();
};

// Middleware to check if user belongs to a specific company
const belongsToCompany = (req, res, next) => {
  const companyId = req.params.companyId || req.body.companyId;
  
  if (req.user.userType === 'super_admin') {
    return next();
  }
  
  if (req.user.company_id !== parseInt(companyId)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not belong to this company.'
    });
  }
  next();
};

module.exports = {
  authenticate,
  isSuperAdmin,
  isCompanyAdmin,
  belongsToCompany
};

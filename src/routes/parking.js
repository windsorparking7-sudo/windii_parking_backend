const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { addParkingSessionValidator } = require('../middleware/validators');
const { emitToCompany, emitToManager } = require('../socket');

const router = express.Router();

// TEMP: Route without authentication for testing (must be before auth middleware)
router.patch('/test/requests/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'pending', 'bringing', 'arrived', 'completed'
    // TEMP: Hardcode company_id for testing
    const companyId = 1;

    if (!['requested', 'bringing', 'arrived', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const requests = await query(
      'SELECT * FROM car_requests WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Car request not found'
      });
    }

    const updateFields = ['status = ?'];
    const updateValues = [status];
    
    if (status === 'bringing') {
      updateFields.push('bringing_car_at = NOW()');
    } else if (status === 'arrived') {
      updateFields.push('car_arrived_at = NOW()');
    } else if (status === 'completed') {
      updateFields.push('completed_at = NOW()');
    }
    
    updateValues.push(id);

    await query(
      `UPDATE car_requests SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Car request status updated',
      data: { status }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update car request status'
    });
  }
});

// TEMP: Setup endpoint without authentication
router.post('/setup-columns', async (req, res) => {
  try {
    // Add missing columns - check if they exist first
    try {
      await query('ALTER TABLE car_requests ADD COLUMN bringing_car_at TIMESTAMP NULL');
    } catch (err) {
      // Column probably already exists
      console.log('bringing_car_at column may already exist');
    }
    
    try {
      await query('ALTER TABLE car_requests ADD COLUMN car_arrived_at TIMESTAMP NULL');
    } catch (err) {
      // Column probably already exists
      console.log('car_arrived_at column may already exist');
    }
    
    // Update the status column enum to support our new statuses
    try {
      await query("ALTER TABLE car_requests MODIFY COLUMN status ENUM('requested', 'bringing', 'arrived', 'completed', 'open', 'closed', 'cancelled') DEFAULT 'requested'");
    } catch (err) {
      console.log('Status column may already be updated or error occurred:', err.message);
    }
    
    res.json({
      success: true,
      message: 'Columns updated successfully'
    });
  } catch (error) {
    console.error('Setup columns error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update columns'
    });
  }
});

// TEMP: Get request by token without authentication
router.get('/test/requests/token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const requests = await query(
      `SELECT cr.*, ps.plate_number, ps.vehicle_model, ps.vehicle_color
       FROM car_requests cr 
       LEFT JOIN parking_sessions ps ON cr.session_id = ps.id 
       WHERE cr.token = ? 
       ORDER BY cr.id DESC 
       LIMIT 1`,
      [token]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Car request not found'
      });
    }

    res.json({
      success: true,
      data: requests[0]
    });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get car request'
    });
  }
});

// TEMP: Get all requests without authentication for debugging
router.get('/test/requests', async (req, res) => {
  try {
    const { status } = req.query;

    let sql = `SELECT cr.*, ps.vehicle_model, ps.vehicle_color, cu.name as manager_name 
               FROM car_requests cr 
               JOIN parking_sessions ps ON cr.session_id = ps.id 
               LEFT JOIN company_users cu ON cr.manager_id = cu.id 
               WHERE 1=1`;
    const params = [];

    if (status) {
      // Handle comma-separated statuses
      const statuses = status.split(',').map(s => s.trim());
      if (statuses.length > 1) {
        sql += ` AND cr.status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
      } else {
        sql += ' AND cr.status = ?';
        params.push(status);
      }
    }

    sql += ' ORDER BY cr.id DESC';

    console.log('TEST SQL:', sql);
    console.log('TEST Params:', params);

    const requests = await query(sql, params);

    console.log('TEST Found requests:', requests.length);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('TEST Get requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car requests'
    });
  }
});

// TEMP: Move authenticated requests endpoint here for testing
router.get('/auth-requests', async (req, res) => {
  try {
    // TEMP: Hardcode user info for testing
    const companyId = 1;
    const userId = 1;
    const isAdmin = true;
    const { status } = req.query;

    console.log('Fetching requests for company:', companyId, 'user:', userId, 'isAdmin:', isAdmin, 'status:', status);

    let sql = `SELECT cr.*, ps.vehicle_model, ps.vehicle_color, cu.name as manager_name 
               FROM car_requests cr 
               JOIN parking_sessions ps ON cr.session_id = ps.id 
               LEFT JOIN company_users cu ON cr.manager_id = cu.id 
               WHERE cr.company_id = ?`;
    const params = [companyId];

    if (!isAdmin) {
      sql += ' AND cr.manager_id = ?';
      params.push(userId);
    }

    if (status) {
      // Handle comma-separated statuses
      const statuses = status.split(',').map(s => s.trim());
      if (statuses.length > 1) {
        sql += ` AND cr.status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
      } else {
        sql += ' AND cr.status = ?';
        params.push(status);
      }
    }

    sql += ' ORDER BY cr.id DESC';

    console.log('SQL:', sql);
    console.log('Params:', params);

    const requests = await query(sql, params);

    console.log('Found requests:', requests.length);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car requests'
    });
  }
});

// PUBLIC ENDPOINTS (no authentication required) - MUST BE BEFORE router.use(authenticate)

// Test endpoint to verify deployment
router.get('/test-public', async (req, res) => {
  res.json({
    success: true,
    message: 'Public endpoints are working!',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to list recent tokens
router.get('/debug-tokens', async (req, res) => {
  try {
    const tokens = await query('SELECT id, token, plate_number, vehicle_model, entry_time FROM parking_sessions ORDER BY id DESC LIMIT 10');
    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    console.error('Debug tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tokens'
    });
  }
});

// Get session by token (public - for car details page)
router.get('/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('=== PUBLIC TOKEN DEBUG ===');
    console.log('Looking for token:', token);

    // First, let's see what tokens exist
    const allTokens = await query('SELECT token FROM parking_sessions ORDER BY id DESC LIMIT 10');
    console.log('Recent tokens in database:', allTokens.map(t => t.token));

    const sessions = await query(
      `SELECT ps.*, c.name as company_name, cu.name as manager_name, cu.phone as manager_phone
       FROM parking_sessions ps 
       JOIN companies c ON ps.company_id = c.id
       LEFT JOIN company_users cu ON ps.manager_id = cu.id 
       WHERE ps.token = ?`,
      [token]
    );

    console.log('Query result count:', sessions.length);

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const session = sessions[0];
    console.log('Found session:', session.token, session.plate_number);

    // Calculate current fee if still open
    let currentFee = session.total_fee;
    if (session.status === 'open') {
      currentFee = await calculateFee(
        session.company_id,
        session.vehicle_type,
        session.entry_time
      );
    }

    res.json({
      success: true,
      data: {
        ...session,
        currentFee
      }
    });
  } catch (error) {
    console.error('Get session by token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session'
    });
  }
});

// Get car request by token (public - for customer checking status)
router.get('/requests/token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const requests = await query(
      `SELECT cr.*, ps.plate_number, ps.vehicle_model, ps.vehicle_color
       FROM car_requests cr 
       LEFT JOIN parking_sessions ps ON cr.parking_session_id = ps.id 
       WHERE cr.token = ? 
       ORDER BY cr.id DESC 
       LIMIT 1`,
      [token]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Car request not found'
      });
    }

    res.json({
      success: true,
      data: requests[0]
    });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get car request'
    });
  }
});

// Create car request (public - for customers)
router.post('/requests', async (req, res) => {
  try {
    console.log('=== CREATE CAR REQUEST DEBUG ===');
    console.log('Request body:', req.body);
    
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    console.log('Looking for parking session with token:', token);

    // Get the parking session by token
    const sessions = await query(
      'SELECT id, company_id, manager_id FROM parking_sessions WHERE token = ?',
      [token]
    );

    console.log('Found sessions:', sessions.length);

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parking session not found'
      });
    }

    const session = sessions[0];
    console.log('Session found:', session);

    // Check if there's already an active car request for this token
    const existingRequests = await query(
      "SELECT id FROM car_requests WHERE token = ? AND status NOT IN ('completed', 'cancelled')",
      [token]
    );

    console.log('Existing requests:', existingRequests.length);

    if (existingRequests.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A car request is already in progress for this token'
      });
    }

    // Create new car request
    console.log('Creating car request with:', {
      token: token,
      parking_session_id: session.id,
      company_id: session.company_id,
      manager_id: session.manager_id
    });

    const result = await query(`
      INSERT INTO car_requests (token, parking_session_id, company_id, manager_id, status, requested_at)
      VALUES (?, ?, ?, ?, 'requested', NOW())
    `, [token, session.id, session.company_id, session.manager_id]);

    console.log('Car request created:', result);

    res.status(201).json({
      success: true,
      message: 'Car request submitted successfully',
      data: {
        id: result.insertId,
        token: token,
        status: 'requested'
      }
    });
  } catch (error) {
    console.error('Create car request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create car request'
    });
  }
});

// Apply authentication to all routes after this point
router.use(authenticate);

// Generate unique token
const generateToken = () => {
  return `TK${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
};

// Calculate parking fee
const calculateFee = async (companyId, vehicleType, entryTime, exitTime) => {
  const rates = await query(
    'SELECT * FROM parking_rates WHERE company_id = ? AND vehicle_type = ?',
    [companyId, vehicleType]
  );

  const rate = rates[0] || { rate_per_hour: 5, minimum_charge: 5 };
  
  const entry = new Date(entryTime);
  const exit = exitTime ? new Date(exitTime) : new Date();
  const hours = Math.ceil((exit.getTime() - entry.getTime()) / (1000 * 60 * 60));
  
  return Math.max(hours * rate.rate_per_hour, rate.minimum_charge);
};

// Get all sessions (with filters)
router.get('/sessions', async (req, res) => {
  try {
    console.log('=== GET SESSIONS DEBUG ===');
    console.log('User:', req.user);
    
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    console.log('Query params:', { companyId, userId, isAdmin, status, search, page, limit, offset });

    let sql = `SELECT ps.*, cu.name as manager_name 
               FROM parking_sessions ps 
               LEFT JOIN company_users cu ON ps.manager_id = cu.id 
               WHERE ps.company_id = ?`;
    const params = [companyId];

    // Managers only see their own sessions
    if (!isAdmin) {
      sql += ' AND ps.manager_id = ?';
      params.push(userId);
    }

    if (status) {
      sql += ' AND ps.status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (ps.plate_number LIKE ? OR ps.customer_name LIKE ? OR ps.token LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Get total count
    const countSql = sql.replace('SELECT ps.*, cu.name as manager_name', 'SELECT COUNT(*) as total');
    const [countResult] = await query(countSql.replace('LEFT JOIN company_users cu ON ps.manager_id = cu.id', ''), params);
    const total = countResult?.total || 0;

    // For now, remove LIMIT/OFFSET to test basic query
    // sql += ' ORDER BY ps.entry_time DESC LIMIT ? OFFSET ?';
    // params.push(String(limit), String(offset));

    const sessions = await query(sql, params);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parking sessions'
    });
  }
});

// Get open sessions (live parking)
router.get('/live', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let sql = `SELECT ps.*, cu.name as manager_name 
               FROM parking_sessions ps 
               LEFT JOIN company_users cu ON ps.manager_id = cu.id 
               WHERE ps.company_id = ? AND ps.status = 'open'`;
    const params = [companyId];

    if (!isAdmin) {
      sql += ' AND ps.manager_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY ps.entry_time DESC';

    const sessions = await query(sql, params);

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

// Get single session by ID
router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const sessions = await query(
      `SELECT ps.*, cu.name as manager_name 
       FROM parking_sessions ps 
       LEFT JOIN company_users cu ON ps.manager_id = cu.id 
       WHERE ps.id = ? AND ps.company_id = ?`,
      [id, companyId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: sessions[0]
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session'
    });
  }
});

// Get session by token (public - for car details page)
// Note: This endpoint is now moved above authentication middleware

// Add new parking session
router.post('/sessions', addParkingSessionValidator, async (req, res) => {
  try {
    console.log('=== PARKING SESSION DEBUG ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);
    
    const companyId = req.user.company_id;
    const managerId = req.user.id;
    const { 
      plateNumber, 
      model, 
      color, 
      vehicleType = 'car',
      token
    } = req.body;

    console.log('Extracted data:', { plateNumber, model, color, vehicleType, token });

    if (!plateNumber || !model || !color) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: plateNumber, model, color'
      });
    }

    // Use token from frontend, or generate new one if not provided
    const sessionToken = token || generateToken();
    console.log('Using token:', sessionToken);

    // Simple insert without optional fields
    const result = await query(
      'INSERT INTO parking_sessions (company_id, manager_id, token, plate_number, vehicle_model, vehicle_color, vehicle_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [companyId, managerId, sessionToken, plateNumber, model, color, vehicleType, 'open']
    );
    
    console.log('Database result:', result);

    const newSession = {
      id: result.insertId,
      token: sessionToken,
      plateNumber,
      model,
      color,
      vehicleType,
      status: 'open',
      entryTime: new Date().toISOString()
    };

    console.log('New session:', newSession);

    res.status(201).json({
      success: true,
      message: 'Parking session created',
      data: newSession
    });
  } catch (error) {
    console.error('Add session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create parking session',
      error: error.message
    });
  }
});

// Close parking session
router.post('/sessions/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const sessions = await query(
      'SELECT * FROM parking_sessions WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const session = sessions[0];

    if (session.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'Session is already closed'
      });
    }

    // Calculate fee
    const totalFee = await calculateFee(
      companyId,
      session.vehicle_type,
      session.entry_time
    );

    await query(
      'UPDATE parking_sessions SET status = ?, exit_time = NOW(), total_fee = ? WHERE id = ?',
      ['closed', totalFee, id]
    );

    // Record revenue
    await query(
      'INSERT INTO revenue_records (company_id, manager_id, session_id, amount, recorded_at) VALUES (?, ?, ?, ?, CURDATE())',
      [companyId, session.manager_id, id, totalFee]
    );

    const updatedSession = await query(
      'SELECT * FROM parking_sessions WHERE id = ?',
      [id]
    );

    // Emit real-time update
    emitToCompany(companyId, 'parking-session-closed', updatedSession[0]);

    res.json({
      success: true,
      message: 'Parking session closed',
      data: updatedSession[0]
    });
  } catch (error) {
    console.error('Close session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to close parking session'
    });
  }
});

// Update session (add notes, update whatsapp status, etc.)
router.put('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { notes, whatsappSent, qrGenerated } = req.body;

    const sessions = await query(
      'SELECT * FROM parking_sessions WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    await query(
      `UPDATE parking_sessions 
       SET notes = COALESCE(?, notes), 
           whatsapp_sent = COALESCE(?, whatsapp_sent), 
           qr_generated = COALESCE(?, qr_generated) 
       WHERE id = ?`,
      [notes, whatsappSent, qrGenerated, id]
    );

    const updatedSession = await query(
      'SELECT * FROM parking_sessions WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Session updated',
      data: updatedSession[0]
    });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update session'
    });
  }
});

// Get parking history
router.get('/history', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const { startDate, endDate, managerId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT ps.*, cu.name as manager_name 
               FROM parking_sessions ps 
               LEFT JOIN company_users cu ON ps.manager_id = cu.id 
               WHERE ps.company_id = ? AND ps.status = 'closed'`;
    const params = [companyId];

    if (!isAdmin) {
      sql += ' AND ps.manager_id = ?';
      params.push(userId);
    } else if (managerId) {
      sql += ' AND ps.manager_id = ?';
      params.push(managerId);
    }

    if (startDate) {
      sql += ' AND DATE(ps.exit_time) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND DATE(ps.exit_time) <= ?';
      params.push(endDate);
    }

    // Get total
    const countSql = sql.replace('SELECT ps.*, cu.name as manager_name', 'SELECT COUNT(*) as total').replace('LEFT JOIN company_users cu ON ps.manager_id = cu.id', '');
    const [countResult] = await query(countSql, params);
    const total = countResult?.total || 0;

    sql += ' ORDER BY ps.exit_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const sessions = await query(sql, params);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parking history'
    });
  }
});

// Car Requests
router.get('/requests', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const { status } = req.query;

    console.log('Fetching requests for company:', companyId, 'user:', userId, 'isAdmin:', isAdmin, 'status:', status);

    let sql = `SELECT cr.*, ps.vehicle_model, ps.vehicle_color, cu.name as manager_name 
               FROM car_requests cr 
               JOIN parking_sessions ps ON cr.session_id = ps.id 
               LEFT JOIN company_users cu ON cr.manager_id = cu.id 
               WHERE cr.company_id = ?`;
    const params = [companyId];

    if (!isAdmin) {
      sql += ' AND cr.manager_id = ?';
      params.push(userId);
    }

    if (status) {
      // Handle comma-separated statuses
      const statuses = status.split(',').map(s => s.trim());
      if (statuses.length > 1) {
        sql += ` AND cr.status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
      } else {
        sql += ' AND cr.status = ?';
        params.push(status);
      }
    }

    sql += ' ORDER BY cr.id DESC';

    console.log('SQL:', sql);
    console.log('Params:', params);

    const requests = await query(sql, params);

    console.log('Found requests:', requests.length);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car requests'
    });
  }
});

// Create car request (customer requesting their car)
router.post('/requests', async (req, res) => {
  try {
    const { token } = req.body;

    // Find the session
    const sessions = await query(
      'SELECT * FROM parking_sessions WHERE token = ? AND status = ?',
      [token, 'open']
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active parking session not found'
      });
    }

    const session = sessions[0];

    // Check if request already exists
    const existingRequest = await query(
      'SELECT * FROM car_requests WHERE session_id = ? AND status IN (?, ?, ?)',
      [session.id, 'requested', 'bringing', 'arrived']
    );

    if (existingRequest.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Car request already exists for this session'
      });
    }

    const result = await query(
      'INSERT INTO car_requests (company_id, session_id, manager_id, token, plate_number, status) VALUES (?, ?, ?, ?, ?, ?)',
      [session.company_id, session.id, session.manager_id, session.token, session.plate_number, 'requested']
    );

    const newRequest = {
      id: result.insertId,
      sessionId: session.id,
      token: session.token,
      plateNumber: session.plate_number,
      status: 'requested'
    };

    // Emit to the manager
    emitToManager(session.manager_id, 'new-car-request', newRequest);
    emitToCompany(session.company_id, 'new-car-request', newRequest);

    res.status(201).json({
      success: true,
      message: 'Car request created',
      data: newRequest
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create car request'
    });
  }
});

// Complete car request
router.post('/requests/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const requests = await query(
      'SELECT * FROM car_requests WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Car request not found'
      });
    }

    await query(
      'UPDATE car_requests SET status = ?, completed_at = NOW() WHERE id = ?',
      ['completed', id]
    );

    emitToCompany(companyId, 'car-request-completed', { requestId: id });

    res.json({
      success: true,
      message: 'Car request completed'
    });
  } catch (error) {
    console.error('Complete request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete car request'
    });
  }
});

// Update car request status (for manager flow) - TEMP: No auth for testing
router.patch('/requests/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'pending', 'bringing', 'arrived', 'completed'
    // TEMP: Hardcode company_id for testing
    const companyId = 1;

    if (!['requested', 'bringing', 'arrived', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const requests = await query(
      'SELECT * FROM car_requests WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Car request not found'
      });
    }

    const updateFields = ['status = ?'];
    const updateValues = [status];
    
    if (status === 'bringing') {
      updateFields.push('bringing_car_at = NOW()');
    } else if (status === 'arrived') {
      updateFields.push('car_arrived_at = NOW()');
    } else if (status === 'completed') {
      updateFields.push('completed_at = NOW()');
    }
    
    updateValues.push(id);

    await query(
      `UPDATE car_requests SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Emit status update to company
    // emitToCompany(companyId, 'car-request-status-updated', { 
    //   requestId: id, 
    //   status 
    // });

    res.json({
      success: true,
      message: 'Car request status updated',
      data: { status }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update car request status'
    });
  }
});

// Get car request by token (for customer checking status)
// Note: This endpoint is now moved above authentication middleware

// Get all car requests for company (for managers)
router.get('/requests', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status } = req.query;

    let whereClause = 'WHERE cr.company_id = ?';
    let params = [companyId];

    if (status && ['pending', 'bringing_car', 'car_arrived', 'completed'].includes(status)) {
      whereClause += ' AND cr.status = ?';
      params.push(status);
    }

    const requests = await query(
      `SELECT cr.*, ps.plate_number, ps.vehicle_model, ps.vehicle_color
       FROM car_requests cr 
       LEFT JOIN parking_sessions ps ON cr.session_id = ps.id 
       ${whereClause}
       ORDER BY cr.id DESC`,
      params
    );

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get car requests'
    });
  }
});

module.exports = router;

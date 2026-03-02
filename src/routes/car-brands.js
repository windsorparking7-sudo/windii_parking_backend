const express = require('express');
const { query } = require('../config/database');
const { authenticate, isSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication and super admin check to all routes
router.use(authenticate, isSuperAdmin);

// GET /api/admin/car-brands - Get all car brands (simplified without pagination)
router.get('/car-brands', async (req, res) => {
  try {
    const { search, is_active } = req.query;
    
    let sql = 'SELECT * FROM car_brands WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    if (is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(is_active === 'true');
    }

    sql += ' ORDER BY name';

    const brands = await query(sql, params);

    // Get model counts for each brand
    const brandsWithCounts = await Promise.all(
      brands.map(async (brand) => {
        const modelCount = await query(
          'SELECT COUNT(*) as count FROM car_models WHERE brand_id = ? AND is_active = TRUE',
          [brand.id]
        );
        return {
          ...brand,
          models_count: modelCount[0]?.count || 0
        };
      })
    );

    res.json({
      success: true,
      data: {
        brands: brandsWithCounts,
        pagination: {
          page: 1,
          limit: brandsWithCounts.length,
          total: brandsWithCounts.length,
          totalPages: 1
        }
      }
    });
  } catch (error) {
    console.error('Get car brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car brands'
    });
  }
});

// GET /api/admin/car-models - Get all car models (simplified without pagination)
router.get('/car-models', async (req, res) => {
  try {
    const { search, brand_id, body_type, is_active } = req.query;
    
    let sql = `
      SELECT cm.*, cb.name as brand_name
      FROM car_models cm
      JOIN car_brands cb ON cm.brand_id = cb.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ' AND (cm.name LIKE ? OR cb.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (brand_id) {
      sql += ' AND cm.brand_id = ?';
      params.push(brand_id);
    }

    if (body_type) {
      sql += ' AND cm.body_type = ?';
      params.push(body_type);
    }

    if (is_active !== undefined) {
      sql += ' AND cm.is_active = ?';
      params.push(is_active === 'true');
    }

    sql += ' ORDER BY cb.name, cm.name';

    const models = await query(sql, params);

    res.json({
      success: true,
      data: {
        models,
        pagination: {
          page: 1,
          limit: models.length,
          total: models.length,
          totalPages: 1
        }
      }
    });
  } catch (error) {
    console.error('Get car models error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car models'
    });
  }
});

module.exports = router;

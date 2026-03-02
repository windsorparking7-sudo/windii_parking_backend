const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Auth validators
const loginValidator = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

const registerCompanyValidator = [
  body('name').notEmpty().trim().withMessage('Company name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('address').notEmpty().trim().withMessage('Address is required'),
  body('contact').notEmpty().trim().withMessage('Contact is required'),
  validate
];

// Parking validators
const addParkingSessionValidator = [
  body('plateNumber').notEmpty().trim().withMessage('Plate number is required'),
  body('model').notEmpty().trim().withMessage('Vehicle model is required'),
  body('color').notEmpty().trim().withMessage('Vehicle color is required'),
  validate
];

// Manager validators
const addManagerValidator = [
  body('name').notEmpty().trim().withMessage('Manager name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate
];

// ID param validator
const idParamValidator = [
  param('id').isInt().withMessage('Valid ID is required'),
  validate
];

module.exports = {
  validate,
  loginValidator,
  registerCompanyValidator,
  addParkingSessionValidator,
  addManagerValidator,
  idParamValidator
};

-- Create car_brands table
CREATE TABLE IF NOT EXISTS car_brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  logo_url VARCHAR(255),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_brand_name (name),
  INDEX idx_brand_active (is_active)
);

-- Create car_models table
CREATE TABLE IF NOT EXISTS car_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  year_range VARCHAR(20),
  body_type ENUM('sedan', 'suv', 'hatchback', 'coupe', 'convertible', 'truck', 'van', 'wagon', 'other'),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES car_brands(id) ON DELETE CASCADE,
  UNIQUE KEY unique_brand_model (brand_id, name),
  INDEX idx_model_brand (brand_id),
  INDEX idx_model_active (is_active),
  INDEX idx_model_name (name)
);

-- Add car_brand_id and car_model_id to parking_sessions table
ALTER TABLE parking_sessions 
ADD COLUMN car_brand_id INT NULL,
ADD COLUMN car_model_id INT NULL,
ADD INDEX idx_parking_brand (car_brand_id),
ADD INDEX idx_parking_model (car_model_id),
ADD FOREIGN KEY (car_brand_id) REFERENCES car_brands(id) ON DELETE SET NULL,
ADD FOREIGN KEY (car_model_id) REFERENCES car_models(id) ON DELETE SET NULL;

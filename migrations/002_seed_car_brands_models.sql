-- Seed data for car brands and models

-- Insert car brands
INSERT INTO car_brands (name, logo_url, description, is_active) VALUES
('Toyota', 'https://example.com/logos/toyota.png', 'Japanese automotive manufacturer known for reliability and efficiency', TRUE),
('Honda', 'https://example.com/logos/honda.png', 'Japanese automotive manufacturer known for engineering excellence and innovation', TRUE);

-- Get the brand IDs (we'll assume they are 1 and 2)
-- Insert Toyota models
INSERT INTO car_models (brand_id, name, year_range, body_type, is_active) VALUES
(1, 'Camry', '2020-2024', 'sedan', TRUE),
(1, 'Corolla', '2020-2024', 'sedan', TRUE),
(1, 'RAV4', '2020-2024', 'suv', TRUE),
(1, 'Highlander', '2020-2024', 'suv', TRUE),
(1, 'Prius', '2020-2024', 'hatchback', TRUE),
(1, 'Tacoma', '2020-2024', 'truck', TRUE),
(1, 'Sienna', '2020-2024', 'van', TRUE),
(1, 'Yaris', '2020-2024', 'hatchback', TRUE),
(1, 'Avalon', '2020-2024', 'sedan', TRUE),
(1, '4Runner', '2020-2024', 'suv', TRUE);

-- Insert Honda models
INSERT INTO car_models (brand_id, name, year_range, body_type, is_active) VALUES
(2, 'Accord', '2020-2024', 'sedan', TRUE),
(2, 'Civic', '2020-2024', 'sedan', TRUE),
(2, 'CR-V', '2020-2024', 'suv', TRUE),
(2, 'HR-V', '2020-2024', 'suv', TRUE),
(2, 'Pilot', '2020-2024', 'suv', TRUE),
(2, 'Odyssey', '2020-2024', 'van', TRUE),
(2, 'Fit', '2020-2024', 'hatchback', TRUE),
(2, 'Insight', '2020-2024', 'sedan', TRUE),
(2, 'Ridgeline', '2020-2024', 'truck', TRUE),
(2, 'Passport', '2020-2024', 'suv', TRUE);

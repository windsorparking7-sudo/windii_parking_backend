-- Add status tracking columns to car_requests table
ALTER TABLE car_requests 
ADD COLUMN IF NOT EXISTS bringing_car_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS car_arrived_at TIMESTAMP NULL;

-- Update existing requests to have proper status flow
UPDATE car_requests SET status = 'pending' WHERE status IS NULL OR status = '';

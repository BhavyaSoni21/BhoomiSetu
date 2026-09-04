-- Initialize PostGIS extension and create tables for BhoomiSetu

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the bhoomisetu database if it doesn't exist (handled by postgres image)
-- Connect to the bhoomisetu database
\c bhoomisetu;

-- Create parcels table with PostGIS geometry
CREATE TABLE IF NOT EXISTS parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_parcel_id VARCHAR(50),
  ulpin VARCHAR(50),
  state_code VARCHAR(10) NOT NULL,
  district_code VARCHAR(20) NOT NULL,
  local_body_code VARCHAR(20) NOT NULL,
  geometry GEOMETRY(POLYGON, 4326) NOT NULL,
  area_sq_m DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create parcel identifiers table
CREATE TABLE IF NOT EXISTS parcel_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  identifier_type VARCHAR(50) NOT NULL,
  identifier_value VARCHAR(100) NOT NULL,
  source_state VARCHAR(10) NOT NULL,
  source_department VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_parcels_state_district ON parcels(state_code, district_code);
CREATE INDEX IF NOT EXISTS idx_parcels_canonical_id ON parcels(canonical_parcel_id);
CREATE INDEX IF NOT EXISTS idx_parcels_ulpin ON parcels(ulpin);
CREATE INDEX IF NOT EXISTS idx_parcels_geometry ON parcels USING GIST(geometry);

CREATE INDEX IF NOT EXISTS idx_parcel_identifiers_type_value ON parcel_identifiers(identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_parcel_identifiers_source ON parcel_identifiers(source_state, identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_parcel_identifiers_parcel_id ON parcel_identifiers(parcel_id);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'CITIZEN', 'Citizen accessing public services'),
  ('22222222-2222-2222-2222-222222222222', 'LAND_RECORD_OFFICER', 'Officer handling land records'),
  ('33333333-3333-3333-3333-333333333333', 'REGISTRATION_OFFICER', 'Officer handling registrations'),
  ('44444444-4444-4444-4444-444444444444', 'PLANNING_OFFICER', 'Officer handling planning permissions'),
  ('55555555-5555-5555-5555-555555555555', 'ADMIN', 'System administrator')
ON CONFLICT (id) DO NOTHING;

-- Create a sample admin user
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (id, name, email, password_hash, role_id) VALUES
  ('66666666-6666-6666-6666-666666666666', 'Admin User', 'admin@bhoomisetu.gov.in', '$2b$10$8NZOO5jSqEyz5J.VqyXKUuAUVWAw7G4iN.YU.JvqRjWnJ5F0iXV2e', '55555555-5555-5555-5555-555555555555')
ON CONFLICT (id) DO NOTHING;

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  workflow_type VARCHAR(50) NOT NULL,
  current_status VARCHAR(20) NOT NULL DEFAULT 'initiated',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow steps table
CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  department VARCHAR(50) NOT NULL,
  assigned_role VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  action VARCHAR(100),
  remarks TEXT,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create governance alerts table
CREATE TABLE IF NOT EXISTS governance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  source VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert some sample parcels for testing
INSERT INTO parcels (id, canonical_parcel_id, ulpin, state_code, district_code, local_body_code, geometry, area_sq_m) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CAN00001', 'ULPIN1234567890', 'DL', 'New Delhi', 'DL-ND-0001',
   'POLYGON((77.20 28.61, 77.21 28.61, 77.21 28.62, 77.20 28.62, 77.20 28.61))', 500.0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CAN00002', 'ULPIN0987654321', 'MH', 'Mumbai', 'MH-MU-0001',
   'POLYGON((72.80 18.90, 72.81 18.90, 72.81 18.91, 72.80 18.91, 72.80 18.90))', 750.0),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'CAN00003', NULL, 'KA', 'Bangalore', 'KA-BG-0001',
   'POLYGON((77.58 12.97, 77.59 12.97, 77.59 12.98, 77.58 12.98, 77.58 12.97))', 600.0)
ON CONFLICT (id) DO NOTHING;

-- Insert sample identifiers for the sample parcels
INSERT INTO parcel_identifiers (id, parcel_id, identifier_type, identifier_value, source_state, source_department) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SURVEY_NUMBER', '42/3', 'DL', 'Land Records'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PLOT_NUMBER', '121', 'DL', 'Land Records'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'SURVEY_NUMBER', '15/7', 'MH', 'Land Records'),
  ('gggggggg-gggg-gggg-gggg-gggggggggggg', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'PLOT_NUMBER', '45', 'MH', 'Land Records'),
  ('hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'LOCAL_PARCEL_ID', 'KA-BG-7890', 'KA', 'Land Records')
ON CONFLICT (id) DO NOTHING;
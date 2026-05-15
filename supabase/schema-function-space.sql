-- Function Space Bookings
-- Run this in the Supabase SQL editor to add function space support.

CREATE TYPE booking_status AS ENUM (
  'inquiry',
  'agreement_sent',
  'deposit_pending',
  'confirmed',
  'completed',
  'cancelled'
);

CREATE TABLE function_space_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Client
  client_name       TEXT NOT NULL,
  client_company    TEXT,
  client_email      TEXT,
  client_phone      TEXT,
  -- Event
  space_name        TEXT NOT NULL DEFAULT 'Function Space',
  event_date        DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  guest_count       INTEGER,
  event_type        TEXT,
  -- Status
  status            booking_status NOT NULL DEFAULT 'inquiry',
  -- Financials (deposit_status reuses existing enum)
  hire_fee          NUMERIC,
  deposit_amount    NUMERIC,
  deposit_status    deposit_status DEFAULT 'pending',
  officernd_fee_id  TEXT,
  -- Notes
  notes             TEXT,
  internal_notes    TEXT,
  -- Timestamps
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER function_space_bookings_updated_at
  BEFORE UPDATE ON function_space_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE function_space_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access"
  ON function_space_bookings FOR ALL
  USING (auth.role() = 'authenticated');

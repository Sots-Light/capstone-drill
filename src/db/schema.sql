CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  city TEXT NOT NULL CHECK (length(trim(city)) > 0),
  venue TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published'))
);

CREATE TABLE IF NOT EXISTS ticket_tiers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  price_in_kobo INTEGER NOT NULL CHECK (price_in_kobo > 0),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  sold INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0 AND sold <= capacity)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  booked_by TEXT NOT NULL REFERENCES users(id),
  tier_id TEXT NOT NULL REFERENCES ticket_tiers(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded', 'checked_in')),
  created_at TEXT NOT NULL,
  paid_at TEXT,
  amount_in_kobo INTEGER NOT NULL CHECK (amount_in_kobo > 0),
  refunded_amount_in_kobo INTEGER NOT NULL DEFAULT 0
    CHECK (refunded_amount_in_kobo >= 0 AND refunded_amount_in_kobo <= amount_in_kobo)
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL CHECK (length(trim(first_name)) > 0),
  last_name TEXT NOT NULL CHECK (length(trim(last_name)) > 0),
  holder_name TEXT NOT NULL CHECK (length(trim(holder_name)) > 0),
  price_in_kobo INTEGER NOT NULL CHECK (price_in_kobo > 0),
  status TEXT NOT NULL CHECK (status IN ('valid', 'refunded', 'cancelled', 'checked_in')),
  issued_at TEXT NOT NULL,
  used_at TEXT,
  refunded_at TEXT
);

CREATE INDEX IF NOT EXISTS ticket_tiers_event_id_idx ON ticket_tiers(event_id);
CREATE INDEX IF NOT EXISTS bookings_tier_id_idx ON bookings(tier_id);
CREATE INDEX IF NOT EXISTS tickets_booking_id_idx ON tickets(booking_id);

-- Schema Supabase / PostgreSQL — Microservicio Despacho y Logística (G8)
-- Ejecutar en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS shipments (
  shipment_id   TEXT PRIMARY KEY,
  order_id      TEXT UNIQUE NOT NULL,
  user_id       TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('CREATED', 'PICKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED')),
  lines         JSONB NOT NULL DEFAULT '[]',
  ship_to       JSONB NOT NULL,
  proof         JSONB,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key           TEXT PRIMARY KEY,
  payload_hash  TEXT NOT NULL,
  shipment_id   TEXT NOT NULL REFERENCES shipments(shipment_id),
  status_code   INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);

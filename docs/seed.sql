-- Datos demo para pruebas Bruno (G8)
-- Ejecutar DESPUÉS de docs/schema.sql en Supabase → SQL Editor

DELETE FROM idempotency_keys;
DELETE FROM shipments;

INSERT INTO shipments (
  shipment_id, order_id, user_id, status, lines, ship_to, version, created_at, updated_at, delivered_at
) VALUES
(
  'shp_a1b2c3', 'ORD-1001', 'USR-01', 'OUT_FOR_DELIVERY',
  '[{"sku":"P-100","qty":2,"description":"Caña de pescar Shimano FX"},{"sku":"P-205","qty":1,"description":"Carrete Penn Pursuit IV"}]'::jsonb,
  '{"fullName":"Juan Perez","addressLine1":"Avenida Siempreviva 742","city":"Santiago","region":"RM","postalCode":"8320000","country":"CL"}'::jsonb,
  2, '2026-06-15T10:00:00Z', '2026-06-16T12:00:00Z', NULL
),
(
  'shp_b2c3d4', 'ORD-1002', 'USR-02', 'CREATED',
  '[{"sku":"P-100","qty":2,"description":"Caña de pescar Shimano FX"},{"sku":"P-205","qty":1,"description":"Carrete Penn Pursuit IV"}]'::jsonb,
  '{"fullName":"Juan Perez","addressLine1":"Avenida Siempreviva 742","city":"Santiago","region":"RM","postalCode":"8320000","country":"CL"}'::jsonb,
  1, '2026-06-15T10:00:00Z', '2026-06-15T10:00:00Z', NULL
),
(
  'shp_c3d4e5', 'ORD-1003', 'USR-01', 'DELIVERED',
  '[{"sku":"P-100","qty":2,"description":"Caña de pescar Shimano FX"},{"sku":"P-205","qty":1,"description":"Carrete Penn Pursuit IV"}]'::jsonb,
  '{"fullName":"Juan Perez","addressLine1":"Avenida Siempreviva 742","city":"Santiago","region":"RM","postalCode":"8320000","country":"CL"}'::jsonb,
  4, '2026-06-15T10:00:00Z', '2026-06-14T18:00:00Z', '2026-06-14T18:00:00Z'
),
(
  'shp_d4e5f6', 'ORD-1004', 'USR-01', 'FAILED',
  '[{"sku":"P-100","qty":2,"description":"Caña de pescar Shimano FX"},{"sku":"P-205","qty":1,"description":"Carrete Penn Pursuit IV"}]'::jsonb,
  '{"fullName":"Juan Perez","addressLine1":"Avenida Siempreviva 742","city":"Santiago","region":"RM","postalCode":"8320000","country":"CL"}'::jsonb,
  3, '2026-06-15T10:00:00Z', '2026-06-13T09:30:00Z', NULL
),
(
  'shp_e5f6g7', 'ORD-1005', 'USR-01', 'PICKING',
  '[{"sku":"P-100","qty":2,"description":"Caña de pescar Shimano FX"},{"sku":"P-205","qty":1,"description":"Carrete Penn Pursuit IV"}]'::jsonb,
  '{"fullName":"Juan Perez","addressLine1":"Avenida Siempreviva 742","city":"Santiago","region":"RM","postalCode":"8320000","country":"CL"}'::jsonb,
  2, '2026-06-15T10:00:00Z', '2026-06-16T08:00:00Z', NULL
);

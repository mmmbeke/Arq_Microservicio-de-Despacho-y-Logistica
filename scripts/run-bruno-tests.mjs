const base = process.env.BASE_URL ?? 'http://localhost:3007';
const H = {
  'X-Correlation-Id': 'corr-test-001',
  'X-Consumer': 'g8-despacho',
};

async function req(name, path, opts = {}) {
  const r = await fetch(`${base}${path}`, {
    ...opts,
    headers: { ...H, ...opts.headers },
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  const preview =
    typeof body === 'object' ? JSON.stringify(body).slice(0, 160) : String(body).slice(0, 160);
  const ok = opts.expected?.includes(r.status) ?? r.ok;
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}: ${r.status} ${preview}`);
  return { status: r.status, body };
}

let etagAssigned = '"2"';
let etagOutForDelivery = '"3"';
let etagReject = '"4"';

await req('01 health', '/health', { expected: [200] });
await req('02 list', '/v1/shipments', { expected: [200] });
await req('03 get shp_a1b2c3', '/v1/shipments/shp_a1b2c3', { expected: [200] });
await req('04 404', '/v1/shipments/no-existe', { expected: [404] });
await req('05 create ORD-1006', '/v1/shipments', {
  method: 'POST',
  expected: [201],
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'idem-create-ord-1006-001',
  },
  body: JSON.stringify({ orderId: 'ORD-1006' }),
});
await req('06 idempotencia', '/v1/shipments', {
  method: 'POST',
  expected: [200],
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'idem-create-ord-1006-001',
  },
  body: JSON.stringify({ orderId: 'ORD-1006' }),
});
const r7 = await req('07 patch PICKING', '/v1/shipments/shp_b2c3d4', {
  method: 'PATCH',
  expected: [200],
  headers: {
    'Content-Type': 'application/json',
    'If-Match': '"1"',
  },
  body: JSON.stringify({ status: 'PICKING' }),
});
etagAssigned = `"${r7.body.version}"`;
const r8 = await req('08 patch ASSIGNED', '/v1/shipments/shp_b2c3d4', {
  method: 'PATCH',
  expected: [200],
  headers: {
    'Content-Type': 'application/json',
    'If-Match': etagAssigned,
  },
  body: JSON.stringify({
    status: 'ASSIGNED',
    driverId: 'DRV-01',
    driverName: 'Carlos Reparto',
  }),
});
etagOutForDelivery = `"${r8.body.version}"`;
const r9 = await req('09 patch OUT_FOR_DELIVERY', '/v1/shipments/shp_b2c3d4', {
  method: 'PATCH',
  expected: [200],
  headers: {
    'Content-Type': 'application/json',
    'If-Match': etagOutForDelivery,
  },
  body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' }),
});
etagReject = `"${r9.body.version}"`;
await req('10 confirm', '/v1/shipments/shp_a1b2c3/confirm', {
  method: 'POST',
  expected: [200],
  headers: {
    'Idempotency-Key': 'idem-confirm-001',
    'If-Match': '"2"',
  },
});
await req('11 reject', '/v1/shipments/shp_b2c3d4/reject', {
  method: 'POST',
  expected: [200],
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'idem-reject-001',
    'If-Match': etagReject,
  },
  body: JSON.stringify({ reason: 'Cliente no disponible' }),
});
await req('12 reship', '/v1/shipments/shp_d4e5f6/reship', {
  method: 'POST',
  expected: [201],
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'idem-reship-ord-1004-001',
  },
  body: JSON.stringify({ reason: 'Reintento tras devolucion' }),
});

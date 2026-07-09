import { getSupabase, hasSupabaseEnv } from '../config/supabase';
import { Shipment, ShipmentStatus } from '../types/shipment.types';

const shipments = new Map<string, Shipment>();
const shipmentsByOrderId = new Map<string, string>();
const idempotencyCache = new Map<
  string,
  { payloadHash: string; shipmentId: string; statusCode: number }
>();

export const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  CREATED: ['PICKING', 'FAILED'],
  PICKING: ['ASSIGNED', 'FAILED'],
  ASSIGNED: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: [],
};

interface ShipmentRow {
  shipment_id: string;
  order_id: string;
  user_id: string;
  status: ShipmentStatus;
  lines: Shipment['lines'];
  ship_to: Shipment['shipTo'];
  proof: Shipment['proof'];
  driver_id: string | null;
  driver_name: string | null;
  reship_of: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
}

interface IdempotencyRow {
  key: string;
  payload_hash: string;
  shipment_id: string;
  status_code: number;
}

let activePersistence: 'supabase' | 'memory' = 'memory';

export function isSupabaseEnabled(): boolean {
  return activePersistence === 'supabase';
}

export function getPersistenceMode(): 'supabase' | 'memory' {
  return activePersistence;
}

function rowToShipment(row: ShipmentRow): Shipment {
  return {
    shipmentId: row.shipment_id,
    orderId: row.order_id,
    userId: row.user_id,
    status: row.status,
    lines: row.lines,
    shipTo: row.ship_to,
    driverId: row.driver_id ?? null,
    driverName: row.driver_name ?? null,
    reshipOf: row.reship_of ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveredAt: row.delivered_at,
    proof: row.proof ?? null,
    version: row.version,
  };
}

function shipmentToRow(shipment: Shipment): ShipmentRow {
  return {
    shipment_id: shipment.shipmentId,
    order_id: shipment.orderId,
    user_id: shipment.userId,
    status: shipment.status,
    lines: shipment.lines,
    ship_to: shipment.shipTo,
    proof: shipment.proof ?? null,
    driver_id: shipment.driverId ?? null,
    driver_name: shipment.driverName ?? null,
    reship_of: shipment.reshipOf ?? null,
    version: shipment.version,
    created_at: shipment.createdAt,
    updated_at: shipment.updatedAt,
    delivered_at: shipment.deliveredAt ?? null,
  };
}

function baseShipment(partial: Partial<Shipment> & Pick<Shipment, 'shipmentId' | 'orderId' | 'status'>): Shipment {
  const now = '2026-06-15T10:00:00Z';
  return {
    shipmentId: partial.shipmentId,
    orderId: partial.orderId,
    userId: partial.userId ?? 'USR-01',
    status: partial.status,
    lines: partial.lines ?? [
      { sku: 'P-100', qty: 2, description: 'Caña de pescar Shimano FX' },
      { sku: 'P-205', qty: 1, description: 'Carrete Penn Pursuit IV' },
    ],
    shipTo: partial.shipTo ?? {
      fullName: 'Juan Perez',
      addressLine1: 'Avenida Siempreviva 742',
      city: 'Santiago',
      region: 'RM',
      postalCode: '8320000',
      country: 'CL',
    },
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    deliveredAt: partial.deliveredAt ?? null,
    proof: partial.proof ?? null,
    driverId: partial.driverId ?? null,
    driverName: partial.driverName ?? null,
    reshipOf: partial.reshipOf ?? null,
    version: partial.version ?? 1,
  };
}

function seedMemory(): void {
  if (shipments.size > 0) return;

  const seeds: Shipment[] = [
    baseShipment({
      shipmentId: 'shp_a1b2c3',
      orderId: 'ORD-1001',
      status: 'OUT_FOR_DELIVERY',
      version: 2,
      updatedAt: '2026-06-16T12:00:00Z',
    }),
    baseShipment({
      shipmentId: 'shp_b2c3d4',
      orderId: 'ORD-1002',
      userId: 'USR-02',
      status: 'CREATED',
      version: 1,
    }),
    baseShipment({
      shipmentId: 'shp_c3d4e5',
      orderId: 'ORD-1003',
      status: 'DELIVERED',
      version: 4,
      deliveredAt: '2026-06-14T18:00:00Z',
      updatedAt: '2026-06-14T18:00:00Z',
    }),
    baseShipment({
      shipmentId: 'shp_d4e5f6',
      orderId: 'ORD-1004',
      status: 'FAILED',
      version: 3,
      updatedAt: '2026-06-13T09:30:00Z',
    }),
    baseShipment({
      shipmentId: 'shp_e5f6g7',
      orderId: 'ORD-1005',
      status: 'PICKING',
      version: 2,
      updatedAt: '2026-06-16T08:00:00Z',
    }),
  ];

  for (const shipment of seeds) {
    shipments.set(shipment.shipmentId, cloneShipment(shipment));
    shipmentsByOrderId.set(shipment.orderId, shipment.shipmentId);
  }
}

export function cloneShipment(shipment: Shipment): Shipment {
  return structuredClone(shipment);
}

export async function initStore(): Promise<void> {
  if (!hasSupabaseEnv()) {
    console.warn('[store] Persistencia: memoria (configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)');
    activePersistence = 'memory';
    seedMemory();
    return;
  }

  try {
    console.log('[store] Persistencia: Supabase (PostgreSQL)');
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(error.message);
    }

    activePersistence = 'supabase';
    console.log(`[store] Supabase OK — ${count ?? 0} envíos en BD`);
  } catch (err) {
    activePersistence = 'memory';
    console.error('[store] Error conectando a Supabase:', err);
    console.warn('[store] Usando memoria como respaldo. Revisa variables en Render y la Secret key.');
    seedMemory();
  }
}

export function isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from].includes(to);
}

export function nextShipmentId(): string {
  return `shp_${Math.random().toString(36).slice(2, 10)}`;
}

export async function queryShipments(filters: {
  orderId?: string;
  status?: ShipmentStatus;
  page: number;
  pageSize: number;
}): Promise<{ items: Shipment[]; total: number }> {
  if (!isSupabaseEnabled()) {
    seedMemory();
    let items = Array.from(shipments.values()).map(cloneShipment);
    if (filters.orderId) items = items.filter((s) => s.orderId === filters.orderId);
    if (filters.status) items = items.filter((s) => s.status === filters.status);
    const total = items.length;
    const start = (filters.page - 1) * filters.pageSize;
    return { items: items.slice(start, start + filters.pageSize), total };
  }

  const supabase = getSupabase();
  let query = supabase.from('shipments').select('*', { count: 'exact' });
  if (filters.orderId) query = query.eq('order_id', filters.orderId);
  if (filters.status) query = query.eq('status', filters.status);

  const start = (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(start, start + filters.pageSize - 1);

  if (error) throw new Error(`Supabase queryShipments: ${error.message}`);

  return {
    items: (data as ShipmentRow[]).map(rowToShipment),
    total: count ?? 0,
  };
}

export async function getShipmentById(shipmentId: string): Promise<Shipment | undefined> {
  if (!isSupabaseEnabled()) {
    seedMemory();
    const shipment = shipments.get(shipmentId);
    return shipment ? cloneShipment(shipment) : undefined;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('shipment_id', shipmentId)
    .maybeSingle();

  if (error) throw new Error(`Supabase getShipmentById: ${error.message}`);
  return data ? rowToShipment(data as ShipmentRow) : undefined;
}

export async function getShipmentByOrderId(orderId: string): Promise<Shipment | undefined> {
  if (!isSupabaseEnabled()) {
    seedMemory();
    const shipmentId = shipmentsByOrderId.get(orderId);
    return shipmentId ? getShipmentById(shipmentId) : undefined;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Supabase getShipmentByOrderId: ${error.message}`);
  return data ? rowToShipment(data as ShipmentRow) : undefined;
}

export async function saveShipment(shipment: Shipment): Promise<Shipment> {
  const copy = cloneShipment(shipment);

  if (!isSupabaseEnabled()) {
    seedMemory();
    shipments.set(copy.shipmentId, copy);
    shipmentsByOrderId.set(copy.orderId, copy.shipmentId);
    return cloneShipment(copy);
  }

  const row = shipmentToRow(copy);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('shipments')
    .upsert(row, { onConflict: 'shipment_id' })
    .select('*')
    .single();

  if (error) throw new Error(`Supabase saveShipment: ${error.message}`);
  return rowToShipment(data as ShipmentRow);
}

export async function getIdempotencyEntry(
  key: string
): Promise<{ payloadHash: string; shipmentId: string; statusCode: number } | undefined> {
  if (!isSupabaseEnabled()) {
    seedMemory();
    return idempotencyCache.get(key);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('idempotency_keys')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (error) throw new Error(`Supabase getIdempotencyEntry: ${error.message}`);
  if (!data) return undefined;

  const row = data as IdempotencyRow;
  return {
    payloadHash: row.payload_hash,
    shipmentId: row.shipment_id,
    statusCode: row.status_code,
  };
}

export async function setIdempotencyEntry(
  key: string,
  payloadHash: string,
  shipmentId: string,
  statusCode: number
): Promise<void> {
  if (!isSupabaseEnabled()) {
    seedMemory();
    idempotencyCache.set(key, { payloadHash, shipmentId, statusCode });
    return;
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('idempotency_keys').upsert(
    {
      key,
      payload_hash: payloadHash,
      shipment_id: shipmentId,
      status_code: statusCode,
    },
    { onConflict: 'key' }
  );

  if (error) throw new Error(`Supabase setIdempotencyEntry: ${error.message}`);
}

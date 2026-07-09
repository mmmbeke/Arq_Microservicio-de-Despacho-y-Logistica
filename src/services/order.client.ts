import { Address, ShipmentLine } from '../types/shipment.types';
import { getShipmentByOrderId } from '../store/shipment.store';

export interface OrderSnapshot {
  orderId: string;
  userId: string;
  status: string;
  lines: ShipmentLine[];
  shipTo: Address;
}

const MOCK_ORDERS: Record<string, OrderSnapshot> = {
  'ORD-1001': {
    orderId: 'ORD-1001',
    userId: 'USR-01',
    status: 'READY_TO_SHIP',
    lines: [
      { sku: 'P-100', qty: 2, description: 'Caña de pescar Shimano FX' },
      { sku: 'P-205', qty: 1, description: 'Carrete Penn Pursuit IV' },
    ],
    shipTo: {
      fullName: 'Juan Perez',
      addressLine1: 'Avenida Siempreviva 742',
      city: 'Santiago',
      region: 'RM',
      postalCode: '8320000',
      country: 'CL',
    },
  },
  'ORD-1002': {
    orderId: 'ORD-1002',
    userId: 'USR-02',
    status: 'READY_TO_SHIP',
    lines: [
      { sku: 'P-100', qty: 2, description: 'Caña de pescar Shimano FX' },
      { sku: 'P-205', qty: 1, description: 'Carrete Penn Pursuit IV' },
    ],
    shipTo: {
      fullName: 'Juan Perez',
      addressLine1: 'Avenida Siempreviva 742',
      city: 'Santiago',
      region: 'RM',
      postalCode: '8320000',
      country: 'CL',
    },
  },
  'ORD-1006': {
    orderId: 'ORD-1006',
    userId: 'USR-03',
    status: 'READY_TO_SHIP',
    lines: [{ sku: 'P-310', qty: 1, description: 'Línea Multifilamento PowerPro' }],
    shipTo: {
      fullName: 'Maria Gonzalez',
      addressLine1: 'Calle Los Pescadores 123',
      city: 'Valparaiso',
      region: 'V',
      country: 'CL',
    },
  },
};

const DEFAULT_SHIP_TO: Address = {
  fullName: 'Cliente FishMarket',
  addressLine1: 'Dirección pendiente (G5)',
  city: 'Santiago',
  region: 'RM',
  country: 'CL',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/** Mapea respuesta real de G5 (id, product_id, etc.) al snapshot interno de G8. */
function mapG5Order(raw: unknown, requestedOrderId: string): OrderSnapshot | null {
  const root = asRecord(raw);
  if (!root) return null;

  const data = asRecord(root.data) ?? root;
  const orderId =
    (typeof data.orderId === 'string' && data.orderId) ||
    (typeof data.id === 'string' && data.id) ||
    (typeof data.order_id === 'string' && data.order_id) ||
    requestedOrderId;

  const userId =
    (typeof data.userId === 'string' && data.userId) ||
    (typeof data.user_id === 'string' && data.user_id) ||
    'USR-UNKNOWN';

  const status = typeof data.status === 'string' ? data.status.toUpperCase() : '';

  const itemsRaw = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.lines)
      ? data.lines
      : [];

  const lines: ShipmentLine[] = itemsRaw.map((item) => {
    const row = asRecord(item) ?? {};
    const sku =
      (typeof row.productId === 'string' && row.productId) ||
      (typeof row.product_id === 'string' && row.product_id) ||
      (typeof row.sku === 'string' && row.sku) ||
      'SKU-UNKNOWN';
    const qty = Number(row.quantity ?? row.qty ?? 1);
    const description =
      (typeof row.description === 'string' && row.description) ||
      (typeof row.name === 'string' && row.name) ||
      undefined;

    return { sku, qty: Number.isFinite(qty) ? qty : 1, description };
  });

  const shipToRaw = asRecord(data.shipTo) ?? asRecord(data.ship_to) ?? asRecord(data.shippingAddress);
  const shipTo: Address = shipToRaw
    ? {
        fullName: String(shipToRaw.fullName ?? shipToRaw.full_name ?? 'Cliente'),
        addressLine1: String(shipToRaw.addressLine1 ?? shipToRaw.address_line1 ?? shipToRaw.street ?? 'Sin dirección'),
        city: String(shipToRaw.city ?? 'Santiago'),
        region: shipToRaw.region ? String(shipToRaw.region) : undefined,
        postalCode: shipToRaw.postalCode ? String(shipToRaw.postalCode) : undefined,
        country: String(shipToRaw.country ?? 'CL'),
      }
    : (MOCK_ORDERS[requestedOrderId]?.shipTo ?? DEFAULT_SHIP_TO);

  if (!orderId || !status) return null;

  return { orderId, userId, status, lines, shipTo };
}

async function orderExists(orderId: string): Promise<boolean> {
  if (MOCK_ORDERS[orderId]) return true;
  const shipment = await getShipmentByOrderId(orderId);
  return Boolean(shipment);
}

/**
 * Simula GET /orders/{id} de G5 para enriquecer el envío.
 * Si G5_URL está configurado, intenta la llamada real; si falla, usa mock local.
 */
export async function fetchOrderSnapshot(orderId: string): Promise<OrderSnapshot | null> {
  const g5Url = process.env.G5_ORDER_SERVICE_URL;

  if (g5Url) {
    try {
      const response = await fetch(`${g5Url}/orders/${orderId}`, {
        headers: {
          'X-Correlation-Id': crypto.randomUUID(),
          'X-Request-Id': crypto.randomUUID(),
        },
      });

      if (!response.ok) {
        console.warn(`[g5-client] GET /orders/${orderId} → ${response.status}`);
        return MOCK_ORDERS[orderId] ?? null;
      }

      const raw = await response.json();
      const mapped = mapG5Order(raw, orderId);
      if (mapped) {
        console.log(`[g5-client] pedido ${mapped.orderId} status=${mapped.status}`);
        return mapped;
      }

      console.warn('[g5-client] respuesta G5 no mapeable para', orderId);
      return MOCK_ORDERS[orderId] ?? null;
    } catch (error) {
      console.warn('[g5-client] no se pudo consultar G5, usando mock local:', error);
    }
  }

  return MOCK_ORDERS[orderId] ?? null;
}

/**
 * Simula que G5 crea un pedido de reintento tras un envío fallido.
 * Genera orderId con sufijo -R1, -R2, ... en estado READY_TO_SHIP.
 */
export async function createRetryOrderFromFailed(
  originalOrderId: string,
  fallback?: { userId: string; lines: ShipmentLine[]; shipTo: Address }
): Promise<OrderSnapshot> {
  const base = (await fetchOrderSnapshot(originalOrderId)) ?? fallback;
  if (!base) {
    throw new Error(`No hay snapshot de pedido para reintento: ${originalOrderId}`);
  }

  const retryOrderId = originalOrderId;

  const retryOrder: OrderSnapshot = {
    orderId: retryOrderId,
    userId: base.userId,
    status: 'READY_TO_SHIP',
    lines: base.lines,
    shipTo: base.shipTo,
  };

  MOCK_ORDERS[retryOrderId] = retryOrder;
  console.log(`[g5-client] pedido de reintento mock creado: ${retryOrderId}`);

  const g5Url = process.env.G5_ORDER_SERVICE_URL;
  if (g5Url) {
    try {
      await fetch(`${g5Url}/orders/${originalOrderId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': crypto.randomUUID(),
          'X-Request-Id': crypto.randomUUID(),
          'X-Consumer': 'dispatch-service',
        },
        body: JSON.stringify({ retryOrderId }),
      });
    } catch (error) {
      console.warn('[g5-client] G5 retry no disponible, usando mock local:', error);
    }
  }

  return retryOrder;
}

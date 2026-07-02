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

      if (!response.ok) return MOCK_ORDERS[orderId] ?? null;

      const order = (await response.json()) as {
        orderId: string;
        userId: string;
        status: string;
        items?: Array<{ productId: string; quantity: number }>;
      };

      return {
        orderId: order.orderId,
        userId: order.userId,
        status: order.status,
        lines:
          order.items?.map((item) => ({
            sku: item.productId,
            qty: item.quantity,
          })) ?? [],
        shipTo: MOCK_ORDERS[orderId]?.shipTo ?? MOCK_ORDERS['ORD-1001'].shipTo,
      };
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

  let attempt = 1;
  let retryOrderId = `${originalOrderId}-R${attempt}`;
  while (await orderExists(retryOrderId)) {
    attempt += 1;
    retryOrderId = `${originalOrderId}-R${attempt}`;
  }

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

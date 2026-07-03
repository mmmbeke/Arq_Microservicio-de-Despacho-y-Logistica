export type ShipmentStatus = 'CREATED' | 'PICKING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED';

export interface ShipmentLine {
  sku: string;
  qty: number;
  description?: string;
}

export interface Address {
  fullName: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode?: string;
  country: string;
}

export interface Shipment {
  shipmentId: string;
  orderId: string;
  userId: string;
  status: ShipmentStatus;
  lines: ShipmentLine[];
  shipTo: Address;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  version: number;
}

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3007/v1';

export async function fetchShipments(): Promise<Shipment[]> {
  const res = await fetch(`${API_BASE}/shipments`);
  if (!res.ok) throw new Error('Error al cargar envíos');
  const data = await res.json();
  return data.items || []; // Backend returns paginated { items, total... }
}

export async function updateShipmentStatus(shipmentId: string, status: ShipmentStatus, version: number): Promise<Shipment> {
  const res = await fetch(`${API_BASE}/shipments/${shipmentId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': `"${version}"`
    },
    body: JSON.stringify({ status })
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al actualizar el estado');
  }
  
  return await res.json();
}

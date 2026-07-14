import type { Shipment, ShipmentStatus } from './types';

const API_URL = 'http://localhost:3007/v1/shipments';

export async function fetchShipments(): Promise<Shipment[]> {
  const res = await fetch(`${API_URL}?pageSize=50`);
  if (!res.ok) throw new Error('Failed to fetch shipments');
  const data = await res.json();
  return data.items || [];
}

export async function updateShipmentStatus(id: string, status: ShipmentStatus, version: number, driverId?: string): Promise<Shipment> {
  const payload: any = { status };
  if (driverId) payload.driverId = driverId;
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'If-Match': `"${version}"`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Error updating status');
  }
  return res.json();
}

export async function confirmDelivery(id: string, signature: string): Promise<Shipment> {
  const res = await fetch(`${API_URL}/${id}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `confirm-${id}-${Date.now()}`
    },
    body: JSON.stringify({ proof: signature })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to confirm delivery');
  }
  return res.json();
}

export async function rejectShipment(id: string, reason: string): Promise<Shipment> {
  const res = await fetch(`${API_URL}/${id}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `reject-${id}-${Date.now()}`
    },
    body: JSON.stringify({ reason })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to reject shipment');
  }
  return res.json();
}

export async function reshipShipment(id: string, reason: string): Promise<Shipment> {
  const res = await fetch(`${API_URL}/${id}/reship`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `reship-${id}-${Date.now()}`
    },
    body: JSON.stringify({ reason })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to reship');
  }
  return res.json();
}

export type ShipmentStatus = 'CREATED' | 'PICKING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED';

export interface ShipmentLine {
  sku: string;
  qty: number;
  description: string;
}

export interface Address {
  name: string;
  street: string;
  addressLine1?: string;
  city: string;
  zip: string;
}

export interface Shipment {
  shipmentId: string;
  orderId: string;
  userId: string;
  status: ShipmentStatus;
  lines: ShipmentLine[];
  shipTo: Address;
  driverId: string | null;
  driverName: string | null;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  version: number;
}

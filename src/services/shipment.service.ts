import { createHash } from 'crypto';
import {
  ConfirmShipmentRequest,
  CreateShipmentRequest,
  PatchShipmentStatusRequest,
  RejectShipmentRequest,
  Shipment,
  ShipmentPage,
  ShipmentStatus,
} from '../types/shipment.types';
import { AppError } from '../utils/errors';
import { fetchOrderSnapshot } from './order.client';
import { publishShipmentEvent } from './notification.publisher';
import {
  getIdempotencyEntry,
  getShipmentById,
  getShipmentByOrderId,
  isValidTransition,
  nextShipmentId,
  queryShipments,
  saveShipment,
  setIdempotencyEntry,
} from '../store/shipment.store';

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function assertIfMatch(shipment: Shipment, ifMatch: string | undefined, correlationId: string): void {
  if (!ifMatch) return;

  const expected = ifMatch.replace(/"/g, '');
  if (String(shipment.version) !== expected) {
    throw new AppError(
      412,
      'PRECONDITION_FAILED',
      'La versión del envío no coincide con If-Match.',
      correlationId
    );
  }
}

function requireIdempotencyKey(key: string | undefined, correlationId: string): string {
  if (!key?.trim()) {
    throw new AppError(
      400,
      'MISSING_IDEMPOTENCY_KEY',
      'El header Idempotency-Key es obligatorio.',
      correlationId
    );
  }
  return key.trim();
}

async function getShipmentOrThrow(shipmentId: string, correlationId: string): Promise<Shipment> {
  const shipment = await getShipmentById(shipmentId);
  if (!shipment) {
    throw new AppError(
      404,
      'SHIPMENT_NOT_FOUND',
      'No existe el envío solicitado.',
      correlationId
    );
  }
  return shipment;
}

async function applyStatusChange(
  shipment: Shipment,
  nextStatus: ShipmentStatus,
  correlationId: string,
  proof?: Record<string, unknown> | null
): Promise<Shipment> {
  if (!isValidTransition(shipment.status, nextStatus)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `No se puede pasar de ${shipment.status} a ${nextStatus}.`,
      correlationId
    );
  }

  const now = new Date().toISOString();
  const updated: Shipment = {
    ...shipment,
    status: nextStatus,
    updatedAt: now,
    version: shipment.version + 1,
    proof: proof ?? shipment.proof ?? null,
    deliveredAt: nextStatus === 'DELIVERED' ? now : shipment.deliveredAt ?? null,
  };

  return saveShipment(updated);
}

export async function listShipments(filters: {
  orderId?: string;
  status?: ShipmentStatus;
  page?: number;
  pageSize?: number;
}): Promise<ShipmentPage> {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);

  const { items, total } = await queryShipments({
    orderId: filters.orderId,
    status: filters.status,
    page,
    pageSize,
  });

  return { items, page, pageSize, total };
}

export async function getShipment(shipmentId: string, correlationId: string): Promise<Shipment> {
  return getShipmentOrThrow(shipmentId, correlationId);
}

export async function createShipment(
  body: CreateShipmentRequest,
  idempotencyKey: string | undefined,
  correlationId: string
): Promise<{ shipment: Shipment; statusCode: 200 | 201; isRetry: boolean }> {
  const key = requireIdempotencyKey(idempotencyKey, correlationId);

  if (!body?.orderId?.trim()) {
    throw new AppError(400, 'INVALID_REQUEST', 'El campo orderId es requerido.', correlationId);
  }

  const payloadHash = hashPayload(body);
  const cached = await getIdempotencyEntry(key);
  if (cached) {
    if (cached.payloadHash !== payloadHash) {
      throw new AppError(
        409,
        'ALREADY_PROCESSED',
        'Esta clave de idempotencia ya fue usada con otro payload o acto incompatible.',
        correlationId
      );
    }
    const shipment = await getShipmentById(cached.shipmentId);
    if (!shipment) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Inconsistencia en cache de idempotencia.', correlationId);
    }
    return { shipment, statusCode: cached.statusCode as 200 | 201, isRetry: true };
  }

  const existing = await getShipmentByOrderId(body.orderId);
  if (existing) {
    throw new AppError(
      409,
      'SHIPMENT_ALREADY_EXISTS',
      'Ya existe un envío para este pedido.',
      correlationId
    );
  }

  const order = await fetchOrderSnapshot(body.orderId);
  if (!order) {
    throw new AppError(
      422,
      'ORDER_NOT_READY_LOCALLY',
      'No hay snapshot de pedido listo para despacho.',
      correlationId
    );
  }

  if (order.status !== 'READY_TO_SHIP') {
    throw new AppError(
      422,
      'ORDER_NOT_READY',
      `El pedido ${body.orderId} no está en READY_TO_SHIP.`,
      correlationId
    );
  }

  const now = new Date().toISOString();
  const shipment = await saveShipment({
    shipmentId: nextShipmentId(),
    orderId: order.orderId,
    userId: order.userId,
    status: 'CREATED',
    lines: order.lines,
    shipTo: order.shipTo,
    createdAt: now,
    updatedAt: now,
    deliveredAt: null,
    proof: null,
    version: 1,
  });

  await setIdempotencyEntry(key, payloadHash, shipment.shipmentId, 201);
  await publishShipmentEvent(shipment, correlationId);

  return { shipment, statusCode: 201, isRetry: false };
}

export async function patchShipment(
  shipmentId: string,
  body: PatchShipmentStatusRequest,
  ifMatch: string | undefined,
  correlationId: string
): Promise<Shipment> {
  const shipment = await getShipmentOrThrow(shipmentId, correlationId);
  assertIfMatch(shipment, ifMatch, correlationId);

  if (!body?.status) {
    throw new AppError(400, 'INVALID_REQUEST', 'El campo status es requerido.', correlationId);
  }

  const updated = await applyStatusChange(shipment, body.status, correlationId, body.proof ?? null);
  await publishShipmentEvent(updated, correlationId);
  return updated;
}

export async function confirmShipment(
  shipmentId: string,
  body: ConfirmShipmentRequest | undefined,
  idempotencyKey: string | undefined,
  ifMatch: string | undefined,
  correlationId: string
): Promise<{ shipment: Shipment; isRetry: boolean }> {
  const key = requireIdempotencyKey(idempotencyKey, correlationId);
  const payloadHash = hashPayload({ action: 'confirm', shipmentId, body });
  const cached = await getIdempotencyEntry(`confirm:${key}`);

  if (cached) {
    if (cached.payloadHash !== payloadHash) {
      throw new AppError(409, 'ALREADY_PROCESSED', 'Esta confirmación ya fue procesada con otro payload.', correlationId);
    }
    return { shipment: await getShipmentOrThrow(cached.shipmentId, correlationId), isRetry: true };
  }

  const shipment = await getShipmentOrThrow(shipmentId, correlationId);
  assertIfMatch(shipment, ifMatch, correlationId);

  if (shipment.status === 'DELIVERED') {
    await setIdempotencyEntry(`confirm:${key}`, payloadHash, shipmentId, 200);
    return { shipment, isRetry: true };
  }

  if (shipment.status !== 'OUT_FOR_DELIVERY') {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      'Solo se puede confirmar un envío en OUT_FOR_DELIVERY.',
      correlationId
    );
  }

  const updated = await applyStatusChange(shipment, 'DELIVERED', correlationId, body?.proof ?? null);
  await setIdempotencyEntry(`confirm:${key}`, payloadHash, shipmentId, 200);
  await publishShipmentEvent(updated, correlationId);

  return { shipment: updated, isRetry: false };
}

export async function rejectShipment(
  shipmentId: string,
  body: RejectShipmentRequest | undefined,
  idempotencyKey: string | undefined,
  ifMatch: string | undefined,
  correlationId: string
): Promise<{ shipment: Shipment; isRetry: boolean }> {
  const key = requireIdempotencyKey(idempotencyKey, correlationId);
  const payloadHash = hashPayload({ action: 'reject', shipmentId, body });
  const cached = await getIdempotencyEntry(`reject:${key}`);

  if (cached) {
    if (cached.payloadHash !== payloadHash) {
      throw new AppError(409, 'ALREADY_PROCESSED', 'Este rechazo ya fue procesado con otro payload.', correlationId);
    }
    return { shipment: await getShipmentOrThrow(cached.shipmentId, correlationId), isRetry: true };
  }

  const shipment = await getShipmentOrThrow(shipmentId, correlationId);
  assertIfMatch(shipment, ifMatch, correlationId);

  if (shipment.status === 'FAILED') {
    await setIdempotencyEntry(`reject:${key}`, payloadHash, shipmentId, 200);
    return { shipment, isRetry: true };
  }

  if (!['CREATED', 'PICKING', 'OUT_FOR_DELIVERY'].includes(shipment.status)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      'El envío no puede rechazarse desde su estado actual.',
      correlationId
    );
  }

  const updated = await applyStatusChange(shipment, 'FAILED', correlationId, null);
  await setIdempotencyEntry(`reject:${key}`, payloadHash, shipmentId, 200);
  await publishShipmentEvent(updated, correlationId, body?.reason);

  return { shipment: updated, isRetry: false };
}

export function toEtag(version: number): string {
  return `"${version}"`;
}

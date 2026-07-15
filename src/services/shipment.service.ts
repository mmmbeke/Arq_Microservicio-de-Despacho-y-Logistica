import { createHash } from 'crypto';
import {
  ConfirmShipmentRequest,
  CreateShipmentRequest,
  PatchShipmentStatusRequest,
  RejectShipmentRequest,
  ReshipRequest,
  Shipment,
  ShipmentPage,
  ShipmentStatus,
} from '../types/shipment.types';
import { AppError } from '../utils/errors';
import { createRetryOrderFromFailed, fetchOrderSnapshot } from './order.client';
import { publishReshipRequested, publishShipmentEvent } from './notification.publisher';
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
import { getDriverById, updateDriverStatus } from '../store/driver.store';

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
  options?: {
    proof?: Record<string, unknown> | null;
    driverId?: string | null;
    driverName?: string | null;
  }
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
    proof: options?.proof ?? shipment.proof ?? null,
    deliveredAt: nextStatus === 'DELIVERED' ? now : shipment.deliveredAt ?? null,
    driverId: options?.driverId !== undefined ? options.driverId : shipment.driverId ?? null,
    driverName: options?.driverName !== undefined ? options.driverName : shipment.driverName ?? null,
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
    return { shipment, statusCode: 200, isRetry: true };
  }

  const existing = await getShipmentByOrderId(body.orderId);
  if (existing && existing.status !== 'FAILED') {
    throw new AppError(
      409,
      'SHIPMENT_ALREADY_EXISTS',
      'Ya existe un envío activo para este pedido.',
      correlationId
    );
  }

  const order = await fetchOrderSnapshot(body.orderId);
  
  // Si no encontramos el pedido, usamos valores mínimos pero válidos
  const now = new Date().toISOString();
  const shipment = await saveShipment({
    shipmentId: nextShipmentId(),
    orderId: body.orderId,
    userId: order?.userId ?? 'USR-UNKNOWN',
    status: 'CREATED',
    lines: order?.lines ?? [],
    shipTo: order?.shipTo ?? {
      fullName: 'Destinatario desconocido',
      addressLine1: 'Por determinar',
      city: 'Pendiente',
      country: 'CL',
    },
    createdAt: now,
    updatedAt: now,
    deliveredAt: null,
    proof: null,
    driverId: null,
    driverName: null,
    reshipOf: null,
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
  const original = await getShipmentOrThrow(shipmentId, correlationId);
  assertIfMatch(original, ifMatch, correlationId);

  if (!body?.status) {
    throw new AppError(400, 'INVALID_REQUEST', 'El campo status es requerido.', correlationId);
  }

  let newDriverId = original.driverId;
  let newDriverName = original.driverName;

  if (body.status === 'ASSIGNED') {
    if (!body.driverId?.trim()) {
      throw new AppError(
        400,
        'MISSING_DRIVER_ID',
        'El campo driverId es requerido al asignar repartidor.',
        correlationId
      );
    }
    const driverInput = body.driverId.trim();
    const driver = await getDriverById(driverInput);
    if (!driver) {
      throw new AppError(
        400,
        'INVALID_DRIVER_ID',
        `El conductor '${driverInput}' no existe en la base de datos. Intenta con DRV-01, DRV-02, etc.`,
        correlationId
      );
    }
    if (driver.status !== 'AVAILABLE') {
      throw new AppError(
        400,
        'DRIVER_UNAVAILABLE',
        `El conductor '${driverInput}' no está disponible (estado actual: ${driver.status}).`,
        correlationId
      );
    }
    newDriverId = driverInput;
    newDriverName = driver.driver_name;
  }

  const updated = await applyStatusChange(original, body.status, correlationId, {
    proof: body.proof ?? null,
    driverId: newDriverId,
    driverName: newDriverName,
  });
  
  if (body.status === 'ASSIGNED' && newDriverId) {
    await updateDriverStatus(newDriverId, 'BUSY');
  }
  
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

  const updated = await applyStatusChange(shipment, 'DELIVERED', correlationId, {
    proof: body?.proof ?? null,
  });
  
  if (shipment.driverId) {
    await updateDriverStatus(shipment.driverId, 'AVAILABLE');
  }
  
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

  if (!['CREATED', 'PICKING', 'ASSIGNED', 'OUT_FOR_DELIVERY'].includes(shipment.status)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      'El envío no puede rechazarse desde su estado actual.',
      correlationId
    );
  }

  const updated = await applyStatusChange(shipment, 'FAILED', correlationId, { proof: null });
  
  if (shipment.driverId) {
    await updateDriverStatus(shipment.driverId, 'AVAILABLE');
  }
  
  await setIdempotencyEntry(`reject:${key}`, payloadHash, shipmentId, 200);
  await publishShipmentEvent(updated, correlationId, body?.reason);

  return { shipment: updated, isRetry: false };
}

export async function reshipShipment(
  shipmentId: string,
  body: ReshipRequest | undefined,
  idempotencyKey: string | undefined,
  correlationId: string
): Promise<{ shipment: Shipment; statusCode: 200 | 201; isRetry: boolean }> {
  const key = requireIdempotencyKey(idempotencyKey, correlationId);
  const payloadHash = hashPayload({ action: 'reship', shipmentId, body });
  const cached = await getIdempotencyEntry(`reship:${key}`);

  if (cached) {
    if (cached.payloadHash !== payloadHash) {
      throw new AppError(
        409,
        'ALREADY_PROCESSED',
        'Este reenvío ya fue procesado con otro payload.',
        correlationId
      );
    }
    return {
      shipment: await getShipmentOrThrow(cached.shipmentId, correlationId),
      statusCode: 200,
      isRetry: true,
    };
  }

  const original = await getShipmentOrThrow(shipmentId, correlationId);

  if (original.status !== 'FAILED') {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      'Solo se puede reenviar un envío en estado FAILED.',
      correlationId
    );
  }

  const retryOrder = await createRetryOrderFromFailed(original.orderId, {
    userId: original.userId,
    lines: original.lines,
    shipTo: original.shipTo,
  });

  const existing = await getShipmentByOrderId(retryOrder.orderId);
  if (existing && existing.status !== 'FAILED') {
    throw new AppError(
      409,
      'SHIPMENT_ALREADY_EXISTS',
      'Ya existe un envío activo para el pedido de reintento.',
      correlationId
    );
  }

  const now = new Date().toISOString();
  const newShipment = await saveShipment({
    shipmentId: nextShipmentId(),
    orderId: retryOrder.orderId,
    userId: retryOrder.userId,
    status: 'CREATED',
    lines: retryOrder.lines,
    shipTo: retryOrder.shipTo,
    driverId: null,
    driverName: null,
    reshipOf: original.shipmentId,
    createdAt: now,
    updatedAt: now,
    deliveredAt: null,
    proof: null,
    version: 1,
  });

  await setIdempotencyEntry(`reship:${key}`, payloadHash, newShipment.shipmentId, 201);
  await publishReshipRequested(original, newShipment, correlationId, body?.reason);
  await publishShipmentEvent(newShipment, correlationId);

  return { shipment: newShipment, statusCode: 201, isRetry: false };
}

export function toEtag(version: number): string {
  return `"${version}"`;
}

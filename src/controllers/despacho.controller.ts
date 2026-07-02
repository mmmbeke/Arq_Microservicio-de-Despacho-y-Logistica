import { Request, Response } from 'express';
import { ShipmentStatus } from '../types/shipment.types';
import * as shipmentService from '../services/shipment.service';
import { getCorrelationId, handleControllerError } from '../utils/errors';

function paramId(req: Request): string {
  const value = req.params.id;
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: unknown): ShipmentStatus | undefined {
  const allowed: ShipmentStatus[] = [
    'CREATED',
    'PICKING',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'FAILED',
  ];
  return typeof value === 'string' && allowed.includes(value as ShipmentStatus)
    ? (value as ShipmentStatus)
    : undefined;
}

export const listShipments = async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req.header('X-Correlation-Id'));

  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;

    const result = await shipmentService.listShipments({
      orderId: typeof req.query.orderId === 'string' ? req.query.orderId : undefined,
      status: parseStatus(req.query.status),
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    });

    res.status(200).json(result);
  } catch (error) {
    handleControllerError(res, error, correlationId);
  }
};

export const getShipment = async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req.header('X-Correlation-Id'));

  try {
    const shipment = await shipmentService.getShipment(paramId(req), correlationId);
    res
      .status(200)
      .set('ETag', shipmentService.toEtag(shipment.version))
      .json(shipment);
  } catch (error) {
    handleControllerError(res, error, correlationId);
  }
};

export const createShipment = async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req.header('X-Correlation-Id'));

  try {
    const result = await shipmentService.createShipment(
      req.body,
      req.header('Idempotency-Key'),
      correlationId
    );

    const statusCode = result.statusCode;
    res
      .status(statusCode)
      .set('Location', `/v1/shipments/${result.shipment.shipmentId}`)
      .set('ETag', shipmentService.toEtag(result.shipment.version))
      .json(result.shipment);
  } catch (error) {
    handleControllerError(res, error, correlationId);
  }
};

export const updateShipment = async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req.header('X-Correlation-Id'));

  try {
    const shipment = await shipmentService.patchShipment(
      paramId(req),
      req.body,
      req.header('If-Match'),
      correlationId
    );

    res
      .status(200)
      .set('ETag', shipmentService.toEtag(shipment.version))
      .json(shipment);
  } catch (error) {
    handleControllerError(res, error, correlationId);
  }
};

export const confirmShipment = async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req.header('X-Correlation-Id'));

  try {
    const result = await shipmentService.confirmShipment(
      paramId(req),
      req.body,
      req.header('Idempotency-Key'),
      req.header('If-Match'),
      correlationId
    );

    res
      .status(200)
      .set('ETag', shipmentService.toEtag(result.shipment.version))
      .json(result.shipment);
  } catch (error) {
    handleControllerError(res, error, correlationId);
  }
};

export const rejectShipment = async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req.header('X-Correlation-Id'));

  try {
    const result = await shipmentService.rejectShipment(
      paramId(req),
      req.body,
      req.header('Idempotency-Key'),
      req.header('If-Match'),
      correlationId
    );

    res
      .status(200)
      .set('ETag', shipmentService.toEtag(result.shipment.version))
      .json(result.shipment);
  } catch (error) {
    handleControllerError(res, error, correlationId);
  }
};

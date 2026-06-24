import { Request, Response } from 'express';

// GET /v1/shipments — Listar envíos
export const listShipments = (_req: Request, res: Response) => {
  res.status(200).json({
    items: [
      {
        shipmentId: 'shp_a1b2c3',
        orderId: 'ORD-1001',
        userId: 'USR-01',
        status: 'OUT_FOR_DELIVERY',
        createdAt: '2026-06-15T10:00:00Z',
        updatedAt: '2026-06-16T12:00:00Z',
        version: 2,
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
  });
};

// GET /v1/shipments/:id — Obtener un envío
export const getShipment = (req: Request, res: Response) => {
  res.status(200).json({
    shipmentId: req.params.id,
    orderId: 'ORD-1001',
    userId: 'USR-01',
    status: 'OUT_FOR_DELIVERY',
    version: 2,
    shipTo: {
      fullName: 'Juan Perez',
      addressLine1: 'Avenida Siempreviva 742',
      city: 'Santiago',
      country: 'CL',
    },
  });
};

// POST /v1/shipments — Crear envío (desde Pedidos G5)
export const createShipment = (req: Request, res: Response) => {
  res.status(201).json({
    shipmentId: 'shp_nuevo999',
    orderId: req.body.orderId || 'ORD-TEST',
    userId: 'USR-01',
    status: 'CREATED',
    createdAt: new Date().toISOString(),
    version: 1,
  });
};

// PATCH /v1/shipments/:id — Actualizar estado (PICKING / OUT_FOR_DELIVERY)
export const updateShipment = (req: Request, res: Response) => {
  res.status(200).json({
    shipmentId: req.params.id,
    status: req.body.status || 'PICKING',
    version: 3,
    updatedAt: new Date().toISOString(),
  });
};

// POST /v1/shipments/:id/confirm — Confirmar entrega (idempotente)
export const confirmShipment = (req: Request, res: Response) => {
  const idempotencyKey = req.header('Idempotency-Key');

  if (!idempotencyKey) {
    res.status(400).json({
      timestamp: new Date().toISOString(),
      status: 400,
      code: 'MISSING_HEADER',
      message: 'Falta el header Idempotency-Key',
    });
    return;
  }

  res.status(200).json({
    shipmentId: req.params.id,
    status: 'DELIVERED',
    version: 4,
    deliveredAt: new Date().toISOString(),
  });
};

// POST /v1/shipments/:id/reject — Fallar entrega (idempotente)
export const rejectShipment = (req: Request, res: Response) => {
  res.status(200).json({
    shipmentId: req.params.id,
    status: 'FAILED',
    version: 4,
    updatedAt: new Date().toISOString(),
  });
};

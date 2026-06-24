import { Router } from 'express';
import * as despachoController from '../controllers/despacho.controller';

export const despachoRouter = Router();

despachoRouter.get('/', despachoController.listShipments);
despachoRouter.get('/:id', despachoController.getShipment);
despachoRouter.post('/', despachoController.createShipment);
despachoRouter.patch('/:id', despachoController.updateShipment);
despachoRouter.post('/:id/confirm', despachoController.confirmShipment);
despachoRouter.post('/:id/reject', despachoController.rejectShipment);

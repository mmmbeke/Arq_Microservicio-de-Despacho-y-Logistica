import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { despachoRouter } from './routes/despacho.routes';
import { initStore, getPersistenceMode } from './store/shipment.store';
import { AppError, getCorrelationId, handleControllerError } from './utils/errors';
import { closeRabbit, getRabbitStatus, initRabbitTopology, isRabbitEnabled } from './config/rabbitmq';
import { startOrderConsumer } from './messaging/order.consumer';

const openApiPath = path.join(__dirname, '../docs/openapi.yaml');
const swaggerDocument = YAML.load(openApiPath);

const app = express();
const PORT = process.env.PORT || 3007;

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  const consumer = req.header('X-Consumer') ?? 'unknown';
  const correlationId = req.header('X-Correlation-Id') ?? 'sin-correlation-id';
  console.log(`[${req.method}] ${req.path} consumer=${consumer} correlationId=${correlationId}`);
  next();
});

console.log('Iniciando Microservicio de Despacho y Logística (G8)...');

app.get('/', (_req, res) => {
  res.redirect('/api-docs');
});

app.use('/v1/shipments', despachoRouter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/docs/openapi.yaml', (_req, res) => {
  res.type('application/yaml').sendFile(openApiPath);
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'despacho',
    persistence: getPersistenceMode(),
    rabbitmq: getRabbitStatus(),
    messaging: isRabbitEnabled() ? 'rabbitmq+rest' : 'rest-only',
  });
});

app.use((req, res) => {
  const correlationId = getCorrelationId(req.header('X-Correlation-Id'));
  handleControllerError(
    res,
    new AppError(404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`, correlationId),
    correlationId
  );
});

async function start(): Promise<void> {
  await initStore();

  try {
    await initRabbitTopology();
    await startOrderConsumer();
  } catch (error) {
    console.error('[rabbitmq] no se pudo iniciar (el API REST sigue activo):', error);
  }

  app.listen(PORT, () => {
    console.log(`Servidor de Despacho corriendo en: http://localhost:${PORT}`);
    console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`OpenAPI YAML: http://localhost:${PORT}/docs/openapi.yaml`);
    console.log(`Persistencia: ${getPersistenceMode()}`);
    console.log(`RabbitMQ: ${getRabbitStatus()}`);
    console.log(`Prueba: GET http://localhost:${PORT}/v1/shipments`);
  });
}

process.on('SIGINT', () => {
  void closeRabbit().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void closeRabbit().finally(() => process.exit(0));
});

start().catch((err) => {
  console.error('Error al iniciar el servicio:', err);
  process.exit(1);
});

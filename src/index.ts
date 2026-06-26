import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { despachoRouter } from './routes/despacho.routes';

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

app.use('/v1/shipments', despachoRouter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/docs/openapi.yaml', (_req, res) => {
  res.type('application/yaml').sendFile(openApiPath);
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'despacho' });
});

app.listen(PORT, () => {
  console.log(`Servidor de Despacho corriendo en: http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`OpenAPI YAML: http://localhost:${PORT}/docs/openapi.yaml`);
  console.log(`Prueba: GET http://localhost:${PORT}/v1/shipments`);
});

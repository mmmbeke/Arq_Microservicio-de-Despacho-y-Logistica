import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { despachoRouter } from './routes/despacho.routes';

const app = express();
const PORT = process.env.PORT || 3007;

app.use(cors());
app.use(express.json());

console.log('Iniciando Microservicio de Despacho y Logística (G8)...');

app.use('/v1/shipments', despachoRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'despacho' });
});

app.listen(PORT, () => {
  console.log(`Servidor de Despacho corriendo en: http://localhost:${PORT}`);
  console.log(`Prueba: GET http://localhost:${PORT}/v1/shipments`);
});

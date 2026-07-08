# E4 — Integración con RabbitMQ (G8 Despacho)

## Resumen

G8 usa **RabbitMQ (topic exchange)** para integrarse con el ecosistema FishMarket:

| Dirección | Grupo | Mecanismo |
|-----------|-------|-----------|
| **Consume** | G5 Pedidos | Cola `g8.dispatch.orders` ← eventos `ReadyToShip` |
| **Publica** | G9 Notificaciones | Exchange → routing keys `shipment.*` / `ShipmentCreated` |
| **Expone REST** | G10 Reportería | `GET /v1/shipments` (sin Rabbit) |

REST sigue disponible como respaldo (`POST /v1/shipments`, `POST /notifications/events` hacia G9).

---

## Variables de entorno

```env
# RabbitMQ (CloudAMQP, Render RabbitMQ, o broker del curso)
RABBITMQ_URL=amqps://user:pass@host/vhost

# Topología (acordar con G5/G9 si usan otros nombres)
RABBITMQ_EXCHANGE=fishmarket.events
RABBITMQ_ORDER_QUEUE=g8.dispatch.orders
RABBITMQ_ORDER_ROUTING_KEYS=ReadyToShip,OrderReadyToShip,order.ready_to_ship

# Opcional: forzar una routing key al publicar
# RABBITMQ_PUBLISH_ROUTING_KEY=shipment.created

# G5 / G9 REST (híbrido)
G5_ORDER_SERVICE_URL=https://g5.onrender.com
G9_NOTIFICATION_SERVICE_URL=https://g9.onrender.com
G9_NOTIFY_VIA_REST=true
```

Configurar las mismas variables en **Render → Environment** y hacer **Manual Deploy**.

---

## Flujo integrado

### 1. G5 → G8 (consumer)

G5 publica en el exchange:

```json
{
  "eventId": "uuid",
  "eventType": "ReadyToShip",
  "correlationId": "corr-001",
  "payload": {
    "orderId": "ORD-1001"
  }
}
```

G8 consume la cola `g8.dispatch.orders`, consulta G5 (`GET /orders/{orderId}`), valida `READY_TO_SHIP` y crea el envío.

### 2. G8 → G9 (publisher)

Al cambiar estado, G8 publica:

```json
{
  "eventId": "uuid",
  "eventType": "ShipmentCreated",
  "version": "1.0",
  "occurredAt": "2026-07-08T...",
  "producer": "dispatch-service",
  "correlationId": "corr-001",
  "payload": {
    "userId": "USR-01",
    "orderId": "ORD-1001",
    "shipmentId": "shp_...",
    "status": "CREATED"
  }
}
```

Routing keys publicadas:
- `shipment.created` (topic)
- `ShipmentCreated` (compatibilidad literal)

G9 debe enlazar su cola a esas keys (o a `shipment.*`).

---

## Verificación

### Health

```bash
GET /health
```

```json
{
  "status": "ok",
  "service": "despacho",
  "persistence": "supabase",
  "rabbitmq": "connected",
  "messaging": "rabbitmq+rest"
}
```

### Logs esperados al arrancar

```text
[rabbitmq] OK — exchange=fishmarket.events queue=g8.dispatch.orders keys=[ReadyToShip, ...]
[rabbitmq] consumer activo en cola g8.dispatch.orders
```

### Al crear envío / recibir evento

```text
[rabbitmq] consumiendo ReadyToShip orderId=ORD-1001 correlationId=corr-001
[rabbitmq] publicado ShipmentCreated → fishmarket.events/shipment.created
```

---

## Acuerdo con otros grupos (checklist)

### Con G5

- [ ] Mismo `RABBITMQ_EXCHANGE`
- [ ] G5 publica `ReadyToShip` con `payload.orderId`
- [ ] G5 expone `GET /orders/{orderId}` con `status: "READY_TO_SHIP"`
- [ ] Un `orderId` de prueba compartido

### Con G9

- [ ] Mismo exchange
- [ ] G9 enlaza cola a `shipment.*` o `ShipmentCreated`, `ShipmentDelivered`, `ShipmentFailed`
- [ ] Confirman recepción en logs

### Con G10

- [ ] Les pasamos URL REST: `GET /v1/shipments`
- [ ] No requieren Rabbit

---

## Prueba manual (publicar evento como G5)

Desde RabbitMQ Management UI o script del broker, publicar en el exchange:

- **Exchange:** `fishmarket.events`
- **Routing key:** `ReadyToShip`
- **Body:** JSON de arriba con `orderId` real

G8 debe crear el envío y publicar `ShipmentCreated`.

---

## Evidencias E4

1. Captura `/health` con `rabbitmq: connected`
2. Log consumer + publisher con mismo `correlationId`
3. Fila nueva en Supabase `shipments`
4. G9 confirma evento recibido
5. Caso error: pedido no READY → log `evento rechazado` sin caída del servicio

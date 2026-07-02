# Microservicio de Despacho y Logística - Grupo 8

> **Universidad Tecnológica Metropolitana (UTEM)**  
> **Proyecto:** Mini Marketplace Cloud (FishMarket)

Este repositorio contiene la implementación del **Microservicio de Despacho y Logística**, encargado de gestionar el ciclo de vida de los envíos, las transiciones de estado logístico y la emisión de eventos transaccionales para el ecosistema FishMarket.

Implementa un diseño orientado a eventos (EDA), asegurando operaciones asincrónicas y un bajo nivel de acoplamiento con el resto de la plataforma.

## Equipo de Desarrollo

*   Francisco Duran
*   Moisés Jiménez
*   Martín Aravena
*   Lucas Martinez

---

## Enlaces Importantes (Entrega 2)

*   **URL servicio (producción):** https://arq-microservicio-de-despacho-y-logistica.onrender.com
*   **Swagger UI:** https://arq-microservicio-de-despacho-y-logistica.onrender.com/api-docs
*   **Health check:** https://arq-microservicio-de-despacho-y-logistica.onrender.com/health
*   **Documentación API (OpenAPI):** `/docs/openapi.yaml`
*   **Schema BD:** `/docs/schema.sql`
*   **Colección de pruebas (Bruno):** `/docs/G8_Coleccion/` (importar carpeta en Bruno)

---

## URLs del servicio

| Entorno | API | Swagger | Health |
| :--- | :--- | :--- | :--- |
| **Producción (Render)** | https://arq-microservicio-de-despacho-y-logistica.onrender.com | `/api-docs` | `/health` |
| **Local** | http://localhost:3007 | http://localhost:3007/api-docs | http://localhost:3007/health |

---

## Cómo correr localmente

```bash
git clone https://github.com/mmmbeke/Arq_Microservicio-de-Despacho-y-Logistica.git
cd Arq_Microservicio-de-Despacho-y-Logistica
npm install
cp .env.example .env   # completar variables (ver abajo)
npm run dev
```

Verificar conexión a Supabase:

```bash
GET http://localhost:3007/health
```

Respuesta esperada:

```json
{ "status": "ok", "service": "despacho", "persistence": "supabase" }
```

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
| :--- | :---: | :--- |
| `PORT` | No | Puerto local (default `3007`). Render lo asigna automáticamente. |
| `SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Secret key del backend (Settings → API Keys → Secret keys) |
| `SUPABASE_ANON_KEY` | No | No usada por el backend actualmente |
| `G5_ORDER_SERVICE_URL` | No | URL mock/servicio de pedidos (opcional) |
| `G9_NOTIFICATION_SERVICE_URL` | No | URL mock/servicio de notificaciones (opcional) |

> **Nunca** subir el archivo `.env` al repositorio.

---

## Base de datos (Supabase)

1. Crear proyecto en [supabase.com](https://supabase.com)
2. En **SQL Editor**, ejecutar `docs/schema.sql` y luego `docs/seed.sql` (datos demo Bruno)
3. Verificar tablas `shipments` e `idempotency_keys` en **Table Editor**
4. Copiar credenciales a `.env` (local) y a **Render → Environment** (producción)

Guía paso a paso para local: **`docs/SUPABASE_LOCAL.md`**

Tablas principales:

| Tabla | Uso |
| :--- | :--- |
| `shipments` | Envíos y estados logísticos |
| `idempotency_keys` | Cache de idempotencia para POST create/confirm/reject |

---

## Deploy en Render

1. Conectar repositorio de GitHub en [render.com](https://render.com)
2. Crear **Web Service** con runtime **Docker** (detecta el `Dockerfile`)
3. Agregar variables de entorno:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. **Manual Deploy** → último commit de `main`
5. Verificar: `/health` debe responder `"persistence": "supabase"`

> En plan Free, el servicio puede tardar ~30–50 s en despertar tras inactividad.

---

## Pruebas con Bruno

1. Instalar [Bruno](https://www.usebruno.com/)
2. Importar la colección desde `docs/G8_Coleccion/`
3. Configurar variable de entorno `baseUrl`:
   - Local: `http://localhost:3007`
   - Producción: `https://arq-microservicio-de-despacho-y-logistica.onrender.com`
4. Ejecutar requests de health, listado, obtener envío, crear, confirmar y rechazar

También puedes importar `docs/openapi.yaml` directamente en Bruno para generar requests desde el contrato.

---

## Evidencias de entrega

| Entregable | Dónde obtenerlo |
| :--- | :--- |
| URL servicio cloud | Render dashboard + README |
| Base de datos funcionando | Captura Supabase Table Editor con datos |
| Documentación endpoints | `/api-docs` + `docs/openapi.yaml` |
| Deploy documentado | Sección Render de este README |
| Pruebas funcionales | Colección Bruno + capturas de respuestas |

---

## Stack Tecnológico

Nuestra arquitectura se basa en las siguientes tecnologías modernas:

*   **Backend / API:** Node.js + TypeScript
*   **Frontend (Panel Logístico):** React
*   **Base de Datos:** PostgreSQL (Supabase)
*   **Mensajería (Eventos):** REST hacia G9 (`POST /notifications/events`)
*   **Despliegue Backend:** Render
*   **Despliegue Frontend:** Vercel

---

## Funcionalidades Principales

Este componente es el dueño absoluto de los datos de logística. Sus tareas abarcan:

*   Recepción y registro de nuevas órdenes de despacho.
*   Administración de los cambios de estado durante el traslado de los paquetes.
*   Disponibilidad de una API REST para la consulta del estado de las entregas.
*   Publicación de notificaciones al ecosistema ante eventos transaccionales clave.

> **Nota de alcance:** Este módulo no gestiona pagos, no descuenta inventario físico de las bodegas ni envía correos electrónicos o mensajes directamente a los clientes finales.

---

## Arquitectura y Patrones

El microservicio está diseñado bajo los siguientes patrones:

1.  **Arquitectura Hexagonal:** Separación estricta entre la lógica de negocio (dominio) y la infraestructura (transporte REST/Eventos y base de datos).
2.  **Database-Per-Service:** Base de datos aislada en Supabase; ningún otro servicio interactúa directamente con nuestras tablas.
3.  **Idempotencia Transaccional:** Control estricto en los endpoints de mutación (`/confirm`, `/reject`) para evitar inconsistencias por reintentos de red.
4.  **Optimistic Locking:** Uso de versionado en la entidad `Envio` para mitigar colisiones de concurrencia.

### Máquina de Estados
El ciclo de vida de un envío permite únicamente las siguientes transiciones:
1. `CREATED`
2. `PICKING`
3. `ASSIGNED` (asignación de repartidor con `driverId`)
4. `OUT_FOR_DELIVERY`
5. `DELIVERED`
6. `FAILED`

**Reenvío tras fallo:** `POST /v1/shipments/{id}/reship` crea un nuevo envío cuando el original está en `FAILED`. G8 coordina con G5 generando un pedido de reintento (`orderId-R1`) y publica `ShipmentReshipRequested`.

---

## Integraciones del Ecosistema

La comunicación híbrida del servicio se estructura con 4 áreas de FishMarket:

| Grupo | Componente | Protocolo | Interacción del Grupo 8 |
| :--- | :--- | :--- | :--- |
| **G1** | Frontend | REST | Exposición de datos para la interfaz de rastreo del usuario final. |
| **G5** | Pedidos | Híbrido (Evento y REST) | Recibe alertas para iniciar despachos y notifica entregas para cerrar el pedido. |
| **G9** | Notificaciones | REST | Publica eventos vía `POST /notifications/events`. |
| **G10** | Reportería | REST | Provee información para la consolidación de métricas y actualización de dashboards. |

---

## Estructura del Proyecto

```text
Arq_Microservicio-de-Despacho-y-Logistica/
├── docs/
│   ├── openapi.yaml               # Contrato OpenAPI
│   ├── schema.sql                 # Script tablas Supabase
│   └── G8_Coleccion/              # Colección Bruno (pruebas)
├── src/
│   ├── config/
│   │   └── supabase.ts            # Cliente de Supabase
│   ├── controllers/
│   │   └── despacho.controller.ts # Handlers REST (shipments + reship)
│   ├── middlewares/
│   │   └── auth.middleware.ts     # Validación de JWT (Bearer)
│   ├── routes/
│   │   └── despacho.routes.ts     # Definición de rutas
│   ├── services/
│   │   └── shipment.service.ts    # Lógica de negocio
│   ├── store/
│   │   └── shipment.store.ts      # Persistencia Supabase / memoria
│   └── index.ts                   # Entry point Express
├── .env.example                   # PORT=3007 + claves Supabase vacías
├── .gitignore                     # Ignora node_modules, dist, .env
├── Dockerfile                     # Imagen node:20, expone 3007
├── package.json                   # Scripts dev/start/build + stack acordado
└── tsconfig.json                  # Configuración de TypeScript

```

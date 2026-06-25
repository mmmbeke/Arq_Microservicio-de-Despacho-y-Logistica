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

*   **Documentación API (Swagger/OpenAPI):** Ver archivo `/docs/openapi.yaml`
*   **Colección de Pruebas:** Ver archivo `/docs/G8_Coleccion.json` (Importar en Postman/Insomnia)
*   **Diagrama de Base de Datos:** Ver archivo `/docs/database_schema.png`

---

## Stack Tecnológico

Nuestra arquitectura se basa en las siguientes tecnologías modernas:

*   **Backend / API:** Node.js + TypeScript
*   **Frontend (Panel Logístico):** React
*   **Base de Datos:** PostgreSQL (Supabase)
*   **Mensajería (Eventos):** Supabase Realtime
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
El ciclo de vida de un envío permite únicamente los siguientes estados secuenciales y estrictos:
1. `CREATED`
2. `PICKING`
3. `OUT_FOR_DELIVERY`
4. `DELIVERED`
5. `FAILED`

---

## Integraciones del Ecosistema

La comunicación híbrida del servicio se estructura con 4 áreas de FishMarket:

| Grupo | Componente | Protocolo | Interacción del Grupo 8 |
| :--- | :--- | :--- | :--- |
| **G1** | Frontend | REST | Exposición de datos para la interfaz de rastreo del usuario final. |
| **G5** | Pedidos | Híbrido (Evento y REST) | Recibe alertas para iniciar despachos y notifica entregas para cerrar el pedido. |
| **G9** | Notificaciones | Supabase Realtime | Emite eventos de estado para que este grupo dispare las alertas correspondientes. |
| **G10** | Reportería | REST | Provee información para la consolidación de métricas y actualización de dashboards. |

---

## Estructura del Proyecto

```text
Arq_Microservicio-de-Despacho-y-Logistica/
├── src/
│   ├── config/
│   │   └── supabase.ts            # Cliente de Supabase
│   ├── controllers/
│   │   └── despacho.controller.ts # La lógica de tus 6 endpoints
│   ├── middlewares/
│   │   └── auth.middleware.ts     # Validación de JWT (Bearer)
│   ├── routes/
│   │   └── despacho.routes.ts     # Solo define las rutas
│   └── index.ts                   # Entry point: crea Express, monta rutas, app.listen()
├── .env.example                   # PORT=3007 + claves Supabase vacías
├── .gitignore                     # Ignora node_modules, dist, .env
├── Dockerfile                     # Imagen node:20, expone 3007
├── package.json                   # Scripts dev/start/build + stack acordado
└── tsconfig.json                  # Configuración de TypeScript

```

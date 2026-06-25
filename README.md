# Arq_Microservicio_de_Despacho_y_Logistica
## Área de desarrollo de Despacho y Logística para el microservicio de FishMarket. 
## **Proyecto:** Mini Marketplace Cloud (FishMarket)

Este repositorio contiene la implementación del **Microservicio de Despacho y Logística** (Grupo 8), encargado de gestionar el ciclo de vida de los envíos, transiciones de estado logístico y emisión de eventos transaccionales para el ecosistema FishMarket.

##  Stack Tecnológico

## Nuestra arquitectura se basa en las siguientes tecnologías: 

*   **Backend / API:** Node.js + TypeScript
*   **Frontend (Panel Logístico):** React
*   **Base de Datos:** PostgreSQL (Supabase)
*   **Despliegue Backend:** Render
*   **Despliegue Frontend:** Vercel

## Enlaces Importantes:

*   **Documentación API (Swagger/OpenAPI):** 
*   **Colección de Pruebas:**
*   **Diagrama de Base de Datos:**

## Arquitectura y Patrones

## Arquitectura a seguir

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

El microservicio está diseñado bajo los siguientes patrones:
1.  **Arquitectura Hexagonal:** Separación estricta entre la lógica de negocio (dominio) y la infraestructura (transporte REST/Eventos y base de datos).
2.  **Database:** Base de datos aislada en Supabase; ningún otro servicio interactúa directamente con nuestras tablas.
3.  **Idempotencia Transaccional:** Control estricto en los endpoints de mutación (`/confirm`, `/reject`) para evitar inconsistencias por reintentos de red.
4.  **Optimistic Locking:** Uso de versionado en la entidad `Envio` para mitigar colisiones de concurrencia.


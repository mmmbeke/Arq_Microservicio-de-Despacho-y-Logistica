# Colección Bruno — G8 Despacho y Logística

## 1. Levantar el servidor

```bash
npm install
npm run dev
```

Debe mostrar: `Servidor de Despacho corriendo en: http://localhost:3007`

## 2. Abrir la colección en Bruno

1. Abre **Bruno**.
2. Menú **Collection** → **Open Collection** (no uses "Create Collection").
3. Navega y selecciona esta carpeta exacta: `docs/G8_Coleccion`
4. Deberías ver la carpeta **requests** con los 12 requests (01–12).
5. Entorno **local** con variable `base_url` = `http://localhost:3007`

## 3. Ejecutar las pruebas (orden 01 → 12)

**Importante antes de Run Collection:**

- **Memoria**: reinicia el servidor (`Ctrl+C` → `npm run dev`).
- **Supabase**: ejecuta de nuevo `docs/seed.sql` en SQL Editor.

| # | Request | Resultado esperado |
|---|---------|-------------------|
| 01 | Health check | `200`, `persistence`: `supabase` o `memory` |
| 02 | Listar envíos | `200`, 5 envíos seed |
| 03 | Obtener `shp_a1b2c3` | `200`, `OUT_FOR_DELIVERY` |
| 04 | ID inexistente | `404`, `SHIPMENT_NOT_FOUND` |
| 05 | Crear `ORD-1006` | `201` |
| 06 | Idempotencia crear | `200`, mismo `shipmentId` |
| 07 | PATCH → PICKING | `200`, `PICKING` |
| 08 | PATCH → ASSIGNED | `200`, `ASSIGNED`, `driverId` |
| 09 | PATCH → OUT_FOR_DELIVERY | `200`, `OUT_FOR_DELIVERY` |
| 10 | Confirmar `shp_a1b2c3` | `200`, `DELIVERED` |
| 11 | Rechazar `shp_b2c3d4` | `200`, `FAILED` |
| 12 | Reship `shp_d4e5f6` | `201`, `orderId`: `ORD-1004-R1`, `reshipOf` |

Flujo logístico: `CREATED → PICKING → ASSIGNED → OUT_FOR_DELIVERY → DELIVERED | FAILED`

## 4. Supabase

Si agregaste ASSIGNED recién, ejecuta en SQL Editor el bloque `ALTER` de `docs/schema.sql` y luego `docs/seed.sql`.

## 5. Verificación rápida

```bash
node scripts/run-bruno-tests.mjs
```

# Conectar Supabase en local (G8)

El backend ya está preparado: si existen `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env`, usa PostgreSQL. Si no, usa **memoria** (como ahora).

Hay **dos formas** de trabajar en local. Para el curso, la **Opción A** suele ser la más simple.

---

## Opción A — App local + proyecto Supabase en la nube (recomendada)

Tu `npm run dev` corre en tu PC, pero la base de datos está en [supabase.com](https://supabase.com).

### 1. Crear proyecto

1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Elige organización, nombre (ej. `g8-despacho`) y contraseña de BD.
3. Espera a que termine de crearse (~1 min).

### 2. Crear tablas y datos demo

En el proyecto → **SQL Editor** → **New query**:

1. Pega y ejecuta todo `docs/schema.sql`.
2. Pega y ejecuta todo `docs/seed.sql` (5 envíos para Bruno).

Verifica en **Table Editor** que existan `shipments` e `idempotency_keys`.

### 3. Copiar credenciales

**Project Settings** → **API** (o **API Keys**):

| Variable en `.env` | Dónde copiarla |
|------------------|----------------|
| `SUPABASE_URL` | **Project URL** (ej. `https://xxxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret key** (`service_role`) — **no** la `anon` |

### 4. Archivo `.env` en la raíz del repo

```bash
cp .env.example .env
```

Edita `.env`:

```env
PORT=3007
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> No subas `.env` a Git.

### 5. Levantar y verificar

```bash
npm run dev
```

En consola debe decir:

```
[store] Persistencia: Supabase (PostgreSQL)
[store] Supabase OK — 5 envíos en BD
```

Prueba en Bruno **01 Health check** → debe responder:

```json
{ "status": "ok", "service": "despacho", "persistence": "supabase" }
```

---

## Opción B — Supabase 100 % local (Docker)

Requiere **Docker Desktop** instalado y en ejecución.

### 1. Instalar CLI

```bash
npm install -g supabase
```

O desde [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli).

### 2. Inicializar en el repo (una vez)

```bash
cd ruta/al/repo
supabase init
supabase start
```

La primera vez descarga imágenes Docker (puede tardar varios minutos).

### 3. Ver credenciales locales

```bash
supabase status
```

Copia:

- **API URL** → `SUPABASE_URL` (suele ser `http://127.0.0.1:54321`)
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

Pégalas en tu `.env` como en la Opción A.

### 4. Crear tablas y seed

Abre **Studio local**: `http://127.0.0.1:54323` → **SQL Editor**  
Ejecuta `docs/schema.sql` y luego `docs/seed.sql`.

### 5. Parar / reiniciar Supabase local

```bash
supabase stop
supabase start
```

---

## Bruno con Supabase

Con Supabase los datos **no se borran** al reiniciar `npm run dev`.

Antes de **Run Collection**, resetea la demo en **SQL Editor**:

```sql
-- Ejecutar docs/seed.sql de nuevo (borra idempotencia y restaura los 5 envíos)
```

O solo borra idempotencia si quieres repetir 05–06:

```sql
DELETE FROM idempotency_keys;
```

---

## Errores frecuentes

| Síntoma | Causa | Solución |
|---------|--------|----------|
| `persistence: memory` | Falta `.env` o variables vacías | Revisa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` |
| Error al conectar / tablas | No ejecutaste `schema.sql` | SQL Editor → `docs/schema.sql` |
| Bruno 03/05/07 fallan | Datos viejos en BD | Vuelve a ejecutar `docs/seed.sql` |
| `412` en PATCH | `shp_b2c3d4` ya no está en `CREATED` | Reset con `seed.sql` |
| Usaste `anon` key | Permisos insuficientes | Usa la **service_role** (secret) |

---

## Render (producción)

Las mismas variables van en **Render → Environment**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Puedes usar el **mismo** proyecto Supabase que en local, o uno separado para producción.

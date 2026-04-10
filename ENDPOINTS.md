# Endpoints API con Base de Datos MySQL

Estos endpoints trabajan contra el backend y persisten datos en MySQL
No usan localStorage para la data de negocio

## Base URL

- http://localhost:3000/api

## Estado actual del schema

- La base de datos ahora usa nombres internos en español
- El backend mantiene compatibilidad con el frontend actual
- La API sigue recibiendo y respondiendo los campos esperados por el frontend

Ejemplos de mapeo interno:
- En BD: `estado` con `disponible`, `ocupado`, `mantenimiento`
- En API: `status` con `available`, `busy`, `maintenance`

- En BD: `categoria` de estaciones con `pc`, `playstation`, `movil`, `portatil`
- En API: `category` con `pc`, `ps`, `mobile`, `laptop`

- En BD: `precio` y `existencias` en productos
- En API: `price` y `stock`

## Autenticación

- POST /api/auth/register
- POST /api/auth/login

## Estaciones

- GET /api/estaciones
- POST /api/estaciones
- GET /api/estaciones/:id
- PUT /api/estaciones/:id
- DELETE /api/estaciones/:id
- GET /api/estaciones/tarifas
- PUT /api/estaciones/tarifas/:categoria

## Inventario

- GET /api/inventario
- POST /api/inventario
- PUT /api/inventario/:id
- DELETE /api/inventario/:id
- POST /api/inventario/:id/stock

## Finanzas

- GET /api/finanzas/resumen?fecha=YYYY-MM-DD
- GET /api/finanzas/sesiones/activas
- GET /api/finanzas/sesiones?fecha=YYYY-MM-DD&limit=50
- POST /api/finanzas/sesiones
- PUT /api/finanzas/sesiones/:id/cerrar

## Transacciones

- GET /api/transacciones
- POST /api/transacciones
- DELETE /api/transacciones

## Nota de autenticación

- La mayoría de rutas usan middleware requireAuth
- Si AUTH_DISABLED=true en backend puedes probar en desarrollo sin token

## Nota de instalación limpia

Si ya tenías una base vieja con nombres en inglés debes recrearla para evitar errores de columnas

1. `DROP DATABASE IF EXISTS VHO_gaming;`
2. Ejecutar `backend/db/schema.sql`

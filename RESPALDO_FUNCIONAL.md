# Respaldo funcional del proyecto (antes de Fase 2)

Este documento describe que hace cada seccion del sistema para tener una referencia clara antes de simplificar codigo.

## 1) Estructura general de la app

La app carga 4 modulos principales desde [index.html](index.html):
- [index.js](index.js): autenticacion, navegacion, dashboard, caja, modales globales.
- [estacion.js](estacion.js): estaciones/equipos, tarifas, mapa del local.
- [inventario.js](inventario.js): productos, stock, ventas directas.
- [finanzas.js](finanzas.js): resumenes, historial, graficas, usuarios y sedes.

## 2) Navegacion principal

Pantallas (pages) en [index.html](index.html):
- `page-dashboard`: vista principal operativa.
- `page-estaciones`: gestion de equipos y tarifas.
- `page-inventario`: gestion de productos y stock.
- `page-finanzas`: reportes y administracion.

Cambio de pagina:
- Funcion `goTo(page, el)` en [index.js](index.js).

Version movil:
- Barra inferior en [index.html](index.html) con botones Dashboard, Estaciones, Inventario y Finanzas.

## 3) Autenticacion (estado actual)

Pantalla/modal de auth en [index.html](index.html):
- Tabs: Login y Registro.
- Formulario: usuario (solo registro), correo, contrasena.

Funciones clave en [index.js](index.js):
- `mostrarModalAuth()`: abre modal de login.
- `cerrarModalAuth()`: cierra modal.
- `enviarAutenticacion(e)`: login/registro.
- `logout()`: cierre de sesion.
- `iniciarAutenticacion()`: restaura sesion guardada.
- `window.fetch` interceptado: inyecta token en rutas `/api/*` y muestra auth cuando aplica.

Comportamiento esperado actual:
- Se puede navegar el dashboard sin login.
- Si intentas accion de escritura, aparece login.

## 4) Dashboard (operacion diaria)

Subtabs en [index.html](index.html):
- Home
- Disponibles
- Ocupados
- Mapa
- Caja

Funciones en [index.js](index.js):
- `switchDashboardTab(tab, btn)`
- `renderPCs(filter)`
- `openModalTurno(preselectId)`
- `startTurn()`
- `showPCDetail(id)`
- `endTurn(id)`

### 4.1 Caja y facturacion

Modos de cobro:
- Por dispositivo
- Por cliente
- Servicio adicional

Funciones en [index.js](index.js):
- `setCajaMode(mode, btn)`
- `cajaLoadDevice()`
- `cajaBuscarCliente()`
- `cajaLoadClientDevice()`
- `cajaAddExtraItem()`
- `cajaPreviewFactura()`
- `cajaConfirmarCobro()`
- `showFacturaPreview(factura)`

## 5) Estaciones

Pantalla: [index.html](index.html) (`page-estaciones`)

Subtabs:
- Home
- Tarifas

Funciones principales en [estacion.js](estacion.js):
- `initStations()`
- `switchStationTab(tab, btn)`
- `renderAllStations(stations)`
- `searchStations(query)`
- `openDeviceModal(editId)`
- `saveDevice()`
- `confirmDeleteDevice(id)`
- `renderTarifas()`
- `saveTarifa(cat, field, value)`
- `renderMapa()`

Objetivo funcional:
- Crear/editar/eliminar equipos.
- Configurar tarifas por categoria.
- Ver mapa visual del local.

## 6) Inventario

Pantalla: [index.html](index.html) (`page-inventario`)

Filtros:
- Todos, Snacks, Bebidas, Tecnologia, Servicios.

Funciones en [inventario.js](inventario.js):
- `ProductDB.init()`
- `ProductDB.create(data)`
- `ProductDB.update(id, changes)`
- `ProductDB.delete(id)`
- `ProductDB.addStock(id, amount)`
- `ProductDB.reduceStock(id, amount)`

Funciones usadas desde [index.js](index.js):
- `openProductModal(id)`
- `saveProduct()`
- `saveStock()`
- `openAddToCartModal(prodId)`
- `processAddToCart()`

Objetivo funcional:
- Gestionar productos y stock.
- Vender directo en mostrador.
- Cargar consumo a una sesion activa.

## 7) Finanzas

Pantalla: [index.html](index.html) (`page-finanzas`)

Subtabs:
- Home
- Historial de Sesiones
- Graficas
- Usuarios

Funciones clave en [finanzas.js](finanzas.js):
- `switchFinanceTab(tab, btn)`
- `renderFinanceHome()`
- `renderFinanceHistory(dateStr, query)`
- `renderFinanceChart()`
- `buscarEnHistorial(query)`

### 7.1 Usuarios y sedes (dentro de Finanzas)

Subtabs de usuarios:
- Pendientes
- Todos los usuarios
- Sedes

Funciones en [finanzas.js](finanzas.js):
- `switchUsersTab(tab, btn)`
- `initUsersManagement()`
- `approveUser(userId)`
- `rejectUser(userId)`
- `editUserRole(userId)`
- `initSedesManagement()`
- `showAddSedeModal()`
- `addSede(data)`
- `editSede(sedeId)`
- `deleteSede(sedeId)`

## 8) Modales existentes

Definidos en [index.html](index.html):
- `modal-turno`: iniciar turno.
- `modal-pc-detail`: detalle de equipo/sesion.
- `modal-device`: crear/editar equipo.
- `modal-product`: crear/editar producto.
- `modal-stock`: ajuste de stock.
- `modal-checkout`: cierre de sesion.
- `modal-add-to-cart`: venta rapida.
- `modal-factura`: vista de factura.

Control global en [index.js](index.js):
- `openModal(id)`
- `closeModal(id)`

## 9) Flujo corto de negocio (resumen)

1. Crear estaciones y tarifas.
2. Iniciar turno desde Dashboard.
3. Cargar productos al cliente o venta directa.
4. Cerrar turno y calcular total.
5. Ver resumen e historial en Finanzas.

## 10) Riesgos conocidos antes de Fase 2

- Hay mucha logica mezclada en [index.js](index.js).
- Hay funciones largas con responsabilidades multiples.
- Hay dependencias cruzadas entre modulos (index.js llama acciones de inventario/estaciones/finanzas).

## 11) Objetivo de la Fase 2 (cuando arranque)

- Reducir complejidad para perfil junior sin romper flujos.
- Mantener mismo comportamiento funcional.
- Separar responsabilidades por bloques mas pequenos y claros.

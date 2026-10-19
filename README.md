# Lumiq · Panel de administracion (v2 COMPLETO)

Panel web para administrar la app **Lumiq**. Escrito desde cero sobre
**Supabase** (PostgREST + Supabase Auth). No hay ni una linea de Firebase.

- Proyecto Supabase: `https://zclgybzeuftutfrqtwax.supabase.co`
- Administrador unico: `limberhuaychoquispe81@gmail.com`
- Estilo: tema oscuro con verde neon (mismo color de la app).

## Archivos

| Archivo | Que hace |
|---|---|
| `index.html` | Pagina completa: login (Google o correo+contrasena) + menu de vistas + formularios. Sin dependencias de build. |
| `admin.js` | Logica completa del panel con `@supabase/supabase-js` (CDN ESM): dashboard, usuarios, tienda con "Subir producto", billetera, config y creacion de cuentas admin. |

## Estructura de directorios

```
web/admin/
  index.html
  admin.js
  README.md
```

Las migraciones SQL y las politicas RLS están en:
```
supabase/
  schema/
    00_esquema_supabase.sql
    01_relaciones_completas.sql
  rls/
    00_politicas_seguridad.sql
    ...
```

## Requisitos en el panel de Supabase

1. **Authentication → Providers → Google**: activado.
2. **Authentication → URL configuration**: agregar la URL donde publiques
   el panel (por ejemplo `https://tu-dominio/panel/`) en *Redirect URLs*.
3. **SQL Editor**: ejecutar en este orden (todos son idempotentes):
   1. `supabase/schema/00_esquema_supabase.sql`
   2. `supabase/schema/01_relaciones_completas.sql`
   3. `supabase/schema/02_mensajes_respuestas_reenvios.sql`
   4. `supabase/rls/00_politicas_seguridad.sql`
4. **Authentication → Sign In / Providers → Anonymous**: ON (lo usa la app).

## Como se publica

Cualquier hosting estatico sirve (Netlify, Vercel, GitHub Pages, nginx):
solo son `index.html` + `admin.js`.

Ejemplo local con Node:
```bash
npx serve .
```

## Que puedes hacer en la version completa (v2)

### Dashboard
- Contadores en vivo (usuarios, codigos, mensajes, productos, pedidos).
- Saldo total en custodia.
- Grafico de usuarios por dia de la semana (7d, 30d, 60d).

### Usuarios y verificacion
- Lista de usuarios con rol, sello, estado de activo.
- Cambiar rol (usuario/moderador/admin).
- Dar/quitar sello de verificado.
- Activar/desactivar usuarios.

### Codigos 6 digitos
- Generar codigos (RPC `crear_codigo`).
- Ver lista de codigos con estado (vivo/used/caducado).
- Reenviar codigo.

### Dispositivos y perfiles
- Ver dispositivos vinculados y desvincular.
- Ver perfiles de usuarios.

### Chats y reportes
- Ver conversaciones y mensajes.
- Ver reportes y marcar como revisados/descartados.

### Tienda
- Negocios (abrir/cerrar/publicar).
- Productos (estado/borrar).
- Pedidos (cambiar estado: confirmado, preparando, en_camino, entregado, cancelado).

### Billetera
- Lista de saldos con nombre y numero de usuario.
- Ajuste manual de saldo con registro en auditoria.
- Transferencias (ver historial).

### Configuracion
- Modo mantenimiento, aviso, version.
- Listado de roles y permisos.

### Auditoria
- Registro de todas las acciones administrativas.

## Que haces en el panel

- **Login**: solo `limberhuaychoquispe81@gmail.com` puede entrar.
- **Salida**: botón de cerrar sesion.
- **Refresco**: cada 20 segundos automático.

## Seguridad

- Solo entra la cuenta `limberhuaychoquispe81@gmail.com`.
- Verifican sesion y autoridad con `public.es_admin()` y RLS.
- No se incluye la clave `service_role` en el cliente.
- El panel requiere `service_role` para operaciones sensibles; usa la clave
  `publishable` para lectura y operaciones controladas.

  pedidos (cambiar estado).
- **Moneda**: saldos, ajuste manual con asiento en `movimientos`, historial
  de transferencias.
- **Auditoria**: log de todo lo que se hace.
- **Config**: mantenimiento, aviso y version de la app.

Toda accion relevante se registra con la RPC `registrar_auditoria`.

## Seguridad

- Sesion con Google vía Supabase Auth; cualquier correo distinto al del
  administrador se cierra automaticamente.
- El panel opera como `authenticated` normal: **las mismas politicas RLS**
  de la app le dejan ver TODO porque `es_admin()` reconoce su JWT.
- No hay claves service_role en el navegador.

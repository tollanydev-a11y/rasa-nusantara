# 🍜 Rasa Nusantara — Sistema de Reservaciones

Sistema web completo para un restaurante de gastronomía indonesia, con autenticación, reservas, gestión de mesas, pedidos y panel de administración.

---

## 🆕 Cambios v2.1 (refactor + preparación Firebase)

| Área                  | Cambio                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🧹 **Limpieza**       | Se eliminaron duplicados: `traducirEstado` y `renderSpicyLevel` ahora viven **sólo** en `main.js` y se importan desde los demás módulos.                                                                         |
| 🐛 **Bugfix**         | `toggleMenuSelectionEnabled` usaba un `query(where("__name__",…))` incorrecto en Firebase. Ahora usa `getDoc` + `updateDoc` directamente.                                                                        |
| 🔥 **Firebase-ready** | `getPlatillos`/`setPlatillos`/`getEstadoMesas`/`setEstadoMesas` ahora son **duales**: operan en `localStorage` (demo) o en Firestore (producción) con caché en memoria para no bloquear el render.               |
| 🖼 **Imágenes**       | Los `dish-card` del home y los `menu-item` de la carta aceptan `imagen` (URL http/https o `data:`). Si la imagen falla (`onerror`), caen al emoji original. Si no hay imagen ni emoji, cae al ícono FontAwesome. |
| ➕ **Admin Menú**     | El modal "Agregar/Editar Platillo" ahora incluye: URL de imagen (con preview en vivo), emoji, ícono FontAwesome, picante (0-4) y disponible.                                                                     |
| 👥 **Usuarios**       | El tab Usuarios lee de la colección `users` de Firestore cuando `USE_DEMO_MODE=false`.                                                                                                                           |
| 🪑 **Liberar Mesa**   | Comportamiento confirmado: limpia pedidos (`menuSelectionsByClient → null`), deshabilita menú del cliente, desmarca flag admin si estaba puesto. Sin tickets, sin logs. Toast simple: **"Mesa N: liberada ✅"**. |

### Cambios anteriores (v2.0)

1. **Calendario visual con disponibilidad** (verde / ámbar / rojo) en Reservaciones.
2. **Menú completo con tabs y etiquetas** (Vegano, Picante, Sin gluten…).
3. **Página "Mis Reservaciones"** para gestionar reservas del cliente.
4. **Fix del overflow** de tablas en el panel admin.
5. **Mesas tipo tarjeta** con botones "Liberar Mesa" / "Marcar como Ocupada".
6. **Tab de Menú en Admin** con CRUD completo de platillos.

---

## 📁 Estructura del proyecto

```
rasa-nusantara/
├── index.html                  # Home
├── menu.html                   # Carta completa + menús de tiempos
├── reservaciones.html          # Calendario visual + formulario
├── mis-reservaciones.html      # Gestión de reservas del cliente
├── admin.html                  # Panel admin (6 tabs)
├── login.html                  # Autenticación
├── README.md
│
├── css/
│   ├── style.css               # Estilos principales
│   └── responsive.css          # Media queries
│
├── js/
│   ├── main.js                 # Header, toasts, helpers compartidos
│   │                           #   (traducirEstado, renderSpicyLevel,
│   │                           #    renderPlatilloImage, formatCurrency…)
│   ├── firebase-config.js      # Config, USE_DEMO_MODE, COLLECTIONS
│   ├── auth.js                 # Login/registro/sesión/proteger páginas
│   ├── data.js                 # Platillos (con `imagen`), áreas, mesas,
│   │                           #   horarios — dual localStorage / Firestore
│   ├── home.js                 # Render de dish-cards (con imágenes)
│   ├── menu.js                 # Carta + selector de menús de tiempos
│   ├── reservaciones.js        # Calendario + formulario + API de reservas
│   ├── mis-reservaciones.js    # Página de gestión del cliente
│   └── admin.js                # 6 tabs del panel admin + modal de platillo
│
└── img/                        # Imágenes (directorio para assets propios)
```

---

## 🚀 Cómo usar (modo demo)

1. **Descomprime** el proyecto.
2. **Abre `index.html`** o sírvelo con un servidor local (requerido por los módulos ES6):
   ```bash
   python -m http.server 8000
   # Luego abre http://localhost:8000
   ```
3. Por defecto corre en **modo demo** (localStorage, sin red).

### Credenciales demo

| Rol        | Email                       | Contraseña |
| ---------- | --------------------------- | ---------- |
| 🔧 Admin   | `admin@rasanusantara.com`   | `admin123` |
| 👤 Cliente | `usuario@rasanusantara.com` | `user123`  |
| 👤 Cliente | `maria@rasanusantara.com`   | `maria123` |

---

## 🔥 Activar Firebase

1. Crea un proyecto en <https://console.firebase.google.com/>.
2. En **Configuración del proyecto > Tus apps** agrega una Web App y copia `firebaseConfig`.
3. Pégalo en `js/firebase-config.js`, reemplazando los valores `TU_*`.
4. En **Authentication > Sign-in method** activa **Email/Password**.
5. En **Firestore Database** crea la base en modo **test** para desarrollo.
6. Abre `js/firebase-config.js` y cambia:
   ```js
   const USE_DEMO_MODE = true; // ← cambiar a false
   ```
7. La app se autoabastecerá de datos:
   - Si la colección `platillos` está vacía, se siembra con los 41 defaults.
   - Si no existe `mesas_estado/state`, se inicializa con todas las mesas libres.

### Colecciones de Firestore

| Colección       | Contenido                                                          |
| --------------- | ------------------------------------------------------------------ | -------------- |
| `users`         | Perfil + rol (`user` / `admin`). Se crea al registrar.             |
| `reservaciones` | Reservas con estado, pedidos por cliente, flag de menú habilitado. |
| `platillos`     | Catálogo del menú editable desde Admin → Menú.                     |
| `mesas_estado`  | Único documento `state` con el mapa `{ mesaId → 'available'        | 'occupied' }`. |

Los nombres están centralizados en el export `COLLECTIONS` de `firebase-config.js`.

---

## 🎨 Paleta y tipografías

- **Primario:** `#C1272D` (rojo especia)
- **Secundario:** `#D4AF37` (dorado)
- **Acento:** `#2C5F2D` (verde tropical)
- **Neutros:** `#FAF3E7` (crema), `#3E2723` (marrón oscuro)
- **Tipos:** Playfair Display (títulos), Poppins (texto), Dancing Script (decorativo)

---

## 🖼 Sistema de imágenes de platillos

Cada platillo (`data.js`) soporta los tres siguientes campos (en orden de prioridad):

```js
{
  imagen: "https://...",    // opcional — URL remota o data:
  emoji:  "🍜",              // fallback si no hay imagen
  icono:  "fa-bowl-rice"    // fallback si no hay imagen ni emoji
}
```

En el render (`renderPlatilloImage` en `main.js`) la cascada es:

1. Si existe `imagen` se intenta cargar como `<img>`.
2. Si la imagen falla (`onerror`), se degrada al emoji.
3. Si no había imagen y el platillo no tiene emoji, se muestra el ícono FontAwesome.
4. Por último, emoji por defecto `🍽`.

Esto permite **migrar gradualmente** de emojis a fotos reales sin reescribir nada.

### Desde Admin → Menú

El modal "Agregar/Editar Platillo" incluye los tres campos. La URL de imagen muestra **preview en vivo** mientras escribes.

---

## 📄 Detalle por funcionalidad

### 1️⃣ Calendario visual de disponibilidad

Cada día se colorea según el nivel de ocupación:

- 🟢 **Verde** — Disponible (<50% ocupado)
- 🟡 **Ámbar** — Parcial (50–90%)
- 🔴 **Rojo tachado** — Lleno (>90%)
- ⚫ **Gris tachado** — Cerrado (lunes)

### 2️⃣ Menú con etiquetas y tabs

Tabs **Entradas / Principales / Postres / Bebidas**. Cada platillo muestra imagen (o emoji), nombre, precio, origen, descripción y tags.

### 3️⃣ Mis Reservaciones

Stats, filtros (Todas / Próximas / Pasadas / Canceladas), cancelar, eliminar del historial.

### 4️⃣ Fix overflow en admin

`.table-wrapper` → `overflow-x: auto`; `#admin-panel-container` → `overflow-x: hidden`.

### 5️⃣ Mesas como tarjetas con toggle

Filtros por área + por fecha + por hora. Estadísticas arriba. El estado efectivo de la mesa combina: flag admin + menú habilitado + reserva en horario filtrado.

### 6️⃣ Tab Menú (CRUD)

✅/❌ toggle de disponibilidad, ✏️ editar (nombre, precio, categoría, origen, descripción, imagen, emoji, ícono, tags, picante), 🗑 eliminar, ➕ agregar.

### 7️⃣ Tab Pedidos

Muestra agrupados por reserva → por cliente los platillos elegidos. Botón de eliminar platillo individual. **Desaparecen automáticamente** al liberar la mesa.

---

## 🧩 Persistencia (modo demo)

| Clave localStorage       | Contenido                                  |
| ------------------------ | ------------------------------------------ |
| `rasa_nusantara_session` | Sesión del usuario actual                  |
| `rasa_reservaciones`     | Reservaciones hechas por clientes          |
| `rasa_platillos`         | Menú modificado por el admin               |
| `rasa_mesas_estado`      | Estado físico (libre/ocupada) de cada mesa |

---

## 📱 Responsive

Puntos de ruptura:

- `≤ 992px` — menú hamburguesa activado
- `≤ 756px` — tablet, grids reducidos
- `≤ 480px` — móvil

---

## 🙏 Créditos

- Diseño e implementación basados en patrones visuales de **Warung Nusantara**, adaptados a la paleta cálida de **Rasa Nusantara**.
- Tipografías: Google Fonts
- Iconos: Font Awesome 6.5.2

_Terima kasih — Hecho con ♥ en CDMX_

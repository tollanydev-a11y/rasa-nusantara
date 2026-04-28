/* ===================================================
   MÓDULO: PANEL DE ADMINISTRACIÓN
   6 pestañas: Dashboard, Reservaciones, Pedidos, Usuarios,
               Mesas, Menú.

   CAMBIOS RESPECTO A LA VERSIÓN ANTERIOR
   -----------------------------------------
   - traducirEstado ahora proviene de main.js (sin duplicado).
   - setPlatillos / toggleEstadoMesa son async → se usa await.
   - Usuarios se obtienen desde Firestore en producción (fallback
     a DEMO_USERS en demo).
   - El modal "Agregar/Editar Platillo" acepta imagen (URL o
     data-URI) además de emoji e ícono FontAwesome.
   - refreshPlatillos / refreshEstadoMesas se invocan en el arranque
     cuando USE_DEMO_MODE=false.

   LIBERAR MESA (comportamiento actual, validado):
     - Limpia los pedidos (menuSelectionsByClient → null)
     - Deshabilita el menú del cliente si estaba habilitado
     - Destoggle del flag admin si estaba marcado
     - NO genera ticket ni imprime en consola
     - Toast: "Mesa N: liberada ✅"
   =================================================== */

import { protectPage } from "./auth.js";
import {
  getTodasLasReservaciones,
  actualizarEstadoReserva,
  eliminarReserva,
  toggleMenuSelectionEnabled,
  actualizarSeleccionMenu,
} from "./reservaciones.js";
import {
  AREAS,
  generarMesas,
  MENUS,
  HORAS_RESERVA,
  getPlatillos,
  setPlatillos,
  deletePlatillo,
  refreshPlatillos,
  getEstadoMesas,
  refreshEstadoMesas,
  toggleEstadoMesa,
} from "./data.js";
import {
  showToast,
  formatCurrency,
  formatDate,
  getTodayISO,
  traducirEstado,
  showConfirmModal,
} from "./main.js";
import {
  USE_DEMO_MODE,
  DEMO_USERS,
  db,
  collection,
  getDocs,
  COLLECTIONS,
} from "./firebase-config.js";
import { enviarCorreoConfirmacion, enviarFacturaPorCorreo } from "./email.js";

// ==========================================================
// ESTADO
// ==========================================================
const state = {
  reservaciones: [],
  usuarios: [],
  currentTab: "dashboard",
  filtroEstado: "todos",
  filtroArea: "all",
  filtroMesaFecha: "",
  filtroMesaHora: "",
  filtroReservaFecha: "",
  filtroReservaStatus: "all",
  editingDishId: null,
};

// ==========================================================
// INICIALIZACIÓN
// ==========================================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("admin-panel-container")) return;
  if (!protectPage(true)) return;

  // En producción: sembrar cachés de platillos y estado de mesas
  if (!USE_DEMO_MODE) {
    await Promise.all([refreshPlatillos(), refreshEstadoMesas()]);
  }

  await cargarDatos();
  initTabs();
  initDishModal();
  renderDashboard();
  renderReservacionesTab();
  renderPedidosTab();
  renderUsuariosTab();
  renderMesasTab();
  renderMenuTab();
});

async function cargarDatos() {
  state.reservaciones = await getTodasLasReservaciones();
  state.usuarios = await cargarUsuarios();
}

async function cargarUsuarios() {
  if (USE_DEMO_MODE) return [...DEMO_USERS];
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.USERS));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error cargando usuarios:", err);
    return [...DEMO_USERS];
  }
}

// ==========================================================
// TABS
// ==========================================================
function initTabs() {
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document
        .querySelectorAll(".admin-tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".admin-panel")
        .forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${target}`).classList.add("active");
      state.currentTab = target;

      if (target === "dashboard") renderDashboard();
      if (target === "reservaciones") renderReservacionesTab();
      if (target === "pedidos") renderPedidosTab();
      if (target === "usuarios") renderUsuariosTab();
      if (target === "mesas") renderMesasTab();
      if (target === "menu") renderMenuTab();
    });
  });
}

// ==========================================================
// TAB: DASHBOARD
// ==========================================================
function renderDashboard() {
  const container = document.getElementById("tab-dashboard");
  if (!container) return;

  const hoy = getTodayISO();
  const reservasHoy = state.reservaciones.filter(
    (r) => r.fecha === hoy && r.estado !== "cancelled",
  );
  const reservasConfirmadas = state.reservaciones.filter(
    (r) => r.estado === "confirmed",
  );
  const reservasPendientes = state.reservaciones.filter(
    (r) => r.estado === "pending",
  );
  const ingresosTotal = reservasConfirmadas.reduce(
    (sum, r) => sum + (r.total || 0),
    0,
  );

  container.innerHTML = `
        <h3 style="margin-bottom: 25px;"><i class="fa-solid fa-chart-line"></i> Dashboard General</h3>

        <div class="stats-grid">
            <div class="stat-card">
                <i class="fa-solid fa-calendar-day stat-icon"></i>
                <div class="stat-number">${reservasHoy.length}</div>
                <div class="stat-label">Reservas hoy</div>
            </div>
            <div class="stat-card">
                <i class="fa-solid fa-circle-check stat-icon"></i>
                <div class="stat-number">${reservasConfirmadas.length}</div>
                <div class="stat-label">Confirmadas</div>
            </div>
            <div class="stat-card">
                <i class="fa-solid fa-clock stat-icon"></i>
                <div class="stat-number">${reservasPendientes.length}</div>
                <div class="stat-label">Pendientes</div>
            </div>
            <div class="stat-card">
                <i class="fa-solid fa-sack-dollar stat-icon"></i>
                <div class="stat-number">${formatCurrency(ingresosTotal)}</div>
                <div class="stat-label">Ingresos totales</div>
            </div>
        </div>

        <h3 style="margin: 30px 0 15px;"><i class="fa-solid fa-calendar-days"></i> Reservas de Hoy</h3>
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Hora</th><th>Cliente</th><th>Personas</th>
                        <th>Área</th><th>Mesa</th><th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${
                      reservasHoy.length === 0
                        ? '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--color-text-light);">No hay reservas para hoy</td></tr>'
                        : reservasHoy
                            .sort((a, b) => a.hora.localeCompare(b.hora))
                            .map((r) => {
                              const area = AREAS.find((a) => a.id === r.area);
                              return `
                                <tr>
                                    <td><strong>${r.hora}</strong></td>
                                    <td>${r.userName}</td>
                                    <td>${r.personas}</td>
                                    <td>${area ? area.nombre : r.area}</td>
                                    <td>#${r.mesa.split("-m")[1]}</td>
                                    <td><span class="status-badge ${r.estado}">${traducirEstado(r.estado)}</span></td>
                                </tr>
                            `;
                            })
                            .join("")
                    }
                </tbody>
            </table>
        </div>
    `;
}

// ==========================================================
// TAB: RESERVACIONES
// ==========================================================
function renderReservacionesTab() {
  const container = document.getElementById("tab-reservaciones");
  if (!container) return;

  let reservas = [...state.reservaciones];

  if (state.filtroReservaFecha) {
    reservas = reservas.filter((r) => r.fecha === state.filtroReservaFecha);
  }
  if (state.filtroReservaStatus && state.filtroReservaStatus !== "all") {
    reservas = reservas.filter((r) => r.estado === state.filtroReservaStatus);
  }

  reservas.sort((a, b) => {
    const fa = `${a.fecha} ${a.hora}`;
    const fb = `${b.fecha} ${b.hora}`;
    return fb.localeCompare(fa);
  });

  container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
            <h3><i class="fa-solid fa-book"></i> Gestión de Reservaciones</h3>
        </div>

        <div class="res-filter-row">
            <input type="date" id="filter-res-date" value="${state.filtroReservaFecha}" title="Filtrar por fecha">
            <select id="filter-res-status">
                <option value="all" ${state.filtroReservaStatus === "all" ? "selected" : ""}>Todos los estados</option>
                <option value="pending" ${state.filtroReservaStatus === "pending" ? "selected" : ""}>Pendientes</option>
                <option value="confirmed" ${state.filtroReservaStatus === "confirmed" ? "selected" : ""}>Confirmadas</option>
                <option value="cancelled" ${state.filtroReservaStatus === "cancelled" ? "selected" : ""}>Canceladas</option>
            </select>
            <button class="btn btn-outline btn-sm" id="btn-aplicar-filtro">
                <i class="fa-solid fa-filter"></i> Aplicar
            </button>
            <button class="btn btn-outline btn-sm" id="btn-limpiar-filtro">
                <i class="fa-solid fa-xmark"></i> Limpiar
            </button>
        </div>

        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Cliente</th><th>Fecha</th><th>Hora</th>
                        <th>Personas</th><th>Mesa</th><th>Menú</th>
                        <th>Total</th><th>Estado</th><th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${
                      reservas.length === 0
                        ? '<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--color-text-light);">No hay reservaciones</td></tr>'
                        : reservas
                            .map((r) => {
                              const menu = MENUS[r.menu];
                              return `
                                <tr data-reserva-id="${r.id}">
                                    <td>
                                        <strong>${r.userName}</strong><br>
                                        <small style="color: var(--color-text-light);">${r.userEmail}</small>
                                    </td>
                                    <td>${r.fecha}</td>
                                    <td>${r.hora}</td>
                                    <td>${r.personas}</td>
                                    <td>#${r.mesa.split("-m")[1]} (${r.area})</td>
                                    <td>${menu ? menu.nombre : r.menu}</td>
                                    <td><strong>${formatCurrency(r.total)}</strong></td>
                                    <td><span class="status-badge ${r.estado}">${traducirEstado(r.estado)}</span></td>
                                    
                                    <td>
                                        <div class="table-actions" style="flex-wrap: wrap; gap: 5px;">
                                            ${
                                              r.estado === "pending"
                                                ? `
                                                <button class="btn-icon" data-action="confirmar" data-id="${r.id}" title="Confirmar">
                                                    <i class="fa-solid fa-check"></i>
                                                </button>
                                            `
                                                : ""
                                            }
                                            ${
                                              r.estado === "confirmed"
                                                ? `
                                                <button class="btn-habilitar-menu ${r.menuSelectionEnabled ? "active" : ""}"
                                                        data-action="toggle-menu"
                                                        data-id="${r.id}"
                                                        title="${r.menuSelectionEnabled ? "Selección de platillos HABILITADA (click para deshabilitar)" : "Habilitar selección de platillos para el cliente"}">
                                                    <i class="fa-solid ${r.menuSelectionEnabled ? "fa-unlock" : "fa-utensils"}"></i>
                                                    ${r.menuSelectionEnabled ? "Menú habilitado" : "Habilitar menú"}
                                                </button>
                                            `
                                                : ""
                                            }
                                            ${
                                              r.estado !== "cancelled"
                                                ? `
                                                <button class="btn-icon danger" data-action="cancelar" data-id="${r.id}" title="Cancelar">
                                                    <i class="fa-solid fa-xmark"></i>
                                                </button>
                                            `
                                                : ""
                                            }
                                            <button class="btn-icon danger" data-action="eliminar" data-id="${r.id}" title="Eliminar">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                            })
                            .join("")
                    }
                </tbody>
            </table>
        </div>
    `;

  document
    .getElementById("btn-aplicar-filtro")
    .addEventListener("click", () => {
      state.filtroReservaFecha =
        document.getElementById("filter-res-date").value;
      state.filtroReservaStatus =
        document.getElementById("filter-res-status").value;
      renderReservacionesTab();
    });
  document
    .getElementById("btn-limpiar-filtro")
    .addEventListener("click", () => {
      state.filtroReservaFecha = "";
      state.filtroReservaStatus = "all";
      renderReservacionesTab();
    });
  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () =>
      handleAccionReserva(btn.dataset.action, btn.dataset.id),
    );
  });
}

async function handleAccionReserva(accion, reservaId) {
  const reserva = state.reservaciones.find((r) => r.id === reservaId);

  if (accion === "confirmar") {
    showConfirmModal(
      "Confirmar reservación",
      `¿Confirmar la reservación de <strong>${reserva?.userName ?? ""}</strong>?`,
      async () => {
        const ok = await actualizarEstadoReserva(reservaId, "confirmed");
        if (ok) {
          let correoOk = false;
          if (reserva) correoOk = await enviarCorreoConfirmacion(reserva);
          showToast(
            correoOk
              ? `Reservación confirmada ✅ · Correo enviado a ${reserva.userEmail} ✉️`
              : `Reservación confirmada ✅ · No se pudo enviar el correo`,
            correoOk ? "success" : "warning",
            4500,
          );
          await cargarDatos();
          renderReservacionesTab();
          renderDashboard();
        }
      },
      { confirmText: "Confirmar" },
    );
  } else if (accion === "cancelar") {
    showConfirmModal(
      "Cancelar reservación",
      `¿Cancelar la reservación de <strong>${reserva?.userName ?? ""}</strong>?`,
      async () => {
        const ok = await actualizarEstadoReserva(reservaId, "cancelled");
        if (ok) {
          showToast("Reservación cancelada", "warning");
          await cargarDatos();
          renderReservacionesTab();
          renderDashboard();
        }
      },
      { confirmText: "Cancelar reservación", danger: true },
    );
  } else if (accion === "eliminar") {
    showConfirmModal(
      "Eliminar reservación",
      "¿Eliminar permanentemente esta reservación? Esta acción no se puede deshacer.",
      async () => {
        const ok = await eliminarReserva(reservaId);
        if (ok) {
          showToast("Reservación eliminada", "success");
          await cargarDatos();
          renderReservacionesTab();
          renderDashboard();
        }
      },
      { confirmText: "Eliminar", danger: true },
    );
  } else if (accion === "toggle-menu") {
    const nuevoEstado = await toggleMenuSelectionEnabled(reservaId);
    if (nuevoEstado === true) {
      showToast(
        "Selección de platillos HABILITADA para el cliente 🍽️",
        "success",
        3500,
      );
    } else if (nuevoEstado === false) {
      showToast("Selección de platillos deshabilitada", "info");
    } else {
      showToast("Error al cambiar el estado", "error");
      return;
    }
    await cargarDatos();
    renderReservacionesTab();
    renderMesasTab();
  }
}

// ==========================================================
// Envío de correo de confirmación de reservación (simulado)
// ==========================================================
/* function enviarCorreoConfirmacion(reserva) {
  const area = AREAS.find((a) => a.id === reserva.area);
  const menu = MENUS[reserva.menu];
  const asunto = `✅ Tu reservación en Rasa Nusantara ha sido confirmada`;

  let cuerpo = `
═══════════════════════════════════════
  🍜 RASA NUSANTARA
═══════════════════════════════════════

Estimado/a ${reserva.userName},

Nos complace informarte que tu reservación ha sido CONFIRMADA.
Estamos listos para recibirte con los sabores del archipiélago indonesio.

───────────────────────────────────────
DETALLES DE TU RESERVACIÓN
───────────────────────────────────────
  Fecha:      ${formatDate(reserva.fecha)}
  Hora:       ${reserva.hora}
  Área:       ${area ? area.nombre : reserva.area}
  Mesa:       #${reserva.mesa.split("-m")[1]}
  Comensales: ${reserva.personas}
  Menú:       ${menu ? menu.nombre : reserva.menu} (${menu ? menu.tiempos + " tiempos" : ""})
  Total:      ${formatCurrency(reserva.total)}
───────────────────────────────────────

Te esperamos. Por favor llega 10 minutos antes de tu hora reservada.
Si necesitas cancelar o modificar, hazlo desde tu panel "Mis reservaciones".

      ¡Gracias por tu preferencia!
          Terima Kasih 🙏

═══════════════════════════════════════
Rasa Nusantara · hola@rasanusantara.mx
═══════════════════════════════════════
`;

  console.info(
    `%c[CORREO ENVIADO]%c → ${reserva.userEmail}\nAsunto: ${asunto}${cuerpo}`,
    "color: #4CAF50; font-weight: bold;",
    "color: inherit;",
  );
} */

// ==========================================================
// TAB: USUARIOS
// ==========================================================
function renderUsuariosTab() {
  const container = document.getElementById("tab-usuarios");
  if (!container) return;

  const usuarios = state.usuarios || [];

  container.innerHTML = `
        <h3 style="margin-bottom: 20px;"><i class="fa-solid fa-users"></i> Gestión de Usuarios</h3>

        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nombre</th><th>Email</th><th>Teléfono</th>
                        <th>Rol</th><th>Reservas</th><th>Registro</th>
                    </tr>
                </thead>
                <tbody>
                    ${usuarios
                      .map((u) => {
                        const reservasUsuario = state.reservaciones.filter(
                          (r) => r.userId === u.uid,
                        ).length;
                        return `
                            <tr>
                                <td><strong>${u.displayName || "—"}</strong></td>
                                <td>${u.email || "—"}</td>
                                <td>${u.phone || "—"}</td>
                                <td><span class="status-badge ${u.role}">${u.role === "admin" ? "Admin" : "Usuario"}</span></td>
                                <td>${reservasUsuario}</td>
                                <td>${u.createdAt || "—"}</td>
                            </tr>
                        `;
                      })
                      .join("")}
                </tbody>
            </table>
        </div>
    `;
}

// ==========================================================
// TAB: MESAS
// ==========================================================
function renderMesasTab() {
  const container = document.getElementById("tab-mesas");
  if (!container) return;

  const todasLasMesas = generarMesas();
  const estadoMesas = getEstadoMesas();
  const hoyISO = getTodayISO();

  if (!state.filtroMesaFecha) state.filtroMesaFecha = hoyISO;

  const fechaFiltro = state.filtroMesaFecha;
  const horaFiltro = state.filtroMesaHora;

  const reservaProximaPorMesa = (mesaId) => {
    return (
      state.reservaciones
        .filter(
          (r) =>
            r.mesa === mesaId && r.estado !== "cancelled" && r.fecha >= hoyISO,
        )
        .sort((a, b) =>
          `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`),
        )[0] || null
    );
  };

  const reservaEnFiltro = (mesaId) => {
    return (
      state.reservaciones.find(
        (r) =>
          r.mesa === mesaId &&
          r.estado !== "cancelled" &&
          r.fecha === fechaFiltro &&
          (horaFiltro === "" || r.hora === horaFiltro),
      ) || null
    );
  };

  const esMesaEfectivamenteOcupada = (mesaId) => {
    if (estadoMesas[mesaId] === "occupied") return true;
    return state.reservaciones.some(
      (r) =>
        r.mesa === mesaId &&
        r.estado !== "cancelled" &&
        r.menuSelectionEnabled === true,
    );
  };

  const mesasFiltradas =
    state.filtroArea === "all"
      ? todasLasMesas
      : todasLasMesas.filter((m) => m.area === state.filtroArea);

  const ocupadas = todasLasMesas.filter((m) =>
    esMesaEfectivamenteOcupada(m.id),
  ).length;
  const disponibles = todasLasMesas.length - ocupadas;
  const conReservaProxima = todasLasMesas.filter(
    (m) => reservaProximaPorMesa(m.id) !== null,
  ).length;

  const textoFiltro = horaFiltro
    ? `📆 ${formatDate(fechaFiltro)} · ⏰ ${horaFiltro}`
    : `📆 ${formatDate(fechaFiltro)} · todo el día`;

  container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 15px;">
            <h3><i class="fa-solid fa-chair"></i> Gestión de Mesas — Checklist</h3>
            <div class="table-stats">
                <span class="stat-chip stat-chip--ok">✅ ${disponibles} disponibles</span>
                <span class="stat-chip stat-chip--err">🔴 ${ocupadas} ocupadas</span>
                <span class="stat-chip stat-chip--pending">📅 ${conReservaProxima} con reserva</span>
            </div>
        </div>

        <div class="table-area-filters">
            <div class="table-area-filters__left">
                <button class="filter-btn ${state.filtroArea === "all" ? "active" : ""}" data-area-filter="all">
                    Todas
                </button>
                ${AREAS.map(
                  (a) => `
                    <button class="filter-btn ${state.filtroArea === a.id ? "active" : ""}" data-area-filter="${a.id}">
                        <i class="fa-solid ${a.icono}"></i> ${a.nombre}
                    </button>
                `,
                ).join("")}
            </div>

            <div class="table-area-filters__right">
                <label class="mesa-date-label">
                    <i class="fa-solid fa-calendar-day"></i>
                    <input type="date"
                           id="mesa-filtro-fecha"
                           class="mesa-date-input"
                           value="${fechaFiltro}"
                           min="${hoyISO}">
                </label>
                <label class="mesa-hora-label">
                    <i class="fa-solid fa-clock"></i>
                    <select id="mesa-filtro-hora" class="mesa-hora-select">
                        <option value="">Todo el día</option>
                        ${HORAS_RESERVA.map(
                          (h) => `
                            <option value="${h}" ${horaFiltro === h ? "selected" : ""}>${h}</option>
                        `,
                        ).join("")}
                    </select>
                </label>
                <button class="filter-btn filter-btn--small" id="mesa-filtro-reset" title="Restablecer filtro a hoy">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
            </div>
        </div>

        <div class="mesa-filtro-activo">
            <i class="fa-solid fa-filter"></i>
            <span>Mostrando estado de mesas para: <strong>${textoFiltro}</strong></span>
        </div>

        <div class="tables-grid">
            ${mesasFiltradas
              .map((mesa) => {
                const estado = esMesaEfectivamenteOcupada(mesa.id)
                  ? "occupied"
                  : "available";
                const area = AREAS.find((a) => a.id === mesa.area);
                const reservaFiltro = reservaEnFiltro(mesa.id);

                let reservaBanner = "";
                if (reservaFiltro) {
                  const bannerClass =
                    estado === "occupied"
                      ? "mesa-reserva-banner mesa-reserva-banner--occupied"
                      : "mesa-reserva-banner mesa-reserva-banner--today";
                  const labelPrefix = reservaFiltro.menuSelectionEnabled
                    ? "Ocupa ahora:"
                    : "En este horario:";
                  reservaBanner = `
                        <div class="${bannerClass}">
                            <div class="mesa-reserva-label">${labelPrefix}</div>
                            <div class="mesa-reserva-cliente">
                                <i class="fa-solid fa-user"></i> ${reservaFiltro.userName}
                            </div>
                            <div class="mesa-reserva-datetime">
                                <i class="fa-solid fa-calendar"></i> ${reservaFiltro.fecha} · ${reservaFiltro.hora}
                                · ${reservaFiltro.personas} pax
                            </div>
                            <div class="mesa-reserva-estado">
                                <span class="status-badge ${reservaFiltro.estado}">${traducirEstado(reservaFiltro.estado)}</span>
                                ${reservaFiltro.menuSelectionEnabled ? '<span class="status-badge menu-on">🍽 Menú habilitado</span>' : ""}
                            </div>
                        </div>
                    `;
                } else {
                  reservaBanner = `
                        <div class="mesa-reserva-banner mesa-reserva-banner--empty">
                            <div class="mesa-reserva-empty-content">
                                <i class="fa-solid fa-calendar-xmark"></i>
                                <span>Sin reservación</span>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="table-card table-card--${estado}">
                        <div class="table-card__number">Mesa ${mesa.numero}</div>
                        <div class="table-card__area">${area ? area.nombre : mesa.area}</div>
                        <div class="table-card__cap">👤 × ${mesa.capacidad}</div>
                        <div class="table-card__status">
                            ${estado === "available" ? "✅ Disponible" : "🔴 Ocupada"}
                        </div>
                        ${reservaBanner}
                        <button class="table-card__toggle" data-toggle-mesa="${mesa.id}">
                            ${estado === "available" ? "Marcar como Ocupada" : "Liberar Mesa"}
                        </button>
                    </div>
                `;
              })
              .join("")}
        </div>

        <div class="form-alert info show mt-3" style="margin-top: 20px;">
            <i class="fa-solid fa-info-circle"></i>
            Este checklist refleja el estado físico de cada mesa. Para <strong>habilitar el menú</strong> a un cliente, usa el botón en la pestaña <strong>Reservaciones</strong>. Al <strong>liberar</strong> una mesa, se eliminan sus pedidos asociados.
        </div>
    `;

  // Listeners de filtros por área
  container.querySelectorAll("[data-area-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filtroArea = btn.dataset.areaFilter;
      renderMesasTab();
    });
  });

  // Listeners de filtro fecha/hora
  const inputFecha = container.querySelector("#mesa-filtro-fecha");
  const selectHora = container.querySelector("#mesa-filtro-hora");
  const btnReset = container.querySelector("#mesa-filtro-reset");
  if (inputFecha) {
    inputFecha.addEventListener("change", (e) => {
      state.filtroMesaFecha = e.target.value || hoyISO;
      renderMesasTab();
    });
  }
  if (selectHora) {
    selectHora.addEventListener("change", (e) => {
      state.filtroMesaHora = e.target.value;
      renderMesasTab();
    });
  }
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      state.filtroMesaFecha = hoyISO;
      state.filtroMesaHora = "";
      renderMesasTab();
    });
  }

  // Listener principal: Liberar / Marcar como Ocupada
  container.querySelectorAll("[data-toggle-mesa]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mesaId = btn.dataset.toggleMesa;
      const mesa = todasLasMesas.find((m) => m.id === mesaId);

      // Re-leer el estado fresco en cada clic para evitar stale closure
      const estadoActual = getEstadoMesas();
      const estadoAdmin = estadoActual[mesaId] || "available";

      // Buscar directamente la reserva que tiene menuSelectionEnabled activo
      // (no solo la "próxima" — puede ser cualquier reserva de esta mesa)
      const reservaConMenuActivo = state.reservaciones.find(
        (r) =>
          r.mesa === mesaId &&
          r.estado !== "cancelled" &&
          r.menuSelectionEnabled === true,
      );

      const estaOcupada =
        estadoAdmin === "occupied" || reservaConMenuActivo !== undefined;

      if (estaOcupada) {
        showConfirmModal(
          `Liberar Mesa ${mesa.numero}`,
          "¿Liberar esta mesa? Se eliminarán los pedidos asociados.",
          async () => {
            await limpiarPedidosDeLaMesa(mesaId);
            if (reservaConMenuActivo) {
              await toggleMenuSelectionEnabled(reservaConMenuActivo.id);
            }
            if (estadoAdmin === "occupied") {
              await toggleEstadoMesa(mesaId);
            }
            showToast(`Mesa ${mesa.numero}: liberada ✅`, "success", 3500);
            await cargarDatos();
            renderMesasTab();
            renderPedidosTab();
            renderReservacionesTab();
          },
          { confirmText: "Liberar Mesa", danger: true },
        );
      } else {
        await toggleEstadoMesa(mesaId);
        showToast(`Mesa ${mesa.numero}: ocupada 🔴`, "success", 3500);
        await cargarDatos();
        renderMesasTab();
        renderPedidosTab();
        renderReservacionesTab();
      }
    });
  });
}

// ==========================================================
// TAB: MENÚ (CRUD de platillos)
// ==========================================================
function renderMenuTab() {
  const container = document.getElementById("tab-menu");
  if (!container) return;

  const platillos = getPlatillos();

  const grupos = {
    entrada: platillos.filter((p) => p.categoria === "entrada"),
    principal: platillos.filter((p) => p.categoria === "principal"),
    postre: platillos.filter((p) => p.categoria === "postre"),
    bebida: platillos.filter((p) => p.categoria === "bebida"),
  };

  const titulos = {
    entrada: "🥢 Entradas",
    principal: "🍛 Platos Principales",
    postre: "🍰 Postres",
    bebida: "🫖 Bebidas",
  };

  let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <h3><i class="fa-solid fa-utensils"></i> Gestión del Menú</h3>
            <button class="btn btn-primary btn-sm" id="btn-agregar-platillo">
                <i class="fa-solid fa-plus"></i> Agregar Platillo
            </button>
        </div>
    `;

  Object.keys(grupos).forEach((cat) => {
    if (grupos[cat].length === 0) return;
    html += `
            <h4 style="color: var(--color-primary); margin: 22px 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--color-secondary);">
                ${titulos[cat]} (${grupos[cat].length})
            </h4>
            <div class="menu-admin-grid">
                ${grupos[cat]
                  .map(
                    (p) => `
                    <div class="menu-admin-card ${p.disponible ? "" : "disabled"}">
                        ${renderAdminDishThumb(p)}
                        <div class="menu-admin-info">
                            <strong>${p.nombre}</strong>
                            <span class="origin">${p.origen}</span>
                            <span class="meta">${formatCurrency(p.precio)} · ${p.tags && p.tags.length ? p.tags.join(", ") : "sin etiquetas"}</span>
                        </div>
                        <div class="menu-admin-actions">
                            <label class="toggle-switch" title="${p.disponible ? "Activo" : "Inactivo"}">
                                <input type="checkbox" ${p.disponible ? "checked" : ""} data-toggle-platillo="${p.id}">
                                <span class="toggle-slider"></span>
                            </label>
                            <button class="btn-icon" data-edit-platillo="${p.id}" title="Editar">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn-icon danger" data-delete-platillo="${p.id}" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;
  });

  container.innerHTML = html;

  document
    .getElementById("btn-agregar-platillo")
    .addEventListener("click", () => abrirModalPlatillo());

  container.querySelectorAll("[data-toggle-platillo]").forEach((cb) => {
    cb.addEventListener("change", async () => {
      const id = cb.dataset.togglePlatillo;
      const lista = getPlatillos();
      const idx = lista.findIndex((p) => p.id === id);
      if (idx > -1) {
        lista[idx].disponible = cb.checked;
        const ok = await setPlatillos(lista);
        if (ok) {
          showToast(
            `Platillo ${cb.checked ? "habilitado" : "deshabilitado"}`,
            "success",
          );
        } else {
          showToast("Error al actualizar el platillo", "error");
        }
        renderMenuTab();
      }
    });
  });

  container.querySelectorAll("[data-edit-platillo]").forEach((btn) => {
    btn.addEventListener("click", () =>
      abrirModalPlatillo(btn.dataset.editPlatillo),
    );
  });

  container.querySelectorAll("[data-delete-platillo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deletePlatillo;
      showConfirmModal(
        "Eliminar platillo",
        "¿Eliminar permanentemente este platillo del catálogo?",
        async () => {
          const ok = await deletePlatillo(id);
          if (ok) {
            showToast("Platillo eliminado", "success");
            renderMenuTab();
          } else {
            showToast("Error al eliminar el platillo", "error");
          }
        },
        { confirmText: "Eliminar", danger: true },
      );
    });
  });
}

/**
 * Thumbnail del admin — prioriza imagen real, después ícono,
 * al final emoji (mismo orden que el render público).
 */
function renderAdminDishThumb(p) {
  if (p.imagen && p.imagen.trim()) {
    return `
      <span class="menu-admin-icon menu-admin-icon--img">
        <img src="${p.imagen}"
             alt="${p.nombre}"
             onerror="this.parentElement.innerHTML='${(p.emoji || "🍽").replace(/'/g, "\\'")}'">
      </span>
    `;
  }
  if (!p.emoji && p.icono) {
    return `<span class="menu-admin-icon"><i class="fa-solid ${p.icono}"></i></span>`;
  }
  return `<span class="menu-admin-icon">${p.emoji || "🍽"}</span>`;
}

// ==========================================================
// MODAL DE PLATILLO (agregar/editar)
// ==========================================================
function initDishModal() {
  if (document.getElementById("dish-modal")) return;

  const modal = document.createElement("div");
  modal.id = "dish-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
        <div class="modal-card">
            <h3 id="dish-modal-title"><i class="fa-solid fa-utensils"></i> Nuevo Platillo</h3>

            <div class="form-row">
                <div class="form-group">
                    <label><i class="fa-solid fa-tag"></i> Nombre</label>
                    <input type="text" class="form-control" id="dish-name" placeholder="Ej: Nasi Goreng">
                </div>
                <div class="form-group">
                    <label><i class="fa-solid fa-dollar-sign"></i> Precio (MXN)</label>
                    <input type="number" class="form-control" id="dish-price" placeholder="150" min="0">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label><i class="fa-solid fa-layer-group"></i> Categoría</label>
                    <select class="form-control" id="dish-category">
                        <option value="entrada">Entrada</option>
                        <option value="principal">Plato Principal</option>
                        <option value="postre">Postre</option>
                        <option value="bebida">Bebida</option>
                    </select>
                </div>
                <div class="form-group">
                    <label><i class="fa-solid fa-map-pin"></i> Origen / Región</label>
                    <input type="text" class="form-control" id="dish-origin" placeholder="Java, Bali, Sumatra…">
                </div>
            </div>

            <div class="form-group">
                <label><i class="fa-solid fa-align-left"></i> Descripción</label>
                <textarea class="form-control" id="dish-desc" rows="2" placeholder="Descripción del platillo…"></textarea>
            </div>

            <!-- ============ VISUAL (Imagen / Icono / Emoji) ============ -->
            <div class="form-group" style="margin-bottom: 8px;">
                <label style="font-weight: 700;">
                    <i class="fa-solid fa-image"></i> Visual del platillo
                </label>
                <small style="display:block; color: var(--color-text-light); margin-top:-4px; margin-bottom:10px;">
                    La imagen tiene prioridad; si no se provee, se usará el ícono FontAwesome; si tampoco, el emoji.
                </small>
            </div>

            <div class="form-group">
                <label><i class="fa-solid fa-camera"></i> URL de imagen (opcional)</label>
                <input type="url" class="form-control" id="dish-image" placeholder="https://... o data:image/png;base64,...">
                <div id="dish-image-preview" class="dish-image-preview" style="margin-top: 10px; display:none;"></div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label><i class="fa-solid fa-face-smile"></i> Emoji</label>
                    <input type="text" class="form-control" id="dish-emoji" placeholder="🍜" maxlength="4">
                </div>
                <div class="form-group">
                    <label><i class="fa-brands fa-font-awesome"></i> Ícono FontAwesome (clase)</label>
                    <input type="text" class="form-control" id="dish-icon" placeholder="fa-bowl-rice">
                </div>
            </div>

            <div class="form-group">
                <label><i class="fa-solid fa-tags"></i> Etiquetas (separadas por coma)</label>
                <input type="text" class="form-control" id="dish-tags" placeholder="Picante, Vegano, Sin gluten">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label><i class="fa-solid fa-pepper-hot"></i> Nivel de picante (0-4)</label>
                    <input type="number" class="form-control" id="dish-spicy" min="0" max="4" value="0">
                </div>
                <div class="form-group">
                    <label><i class="fa-solid fa-toggle-on"></i> Disponible</label>
                    <select class="form-control" id="dish-available">
                        <option value="true" selected>Sí</option>
                        <option value="false">No</option>
                    </select>
                </div>
            </div>

            <div class="modal-actions">
                <button class="btn btn-outline" id="btn-cancelar-platillo">
                    <i class="fa-solid fa-xmark"></i> Cancelar
                </button>
                <button class="btn btn-primary" id="btn-guardar-platillo">
                    <i class="fa-solid fa-check"></i> Guardar Platillo
                </button>
            </div>
        </div>
    `;
  document.body.appendChild(modal);

  // Listeners del modal
  document
    .getElementById("btn-cancelar-platillo")
    .addEventListener("click", cerrarModalPlatillo);
  document
    .getElementById("btn-guardar-platillo")
    .addEventListener("click", guardarPlatillo);

  // Preview en vivo de la URL de imagen
  const imgInput = document.getElementById("dish-image");
  const imgPreview = document.getElementById("dish-image-preview");
  imgInput.addEventListener("input", () =>
    actualizarPreviewImagen(imgInput.value, imgPreview),
  );

  // Cerrar al hacer click fuera
  modal.addEventListener("click", (e) => {
    if (e.target === modal) cerrarModalPlatillo();
  });
}

function actualizarPreviewImagen(url, container) {
  if (!url || !url.trim()) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }
  container.style.display = "block";
  container.innerHTML = `
    <img src="${url}"
         alt="Vista previa"
         style="max-width: 180px; max-height: 120px; border-radius: 8px; border: 2px solid var(--color-border); object-fit: cover;"
         onerror="this.parentElement.innerHTML='<span style=&quot;color:var(--color-primary); font-size:0.85rem;&quot;><i class=&quot;fa-solid fa-triangle-exclamation&quot;></i> No se pudo cargar la imagen</span>'">
  `;
}

function abrirModalPlatillo(platilloId = null) {
  const modal = document.getElementById("dish-modal");
  state.editingDishId = platilloId;

  const title = document.getElementById("dish-modal-title");
  const inputs = {
    name: document.getElementById("dish-name"),
    price: document.getElementById("dish-price"),
    category: document.getElementById("dish-category"),
    origin: document.getElementById("dish-origin"),
    desc: document.getElementById("dish-desc"),
    image: document.getElementById("dish-image"),
    emoji: document.getElementById("dish-emoji"),
    icon: document.getElementById("dish-icon"),
    tags: document.getElementById("dish-tags"),
    spicy: document.getElementById("dish-spicy"),
    available: document.getElementById("dish-available"),
  };
  const preview = document.getElementById("dish-image-preview");

  if (platilloId) {
    const platillo = getPlatillos().find((p) => p.id === platilloId);
    if (platillo) {
      title.innerHTML =
        '<i class="fa-solid fa-pen-to-square"></i> Editar Platillo';
      inputs.name.value = platillo.nombre || "";
      inputs.price.value = platillo.precio || 0;
      inputs.category.value = platillo.categoria || "principal";
      inputs.origin.value = platillo.origen || "";
      inputs.desc.value = platillo.descripcion || "";
      inputs.image.value = platillo.imagen || "";
      inputs.emoji.value = platillo.emoji || "";
      inputs.icon.value = platillo.icono || "";
      inputs.tags.value = (platillo.tags || []).join(", ");
      inputs.spicy.value = platillo.picante || 0;
      inputs.available.value = String(platillo.disponible !== false);
      actualizarPreviewImagen(inputs.image.value, preview);
    }
  } else {
    title.innerHTML = '<i class="fa-solid fa-utensils"></i> Nuevo Platillo';
    inputs.name.value = "";
    inputs.price.value = "";
    inputs.category.value = "principal";
    inputs.origin.value = "";
    inputs.desc.value = "";
    inputs.image.value = "";
    inputs.emoji.value = "🍜";
    inputs.icon.value = "fa-utensils";
    inputs.tags.value = "";
    inputs.spicy.value = 0;
    inputs.available.value = "true";
    actualizarPreviewImagen("", preview);
  }

  modal.classList.add("active");
}

function cerrarModalPlatillo() {
  document.getElementById("dish-modal").classList.remove("active");
  state.editingDishId = null;
}

async function guardarPlatillo() {
  const nombre = document.getElementById("dish-name").value.trim();
  const precio = parseFloat(document.getElementById("dish-price").value);
  const categoria = document.getElementById("dish-category").value;
  const origen = document.getElementById("dish-origin").value.trim();
  const descripcion = document.getElementById("dish-desc").value.trim();
  const imagen = document.getElementById("dish-image").value.trim();
  const emoji = document.getElementById("dish-emoji").value.trim();
  const icono = document.getElementById("dish-icon").value.trim();
  const tagsStr = document.getElementById("dish-tags").value.trim();
  const picante = parseInt(document.getElementById("dish-spicy").value) || 0;
  const disponible = document.getElementById("dish-available").value === "true";

  const tags = tagsStr
    ? tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // Validaciones
  if (!nombre) {
    showToast("El nombre es obligatorio", "error");
    return;
  }
  if (isNaN(precio) || precio < 0) {
    showToast("El precio es inválido", "error");
    return;
  }
  if (!origen) {
    showToast("El origen es obligatorio", "error");
    return;
  }
  if (!descripcion) {
    showToast("La descripción es obligatoria", "error");
    return;
  }
  // Debe tener al menos un tipo de visual (imagen, emoji o ícono)
  if (!imagen && !emoji && !icono) {
    showToast("Debes proveer al menos imagen, emoji o ícono", "error");
    return;
  }
  if (picante < 0 || picante > 4) {
    showToast("El picante debe estar entre 0 y 4", "error");
    return;
  }

  const lista = getPlatillos();
  const platilloData = {
    id: state.editingDishId || `custom-${Date.now()}`,
    nombre,
    categoria,
    origen,
    descripcion,
    precio,
    imagen: imagen || "",
    emoji: emoji || "",
    icono: icono || "fa-utensils",
    tags,
    picante,
    disponible,
  };

  if (state.editingDishId) {
    const idx = lista.findIndex((p) => p.id === state.editingDishId);
    if (idx > -1) {
      lista[idx] = platilloData;
    }
  } else {
    lista.push(platilloData);
  }

  const ok = await setPlatillos(lista);
  if (ok) {
    showToast(
      state.editingDishId ? "Platillo actualizado ✅" : "Platillo agregado ✅",
      "success",
    );
    cerrarModalPlatillo();
    renderMenuTab();
  } else {
    showToast("Error al guardar el platillo", "error");
  }
}

// ==========================================================
// TAB: PEDIDOS
// ==========================================================
function renderPedidosTab() {
  const container = document.getElementById("tab-pedidos");
  if (!container) return;

  const platillos = getPlatillos();

  const reservasConPedidos = state.reservaciones.filter(
    (r) =>
      r.menuSelectionsByClient &&
      Array.isArray(r.menuSelectionsByClient) &&
      r.menuSelectionsByClient.some(
        (s) =>
          (s.entradas || []).length +
            (s.principales || []).length +
            (s.postres || []).length +
            (s.bebidas || []).length >
          0,
      ) &&
      r.estado !== "cancelled" &&
      r.estado !== "pasada",
  );

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:15px;">
      <h3><i class="fa-solid fa-receipt"></i> Pedidos realizados</h3>
      <span class="stat-chip stat-chip--ok">
        📋 ${reservasConPedidos.length} ${reservasConPedidos.length === 1 ? "pedido activo" : "pedidos activos"}
      </span>
    </div>`;

  if (reservasConPedidos.length === 0) {
    html += `
      <div class="form-alert info show" style="text-align:center;padding:40px 20px;">
        <i class="fa-solid fa-utensils" style="font-size:2rem;color:var(--color-secondary);display:block;margin-bottom:10px;"></i>
        <p style="margin:0;">
          No hay pedidos activos. Los pedidos aparecen cuando los clientes seleccionan
          sus platillos desde la sección <strong>Menú</strong> (con el menú habilitado por el admin).
        </p>
      </div>`;
    container.innerHTML = html;
    return;
  }

  reservasConPedidos.forEach((r) => {
    const area = AREAS.find((a) => a.id === r.area);
    const menu = MENUS[r.menu];

    // ── Construir HTML por cliente (igual que antes) ─────────────────────
    // ── Construir HTML por cliente (agrupando platillos duplicados) ──────
    const clientesHTML = r.menuSelectionsByClient
      .map((sel, idx) => {
        const total =
          (sel.entradas || []).length +
          (sel.principales || []).length +
          (sel.postres || []).length +
          (sel.bebidas || []).length;
        if (total === 0) return "";
        const nombreCliente =
          r.personasNombres?.[idx]?.trim() || `Cliente ${idx + 1}`;

        // Agrupa los IDs de una categoría y renderiza una card por platillo único
        const renderCategoria = (ids, categoria) => {
          const grupos = new Map();
          ids.forEach((id) => grupos.set(id, (grupos.get(id) || 0) + 1));

          return Array.from(grupos.entries())
            .map(([platilloId, qty]) => {
              const p = platillos.find((x) => x.id === platilloId);
              if (!p) return "";

              const qtyBadge =
                qty > 1
                  ? `<span class="menu-admin-qty-badge">×${qty}</span>`
                  : "";

              const precioLabel =
                qty > 1
                  ? `${qty}×${formatCurrency(p.precio)} = ${formatCurrency(p.precio * qty)}`
                  : formatCurrency(p.precio);

              return `
              <div class="menu-admin-card">
                ${renderAdminDishThumb(p)}
                <div class="menu-admin-info">
                  <strong>${p.nombre}${qtyBadge}</strong>
                  <span class="origin">${p.origen}</span>
                  <span class="meta">${precioLabel} · ${categoria}</span>
                </div>
                <div class="pedido-item-delete">
                  <button class="btn-icon danger"
                          data-pedido-eliminar
                          data-reserva-id="${r.id}"
                          data-cliente-index="${idx}"
                          data-categoria="${categoria}"
                          data-platillo-id="${platilloId}"
                          title="${qty > 1 ? `Quitar uno (quedarán ${qty - 1})` : "Eliminar del pedido"}">
                    <i class="fa-solid fa-${qty > 1 ? "minus" : "trash"}"></i>
                  </button>
                </div>
              </div>`;
            })
            .join("");
        };

        return `
          <div class="pedido-cliente-block">
            <h5 class="pedido-cliente-title">
              <span class="pedido-cliente-badge">${idx + 1}</span>
              ${nombreCliente}
              <span class="pedido-cliente-count">(${total} platillos)</span>
            </h5>
            <div class="menu-admin-grid">
              ${renderCategoria(sel.entradas || [], "entradas")}
              ${renderCategoria(sel.principales || [], "principales")}
              ${renderCategoria(sel.postres || [], "postres")}
              ${renderCategoria(sel.bebidas || [], "bebidas")}
            </div>
          </div>`;
      })
      .filter(Boolean)
      .join("");

    // ── Cálculo de precios para el resumen colapsado ──────────────────────
    // ── Cálculo de precios para el resumen colapsado ──────────────────────
    const esAlaCarta = menu?.id === "alacarta";
    const maxSel = menu
      ? menu.maxSelecciones
      : { entradas: 0, principales: 0, postres: 0, bebidas: 0 };
    let subtotalExtras = 0;
    let subtotalAlaCarta = 0;
    let totalPlatillosCount = 0;
    const countByCat = { entradas: 0, principales: 0, postres: 0, bebidas: 0 };

    (r.menuSelectionsByClient || []).forEach((sel) => {
      ["entradas", "principales", "postres", "bebidas"].forEach((cat) => {
        const ids = sel[cat] || [];
        ids.forEach((id, pos) => {
          totalPlatillosCount++;
          countByCat[cat]++;
          const p = platillos.find((x) => x.id === id);
          if (!p) return;
          if (esAlaCarta) {
            subtotalAlaCarta += p.precio;
          } else if (pos >= (maxSel[cat] || 0)) {
            subtotalExtras += p.precio;
          }
        });
      });
    });
    const precioBase = esAlaCarta
      ? 0
      : menu && menu.precio > 0
        ? menu.precio * r.personas
        : 0;
    const subtotal = esAlaCarta
      ? subtotalAlaCarta
      : precioBase + subtotalExtras;
    const iva = +(subtotal * 0.16).toFixed(2);
    const totalFactura = +(subtotal + iva).toFixed(2);

    const resumenHTML = `
      <div class="pedido-precio-resumen">
        <span class="pedido-precio-item">
          <i class="fa-solid fa-utensils" style="color:var(--color-secondary);"></i>
          <span>${totalPlatillosCount} platillos · ${r.personas} pax</span>
        </span>
        ${
          !esAlaCarta && subtotalExtras > 0
            ? `
        <span class="pedido-precio-item">
          <i class="fa-solid fa-circle-exclamation" style="color:var(--color-primary);"></i>
          <span>Extras: <strong>${formatCurrency(subtotalExtras)}</strong></span>
        </span>`
            : ""
        }
        <span class="pedido-precio-item">
          <i class="fa-solid fa-percent" style="color:var(--color-text-light);"></i>
          <span>IVA (16%): ${formatCurrency(iva)}</span>
        </span>
        <span class="pedido-precio-total">${formatCurrency(totalFactura)}</span>
      </div>`;

    html += `
      <div class="pedido-reserva-card" data-reserva-card="${r.id}">
        <div class="pedido-reserva-header">
          <div>
            <h4>
              <i class="fa-solid fa-user-circle"></i>
              ${r.userName}
            </h4>
            <p class="pedido-reserva-meta">
              <i class="fa-solid fa-calendar"></i> ${formatDate(r.fecha)}
              · <i class="fa-solid fa-clock"></i> ${r.hora}
              · <i class="fa-solid fa-users"></i> ${r.personas} pax
              · ${area ? area.nombre : r.area}
              · Mesa #${r.mesa.split("-m")[1]}
            </p>
            <p class="pedido-reserva-meta">
              <i class="fa-solid fa-utensils"></i> ${menu ? menu.nombre : r.menu}
              · <strong>${formatCurrency(r.total)}</strong>
              · ${r.userEmail}
            </p>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
            <span class="status-badge ${r.estado}">${traducirEstado(r.estado)}</span>
            <button class="pedido-collapse-btn" data-collapse-id="${r.id}">
              <i class="fa-solid fa-chevron-down chevron"></i>
              <span class="collapse-label">Colapsar</span>
            </button>
          </div>
        </div>
        ${resumenHTML}
        <div class="pedido-reserva-body">
          ${clientesHTML}
          <div class="pedido-reserva-actions">
            <button class="btn btn-primary btn-finalizar-pedido"
                    data-pedido-finalizar
                    data-reserva-id="${r.id}">
              <i class="fa-solid fa-paper-plane"></i>
              Finalizar pedido
            </button>
          </div>
        </div>
      </div>`;
  });

  container.innerHTML = html;

  // ── Colapsar / expandir ───────────────────────────────────────────────
  container.querySelectorAll("[data-collapse-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = container.querySelector(
        `[data-reserva-card="${btn.dataset.collapseId}"]`,
      );
      if (!card) return;
      card.classList.toggle("collapsed");
      const label = btn.querySelector(".collapse-label");
      const chevron = btn.querySelector(".chevron");
      const collapsed = card.classList.contains("collapsed");
      if (label) label.textContent = collapsed ? "Expandir" : "Colapsar";
    });
  });

  // ── Eliminar platillo del pedido ──────────────────────────────────────
  container.querySelectorAll("[data-pedido-eliminar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reservaId = btn.dataset.reservaId;
      const clienteIdx = parseInt(btn.dataset.clienteIndex);
      const categoria = btn.dataset.categoria;
      const platilloId = btn.dataset.platilloId;
      const p = getPlatillos().find((x) => x.id === platilloId);
      showConfirmModal(
        "Eliminar platillo del pedido",
        `¿Eliminar <strong>${p?.nombre || "este platillo"}</strong> del pedido?`,
        async () => {
          const reserva = state.reservaciones.find((x) => x.id === reservaId);
          if (!reserva?.menuSelectionsByClient) return;
          const copia = JSON.parse(
            JSON.stringify(reserva.menuSelectionsByClient),
          );
          if (copia[clienteIdx]?.[categoria]) {
            // Quitar solo UNA ocurrencia (por si hay qty > 1)
            const idx = copia[clienteIdx][categoria].indexOf(platilloId);
            if (idx > -1) copia[clienteIdx][categoria].splice(idx, 1);
          }
          const ok = await actualizarSeleccionMenu(reservaId, copia);
          if (ok) {
            showToast("Platillo eliminado del pedido", "info");
            await cargarDatos();
            renderPedidosTab();
          } else {
            showToast("Error al eliminar el platillo", "error");
          }
        },
        { confirmText: "Eliminar", danger: true },
      );
    });
  });

  // ── Finalizar pedido → enviar factura + marcar como pasada ────────────
  container.querySelectorAll("[data-pedido-finalizar]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const reservaId = btn.dataset.reservaId;
      const reserva = state.reservaciones.find((x) => x.id === reservaId);
      if (!reserva) return;

      btn.disabled = true;
      const textoOrig = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

      // 1. Calcular el total real con IVA
      const totalReal = calcularTotalReserva(reserva);
      // 2. Enviar factura por correo
      const enviado = await enviarFacturaPorCorreo(reserva);
      // 3. Cambiar estado a "pasada" y persistir el total correcto en Firestore
      await actualizarEstadoReserva(reservaId, "pasada", { total: totalReal });

      if (enviado) {
        showToast(`Factura enviada a ${reserva.userEmail} ✉️`, "success", 4500);
      } else {
        showToast(
          "No se pudo enviar la factura. Revisa la configuración de EmailJS.",
          "error",
          5000,
        );
      }

      btn.disabled = false;
      btn.innerHTML = textoOrig;
      await cargarDatos();
      renderPedidosTab();
    });
  });
}

function calcularTotalReserva(reserva) {
  const menu = MENUS[reserva.menu];
  const esAlaCarta = menu?.id === "alacarta";
  const platillosList = getPlatillos();

  let subtotal = 0;

  if (esAlaCarta) {
    // Suma el precio individual de cada platillo elegido
    (reserva.menuSelectionsByClient || []).forEach((sel) => {
      ["entradas", "principales", "postres", "bebidas"].forEach((cat) => {
        (sel[cat] || []).forEach((id) => {
          const p = platillosList.find((x) => x.id === id);
          if (p) subtotal += p.precio;
        });
      });
    });
  } else {
    // Menú fijo: precio base + platillos extra (por encima del límite)
    const maxSel = menu
      ? menu.maxSelecciones
      : { entradas: 0, principales: 0, postres: 0, bebidas: 0 };
    subtotal = menu ? menu.precio * reserva.personas : 0;
    (reserva.menuSelectionsByClient || []).forEach((sel) => {
      ["entradas", "principales", "postres", "bebidas"].forEach((cat) => {
        (sel[cat] || []).forEach((id, pos) => {
          if (pos >= (maxSel[cat] || 0)) {
            const p = platillosList.find((x) => x.id === id);
            if (p) subtotal += p.precio;
          }
        });
      });
    });
  }

  // Aplicar IVA y redondear a dos decimales
  return +(subtotal * 1.16).toFixed(2);
}

// ==========================================================
// Limpia los pedidos (selecciones de menú) de una mesa.
// Se dispara al liberar una mesa: setea menuSelectionsByClient=null
// para que los pedidos desaparezcan del tab "Pedidos".
// ==========================================================
async function limpiarPedidosDeLaMesa(mesaId) {
  const reservasConPedidos = state.reservaciones.filter(
    (r) =>
      r.mesa === mesaId &&
      r.estado !== "cancelled" &&
      r.estado !== "pasada" &&
      r.menuSelectionsByClient &&
      Array.isArray(r.menuSelectionsByClient) &&
      r.menuSelectionsByClient.some(
        (s) =>
          (s.entradas || []).length +
            (s.principales || []).length +
            (s.postres || []).length +
            (s.bebidas || []).length >
          0,
      ),
  );

  if (reservasConPedidos.length === 0) return false;

  for (const reserva of reservasConPedidos) {
    await actualizarSeleccionMenu(reserva.id, null);
  }
  return true;
}

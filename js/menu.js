/* ===================================================
   MÓDULO: SELECCIÓN DE PLATILLOS (menu.html)

   Comportamiento:
   1. La carta completa es visible SIEMPRE (no requiere login ni reserva)
   2. Si NO hay reserva habilitada:
      - No se muestra .active-reservation-info
      - No se muestra contador "Elige 1 (0/1)"
      - Hacer click NO agrega la clase 'selected'
      - No hay botón "Guardar selección"
   3. Si HAY reserva con menuSelectionEnabled=true:
      - Se muestra banner de reserva activa
      - Se muestra contador de selección
      - Click agrega/quita 'selected'
      - Tabs por cliente (1 tab por cada persona de la reserva)
      - Botón "Guardar selección"
   =================================================== */

import { MENUS, PLATILLOS, refreshPlatillos } from "./data.js";
import {
  showToast,
  formatCurrency,
  formatDate,
  renderPlatilloImage,
} from "./main.js";
import { getCurrentUser } from "./auth.js";
import {
  getReservacionesDelUsuario,
  actualizarSeleccionMenu,
} from "./reservaciones.js";
import { USE_DEMO_MODE } from "./firebase-config.js";

// ==========================================================
// ESTADO
// ==========================================================
const state = {
  reservaActiva: null, // Reserva con menuSelectionEnabled o null
  menu: null, // MENUS[reservaActiva.menu] o null
  clienteActivo: 0, // índice del comensal actual en la tab
  // Array de selecciones, una entrada por cliente
  // [{ entradas:[], principales:[], postres:[], bebidas:[] }, ...]
  seleccionesPorCliente: [],
};

// ==========================================================
// HELPERS
// ==========================================================
function renderTags(tags) {
  if (!tags || !tags.length) return "";
  return `
        <div class="tag-list">
            ${tags.map((t) => `<span class="tag">${t}</span>`).join("")}
        </div>
    `;
}

function crearSeleccionVacia() {
  return { entradas: [], principales: [], postres: [], bebidas: [] };
}

// ==========================================================
// INICIALIZACIÓN
// ==========================================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("seleccion-platillos")) return;

  // En prod: cargar platillos desde Firestore antes de renderizar
  if (!USE_DEMO_MODE) {
    try {
      await refreshPlatillos();
    } catch (e) {
      /* fallback */
    }
  }

  // NO usa protectPage() — el menú debe ser visible siempre
  await detectarReservaActiva();
  render();
  initEventListeners();
});

// ==========================================================
// Buscar reserva del usuario que cumpla condiciones
// ==========================================================
async function detectarReservaActiva() {
  const user = getCurrentUser();
  if (!user) {
    // Sin sesión: no hay reserva activa, pero el menú sí se muestra
    return;
  }

  const misReservas = await getReservacionesDelUsuario(user.uid);

  const habilitadas = misReservas
    .filter((r) => r.estado === "confirmed" && r.menuSelectionEnabled)
    .sort((a, b) =>
      `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`),
    );

  if (habilitadas.length > 0) {
    state.reservaActiva = habilitadas[0];
    state.menu = MENUS[state.reservaActiva.menu];

    // Inicializar seleccionesPorCliente del tamaño de personas
    const nPersonas = state.reservaActiva.personas || 1;
    state.seleccionesPorCliente = [];

    // Restaurar selecciones previas si existen
    const previas = state.reservaActiva.menuSelectionsByClient;
    for (let i = 0; i < nPersonas; i++) {
      if (previas && previas[i]) {
        state.seleccionesPorCliente.push({
          entradas: previas[i].entradas || [],
          principales: previas[i].principales || [],
          postres: previas[i].postres || [],
          bebidas: previas[i].bebidas || [],
        });
      } else {
        state.seleccionesPorCliente.push(crearSeleccionVacia());
      }
    }

    state.clienteActivo = 0;
  }
}

// ==========================================================
// RENDER
// ==========================================================
function render() {
  const container = document.getElementById("seleccion-platillos");
  if (!container) return;

  container.innerHTML = renderCartaCompleta();
}

function renderCartaCompleta() {
  const enabled = !!state.reservaActiva;
  const menu = state.menu;

  // Solo mostrar el banner de reserva activa si HAY reserva habilitada
  const bannerHTML = enabled ? renderActiveReservationInfo() : "";

  // Tabs de clientes solo si hay reserva habilitada
  const tabsHTML = enabled ? renderClientesTabs() : "";

  // Categorías a mostrar:
  // - Si hay reserva: solo las que contempla el menú
  // - Si no: todas las categorías
  const categoriasAMostrar = enabled
    ? [...new Set(menu.estructura)]
    : ["entradas", "principales", "postres", "bebidas"];

  // Header del paper
  const header = enabled
    ? `<div class="menu-paper-header">
                <p class="paper-eyebrow">Personaliza tu experiencia</p>
                <h2>Carta de degustación</h2>
                <p>Elige los platillos de cada tiempo de tu ${menu.nombre.toLowerCase()}.</p>
            </div>`
    : `<div class="menu-paper-header">
                <p class="paper-eyebrow">Nuestra carta</p>
                <h2>Menú Nusantara</h2>
                <p>Explora todos los sabores del archipiélago indonesio.</p>
            </div>`;

  let saveBtnHTML = "";
  if (enabled) {
    const { completo, totalSeleccionados, totalRequeridos, totalExtras } =
      calcularProgresoCliente(state.clienteActivo);
    const faltantes = Math.max(0, totalRequeridos - totalSeleccionados);

    // Calcular costo estimado de extras de TODOS los clientes
    let costoExtrasTotal = 0;
    state.seleccionesPorCliente.forEach((sel) => {
      Object.entries(menu.maxSelecciones).forEach(([cat, max]) => {
        const ids = sel[cat] || [];
        ids.slice(max).forEach((id) => {
          const p = Object.values(PLATILLOS)
            .flat()
            .find((x) => x.id === id);
          if (p) costoExtrasTotal += p.precio;
        });
      });
    });

    const avisoExtras =
      totalExtras > 0
        ? `<div class="extras-warning-banner">
                   <i class="fa-solid fa-circle-exclamation"></i>
                   <div>
                       <strong>${totalExtras} platillo${totalExtras > 1 ? "s" : ""} extra${totalExtras > 1 ? "s" : ""}</strong>
                       para este comensal — se añadirán a tu factura según lo consumido.
                   </div>
               </div>`
        : "";

    const avisoExtrasGlobal =
      costoExtrasTotal > 0
        ? `<p style="font-size:0.8rem;color:var(--color-text-light);margin-top:10px;">
                   <i class="fa-solid fa-receipt"></i>
                   Cargo estimado por extras: <strong style="color:var(--color-primary);">
                   ${formatCurrency(costoExtrasTotal)}</strong> + IVA
               </p>`
        : "";

    saveBtnHTML = `
            <div class="btn-save-selection">
                <p style="font-size: 0.9rem; color: var(--color-text-light); margin-bottom: 10px;">
                    <strong>${totalSeleccionados} / ${totalRequeridos}</strong> platillos seleccionados para
                    <strong>${nombreCliente(state.clienteActivo)}</strong>
                </p>
                ${avisoExtras}
                <button id="btn-guardar-seleccion" class="btn btn-primary btn-lg" ${completoTodosLosClientes() ? "" : "disabled"}>
                    <i class="fa-solid fa-check"></i>
                    ${completoTodosLosClientes() ? "Guardar selección" : "Completa la selección de todos"}
                </button>
                <p style="font-size: 0.82rem; color: var(--color-text-light); margin-top: 14px;">
                    <i class="fa-solid fa-circle-info"></i>
                    ${
                      completo
                        ? `Este comensal ya completó su selección.`
                        : `Faltan ${faltantes} platillo${faltantes > 1 ? "s" : ""} por elegir para este comensal.`
                    }
                </p>
                ${avisoExtrasGlobal}
            </div>
        `;
  }

  return `
        ${bannerHTML}
        <div class="menu-paper ${enabled ? "" : "view-only"}">
            ${header}
            ${tabsHTML}
            ${categoriasAMostrar.map((cat) => renderCategoria(cat, enabled)).join("")}
            ${saveBtnHTML}
        </div>
    `;
}

function renderActiveReservationInfo() {
  const r = state.reservaActiva;
  const menu = state.menu;
  return `
        <div class="active-reservation-info">
            <div>
                <h4>Seleccionando platillos para:</h4>
                <p>
                    <i class="fa-solid fa-calendar"></i> ${formatDate(r.fecha)}
                    · <i class="fa-solid fa-clock"></i> ${r.hora}
                    · <i class="fa-solid fa-users"></i> ${r.personas} pax
                </p>
            </div>
            <span class="info-badge">${menu.nombre} · ${menu.tiempos} tiempos</span>
        </div>
    `;
}

// ==========================================================
// TABS DE CLIENTES
// ==========================================================
function nombreCliente(idx) {
  const r = state.reservaActiva;
  if (!r) return `Cliente ${idx + 1}`;
  const nombre = r.personasNombres && r.personasNombres[idx];
  if (nombre && nombre.trim()) return nombre.trim();
  return `Cliente ${idx + 1}`;
}

function renderClientesTabs() {
  const r = state.reservaActiva;
  if (!r) return "";

  const tabs = [];
  for (let i = 0; i < r.personas; i++) {
    const { completo } = calcularProgresoCliente(i);
    const activa = i === state.clienteActivo;
    tabs.push(`
            <button type="button"
                    class="cliente-tab ${activa ? "active" : ""} ${completo ? "completed" : ""}"
                    data-cliente-index="${i}">
                <span class="cliente-tab-num">${i + 1}</span>
                <span class="cliente-tab-name">${nombreCliente(i)}</span>
                ${completo ? '<i class="fa-solid fa-check cliente-tab-check"></i>' : ""}
            </button>
        `);
  }

  return `
        <div class="clientes-tabs-wrap">
            <p class="clientes-tabs-label">
                <i class="fa-solid fa-user-group"></i>
                Selección individual por comensal
            </p>
            <div class="clientes-tabs">${tabs.join("")}</div>
        </div>
    `;
}

// ==========================================================
// RENDER CATEGORÍA
// ==========================================================
function renderCategoria(categoriaPlural, enabled) {
  const titulos = {
    entradas: "🥢 Entradas",
    principales: "🍛 Platos Principales",
    postres: "🍰 Postres",
    bebidas: "🫖 Bebidas",
  };

  const platillos = PLATILLOS[categoriaPlural];
  if (!platillos || platillos.length === 0) return "";

  let contadorHTML = "";
  let seleccionados = [];
  if (enabled) {
    const max = state.menu.maxSelecciones[categoriaPlural];
    if (max === 0) return "";
    seleccionados =
      state.seleccionesPorCliente[state.clienteActivo][categoriaPlural];
    const cantActual = seleccionados.length;
    const extras = Math.max(0, cantActual - max);

    const colorContador =
      extras > 0
        ? "color: #C1272D; font-weight: 700;"
        : "color: var(--color-text-light);";
    const etiquetaExtra =
      extras > 0
        ? `<span class="cat-extra-badge">+${extras} extra${extras > 1 ? "s" : ""}</span>`
        : "";

    contadorHTML = `
            <span style="font-size: 0.8rem; font-weight: normal; ${colorContador} margin-left: auto; display:inline-flex; align-items:center; gap:6px;">
                Elige ${max} (${cantActual}/${max}) ${etiquetaExtra}
            </span>
        `;
  }

  return `
        <div class="menu-category" data-categoria="${categoriaPlural}">
            <h3>${titulos[categoriaPlural]}${contadorHTML}</h3>
            <div class="menu-items">
                ${platillos.map((p) => renderMenuItem(p, categoriaPlural, seleccionados, enabled)).join("")}
            </div>
        </div>
    `;
}

function renderMenuItem(platillo, categoriaPlural, seleccionados, enabled) {
  const seleccionado = enabled && seleccionados.includes(platillo.id);
  const max =
    enabled && state.menu ? state.menu.maxSelecciones[categoriaPlural] : 0;
  // El ítem es "extra" cuando ya está seleccionado y su posición supera el límite
  const posicion = seleccionado ? seleccionados.indexOf(platillo.id) : -1;
  const esExtra = seleccionado && max > 0 && posicion >= max;

  const badgeExtra = esExtra
    ? `<span class="menu-item-extra-badge">
               <i class="fa-solid fa-circle-exclamation"></i>
               Extra · ${formatCurrency(platillo.precio)} se añade a tu factura
           </span>`
    : "";

  return `
        <div class="menu-item ${seleccionado ? "selected" : ""} ${esExtra ? "menu-item--extra" : ""} ${enabled ? "" : "view-only"}"
             data-platillo-id="${platillo.id}"
             data-categoria="${categoriaPlural}">
            ${renderPlatilloImage(platillo)}
            <div class="menu-item-content">
                <div class="menu-item-header">
                    <span class="menu-item-name">${platillo.nombre}</span>
                    <span class="menu-item-price">${formatCurrency(platillo.precio)}</span>
                </div>
                <div class="menu-item-origin">— ${platillo.origen}</div>
                <div class="menu-item-desc">${platillo.descripcion}</div>
                ${
                  platillo.picante
                    ? `
                    <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:6px;">
                        ${renderSpicyInline(platillo.picante)}
                    </div>
                `
                    : ""
                }
                ${renderTags(platillo.tags)}
                ${badgeExtra}
            </div>
        </div>
    `;
}

// Envoltorio local para no importar renderSpicyLevel del main solo para esto
function renderSpicyInline(level) {
  if (!level || level === 0) return "";
  const peppers = "🌶️".repeat(level);
  const etiquetas = ["", "Suave", "Medio", "Picante", "Muy picante"];
  return `
        <span class="spicy-level spicy-level--${level}">
            <span class="spicy-level-peppers">${peppers}</span>
            <span class="spicy-level-text">${etiquetas[level]}</span>
        </span>
    `;
}

// ==========================================================
// PROGRESO / VALIDACIÓN
// ==========================================================
function calcularProgresoCliente(idx) {
  if (!state.reservaActiva)
    return {
      completo: false,
      totalSeleccionados: 0,
      totalRequeridos: 0,
      totalExtras: 0,
    };

  const menu = state.menu;
  const seleccion = state.seleccionesPorCliente[idx];
  let totalRequeridos = 0;
  let totalSeleccionados = 0;
  let totalExtras = 0;

  Object.entries(menu.maxSelecciones).forEach(([cat, max]) => {
    const cant = (seleccion[cat] || []).length;
    totalRequeridos += max;
    totalSeleccionados += cant;
    if (cant > max) totalExtras += cant - max;
  });

  return {
    // Completo cuando al menos se ha cubierto lo requerido
    completo: totalSeleccionados >= totalRequeridos && totalRequeridos > 0,
    totalSeleccionados,
    totalRequeridos,
    totalExtras,
  };
}

function completoTodosLosClientes() {
  if (!state.reservaActiva) return false;
  for (let i = 0; i < state.reservaActiva.personas; i++) {
    if (!calcularProgresoCliente(i).completo) return false;
  }
  return true;
}

// ==========================================================
// EVENT LISTENERS
// ==========================================================
function initEventListeners() {
  document.addEventListener("click", async (e) => {
    // Tab de cliente
    const clienteTab = e.target.closest(".cliente-tab");
    if (clienteTab && clienteTab.dataset.clienteIndex !== undefined) {
      state.clienteActivo = parseInt(clienteTab.dataset.clienteIndex);
      render();
      return;
    }

    // Toggle de platillo
    const platilloItem = e.target.closest(".menu-item");
    if (platilloItem && platilloItem.dataset.platilloId) {
      // Solo permitir selección si hay reserva habilitada
      if (!state.reservaActiva) return;

      togglePlatillo(
        platilloItem.dataset.platilloId,
        platilloItem.dataset.categoria,
      );
      return;
    }

    // Guardar selección
    if (e.target.closest("#btn-guardar-seleccion")) {
      await guardarSeleccion();
    }
  });
}

function togglePlatillo(platilloId, categoriaPlural) {
  if (!state.menu) return;

  const max = state.menu.maxSelecciones[categoriaPlural];
  if (max === 0) return; // Categoría no incluida en este menú

  const seleccionados =
    state.seleccionesPorCliente[state.clienteActivo][categoriaPlural];
  const index = seleccionados.indexOf(platilloId);

  if (index > -1) {
    // Deseleccionar
    seleccionados.splice(index, 1);
  } else {
    // Seleccionar (sin límite, pero con aviso si supera el máximo)
    seleccionados.push(platilloId);
    if (seleccionados.length > max) {
      const platillo = Object.values(PLATILLOS)
        .flat()
        .find((p) => p.id === platilloId);
      const precio = platillo ? formatCurrency(platillo.precio) : "";
      showToast(
        `⚠️ Platillo extra — ${precio} se añadirá a tu factura`,
        "warning",
        4000,
      );
    }
  }

  render();
}

async function guardarSeleccion() {
  if (!state.reservaActiva) return;

  if (!completoTodosLosClientes()) {
    showToast("Completa la selección de todos los comensales", "warning");
    return;
  }

  const ok = await actualizarSeleccionMenu(
    state.reservaActiva.id,
    state.seleccionesPorCliente,
  );

  if (ok) {
    showToast(
      `¡Selección guardada para ${state.reservaActiva.personas} comensales! 🌸`,
      "success",
      4000,
    );
    await detectarReservaActiva();
    render();
  } else {
    showToast("Error al guardar la selección", "error");
  }
}

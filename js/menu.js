/* ===================================================
   MÓDULO: SELECCIÓN DE PLATILLOS (menu.html)

   Comportamiento:
   1. La carta es visible SIEMPRE (sin sesión = solo lectura)
   2. Con reserva activa + menuSelectionEnabled:
      - Banner de reserva, tabs por comensal
      - Modo compacto en móvil/tablet (2 cols, imagen pequeña, +/−)
      - Sticky tray inferior con progreso por categoría
      - Cada platillo admite CANTIDAD (×1, ×2, ×3...)
      - Menú "A la Carta": sin límites, precio dinámico
   =================================================== */

import { MENUS, PLATILLOS, getPlatillos, refreshPlatillos } from "./data.js";
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
  reservaActiva: null,
  menu: null,
  clienteActivo: 0,
  // Selecciones como array de IDs con duplicados:
  // ["e1", "e1", "e2"] → e1×2, e2×1
  // Estructura: [{ entradas:[], principales:[], postres:[], bebidas:[] }, ...]
  seleccionesPorCliente: [],
  // Modo compacto activo (≤ 900px en horizontal con reserva activa)
  compacto: false,
};

// ==========================================================
// INICIALIZACIÓN
// ==========================================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("seleccion-platillos")) return;

  if (!USE_DEMO_MODE) {
    try {
      await refreshPlatillos();
    } catch (e) {
      /* fallback */
    }
  }

  await detectarReservaActiva();
  detectarModoCompacto();
  render();
  initEventListeners();
  initStickyTray();

  window.addEventListener("resize", () => {
    detectarModoCompacto();
    render();
    actualizarStickyTray();
  });
});

function detectarModoCompacto() {
  // Modo compacto solo cuando hay reserva activa y pantalla ≤ 900px
  state.compacto = !!state.reservaActiva && window.innerWidth <= 900;
}

// ==========================================================
// HELPERS
// ==========================================================
function renderTags(tags) {
  if (!tags || !tags.length) return "";
  return `<div class="tag-list">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>`;
}

function crearSeleccionVacia() {
  return { entradas: [], principales: [], postres: [], bebidas: [] };
}

/** Cantidad de veces que aparece platilloId en el array de una categoría */
function getQty(clienteIdx, categoria, platilloId) {
  const arr = state.seleccionesPorCliente[clienteIdx]?.[categoria] || [];
  return arr.filter((id) => id === platilloId).length;
}

/** Total de platillos seleccionados (contando duplicados) */
function totalEnCategoria(clienteIdx, categoria) {
  return (state.seleccionesPorCliente[clienteIdx]?.[categoria] || []).length;
}

/** Precio total A la Carta para un cliente (suma precio × qty de cada platillo) */
function calcularTotalAlaCarta(clienteIdx) {
  const todos = getPlatillos();
  const sel = state.seleccionesPorCliente[clienteIdx];
  if (!sel) return 0;
  let total = 0;
  ["entradas", "principales", "postres", "bebidas"].forEach((cat) => {
    (sel[cat] || []).forEach((id) => {
      const p = todos.find((x) => x.id === id);
      if (p) total += p.precio;
    });
  });
  return total;
}

// ==========================================================
// DETECTAR RESERVA ACTIVA
// ==========================================================
async function detectarReservaActiva() {
  const user = getCurrentUser();
  if (!user) return;

  const misReservas = await getReservacionesDelUsuario(user.uid);
  const habilitadas = misReservas
    .filter((r) => r.estado === "confirmed" && r.menuSelectionEnabled)
    .sort((a, b) =>
      `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`),
    );

  if (habilitadas.length > 0) {
    state.reservaActiva = habilitadas[0];
    state.menu = MENUS[state.reservaActiva.menu];
    const nPersonas = state.reservaActiva.personas || 1;
    state.seleccionesPorCliente = [];
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
// RENDER PRINCIPAL
// ==========================================================
function render() {
  const container = document.getElementById("seleccion-platillos");
  if (!container) return;
  container.innerHTML = renderCartaCompleta();
  actualizarStickyTray();
}

function renderCartaCompleta() {
  const enabled = !!state.reservaActiva;
  const menu = state.menu;
  const esAlaCarta = menu?.id === "alacarta";

  const bannerHTML = enabled ? renderActiveReservationInfo() : "";
  const tabsHTML = enabled ? renderClientesTabs() : "";

  const categoriasAMostrar = enabled
    ? [...new Set(menu.estructura)]
    : ["entradas", "principales", "postres", "bebidas"];

  const header = enabled
    ? `<div class="menu-paper-header">
        <p class="paper-eyebrow">Personaliza tu experiencia</p>
        <h2>Carta de degustación</h2>
        <p>${
          esAlaCarta
            ? "Elige libremente los platillos que desees. El total se calculará según tu selección."
            : `Elige los platillos de cada tiempo de tu ${menu.nombre.toLowerCase()}.`
        }</p>
       </div>`
    : `<div class="menu-paper-header">
        <p class="paper-eyebrow">Nuestra carta</p>
        <h2>Menú Nusantara</h2>
        <p>Explora todos los sabores del archipiélago indonesio.</p>
       </div>`;

  // Progreso y botón guardar
  let saveBtnHTML = "";
  if (enabled) {
    const { completo, totalSeleccionados, totalRequeridos } =
      calcularProgresoCliente(state.clienteActivo);
    const totalAC = esAlaCarta ? calcularTotalAlaCarta(state.clienteActivo) : 0;

    saveBtnHTML = `
      <div class="btn-save-selection">
        <p style="font-size:0.9rem;color:var(--color-text-light);margin-bottom:10px;">
          ${
            esAlaCarta
              ? `<strong>${totalSeleccionados}</strong> platillos · Total estimado: <strong>${formatCurrency(totalAC)}</strong>`
              : `<strong>${totalSeleccionados} / ${totalRequeridos}</strong> platillos seleccionados para <strong>${nombreCliente(state.clienteActivo)}</strong>`
          }
        </p>
        <button id="btn-guardar-seleccion" class="btn btn-primary btn-lg"
                ${(esAlaCarta ? totalSeleccionados > 0 : completoTodosLosClientes()) ? "" : "disabled"}>
          <i class="fa-solid fa-check"></i>
          ${
            (esAlaCarta ? totalSeleccionados > 0 : completoTodosLosClientes())
              ? "Guardar selección"
              : esAlaCarta
                ? "Selecciona al menos un platillo"
                : "Completa la selección de todos"
          }
        </button>
      </div>`;
  }

  // Botón de toggle compacto (solo visible en tablet/móvil con reserva activa)
  const toggleCompactoBtn = enabled
    ? `<button id="btn-toggle-compacto" class="btn btn-outline btn-sm"
              style="margin:12px 0 0;${window.innerWidth > 900 ? "display:none;" : ""}">
         <i class="fa-solid fa-${state.compacto ? "expand" : "compress"}"></i>
         ${state.compacto ? "Vista completa" : "Vista compacta"}
       </button>`
    : "";

  return `
    ${bannerHTML}
    <div class="menu-paper ${enabled ? "" : "view-only"}">
      ${header}
      ${tabsHTML}
      ${toggleCompactoBtn}
      ${categoriasAMostrar.map((cat) => renderCategoria(cat, enabled)).join("")}
      ${saveBtnHTML}
    </div>`;
}

// ==========================================================
// BANNER DE RESERVA ACTIVA
// ==========================================================
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
      <span class="info-badge">${menu.nombre} · ${menu.id === "alacarta" ? "Libre" : `${menu.tiempos} tiempos`}</span>
    </div>`;
}

// ==========================================================
// TABS DE CLIENTES
// ==========================================================
function nombreCliente(idx) {
  const r = state.reservaActiva;
  if (!r) return `Cliente ${idx + 1}`;
  const n = r.personasNombres?.[idx];
  return n?.trim() || `Cliente ${idx + 1}`;
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
      </button>`);
  }
  return `
    <div class="clientes-tabs-wrap">
      <p class="clientes-tabs-label">
        <i class="fa-solid fa-user-group"></i> Selección individual por comensal
      </p>
      <div class="clientes-tabs">${tabs.join("")}</div>
    </div>`;
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
  if (!platillos?.length) return "";

  const esAlaCarta = state.menu?.id === "alacarta";
  let contadorHTML = "";
  let totalActual = 0;
  let max = 0;

  if (enabled) {
    max = state.menu.maxSelecciones[categoriaPlural];
    if (!esAlaCarta && max === 0) return ""; // categoría no incluida

    totalActual = totalEnCategoria(state.clienteActivo, categoriaPlural);

    if (esAlaCarta) {
      contadorHTML =
        totalActual > 0
          ? `<span style="font-size:0.8rem;font-weight:normal;color:var(--color-primary);margin-left:auto;">${totalActual} elegido${totalActual > 1 ? "s" : ""}</span>`
          : "";
    } else {
      const extras = Math.max(0, totalActual - max);
      const colorStyle =
        extras > 0
          ? "color:#C1272D;font-weight:700;"
          : "color:var(--color-text-light);";
      const extraBadge =
        extras > 0
          ? `<span class="cat-extra-badge">+${extras} extra${extras > 1 ? "s" : ""}</span>`
          : "";
      contadorHTML = `
        <span style="font-size:0.8rem;font-weight:normal;${colorStyle}margin-left:auto;display:inline-flex;align-items:center;gap:6px;">
          Elige ${max} (${totalActual}/${max}) ${extraBadge}
        </span>`;
    }
  }

  const compactoClass = state.compacto ? "menu-items--compact" : "";

  return `
    <div class="menu-category" data-categoria="${categoriaPlural}" id="cat-${categoriaPlural}">
      <h3>${titulos[categoriaPlural]}${contadorHTML}</h3>
      <div class="menu-items ${compactoClass}">
        ${platillos.map((p) => renderMenuItem(p, categoriaPlural, enabled)).join("")}
      </div>
    </div>`;
}

// ==========================================================
// RENDER ITEM INDIVIDUAL
// ==========================================================
function renderMenuItem(platillo, categoriaPlural, enabled) {
  const qty = enabled
    ? getQty(state.clienteActivo, categoriaPlural, platillo.id)
    : 0;
  const seleccionado = qty > 0;
  const esAlaCarta = state.menu?.id === "alacarta";
  const max = enabled ? (state.menu?.maxSelecciones[categoriaPlural] ?? 0) : 0;
  let esExtra = false;
  if (!esAlaCarta && seleccionado && max > 0) {
    const arr =
      state.seleccionesPorCliente[state.clienteActivo]?.[categoriaPlural] || [];
    esExtra = arr.some((id, pos) => id === platillo.id && pos >= max);
  }

  // Controles de cantidad (solo en modo activo)
  let qtyControlsHTML = "";
  if (enabled && seleccionado) {
    const puedeAgregar = esAlaCarta || qty < max * 3; // límite razonable de extras
    qtyControlsHTML = `
      <div class="qty-controls" data-platillo-id="${platillo.id}" data-categoria="${categoriaPlural}">
        <button class="qty-btn qty-btn--minus" data-action="minus"
                data-platillo-id="${platillo.id}" data-categoria="${categoriaPlural}"
                aria-label="Quitar uno">
          <i class="fa-solid fa-minus"></i>
        </button>
        <span class="qty-badge">${qty}</span>
        <button class="qty-btn qty-btn--plus" data-action="plus"
                data-platillo-id="${platillo.id}" data-categoria="${categoriaPlural}"
                ${puedeAgregar ? "" : "disabled"}
                aria-label="Agregar uno">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>`;
  } else if (enabled && !seleccionado) {
    // Botón de agregar inicial (cuando qty=0, no hay controles +/−)
    qtyControlsHTML = `
      <div class="qty-controls" style="justify-content:flex-end;">
        <button class="qty-btn qty-btn--add" data-action="plus"
                data-platillo-id="${platillo.id}" data-categoria="${categoriaPlural}"
                title="Agregar">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>`;
  }

  // Badge de extra
  const badgeExtra = esExtra
    ? `<span class="menu-item-extra-badge">
         <i class="fa-solid fa-circle-exclamation"></i> Extra · ${formatCurrency(platillo.precio)} extra
       </span>`
    : "";

  return `
    <div class="menu-item ${seleccionado ? "selected" : ""} ${esExtra ? "menu-item--extra" : ""} ${enabled ? "" : "view-only"} ${state.compacto ? "menu-item--compact-card" : ""}"
         data-platillo-id="${platillo.id}"
         data-categoria="${categoriaPlural}">
      ${renderPlatilloImage(platillo)}
      <div class="menu-item-content">
        <div class="menu-item-header">
          <span class="menu-item-name">${platillo.nombre}</span>
          <span class="menu-item-price">${formatCurrency(platillo.precio)}</span>
        </div>
        ${state.compacto ? "" : `<div class="menu-item-origin">— ${platillo.origen}</div>`}
        ${state.compacto ? "" : `<div class="menu-item-desc">${platillo.descripcion}</div>`}
        ${state.compacto ? "" : platillo.picante ? `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px;">${renderSpicyInline(platillo.picante)}</div>` : ""}
        ${state.compacto ? "" : renderTags(platillo.tags)}
        ${badgeExtra}
        ${qtyControlsHTML}
      </div>
    </div>`;
}

function renderSpicyInline(level) {
  if (!level) return "";
  const peppers = "🌶️".repeat(level);
  const etiquetas = ["", "Suave", "Medio", "Picante", "Muy picante"];
  return `<span class="spicy-level spicy-level--${level}">
    <span class="spicy-level-peppers">${peppers}</span>
    <span class="spicy-level-text">${etiquetas[level]}</span>
  </span>`;
}

// ==========================================================
// STICKY TRAY (barra inferior de progreso)
// ==========================================================
function initStickyTray() {
  if (document.getElementById("selection-tray")) return;
  const tray = document.createElement("div");
  tray.id = "selection-tray";
  tray.className = "selection-tray";
  document.body.appendChild(tray);
}

function actualizarStickyTray() {
  const tray = document.getElementById("selection-tray");
  if (!tray) return;

  if (!state.reservaActiva) {
    tray.classList.remove("active");
    document.body.classList.remove("tray-active");
    return;
  }

  tray.classList.add("active");
  document.body.classList.add("tray-active");

  const menu = state.menu;
  const clienteIdx = state.clienteActivo;
  const esAlaCarta = menu?.id === "alacarta";

  const categorias = ["entradas", "principales", "postres", "bebidas"];
  const etiquetas = {
    entradas: "Entradas",
    principales: "Principales",
    postres: "Postres",
    bebidas: "Bebidas",
  };

  let html = `<span class="tray-cliente">👤 ${nombreCliente(clienteIdx)}</span>`;

  categorias.forEach((cat) => {
    if (!esAlaCarta && menu?.maxSelecciones[cat] === 0) return; // skip si no aplica
    const actual = totalEnCategoria(clienteIdx, cat);
    const max = esAlaCarta ? null : menu?.maxSelecciones[cat];
    const done = esAlaCarta ? actual > 0 : actual >= max;
    html += `
      <span class="tray-separator"></span>
      <a class="tray-cat" href="#cat-${cat}" onclick="event.preventDefault(); document.getElementById('cat-${cat}')?.scrollIntoView({behavior:'smooth', block:'start'})">
        <span class="tray-cat-label">${etiquetas[cat]}</span>
        <span class="tray-cat-count ${done ? "done" : ""}">
          ${esAlaCarta ? (actual > 0 ? `${actual} ✓` : "—") : `${actual}/${max}${done ? " ✓" : ""}`}
        </span>
      </a>`;
  });

  // Total A la Carta
  if (esAlaCarta) {
    const total = calcularTotalAlaCarta(clienteIdx);
    if (total > 0) {
      html += `<span class="tray-separator"></span>
        <span class="tray-cat" style="cursor:default;">
          <span class="tray-cat-label">Total</span>
          <span class="tray-cat-count" style="color:var(--color-secondary)">${formatCurrency(total)}</span>
        </span>`;
    }
  }

  tray.innerHTML = html;
}

// ==========================================================
// PROGRESO / VALIDACIÓN
// ==========================================================
function calcularProgresoCliente(idx) {
  if (!state.reservaActiva)
    return { completo: false, totalSeleccionados: 0, totalRequeridos: 0 };

  const menu = state.menu;
  const esAlaCarta = menu?.id === "alacarta";
  const sel = state.seleccionesPorCliente[idx];
  let totalRequeridos = 0;
  let totalSeleccionados = 0;

  if (esAlaCarta) {
    const total = ["entradas", "principales", "postres", "bebidas"].reduce(
      (s, c) => s + (sel?.[c]?.length || 0),
      0,
    );
    return {
      completo: total > 0,
      totalSeleccionados: total,
      totalRequeridos: 0,
    };
  }

  Object.entries(menu.maxSelecciones).forEach(([cat, max]) => {
    totalRequeridos += max;
    totalSeleccionados += (sel?.[cat] || []).length;
  });

  return {
    completo: totalSeleccionados >= totalRequeridos && totalRequeridos > 0,
    totalSeleccionados,
    totalRequeridos,
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

    // Botones +/− de cantidad
    const qtyBtn = e.target.closest(".qty-btn");
    if (qtyBtn && state.reservaActiva) {
      e.stopPropagation(); // no propagar al menu-item
      const action = qtyBtn.dataset.action;
      const platilloId = qtyBtn.dataset.platilloId;
      const categoria = qtyBtn.dataset.categoria;
      if (action === "plus") addPlatillo(platilloId, categoria);
      if (action === "minus") removePlatillo(platilloId, categoria);
      return;
    }

    // Click en el body del menu-item (añadir si qty=0, ignorar si ya tiene controles)
    const platilloItem = e.target.closest(".menu-item");
    if (
      platilloItem &&
      platilloItem.dataset.platilloId &&
      state.reservaActiva
    ) {
      const platilloId = platilloItem.dataset.platilloId;
      const categoria = platilloItem.dataset.categoria;
      const qty = getQty(state.clienteActivo, categoria, platilloId);
      // Solo añadir si qty=0 (el primer toque); si ya tiene qty, los botones +/− son los controles
      if (qty === 0) addPlatillo(platilloId, categoria);
      return;
    }

    // Toggle modo compacto
    if (e.target.closest("#btn-toggle-compacto")) {
      state.compacto = !state.compacto;
      render();
      return;
    }

    // Guardar selección
    if (e.target.closest("#btn-guardar-seleccion")) {
      await guardarSeleccion();
    }
  });
}

// ==========================================================
// MANIPULACIÓN DE CANTIDADES
// ==========================================================
function addPlatillo(platilloId, categoriaPlural) {
  if (!state.menu) return;
  const esAlaCarta = state.menu.id === "alacarta";
  const sel = state.seleccionesPorCliente[state.clienteActivo];
  const arrCat = sel[categoriaPlural];

  if (!esAlaCarta) {
    const max = state.menu.maxSelecciones[categoriaPlural];
    if (max === 0) return; // Categoría no disponible en este menú
    const totalCat = arrCat.length;
    // Advertencia si se supera el máximo, pero se permite (es extra con cargo)
    if (totalCat >= max) {
      const platillo = getPlatillos().find((p) => p.id === platilloId);
      const precio = platillo ? formatCurrency(platillo.precio) : "";
      showToast(
        `⚠️ Platillo extra — ${precio} se añadirá a tu factura`,
        "warning",
        4000,
      );
    }
  }

  arrCat.push(platilloId);
  render();
}

function removePlatillo(platilloId, categoriaPlural) {
  if (!state.menu) return;
  const sel = state.seleccionesPorCliente[state.clienteActivo];
  const arrCat = sel[categoriaPlural];
  // Quitar la última ocurrencia del id
  const lastIdx = arrCat.lastIndexOf(platilloId);
  if (lastIdx > -1) arrCat.splice(lastIdx, 1);
  render();
}

// ==========================================================
// GUARDAR SELECCIÓN
// ==========================================================
async function guardarSeleccion() {
  if (!state.reservaActiva) return;

  const esAlaCarta = state.menu?.id === "alacarta";

  if (!esAlaCarta && !completoTodosLosClientes()) {
    showToast("Completa la selección de todos los comensales", "warning");
    return;
  }

  const totalItems = state.seleccionesPorCliente.reduce((s, sel) => {
    return (
      s +
      ["entradas", "principales", "postres", "bebidas"].reduce(
        (ss, c) => ss + (sel[c]?.length || 0),
        0,
      )
    );
  }, 0);

  if (esAlaCarta && totalItems === 0) {
    showToast("Selecciona al menos un platillo", "warning");
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

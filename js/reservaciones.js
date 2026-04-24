/* ===================================================
   MÓDULO: SISTEMA DE RESERVACIONES
   - Calendario visual con disponibilidad
   - Layout 50/50: calendario + formulario (fecha/hora/personas)
   - Menú de tiempos como tarjetas (NO dropdown)
   - Nuevas reservas se crean con menuSelectionEnabled: false
   - Panel "Mis Reservaciones" del cliente con botón "Cancelar" (texto)
   =================================================== */

import {
    db,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    USE_DEMO_MODE,
    COLLECTIONS
} from "./firebase-config.js";
import {
    AREAS,
    generarMesas,
    HORAS_COMIDA,
    HORAS_CENA,
    HORARIOS,
    MENUS,
    DEMO_RESERVACIONES,
    MESES,
    DIAS_CORTOS,
    getEstadoMesas,
    refreshEstadoMesas,
} from "./data.js";
import { getCurrentUser, protectPage } from "./auth.js";
import {
    showToast,
    formatCurrency,
    formatDate,
    getTodayISO,
    traducirEstado,
} from "./main.js";

// ==========================================================
// ESTADO
// ==========================================================
const state = {
  fecha: null,
  hora: null,
  personas: 2,
  personasNombres: ["", ""],
  personaNombreActivo: 0,
  area: null,
  mesa: null,
  menuElegido: null,
  comentarios: "",
  reservaciones: [],
  currentMonth: new Date(),
};

const STORAGE_KEY = "rasa_reservaciones";

// ==========================================================
// INICIALIZACIÓN
// ==========================================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("reservacion-form")) return;
  if (!protectPage()) return;

  // En prod: cargar estado de mesas desde Firestore antes del render
  if (!USE_DEMO_MODE) {
    try { await refreshEstadoMesas(); } catch (e) { /* fallback */ }
  }

  await cargarReservaciones();

  initCalendar();
  renderHoras();
  renderAreas();
  renderMenusTiemposReserva();
  renderNombresPersonas();
  renderMisReservaciones();
  initEventListeners();
});

// ==========================================================
// CARGAR RESERVACIONES
// ==========================================================
async function cargarReservaciones() {
  try {
    if (USE_DEMO_MODE) {
      const stored = localStorage.getItem(STORAGE_KEY);
      const localReservas = stored ? JSON.parse(stored) : [];
      state.reservaciones = [...DEMO_RESERVACIONES, ...localReservas];
      return;
    }
    const q = query(
      collection(db, COLLECTIONS.RESERVATIONS),
      where("estado", "in", ["confirmed", "pending"]),
    );
    const snapshot = await getDocs(q);
    state.reservaciones = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error cargando reservaciones:", error);
    state.reservaciones = [...DEMO_RESERVACIONES];
  }
}

// ==========================================================
// CALENDARIO VISUAL
// ==========================================================
function initCalendar() {
  const container = document.getElementById("calendar-container");
  if (!container) return;
  renderCalendar();

  document.getElementById("cal-prev").onclick = () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
    renderCalendar();
  };
  document.getElementById("cal-next").onclick = () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
    renderCalendar();
  };
}

function formatDateISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function renderCalendar() {
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  const grid = document.getElementById("calendar-grid");
  const title = document.getElementById("cal-title");

  if (!grid || !title) return;

  title.textContent = `${MESES[month]} ${year}`;
  grid.innerHTML = "";

  DIAS_CORTOS.forEach((d) => {
    const h = document.createElement("div");
    h.className = "cal-day-header";
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day cal-day--empty";
    grid.appendChild(empty);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const totalMesas = generarMesas().length;
  const horasReserva = [...HORAS_COMIDA, ...HORAS_CENA];
  const slotsPorDia = horasReserva.length * totalMesas;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dateStr = formatDateISO(date);
    const isPast = date < today;
    const diaSemana = date.getDay();
    const isClosed = !HORARIOS[diaSemana].abierto;

    const reservasDelDia = state.reservaciones.filter(
      (r) => r.fecha === dateStr && r.estado !== "cancelled",
    );
    const fillRatio = reservasDelDia.length / slotsPorDia;

    const el = document.createElement("div");
    el.className = "cal-day";
    el.textContent = d;

    if (dateStr === state.fecha) el.classList.add("cal-day--selected");
    if (dateStr === formatDateISO(today)) el.classList.add("cal-day--today");

    if (isPast) {
      el.classList.add("cal-day--past");
      el.title = "Fecha pasada";
    } else if (isClosed) {
      el.classList.add("cal-day--closed");
      el.title = "Cerrado los lunes";
    } else if (fillRatio >= 0.9) {
      el.classList.add("cal-day--full");
      el.title = "Sin disponibilidad";
    } else if (fillRatio > 0.5) {
      el.classList.add("cal-day--partial");
      el.title = "Disponibilidad limitada";
      el.onclick = () => seleccionarFecha(dateStr, el);
    } else {
      el.classList.add("cal-day--available");
      el.title = "Disponible";
      el.onclick = () => seleccionarFecha(dateStr, el);
    }

    grid.appendChild(el);
  }
}

function seleccionarFecha(dateStr, el) {
  state.fecha = dateStr;
  state.mesa = null;

  document
    .querySelectorAll(".cal-day--selected")
    .forEach((d) => d.classList.remove("cal-day--selected"));
  if (el) el.classList.add("cal-day--selected");

  const display = document.getElementById("fecha-display");
  if (display) display.value = formatDate(dateStr);

  renderHoras();
  renderMesas();
  actualizarResumen();
}

// ==========================================================
// RENDER HORAS (dos turnos: Comida y Cena)
// ==========================================================
function renderHoras() {
  const select = document.getElementById("hora-reserva");
  if (!select) return;

  const fecha = state.fecha;
  select.innerHTML = '<option value="">-- Selecciona una hora --</option>';

  if (!fecha) {
    select.disabled = true;
    return;
  }

  const dia = new Date(fecha + "T00:00:00").getDay();
  const horario = HORARIOS[dia];

  if (!horario.abierto) {
    select.innerHTML += "<option disabled>Cerrado este día</option>";
    select.disabled = true;
    return;
  }

  select.disabled = false;

  // Optgroup COMIDA
  if (horario.comida) {
    const groupComida = document.createElement("optgroup");
    groupComida.label = "🌤 Comida (12:00 — 16:00)";
    HORAS_COMIDA.forEach((hora) => {
      if (hora >= horario.comida.inicio && hora <= horario.comida.fin) {
        const option = document.createElement("option");
        option.value = hora;
        option.textContent = hora;
        groupComida.appendChild(option);
      }
    });
    if (groupComida.children.length) select.appendChild(groupComida);
  }

  // Optgroup CENA
  if (horario.cena) {
    const groupCena = document.createElement("optgroup");
    groupCena.label = "🌙 Cena (18:00 — 22:00)";
    HORAS_CENA.forEach((hora) => {
      if (hora >= horario.cena.inicio && hora <= horario.cena.fin) {
        const option = document.createElement("option");
        option.value = hora;
        option.textContent = hora;
        groupCena.appendChild(option);
      }
    });
    if (groupCena.children.length) select.appendChild(groupCena);
  }
}

// ==========================================================
// RENDER INPUTS DE NOMBRES (dinámicamente según personas)
// ==========================================================
function renderNombresPersonas() {
  const container = document.getElementById("personas-nombres-container");
  if (!container) return;

  const n = state.personas;
  while (state.personasNombres.length < n) state.personasNombres.push("");
  state.personasNombres = state.personasNombres.slice(0, n);

  if (state.personaNombreActivo >= n) state.personaNombreActivo = n - 1;
  if (state.personaNombreActivo < 0) state.personaNombreActivo = 0;

  const idx = state.personaNombreActivo;
  const valorActivo = state.personasNombres[idx] || "";

  const dots = state.personasNombres
    .map((nombre, i) => {
      const clases = ["persona-nombre-dot"];
      if (i === idx) clases.push("active");
      else if (nombre && nombre.trim()) clases.push("filled");
      return `<span class="${clases.join(" ")}"></span>`;
    })
    .join("");

  container.innerHTML = `
        <div class="persona-nombre-indicator">
            Cliente <strong>${idx + 1}</strong> de <strong>${n}</strong>
        </div>
        <input type="text"
               class="form-control persona-nombre-input"
               id="persona-nombre-activo"
               placeholder="Nombre del Cliente ${idx + 1} (opcional)"
               value="${valorActivo.replace(/"/g, "&quot;")}"
               maxlength="40">
        <div class="persona-nombre-nav">
            <button type="button" class="persona-nav-btn"
                    id="btn-persona-prev"
                    ${idx === 0 ? "disabled" : ""}>
                <i class="fa-solid fa-chevron-left"></i> Anterior
            </button>
            <button type="button" class="persona-nav-btn"
                    id="btn-persona-next"
                    ${idx === n - 1 ? "disabled" : ""}>
                Siguiente <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>
        <div class="persona-nombre-dots">${dots}</div>
    `;

  const input = container.querySelector("#persona-nombre-activo");
  input.addEventListener("input", (e) => {
    state.personasNombres[state.personaNombreActivo] = e.target.value;
    const dotsContainer = container.querySelector(".persona-nombre-dots");
    if (dotsContainer) {
      dotsContainer.innerHTML = state.personasNombres
        .map((nombre, i) => {
          const clases = ["persona-nombre-dot"];
          if (i === state.personaNombreActivo) clases.push("active");
          else if (nombre && nombre.trim()) clases.push("filled");
          return `<span class="${clases.join(" ")}"></span>`;
        })
        .join("");
    }
  });

  const btnPrev = container.querySelector("#btn-persona-prev");
  const btnNext = container.querySelector("#btn-persona-next");
  btnPrev.addEventListener("click", () => {
    if (state.personaNombreActivo > 0) {
      state.personaNombreActivo--;
      renderNombresPersonas();
      const nuevoInput = document.getElementById("persona-nombre-activo");
      if (nuevoInput) nuevoInput.focus();
    }
  });
  btnNext.addEventListener("click", () => {
    if (state.personaNombreActivo < state.personasNombres.length - 1) {
      state.personaNombreActivo++;
      renderNombresPersonas();
      const nuevoInput = document.getElementById("persona-nombre-activo");
      if (nuevoInput) nuevoInput.focus();
    }
  });
}

// ==========================================================
// RENDER ÁREAS
// ==========================================================
function renderAreas() {
  const container = document.getElementById("areas-container");
  if (!container) return;

  container.innerHTML = AREAS.map(
    (area) => `
        <div class="area-option" data-area="${area.id}">
            <i class="fa-solid ${area.icono}"></i>
            <div class="area-name">${area.nombre}</div>
            <div class="area-capacity">${area.capacidad}</div>
        </div>
    `,
  ).join("");
}

// ==========================================================
// RENDER MESAS — Croquis temático por área
// ==========================================================
function renderMesas() {
  const container = document.getElementById("mesas-container");
  const legend = document.getElementById("mesas-legend");
  if (!container) return;

  if (!state.area || !state.fecha || !state.hora) {
    container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--color-text-light);">
                <i class="fa-solid fa-chair" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>Selecciona fecha, hora y área para ver las mesas disponibles</p>
            </div>
        `;
    if (legend) legend.style.display = "none";
    return;
  }

  const todasLasMesas = generarMesas().filter((m) => m.area === state.area);

  // 1. Mesas ocupadas por reservas en el mismo horario
  const mesasOcupadas = new Set(
    state.reservaciones
      .filter(
        (r) =>
          r.fecha === state.fecha &&
          r.hora === state.hora &&
          r.area === state.area &&
          r.estado !== "cancelled",
      )
      .map((r) => r.mesa),
  );

  // 2. Mesas marcadas como ocupadas manualmente por el admin
  const estadoAdmin = getEstadoMesas();
  todasLasMesas.forEach((m) => {
    if (estadoAdmin[m.id] === "occupied") mesasOcupadas.add(m.id);
  });

  // 3. Mesas con menú habilitado (cliente en servicio) → SIEMPRE ocupadas
  state.reservaciones
    .filter((r) => r.menuSelectionEnabled === true && r.estado !== "cancelled")
    .forEach((r) => mesasOcupadas.add(r.mesa));

  const area = AREAS.find((a) => a.id === state.area);
  const croquisConfig = getCroquisConfig(state.area);

  const mesasHTML = todasLasMesas
    .map((mesa, i) => {
      const ocupada = mesasOcupadas.has(mesa.id);
      const seleccionada = state.mesa === mesa.id;
      const status = ocupada ? "occupied" : "available";
      const statusText = ocupada ? "Ocupado" : "Disponible";

      let classes = `table-card table-card--${status}`;
      if (seleccionada) classes += " table-card--selected";

      const pos = croquisConfig.posiciones[i] || { top: "50%", left: "50%" };

      return `
            <div class="${classes}"
                 style="top: ${pos.top}; left: ${pos.left};"
                 data-mesa-id="${mesa.id}"
                 data-capacidad="${mesa.capacidad}"
                 title="${ocupada ? "Mesa ocupada" : `Mesa ${mesa.numero} · ${mesa.capacidad} personas`}">
                <div class="table-card__number">${mesa.numero}</div>
                <div class="table-card__cap">👤 × ${mesa.capacidad}</div>
                <div class="table-card__toggle">${statusText}</div>
            </div>
        `;
    })
    .join("");

  container.innerHTML = `
        <div class="croquis" data-area="${state.area}">
            <div class="croquis-header">
                <i class="fa-solid ${area.icono}"></i>
                <span>${area.nombre}</span>
            </div>
            <div class="croquis-floor">
                ${croquisConfig.decoracion}
                ${mesasHTML}
            </div>
            <div class="croquis-footer">
                <i class="fa-solid fa-circle-info"></i>
                <span>${croquisConfig.leyenda}</span>
            </div>
        </div>
    `;

  if (legend) legend.style.display = "flex";
}

// ==========================================================
// Configuración del croquis por área
// ==========================================================
function getCroquisConfig(areaId) {
  if (areaId === "terraza") {
    return {
      leyenda: "🌿 Vista al jardín zen con estanque · Al aire libre",
      decoracion: `
                <div class="croquis-feature feature-palm" title="Palmera central">
                    <span class="feature-emoji">🌴</span>
                    <span class="feature-label">Jardín Zen</span>
                </div>
                <div class="croquis-feature feature-pond" title="Estanque koi"></div>
                <div class="croquis-feature feature-plant feature-plant--tl">🌺</div>
                <div class="croquis-feature feature-plant feature-plant--tr">🌺</div>
                <div class="croquis-feature feature-plant feature-plant--bl">🪴</div>
                <div class="croquis-feature feature-plant feature-plant--br">🪴</div>
                <div class="croquis-feature feature-door feature-door--left">
                    <i class="fa-solid fa-door-open"></i>
                    <span>Entrada</span>
                </div>
            `,
      posiciones: [
        { top: "15%", left: "18%" },
        { top: "15%", left: "82%" },
        { top: "32%", left: "14%" },
        { top: "32%", left: "86%" },
        { top: "60%", left: "14%" },
        { top: "60%", left: "86%" },
        { top: "82%", left: "28%" },
        { top: "82%", left: "72%" },
      ],
    };
  }

  if (areaId === "salon") {
    return {
      leyenda:
        "💃 Pista de baile central con danza tradicional Legong los viernes y sábados",
      decoracion: `
                <div class="croquis-feature feature-dance-floor" title="Pista de baile / Danza Legong">
                    <div class="dance-ring dance-ring--1"></div>
                    <div class="dance-ring dance-ring--2"></div>
                    <div class="dance-ring dance-ring--3"></div>
                    <div class="dance-emoji">💃</div>
                    <span class="feature-label">Danza Legong</span>
                </div>
                <div class="croquis-feature feature-lantern feature-lantern--1">🏮</div>
                <div class="croquis-feature feature-lantern feature-lantern--2">🏮</div>
                <div class="croquis-feature feature-lantern feature-lantern--3">🏮</div>
                <div class="croquis-feature feature-lantern feature-lantern--4">🏮</div>
                <div class="croquis-feature feature-door feature-door--bottom">
                    <i class="fa-solid fa-door-open"></i>
                    <span>Entrada</span>
                </div>
            `,
      posiciones: [
        { top: "14%", left: "16%" },
        { top: "14%", left: "38%" },
        { top: "14%", left: "62%" },
        { top: "14%", left: "84%" },
        { top: "44%", left: "14%" },
        { top: "44%", left: "86%" },
        { top: "62%", left: "14%" },
        { top: "62%", left: "86%" },
        { top: "86%", left: "16%" },
        { top: "86%", left: "38%" },
        { top: "86%", left: "62%" },
        { top: "86%", left: "84%" },
      ],
    };
  }

  if (areaId === "privado") {
    return {
      leyenda: "🔥 Fuego ceremonial balinés · Ideal para eventos íntimos",
      decoracion: `
                <div class="croquis-feature feature-fireplace" title="Fuego ceremonial">
                    <span class="fire-emoji">🔥</span>
                    <span class="feature-label">Fuego Balinés</span>
                </div>
                <div class="croquis-feature feature-offering feature-offering--tl">🪷</div>
                <div class="croquis-feature feature-offering feature-offering--tr">🪷</div>
                <div class="croquis-feature feature-offering feature-offering--bl">🪷</div>
                <div class="croquis-feature feature-offering feature-offering--br">🪷</div>
                <div class="croquis-feature feature-door feature-door--left">
                    <i class="fa-solid fa-door-open"></i>
                    <span>Entrada</span>
                </div>
            `,
      posiciones: [
        { top: "22%", left: "22%" },
        { top: "22%", left: "78%" },
        { top: "72%", left: "22%" },
        { top: "72%", left: "78%" },
      ],
    };
  }

  if (areaId === "barra") {
    return {
      leyenda: "🔪 Cocina abierta con chef · Vive la experiencia del wok",
      decoracion: `
                <div class="croquis-feature feature-kitchen" title="Cocina abierta / Wok">
                    <div class="kitchen-counter"></div>
                    <div class="kitchen-items">
                        <span>🔥</span>
                        <span>🥘</span>
                        <span>👨‍🍳</span>
                        <span>🍜</span>
                        <span>🔥</span>
                    </div>
                    <span class="feature-label">Cocina abierta</span>
                </div>
                <div class="croquis-feature feature-bar-counter" title="Barra"></div>
                <div class="croquis-feature feature-door feature-door--right">
                    <i class="fa-solid fa-door-open"></i>
                    <span>Entrada</span>
                </div>
            `,
      posiciones: [
        { top: "56%", left: "15%" },
        { top: "56%", left: "32%" },
        { top: "56%", left: "50%" },
        { top: "56%", left: "68%" },
        { top: "56%", left: "85%" },
        { top: "82%", left: "50%" },
      ],
    };
  }

  return {
    leyenda: "Selecciona la mesa de tu preferencia",
    decoracion: "",
    posiciones: [],
  };
}

// ==========================================================
// RENDER MENÚS DE TIEMPOS
// ==========================================================
function renderMenusTiemposReserva() {
  const container = document.getElementById("menu-tiempos-reserva");
  if (!container) return;

  const iconos = {
    clasico: "fa-utensils",
    formal: "fa-wine-glass",
    gala: "fa-crown",
  };

  container.innerHTML = Object.values(MENUS)
    .map(
      (menu) => `
        <div class="tiempo-card-compact ${state.menuElegido === menu.id ? "selected" : ""}"
             data-menu-id="${menu.id}">
            <div class="tc-icon">
                <i class="fa-solid ${iconos[menu.id]}"></i>
            </div>
            <h4>${menu.nombre}</h4>
            <div class="tc-subtitle">${menu.subtitle}</div>
            <div class="tc-price">
                ${formatCurrency(menu.precio)}
                <small>/ persona</small>
            </div>
        </div>
    `,
    )
    .join("");
}

// ==========================================================
// MIS RESERVACIONES (resumen rápido)
// ==========================================================
function renderMisReservaciones() {
  const container = document.getElementById("mis-reservaciones-container");
  if (!container) return;

  const user = getCurrentUser();
  if (!user) {
    container.innerHTML =
      '<p class="empty-msg">Inicia sesión para ver tus reservaciones.</p>';
    return;
  }

  const misReservas = state.reservaciones
    .filter((r) => r.userId === user.uid)
    .sort((a, b) =>
      `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`),
    )
    .slice(0, 5);

  if (misReservas.length === 0) {
    container.innerHTML =
      '<p class="empty-msg"><i class="fa-solid fa-circle-info"></i> No tienes reservaciones aún.</p>';
    return;
  }

  container.innerHTML = misReservas
    .map((r) => {
      const area = AREAS.find((a) => a.id === r.area);
      const menu = MENUS[r.menu];
      return `
            <div class="my-res-card status-${r.estado}">
                <div class="my-res-main">
                    <strong>${formatDate(r.fecha)}</strong>
                    <span>
                        <i class="fa-solid fa-clock"></i> ${r.hora} ·
                        <i class="fa-solid fa-users"></i> ${r.personas} pax ·
                        ${area ? area.nombre : r.area} · Mesa #${r.mesa.split("-m")[1]}
                    </span>
                    <span style="margin-top:2px;">
                        <i class="fa-solid fa-utensils"></i> ${menu ? menu.nombre : r.menu} ·
                        <strong>${formatCurrency(r.total)}</strong>
                    </span>
                </div>
                <div class="my-res-right">
                    <span class="status-badge ${r.estado}">${traducirEstado(r.estado)}</span>
                    ${
                      r.estado !== "cancelled"
                        ? `
                        <button class="btn-cancel-text" data-cancel-id="${r.id}">
                            <i class="fa-solid fa-xmark"></i> Cancelar
                        </button>
                    `
                        : ""
                    }
                </div>
            </div>
        `;
    })
    .join("");

  container.querySelectorAll("[data-cancel-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Cancelar esta reservación?")) return;
      const ok = await actualizarEstadoReserva(
        btn.dataset.cancelId,
        "cancelled",
      );
      if (ok) {
        showToast("Reservación cancelada", "warning");
        await cargarReservaciones();
        renderMisReservaciones();
        renderCalendar();
      }
    });
  });
}

// ==========================================================
// EVENTOS
// ==========================================================
function initEventListeners() {
  const form = document.getElementById("reservacion-form");
  const horaSelect = document.getElementById("hora-reserva");
  const personasInput = document.getElementById("personas-reserva");
  const comentariosInput = document.getElementById("comentarios-reserva");

  if (horaSelect) {
    horaSelect.addEventListener("change", (e) => {
      state.hora = e.target.value;
      state.mesa = null;
      renderMesas();
      actualizarResumen();
    });
  }
  if (personasInput) {
    personasInput.addEventListener("input", (e) => {
      state.personas = parseInt(e.target.value) || 1;
      state.mesa = null;
      renderNombresPersonas();
      renderMesas();
      actualizarResumen();
    });
  }
  if (comentariosInput) {
    comentariosInput.addEventListener("input", (e) => {
      state.comentarios = e.target.value;
    });
  }

  document.addEventListener("click", (e) => {
    const tiempoCard = e.target.closest(".tiempo-card-compact");
    if (tiempoCard) {
      state.menuElegido = tiempoCard.dataset.menuId;
      renderMenusTiemposReserva();
      actualizarResumen();
      return;
    }

    const areaEl = e.target.closest(".area-option");
    if (areaEl) {
      document
        .querySelectorAll(".area-option")
        .forEach((a) => a.classList.remove("selected"));
      areaEl.classList.add("selected");
      state.area = areaEl.dataset.area;
      state.mesa = null;
      renderMesas();
      actualizarResumen();
      return;
    }

    const mesaEl = e.target.closest(".croquis .table-card");
    if (mesaEl && !mesaEl.classList.contains("table-card--occupied")) {
      const capacidad = parseInt(mesaEl.dataset.capacidad);
      if (state.personas > capacidad) {
        showToast(`Esta mesa es para máximo ${capacidad} personas`, "warning");
        return;
      }
      document
        .querySelectorAll(".croquis .table-card")
        .forEach((m) => m.classList.remove("table-card--selected"));
      mesaEl.classList.add("table-card--selected");
      state.mesa = mesaEl.dataset.mesaId;
      actualizarResumen();
    }
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await confirmarReservacion();
    });
  }
}

// ==========================================================
// RESUMEN
// ==========================================================
function actualizarResumen() {
  const resumen = document.getElementById("resumen-reserva");
  if (!resumen) return;

  const menu = state.menuElegido ? MENUS[state.menuElegido] : null;
  const area = AREAS.find((a) => a.id === state.area);
  const total = menu ? menu.precio * state.personas : 0;

  resumen.innerHTML = `
        <h4><i class="fa-solid fa-receipt"></i> Resumen de tu reservación</h4>
        <div class="summary-row">
            <span class="summary-label"><i class="fa-solid fa-calendar"></i> Fecha</span>
            <span class="summary-value">${state.fecha ? formatDate(state.fecha) : "—"}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label"><i class="fa-solid fa-clock"></i> Hora</span>
            <span class="summary-value">${state.hora || "—"}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label"><i class="fa-solid fa-users"></i> Personas</span>
            <span class="summary-value">${state.personas}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label"><i class="fa-solid fa-utensils"></i> Menú</span>
            <span class="summary-value">${menu ? menu.nombre : "—"}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label"><i class="fa-solid fa-location-dot"></i> Área</span>
            <span class="summary-value">${area ? area.nombre : "—"}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label"><i class="fa-solid fa-chair"></i> Mesa</span>
            <span class="summary-value">${state.mesa ? "Mesa #" + state.mesa.split("-m")[1] : "—"}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Total estimado</span>
            <span class="summary-value">${formatCurrency(total)}</span>
        </div>
    `;
}

// ==========================================================
// CONFIRMAR RESERVACIÓN
// ==========================================================
async function confirmarReservacion() {
  if (!state.fecha) {
    showToast("Selecciona una fecha en el calendario", "error");
    return;
  }
  if (!state.hora) {
    showToast("Selecciona una hora", "error");
    return;
  }
  if (!state.menuElegido) {
    showToast("Elige un menú (3, 4 o 5 tiempos)", "error");
    return;
  }
  if (!state.area) {
    showToast("Selecciona un área", "error");
    return;
  }
  if (!state.mesa) {
    showToast("Selecciona una mesa", "error");
    return;
  }
  if (state.personas < 1) {
    showToast("Número de personas inválido", "error");
    return;
  }

  const mesaOcupada = state.reservaciones.some(
    (r) =>
      r.fecha === state.fecha &&
      r.hora === state.hora &&
      r.mesa === state.mesa &&
      r.estado !== "cancelled",
  );

  if (mesaOcupada) {
    showToast("Esta mesa fue reservada por alguien más. Elige otra.", "error");
    await cargarReservaciones();
    renderMesas();
    return;
  }

  const user = getCurrentUser();
  const menu = MENUS[state.menuElegido];
  const total = menu.precio * state.personas;

  const nuevaReserva = {
    userId: user.uid,
    userName: user.displayName,
    userEmail: user.email,
    telefono: user.phone || "",
    fecha: state.fecha,
    hora: state.hora,
    personas: state.personas,
    personasNombres: [...state.personasNombres],
    area: state.area,
    mesa: state.mesa,
    menu: state.menuElegido,
    estado: "pending",
    comentarios: state.comentarios,
    total: total,
    createdAt: new Date().toISOString(),
    menuSelectionEnabled: false,
    menuSelectionsByClient: null,
  };

  const btnSubmit = document.querySelector(
    '#reservacion-form button[type="submit"]',
  );
  const btnTextOriginal = btnSubmit.innerHTML;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<span class="loader"></span> Procesando...';

  try {
    if (USE_DEMO_MODE) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const stored = localStorage.getItem(STORAGE_KEY);
      const reservas = stored ? JSON.parse(stored) : [];
      nuevaReserva.id = `r${Date.now()}`;
      reservas.push(nuevaReserva);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas));
    } else {
      await addDoc(collection(db, COLLECTIONS.RESERVATIONS), {
        ...nuevaReserva,
        createdAt: serverTimestamp(),
      });
    }

    showToast(
      "¡Reservación creada! Te avisaremos cuando sea confirmada 🌸",
      "success",
      4500,
    );

    await cargarReservaciones();
    renderCalendar();
    renderMisReservaciones();

    // Reset parcial del formulario
    state.fecha = null;
    state.hora = null;
    state.mesa = null;
    state.comentarios = "";
    state.personasNombres = state.personasNombres.map(() => "");
    document.getElementById("fecha-display").value = "";
    document.getElementById("comentarios-reserva").value = "";
    renderHoras();
    renderMesas();
    renderNombresPersonas();
    actualizarResumen();

    btnSubmit.disabled = false;
    btnSubmit.innerHTML = btnTextOriginal;
  } catch (error) {
    console.error("Error al crear reservación:", error);
    showToast("Error al crear la reservación. Intenta de nuevo.", "error");
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = btnTextOriginal;
  }
}

// ==========================================================
// EXPORTS PARA ADMIN, MIS-RESERVACIONES Y MENU
// ==========================================================
export async function getReservacionesDelUsuario(userId) {
  if (USE_DEMO_MODE) {
    const stored = localStorage.getItem(STORAGE_KEY);
    const localReservas = stored ? JSON.parse(stored) : [];
    return [...DEMO_RESERVACIONES, ...localReservas].filter(
      (r) => r.userId === userId,
    );
  }
  try {
    const q = query(
      collection(db, COLLECTIONS.RESERVATIONS),
      where("userId", "==", userId),
      orderBy("fecha", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

export async function getTodasLasReservaciones() {
  if (USE_DEMO_MODE) {
    const stored = localStorage.getItem(STORAGE_KEY);
    const localReservas = stored ? JSON.parse(stored) : [];
    return [...DEMO_RESERVACIONES, ...localReservas];
  }
  try {
    const q = query(collection(db, COLLECTIONS.RESERVATIONS), orderBy("fecha", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

export async function actualizarEstadoReserva(reservaId, nuevoEstado) {
  if (USE_DEMO_MODE) {
    const stored = localStorage.getItem(STORAGE_KEY);
    const reservas = stored ? JSON.parse(stored) : [];
    const idx = reservas.findIndex((r) => r.id === reservaId);
    if (idx > -1) {
      reservas[idx].estado = nuevoEstado;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas));
      return true;
    }
    const demoIdx = DEMO_RESERVACIONES.findIndex((r) => r.id === reservaId);
    if (demoIdx > -1) {
      DEMO_RESERVACIONES[demoIdx].estado = nuevoEstado;
      return true;
    }
    return false;
  }
  try {
    await updateDoc(doc(db, COLLECTIONS.RESERVATIONS, reservaId), {
      estado: nuevoEstado,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

export async function eliminarReserva(reservaId) {
  if (USE_DEMO_MODE) {
    const stored = localStorage.getItem(STORAGE_KEY);
    const reservas = stored ? JSON.parse(stored) : [];
    const filtradas = reservas.filter((r) => r.id !== reservaId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtradas));
    return true;
  }
  try {
    await deleteDoc(doc(db, COLLECTIONS.RESERVATIONS, reservaId));
    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

// Admin habilita/deshabilita la selección de menú
// FIX: En producción se usa getDoc directamente en vez del antiguo
//      query con where("__name__", "==", id) que era incorrecto.
export async function toggleMenuSelectionEnabled(reservaId) {
  if (USE_DEMO_MODE) {
    const stored = localStorage.getItem(STORAGE_KEY);
    const reservas = stored ? JSON.parse(stored) : [];
    const idx = reservas.findIndex((r) => r.id === reservaId);
    if (idx > -1) {
      reservas[idx].menuSelectionEnabled = !reservas[idx].menuSelectionEnabled;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas));
      return reservas[idx].menuSelectionEnabled;
    }
    const demoIdx = DEMO_RESERVACIONES.findIndex((r) => r.id === reservaId);
    if (demoIdx > -1) {
      DEMO_RESERVACIONES[demoIdx].menuSelectionEnabled =
        !DEMO_RESERVACIONES[demoIdx].menuSelectionEnabled;
      return DEMO_RESERVACIONES[demoIdx].menuSelectionEnabled;
    }
    return false;
  }
  try {
    const refDoc = doc(db, COLLECTIONS.RESERVATIONS, reservaId);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) {
      console.warn("Reserva no encontrada:", reservaId);
      return false;
    }
    const nuevoValor = !snap.data().menuSelectionEnabled;
    await updateDoc(refDoc, {
      menuSelectionEnabled: nuevoValor,
      updatedAt: serverTimestamp(),
    });
    return nuevoValor;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

// Cliente guarda su selección de platillos en su reserva.
// selecciones = [ { entradas:[], principales:[], postres:[], bebidas:[] }, ... ] | null
export async function actualizarSeleccionMenu(reservaId, selecciones) {
  if (USE_DEMO_MODE) {
    const stored = localStorage.getItem(STORAGE_KEY);
    const reservas = stored ? JSON.parse(stored) : [];
    const idx = reservas.findIndex((r) => r.id === reservaId);
    if (idx > -1) {
      reservas[idx].menuSelectionsByClient = selecciones;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas));
      return true;
    }
    const demoIdx = DEMO_RESERVACIONES.findIndex((r) => r.id === reservaId);
    if (demoIdx > -1) {
      DEMO_RESERVACIONES[demoIdx].menuSelectionsByClient = selecciones;
      return true;
    }
    return false;
  }
  try {
    await updateDoc(doc(db, COLLECTIONS.RESERVATIONS, reservaId), {
      menuSelectionsByClient: selecciones,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

/* ===================================================
   MÓDULO: MIS RESERVACIONES (vista del cliente)
   - Ver y gestionar (cancelar/eliminar) reservaciones propias
   - Modal de factura en reservaciones "pasadas"
   =================================================== */

import {
  getReservacionesDelUsuario,
  actualizarEstadoReserva,
  eliminarReserva,
} from "./reservaciones.js";
import { AREAS, MENUS, getPlatillos, refreshPlatillos } from "./data.js";
import { getCurrentUser, protectPage } from "./auth.js";
import {
  showToast,
  formatCurrency,
  formatDate,
  getTodayISO,
  traducirEstado,
  showConfirmModal,
} from "./main.js";
import { USE_DEMO_MODE } from "./firebase-config.js";

const state = {
  reservaciones: [],
  filtro: "todas",
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("mis-reservas-container")) return;
  if (!protectPage()) return;
  if (!USE_DEMO_MODE) {
    try {
      await refreshPlatillos();
    } catch (e) {
      /* fallback a defaults */
    }
  }
  await cargar();
  initFiltros();
  render();
});

async function cargar() {
  const user = getCurrentUser();
  if (!user) return;
  state.reservaciones = await getReservacionesDelUsuario(user.uid);
}

function initFiltros() {
  document.querySelectorAll(".mr-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".mr-filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.filtro = btn.dataset.mrFilter;
      render();
    });
  });
}

function render() {
  const container = document.getElementById("mis-reservas-container");
  let reservas = [...state.reservaciones];
  const hoy = getTodayISO();

  if (state.filtro === "proximas")
    reservas = reservas.filter(
      (r) => r.fecha >= hoy && r.estado !== "cancelled",
    );
  if (state.filtro === "pasadas")
    reservas = reservas.filter((r) => r.fecha < hoy || r.estado === "pasada");
  if (state.filtro === "canceladas")
    reservas = reservas.filter((r) => r.estado === "cancelled");

  reservas.sort((a, b) =>
    `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`),
  );

  if (reservas.length === 0) {
    container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;">
                <i class="fa-solid fa-calendar-xmark" style="font-size:3rem;color:var(--color-secondary);margin-bottom:15px;"></i>
                <h3>No tienes reservaciones</h3>
                <p style="color:var(--color-text-light);margin-bottom:20px;">
                    ${state.filtro === "todas" ? "Aún no has hecho ninguna reservación." : "No hay reservaciones en esta categoría."}
                </p>
                <a href="reservaciones.html" class="btn btn-primary">
                    <i class="fa-solid fa-calendar-plus"></i> Hacer una reservación
                </a>
            </div>`;
    return;
  }

  container.innerHTML = reservas
    .map((r) => {
      const area = AREAS.find((a) => a.id === r.area);
      const menu = MENUS[r.menu];
      const esPasada = r.fecha < hoy || r.estado === "pasada";

      return `
            <div class="my-res-card status-${r.estado}">
                <div class="my-res-main">
                    <strong>${formatDate(r.fecha)}</strong>
                    <span>
                        <i class="fa-solid fa-clock"></i> ${r.hora} ·
                        <i class="fa-solid fa-users"></i> ${r.personas} pars ·
                        ${area ? area.nombre : r.area} · Mesa #${r.mesa.split("-m")[1]}
                    </span>
                    <span style="margin-top:2px;">
                        <i class="fa-solid fa-utensils"></i> ${menu ? menu.nombre : r.menu} ·
                        <strong>${formatCurrency(r.total)}</strong>
                    </span>
                    ${
                      r.comentarios
                        ? `
                        <span style="margin-top:4px;font-style:italic;">
                            <i class="fa-solid fa-comment"></i> ${r.comentarios}
                        </span>`
                        : ""
                    }
                </div>
                <div class="my-res-right">
                    <span class="status-badge ${r.estado}">${traducirEstado(r.estado)}</span>
                    ${
                      r.estado !== "cancelled" && !esPasada
                        ? `
                        <button class="btn-cancel-text" data-cancel-id="${r.id}">
                            <i class="fa-solid fa-xmark"></i> Cancelar
                        </button>`
                        : ""
                    }
                    ${
                      esPasada
                        ? `
                        <button class="btn btn-outline btn-sm" data-factura-id="${r.id}" style="font-size:0.78rem;">
                            <i class="fa-solid fa-file-invoice"></i> Ver factura
                        </button>
                        <button class="btn-cancel-text" data-eliminar-id="${r.id}" title="Eliminar de mi historial">
                            <i class="fa-solid fa-trash"></i> Eliminar
                        </button>`
                        : ""
                    }
                </div>
            </div>`;
    })
    .join("");

  // ── Cancelar ──────────────────────────────────────────────────────────
  container.querySelectorAll("[data-cancel-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showConfirmModal(
        "Cancelar reservación",
        "¿Cancelar esta reservación? Podrás hacer una nueva cuando quieras.",
        async () => {
          const ok = await actualizarEstadoReserva(
            btn.dataset.cancelId,
            "cancelled",
          );
          if (ok) {
            showToast("Reservación cancelada", "warning");
            await cargar();
            render();
          }
        },
        { confirmText: "Cancelar reservación", danger: true },
      );
    });
  });

  // ── Eliminar del historial ────────────────────────────────────────────
  container.querySelectorAll("[data-eliminar-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showConfirmModal(
        "Eliminar reservación",
        "¿Eliminar esta reservación de tu historial?",
        async () => {
          const ok = await eliminarReserva(btn.dataset.eliminarId);
          if (ok) {
            showToast("Reservación eliminada", "success");
            await cargar();
            render();
          }
        },
        { confirmText: "Eliminar", danger: true },
      );
    });
  });

  // ── Ver factura ───────────────────────────────────────────────────────
  container.querySelectorAll("[data-factura-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reserva = state.reservaciones.find(
        (r) => r.id === btn.dataset.facturaId,
      );
      if (reserva) abrirModalFactura(reserva);
    });
  });
}

// ==========================================================
// MODAL DE FACTURA (movido desde admin.js)
// ==========================================================
function construirHTMLFactura(reserva) {
  const area = AREAS.find((a) => a.id === reserva.area);
  const menu = MENUS[reserva.menu];
  const platillos = getPlatillos();

  const hoy = new Date();
  const nn = (n, d) => String(n).padStart(d, "0");
  const numeroFactura = `RN-${String(hoy.getFullYear()).slice(-2)}${nn(hoy.getMonth() + 1, 2)}${nn(hoy.getDate(), 2)}-${reserva.id.slice(-5).toUpperCase()}`;
  const fechaEmision = hoy.toLocaleString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const esAlaCarta = menu?.id === "alacarta";
  const maxSel = menu
    ? menu.maxSelecciones
    : { entradas: 0, principales: 0, postres: 0, bebidas: 0 };

  let subtotalExtras = 0;
  let subtotalAlaCarta = 0;
  let filasHTML = "";
  let hayPlatillos = false;

  (reserva.menuSelectionsByClient || []).forEach((sel, idx) => {
    const nombre =
      reserva.personasNombres?.[idx]?.trim() || `Cliente ${idx + 1}`;
    const cats = ["entradas", "principales", "postres", "bebidas"];
    const totalPlatillos = cats.reduce((s, c) => s + (sel[c] || []).length, 0);
    if (totalPlatillos === 0) return;
    hayPlatillos = true;

    filasHTML += `<tr class="inv-row-cliente">
            <td colspan="3">
                <span class="inv-cliente-num">${idx + 1}</span>
                <span class="inv-cliente-nombre">${nombre}</span>
                <span class="inv-cliente-count">(${totalPlatillos} platillo${totalPlatillos > 1 ? "s" : ""})</span>
            </td>
        </tr>`;

    cats.forEach((cat) => {
      const ids = sel[cat] || [];
      const limite = esAlaCarta ? 0 : maxSel[cat] || 0;

      const grupos = new Map();
      ids.forEach((id, pos) => {
        if (!grupos.has(id)) grupos.set(id, { qty: 0, posiciones: [] });
        const g = grupos.get(id);
        g.qty++;
        g.posiciones.push(pos);
      });

      Array.from(grupos.entries()).forEach(([id, { qty, posiciones }]) => {
        const p = platillos.find((x) => x.id === id);
        if (!p) return;

        const incluidoCount = esAlaCarta
          ? 0
          : posiciones.filter((pos) => pos < limite).length;
        const extraCount = esAlaCarta ? qty : qty - incluidoCount;

        if (esAlaCarta) {
          subtotalAlaCarta += p.precio * qty;
        } else {
          subtotalExtras += p.precio * extraCount;
        }

        const qtyBadge =
          qty > 1 ? `<span class="inv-qty-badge">×${qty}</span>` : "";

        const catLabel =
          cat === "principales"
            ? "Principal"
            : cat === "bebidas"
              ? "Bebida"
              : cat === "entradas"
                ? "Entrada"
                : "Postre";

        let precioTxt;
        let extraBadge = "";

        if (esAlaCarta) {
          const tot = p.precio * qty;
          precioTxt =
            qty > 1
              ? `<span class="inv-price-detail">${qty}×${formatCurrency(p.precio)} =</span><strong class="inv-price-val">${formatCurrency(tot)}</strong>`
              : `<strong class="inv-price-val">${formatCurrency(p.precio)}</strong>`;
        } else if (incluidoCount > 0 && extraCount === 0) {
          precioTxt = `<span class="inv-price-included">Incluido${qty > 1 ? " ×" + qty : ""}</span>`;
        } else if (incluidoCount === 0) {
          const tot = p.precio * extraCount;
          extraBadge = `<span class="inv-extra-badge">+EXTRA</span>`;
          precioTxt =
            extraCount > 1
              ? `<span class="inv-price-detail">${extraCount}×${formatCurrency(p.precio)} =</span><strong class="inv-price-val">${formatCurrency(tot)}</strong>`
              : `<strong class="inv-price-val">${formatCurrency(p.precio)}</strong>`;
        } else {
          const tot = p.precio * extraCount;
          extraBadge = `<span class="inv-extra-badge">+EXTRA</span>`;
          precioTxt = `<span class="inv-price-included">×${incluidoCount}&nbsp;Incl.</span><span class="inv-price-sep">+</span><strong class="inv-price-val">${extraCount > 1 ? extraCount + "×" + formatCurrency(p.precio) + " = " : ""}${formatCurrency(tot)}</strong>`;
        }

        filasHTML += `<tr class="inv-row-platillo">
                    <td class="inv-td inv-td--name">${p.nombre}${qtyBadge}${extraBadge}</td>
                    <td class="inv-td inv-td--cat">${catLabel}</td>
                    <td class="inv-td inv-td--price">${precioTxt}</td>
                </tr>`;
      });
    });
  });

  const precioBase = esAlaCarta
    ? 0
    : menu && menu.precio > 0
      ? menu.precio * reserva.personas
      : 0;
  const subtotal = esAlaCarta ? subtotalAlaCarta : precioBase + subtotalExtras;
  const iva = +(subtotal * 0.16).toFixed(2);
  const total = +(subtotal + iva).toFixed(2);

  return `
<div class="inv">
    <!-- ENCABEZADO -->
    <div class="inv-header">
        <div class="inv-brand">
            <div class="inv-brand-logo">
                <img src="img/logo.png" alt="Rasa Nusantara">
            </div>
            <div class="inv-brand-text">
                <span class="inv-brand-name">Rasa Nusantara</span>
                <span class="inv-brand-tagline">Sabor del archipiélago</span>
            </div>
        </div>
        <div class="inv-meta">
            <p class="inv-meta-label">Factura</p>
            <p class="inv-meta-num">${numeroFactura}</p>
            <p class="inv-meta-date">${fechaEmision}</p>
        </div>
    </div>

    <!-- PARTES -->
    <div class="inv-parties">
        <div class="inv-party">
            <p class="inv-party-label">Facturar a</p>
            <p class="inv-party-name">${reserva.userName}</p>
            <p class="inv-party-detail">${reserva.userEmail}</p>
            ${reserva.telefono ? `<p class="inv-party-detail">Tel: ${reserva.telefono}</p>` : ""}
        </div>
        <div class="inv-party inv-party--right">
            <p class="inv-party-label">Reservación</p>
            <p class="inv-party-detail">${formatDate(reserva.fecha)} · ${reserva.hora}</p>
            <p class="inv-party-detail">${area ? area.nombre : reserva.area} · Mesa #${reserva.mesa?.split("-m")[1]}</p>
            <p class="inv-party-detail">${menu ? menu.nombre : reserva.menu} · ${reserva.personas} pax</p>
        </div>
    </div>

    <!-- TABLA DE PLATILLOS -->
    <div class="inv-table-wrap">
        <table class="inv-table">
            <thead>
                <tr>
                    <th class="inv-th inv-th--name">Platillo</th>
                    <th class="inv-th inv-th--cat">Categoría</th>
                    <th class="inv-th inv-th--price">Precio</th>
                </tr>
            </thead>
            <tbody>
                ${hayPlatillos ? filasHTML : `<tr><td colspan="3" class="inv-empty">Sin platillos registrados</td></tr>`}
            </tbody>
        </table>
    </div>

    <!-- RESUMEN DE PRECIOS -->
    <div class="inv-totals">
        <div class="inv-totals-row">
            <span>${esAlaCarta ? `A la Carta — ${reserva.personas} pax` : `${menu ? menu.nombre : ""} × ${reserva.personas} pax`}</span>
            <span>${formatCurrency(esAlaCarta ? subtotalAlaCarta : precioBase)}</span>
        </div>
        ${
          !esAlaCarta && subtotalExtras > 0
            ? `
        <div class="inv-totals-row inv-totals-row--extra">
            <span>Extras adicionales</span>
            <span>${formatCurrency(subtotalExtras)}</span>
        </div>`
            : ""
        }
        <div class="inv-totals-row">
            <span>Subtotal</span>
            <span>${formatCurrency(subtotal)}</span>
        </div>
        <div class="inv-totals-row">
            <span>IVA (16%)</span>
            <span>${formatCurrency(iva)}</span>
        </div>
        <div class="inv-totals-row inv-totals-row--total">
            <span>TOTAL</span>
            <span>${formatCurrency(total)}</span>
        </div>
    </div>

    <!-- PIE -->
    <div class="inv-footer">
        <p>Esta factura es un comprobante informativo generado automáticamente.</p>
    </div>
</div>`;
}

function abrirModalFactura(reserva) {
  document.getElementById("mr-invoice-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "mr-invoice-modal";
  modal.className = "invoice-modal";
  modal.innerHTML = `
        <div class="invoice-modal-backdrop" data-close-modal></div>
        <div class="invoice-modal-dialog" role="dialog" aria-modal="true">
            <div class="invoice-modal-topbar">
                <h3><i class="fa-solid fa-file-invoice"></i> Comprobante de reservación</h3>
                <button class="invoice-modal-close" data-close-modal aria-label="Cerrar">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="invoice-modal-body">${construirHTMLFactura(reserva)}</div>
            <div class="invoice-modal-actions">
                <button class="btn btn-outline" data-close-modal>
                    <i class="fa-solid fa-xmark"></i> Cerrar
                </button>
            </div>
        </div>`;
  document.body.appendChild(modal);
  document.body.classList.add("modal-open");
  const cerrar = () => {
    modal.remove();
    document.body.classList.remove("modal-open");
  };
  modal
    .querySelectorAll("[data-close-modal]")
    .forEach((el) => el.addEventListener("click", cerrar));
}

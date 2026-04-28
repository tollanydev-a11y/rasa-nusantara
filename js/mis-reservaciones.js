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
                        <i class="fa-solid fa-users"></i> ${r.personas} pax ·
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

  (reserva.menuSelectionsByClient || []).forEach((sel, idx) => {
    const nombre =
      reserva.personasNombres?.[idx]?.trim() || `Cliente ${idx + 1}`;
    const cats = ["entradas", "principales", "postres", "bebidas"];
    const totalPlatillos = cats.reduce((s, c) => s + (sel[c] || []).length, 0);
    if (totalPlatillos === 0) return;

    filasHTML += `<tr><td colspan="3" style="background:#FFF8ED;color:#C1272D;font-size:0.82rem;font-weight:700;
             border-top:2px solid #D4AF37;padding:8px 12px;">
          ${idx + 1}. ${nombre} <span style="color:#8B5A2B;font-weight:400;margin-left:8px;">(${totalPlatillos} platillos)</span>
        </td></tr>`;

    cats.forEach((cat) => {
      const ids = sel[cat] || [];
      const limite = esAlaCarta ? 0 : maxSel[cat] || 0;

      // Agrupar IDs duplicados conservando el orden de posición original
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

        // Acumular subtotales por grupo
        if (esAlaCarta) {
          subtotalAlaCarta += p.precio * qty;
        } else {
          subtotalExtras += p.precio * extraCount;
        }

        // Badge ×N (solo si qty > 1)
        const qtyBadge =
          qty > 1
            ? `<span style="display:inline-flex;align-items:center;justify-content:center;background:#D4AF37;color:#2C1810;border-radius:3px;font-size:0.68rem;font-weight:700;padding:1px 7px;margin-left:6px;line-height:1.5;vertical-align:middle;letter-spacing:0.02em;">×${qty}</span>`
            : "";

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
          const total = p.precio * qty;
          precioTxt =
            qty > 1
              ? `<span style="font-size:0.8rem;color:#8B5A2B;">${qty}×${formatCurrency(p.precio)} =</span> <strong style="color:#C1272D;">${formatCurrency(total)}</strong>`
              : `<strong style="color:#C1272D;">${formatCurrency(p.precio)}</strong>`;
        } else if (incluidoCount > 0 && extraCount === 0) {
          // Todos incluidos
          precioTxt = `<span style="color:#4CAF50;font-style:italic;">Incluido${qty > 1 ? " ×" + qty : ""}</span>`;
        } else if (incluidoCount === 0) {
          // Todos extra
          const total = p.precio * extraCount;
          extraBadge = `<span style="background:#FFF0F0;color:#C1272D;border:1px solid #F8BBD0;border-radius:3px;font-size:0.68rem;font-weight:700;padding:1px 5px;margin-left:6px;vertical-align:middle;">+EXTRA</span>`;
          precioTxt =
            extraCount > 1
              ? `<span style="font-size:0.8rem;color:#8B5A2B;">${extraCount}×${formatCurrency(p.precio)} =</span> <strong style="color:#C1272D;">${formatCurrency(total)}</strong>`
              : `<strong style="color:#C1272D;">${formatCurrency(p.precio)}</strong>`;
        } else {
          // Mixto: algunos incluidos, algunos extra
          const total = p.precio * extraCount;
          extraBadge = `<span style="background:#FFF0F0;color:#C1272D;border:1px solid #F8BBD0;border-radius:3px;font-size:0.68rem;font-weight:700;padding:1px 5px;margin-left:6px;vertical-align:middle;">+EXTRA</span>`;
          precioTxt = `<span style="color:#4CAF50;font-style:italic;">×${incluidoCount}&nbsp;Incl.</span> <span style="color:#555;">+</span> <strong style="color:#C1272D;">${extraCount > 1 ? extraCount + "×" + formatCurrency(p.precio) + " = " : ""}${formatCurrency(total)}</strong>`;
        }

        filasHTML += `<tr>
                  <td style="padding:9px 12px;border-bottom:1px solid #EEE;font-size:0.88rem;">${p.nombre}${qtyBadge}${extraBadge}</td>
                  <td style="padding:9px 12px;border-bottom:1px solid #EEE;font-size:0.78rem;color:#8B5A2B;font-style:italic;">${catLabel}</td>
                  <td style="padding:9px 12px;border-bottom:1px solid #EEE;font-size:0.88rem;text-align:right;font-weight:600;white-space:nowrap;">${precioTxt}</td>
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
  const c = {
    rojo: "#C1272D",
    dorado: "#D4AF37",
    oscuro: "#2C1810",
    cafe: "#8B5A2B",
    fondo: "#FAF3E7",
    fondo2: "#FFF8ED",
    gris: "#555",
  };

  return `<div style="font-family:'Poppins',Arial,sans-serif;max-width:720px;margin:0 auto;background:#FFF;color:${c.oscuro};border-radius:8px;box-shadow:0 4px 18px rgba(0,0,0,.08);">
  <div style="background:linear-gradient(135deg,${c.rojo} 0%,#8B0000 100%);padding:28px 32px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
    <div style="display:flex;align-items:center;gap:12px;color:#fff;">
      <div style="width:45px;height:45px;background:${c.dorado};border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
        <img src="img/logo.png" alt="Rasa Nusantara" style="width:100%;height:100%;object-fit:cover;display:block;">
      </div>
      <div>
        <span style="font-family:'Playfair Display',serif;font-size:1.3rem;color:${c.dorado};font-weight:700;letter-spacing:1px;display:block;">Rasa Nusantara</span>
        <span style="font-family:'Dancing Script',cursive;font-size:0.85rem;color:#fff;">Sabor del archipiélago</span>
      </div>
    </div>
    <div style="text-align:right;">
      <p style="margin:0;font-size:0.65rem;text-transform:uppercase;letter-spacing:.15em;color:${c.dorado};font-weight:700;">Factura</p>
      <p style="margin:3px 0 4px;font-family:'Playfair Display',serif;font-size:1.1rem;color:#FFF;font-weight:700;">${numeroFactura}</p>
      <p style="margin:0;font-size:0.76rem;color:rgba(255,255,255,.75);">${fechaEmision}</p>
    </div>
  </div>
  <div style="display:flex;gap:20px;flex-wrap:wrap;background:${c.fondo};border-left:4px solid ${c.dorado};padding:16px 22px;">
    <div style="flex:1;min-width:200px;">
      <p style="margin:0 0 6px;font-size:0.65rem;text-transform:uppercase;letter-spacing:.12em;color:${c.cafe};font-weight:700;">Facturar a</p>
      <p style="margin:0 0 3px;font-family:'Playfair Display',serif;font-size:1rem;color:${c.oscuro};font-weight:700;">${reserva.userName}</p>
      <p style="margin:2px 0;font-size:0.82rem;color:${c.gris};">${reserva.userEmail}</p>
      ${reserva.telefono ? `<p style="margin:2px 0;font-size:0.82rem;color:${c.gris};">Tel: ${reserva.telefono}</p>` : ""}
    </div>
    <div style="flex:1;min-width:200px;text-align:right;">
      <p style="margin:0 0 6px;font-size:0.65rem;text-transform:uppercase;letter-spacing:.12em;color:${c.cafe};font-weight:700;">Reservación</p>
      <p style="margin:2px 0;font-size:0.82rem;color:${c.gris};">${formatDate(reserva.fecha)} · ${reserva.hora}</p>
      <p style="margin:2px 0;font-size:0.82rem;color:${c.gris};">${area ? area.nombre : reserva.area} · Mesa #${reserva.mesa?.split("-m")[1]}</p>
      <p style="margin:2px 0;font-size:0.82rem;color:${c.gris};">${menu ? menu.nombre : reserva.menu} · ${reserva.personas} pax</p>
    </div>
  </div>
  <div style="padding:20px 22px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:${c.fondo2};">
          <th style="padding:10px 12px;font-size:0.78rem;text-transform:uppercase;letter-spacing:.1em;color:${c.cafe};text-align:left;">Platillo</th>
          <th style="padding:10px 12px;font-size:0.78rem;text-transform:uppercase;letter-spacing:.1em;color:${c.cafe};">Categoría</th>
          <th style="padding:10px 12px;font-size:0.78rem;text-transform:uppercase;letter-spacing:.1em;color:${c.cafe};text-align:right;">Precio</th>
        </tr>
      </thead>
      <tbody>${filasHTML}</tbody>
    </table>
    <div style="margin-top:18px;border-top:2px solid ${c.dorado};padding-top:14px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.88rem;color:${c.gris};">
        ${
          esAlaCarta
            ? `<span>A la Carta — ${reserva.personas} pax</span><span>${formatCurrency(subtotalAlaCarta)}</span>`
            : `<span>Menú base (${menu ? menu.nombre : ""} × ${reserva.personas} pax)</span><span>${formatCurrency(precioBase)}</span>`
        }
      </div>
      ${
        !esAlaCarta && subtotalExtras > 0
          ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.88rem;color:${c.rojo};">
        <span>Extras adicionales</span><span>${formatCurrency(subtotalExtras)}</span>
      </div>`
          : ""
      }
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.88rem;color:${c.gris};">
        <span>Subtotal</span><span>${formatCurrency(subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.88rem;color:${c.gris};">
        <span>IVA (16%)</span><span>${formatCurrency(iva)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0 5px;font-family:'Playfair Display',serif;font-size:1.1rem;color:${c.rojo};font-weight:700;border-top:1px dashed ${c.dorado};margin-top:6px;">
        <span>Total</span><span>${formatCurrency(total)}</span>
      </div>
    </div>
  </div>
  <div style="background:${c.fondo};border-radius:0 0 8px 8px;padding:14px 22px;text-align:center;">
    <p style="margin:0;font-size:0.78rem;color:${c.cafe};font-style:italic;">
      Esta factura es un comprobante informativo generado automáticamente.
    </p>
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

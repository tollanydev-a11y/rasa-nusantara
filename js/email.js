/* ==========================================================
   EMAIL.JS — Envío de correos usando EmailJS
   Centraliza la configuración y todas las funciones de envío
   (confirmación de reserva y factura). Las demás vistas NO
   deben importar EmailJS directamente: siempre pasan por aquí.
   ========================================================== */

import { AREAS, MENUS, getPlatillos } from "./data.js";
import { formatDate, formatCurrency } from "./main.js";

// ==========================================================
// CONFIGURACIÓN
// Reemplaza estos valores con los IDs reales de tu cuenta
// de EmailJS (https://dashboard.emailjs.com/admin/).
// El publicKey se inicializa automáticamente al cargar este
// módulo (ver inicialización al final del archivo).
// ==========================================================
export const EMAILJS_CONFIG = {
  publicKey: "9WAcEOAhGkWvRzvC0",
  serviceId: "service_sb1fp95",
  // Un template por tipo de correo; ambos reciben {{factura_html}}
  // (o {{confirmacion_html}}) para insertar el markup tal cual.
  templateIdConfirmacion: "template_toqxbw4",
  templateIdFactura: "template_n5dviep",
};

// ==========================================================
// Helper: verifica que EmailJS esté disponible en window.
// El CDN se carga desde admin.html antes del módulo JS.
// ==========================================================
function emailjsDisponible() {
  if (!window.emailjs) {
    console.error(
      "[EmailJS] No está cargado. Verifica que el <script> del CDN esté en admin.html antes de js/admin.js",
    );
    return false;
  }
  return true;
}

// ==========================================================
// Construye el HTML del correo de confirmación de reserva.
// Se inserta textualmente en el template de EmailJS vía
// {{{confirmacion_html}}} (triple llave para no escapar).
// ==========================================================
function construirHTMLConfirmacion(reserva) {
  const area = AREAS.find((a) => a.id === reserva.area);
  const menu = MENUS[reserva.menu];
  const mesaNum = reserva.mesa.split("-m")[1];

  return `
<div style="font-family: 'Poppins', Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #FFFFFF; color: #2C1810;">
    <div style="background: linear-gradient(135deg, #C1272D 0%, #8B0000 100%); color: #D4AF37; padding: 30px 28px; text-align: center;">
        <div style="font-size: 2.4rem; line-height: 1; margin-bottom: 6px;">🍜</div>
        <h1 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 1.7rem; color: #FFFFFF;">Rasa Nusantara</h1>
        <p style="margin: 6px 0 0; font-size: 0.82rem; color: #D4AF37; font-style: italic;">Cocina indonesia · Sabores del archipiélago</p>
    </div>

    <div style="padding: 32px 28px;">
        <h2 style="font-family: 'Playfair Display', serif; color: #C1272D; margin: 0 0 14px; font-size: 1.35rem;">
            ✅ Tu reservación ha sido confirmada
        </h2>

        <p style="margin: 0 0 18px; line-height: 1.6; color: #444;">
            Estimado/a <strong style="color: #2C1810;">${reserva.userName}</strong>,
        </p>

        <p style="margin: 0 0 18px; line-height: 1.6; color: #444;">
            Nos complace informarte que tu reservación ha sido <strong>confirmada</strong>.
            Estamos listos para recibirte con los sabores del archipiélago indonesio.
        </p>

        <div style="background: #FAF3E7; border-left: 4px solid #D4AF37; padding: 18px 22px; border-radius: 6px; margin: 24px 0;">
            <p style="margin: 0 0 10px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: #8B5A2B; font-weight: 700;">
                Detalles de tu reservación
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.92rem;">
                <tr>
                    <td style="padding: 4px 0; color: #8B5A2B; width: 120px;"><strong>Fecha:</strong></td>
                    <td style="padding: 4px 0; color: #2C1810;">${formatDate(reserva.fecha)}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #8B5A2B;"><strong>Hora:</strong></td>
                    <td style="padding: 4px 0; color: #2C1810;">${reserva.hora}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #8B5A2B;"><strong>Área:</strong></td>
                    <td style="padding: 4px 0; color: #2C1810;">${area ? area.nombre : reserva.area}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #8B5A2B;"><strong>Mesa:</strong></td>
                    <td style="padding: 4px 0; color: #2C1810;">#${mesaNum}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #8B5A2B;"><strong>Comensales:</strong></td>
                    <td style="padding: 4px 0; color: #2C1810;">${reserva.personas}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #8B5A2B;"><strong>Menú:</strong></td>
                    <td style="padding: 4px 0; color: #2C1810;">${menu ? menu.nombre : reserva.menu}${menu ? ` (${menu.tiempos} tiempos)` : ""}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #8B5A2B;"><strong>Total:</strong></td>
                    <td style="padding: 4px 0; color: #C1272D; font-weight: 700;">${formatCurrency(reserva.total)}</td>
                </tr>
            </table>
        </div>

        <p style="margin: 0 0 14px; line-height: 1.6; color: #444; font-size: 0.9rem;">
            Te esperamos. Por favor llega <strong>10 minutos antes</strong> de tu hora reservada.
        </p>
        <p style="margin: 0; line-height: 1.6; color: #666; font-size: 0.85rem;">
            Si necesitas cancelar o modificar, hazlo desde tu panel <em>"Mis reservaciones"</em>.
        </p>
    </div>

    <div style="text-align: center; padding: 20px 28px 26px; border-top: 1px dashed #D4AF37; background: #FFF8ED;">
        <p style="margin: 0; font-family: 'Playfair Display', serif; font-size: 1.15rem; color: #C1272D; font-weight: 700;">
            ¡Gracias por tu preferencia!
        </p>
        <p style="margin: 4px 0 14px; font-family: 'Dancing Script', cursive; font-size: 1.5rem; color: #8B5A2B;">
            Terima Kasih 🙏
        </p>
        <p style="margin: 0; font-size: 0.72rem; color: #999; line-height: 1.5;">
            Rasa Nusantara · hola@rasanusantara.mx
        </p>
    </div>
</div>
`;
}

// ==========================================================
// Envía correo de CONFIRMACIÓN cuando el admin confirma una
// reservación desde el tab Reservaciones.
// ==========================================================
export async function enviarCorreoConfirmacion(reserva) {
  if (!emailjsDisponible()) return false;

  const confirmacionHTML = construirHTMLConfirmacion(reserva);

  const templateParams = {
    to_email: reserva.userEmail,
    to_name: reserva.userName,
    reservation_date: formatDate(reserva.fecha),
    reservation_time: reserva.hora,
    confirmacion_html: confirmacionHTML,
  };

  try {
    await window.emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateIdConfirmacion,
      templateParams,
    );
    console.info(
      `%c[EmailJS]%c Confirmación enviada a ${reserva.userEmail}`,
      "color:#4CAF50;font-weight:bold;",
      "color:inherit;",
    );
    return true;
  } catch (err) {
    console.error("[EmailJS] Error al enviar confirmación:", err);
    return false;
  }
}

// ==========================================================
// Envía la FACTURA al correo del cliente. El HTML de la
// factura se construye en admin.js (construirHTMLFactura) y
// se pasa tal cual como parámetro.
// Placeholders esperados en el template:
//   {{to_email}} {{to_name}} {{invoice_number}} {{{factura_html}}}
// ==========================================================
// ==========================================================
// Construye la factura en HTML optimizado para CORREO.
//
// A diferencia de la versión del modal (admin.js → construirHTMLFactura),
// este markup usa <table> para el layout en vez de flexbox porque los
// clientes de correo (Gmail, Outlook, Yahoo, Apple Mail) eliminan
// silenciosamente propiedades modernas como justify-content, align-items,
// gap, flex-wrap y flex:1. El look & feel debe coincidir con la preview,
// pero la implementación técnica es distinta.
// ==========================================================
function construirHTMLFacturaEmail(reserva) {
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

  // ── Paleta de colores (los clientes de correo sí respetan #hex) ─────
  const C = {
    rojo: "#C1272D",
    rojoOscuro: "#8B0000",
    dorado: "#D4AF37",
    oscuro: "#2C1810",
    cafe: "#8B5A2B",
    fondo: "#FAF3E7",
    fondo2: "#FFF8ED",
    gris: "#555555",
    grisClaro: "#999999",
    borde: "#EEEEEE",
    verde: "#4CAF50",
    badgeFondo: "#FFF0F0",
    badgeBorde: "#F8BBD0",
  };

  // ── Filas de platillos con lógica incluido/extra ────────────────────
  let subtotalExtras = 0;
  let subtotalAlaCarta = 0; // ← nueva variable
  let filasHTML = "";
  const countByCat = { entradas: 0, principales: 0, postres: 0, bebidas: 0 };

  (reserva.menuSelectionsByClient || []).forEach((sel, idx) => {
    const nombre =
      reserva.personasNombres?.[idx]?.trim() || `Cliente ${idx + 1}`;
    const cats = ["entradas", "principales", "postres", "bebidas"];
    const totalPlatillos = cats.reduce((s, c) => s + (sel[c] || []).length, 0);
    if (totalPlatillos === 0) return;

    filasHTML += `
        <tr>
          <td colspan="3" style="background:${C.fondo2};color:${C.rojo};font-size:13px;font-weight:700;border-top:2px solid ${C.dorado};padding:8px 12px;">
            ${idx + 1}. ${nombre}
            <span style="color:${C.cafe};font-weight:400;margin-left:8px;">(${totalPlatillos} platillos)</span>
          </td>
        </tr>`;

    cats.forEach((cat) => {
      const ids = sel[cat] || [];
      const limite = esAlaCarta ? 0 : maxSel[cat] || 0;

      // Agrupar IDs duplicados conservando el orden de posición original
      // (la posición determina si un platillo es "incluido" o "extra")
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

        // Badge ×N (solo aparece cuando qty > 1)
        const qtyBadge =
          qty > 1
            ? `<span style="display:inline-flex;align-items:center;justify-content:center;background:${C.dorado};color:${C.oscuro};border-radius:3px;font-size:10px;font-weight:700;padding:1px 7px;margin-left:6px;line-height:1.5;vertical-align:middle;letter-spacing:0.02em;">×${qty}</span>`
            : "";

        const nombreCat =
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
              ? `<span style="font-size:11px;color:${C.cafe};">${qty}×${formatCurrency(p.precio)} =</span> <strong style="color:${C.rojo};">${formatCurrency(total)}</strong>`
              : `<strong style="color:${C.rojo};">${formatCurrency(p.precio)}</strong>`;
        } else if (incluidoCount > 0 && extraCount === 0) {
          // Todos incluidos en el menú
          precioTxt = `<span style="color:${C.verde};font-style:italic;">Incluido${qty > 1 ? " ×" + qty : ""}</span>`;
        } else if (incluidoCount === 0) {
          // Todos extra
          const total = p.precio * extraCount;
          extraBadge = `<span style="background:${C.badgeFondo};color:${C.rojo};border:1px solid ${C.badgeBorde};border-radius:3px;font-size:10px;font-weight:700;padding:1px 5px;margin-left:6px;">+EXTRA</span>`;
          precioTxt =
            extraCount > 1
              ? `<span style="font-size:11px;color:${C.cafe};">${extraCount}×${formatCurrency(p.precio)} =</span> <strong style="color:${C.rojo};">${formatCurrency(total)}</strong>`
              : `<strong style="color:${C.rojo};">${formatCurrency(p.precio)}</strong>`;
        } else {
          // Mixto: algunos incluidos, algunos extra en el mismo platillo
          const total = p.precio * extraCount;
          extraBadge = `<span style="background:${C.badgeFondo};color:${C.rojo};border:1px solid ${C.badgeBorde};border-radius:3px;font-size:10px;font-weight:700;padding:1px 5px;margin-left:6px;">+EXTRA</span>`;
          precioTxt = `<span style="color:${C.verde};font-style:italic;">×${incluidoCount}&nbsp;Incl.</span> <span style="color:${C.gris};">+</span> <strong style="color:${C.rojo};">${extraCount > 1 ? extraCount + "×" + formatCurrency(p.precio) + " = " : ""}${formatCurrency(total)}</strong>`;
        }

        filasHTML += `
        <tr>
          <td style="padding:9px 12px;border-bottom:1px solid ${C.borde};font-size:13px;">${p.nombre}${qtyBadge}${extraBadge}</td>
          <td style="padding:9px 12px;border-bottom:1px solid ${C.borde};font-size:12px;color:${C.cafe};font-style:italic;">${nombreCat}</td>
          <td align="right" style="padding:9px 12px;border-bottom:1px solid ${C.borde};font-size:13px;font-weight:600;white-space:nowrap;">${precioTxt}</td>
        </tr>`;
      });
    });
  });

  // ── Totales ──────────────────────────────────────────────────────────
  const precioBase = esAlaCarta ? 0 : menu ? menu.precio * reserva.personas : 0;
  const subtotal = esAlaCarta ? subtotalAlaCarta : precioBase + subtotalExtras;
  const iva = +(subtotal * 0.16).toFixed(2);
  const total = +(subtotal + iva).toFixed(2);

  // ── MARKUP (todo con <table> — compatible con Gmail/Outlook/Yahoo) ──
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F8F3EA;padding:20px 10px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;width:100%;background:#FFFFFF;border:1px solid ${C.borde};border-radius:8px;font-family:'Poppins',Arial,sans-serif;color:${C.oscuro};">

        <!-- ENCABEZADO -->
        <tr>
          <td style="background:${C.rojo};background-image:linear-gradient(135deg,${C.rojo} 0%,${C.rojoOscuro} 100%);padding:28px 32px;border-radius:8px 8px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td valign="middle" align="left" width="60%">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="middle" align="center" width="62" style="background:rgba(255,255,255,0.15);border-radius:50%;border:2px solid ${C.dorado};height:58px;width:58px;font-size:28px;line-height:58px;">🍜</td>
                      <td valign="middle" style="padding-left:14px;">
                        <div style="font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#FFFFFF;font-weight:700;letter-spacing:0.02em;line-height:1.2;">Rasa Nusantara</div>
                        <div style="font-size:12px;color:${C.dorado};font-style:italic;margin-top:3px;">Cocina indonesia · Sabores del archipiélago</div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td valign="top" align="right" width="40%">
                  <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:${C.dorado};font-weight:700;">Factura</div>
                  <div style="font-family:'Playfair Display',Georgia,serif;font-size:17px;color:#FFFFFF;font-weight:700;margin:3px 0 4px;">${numeroFactura}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.75);">${fechaEmision}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PARTES -->
        <tr>
          <td style="background:${C.fondo};border-left:4px solid ${C.dorado};padding:16px 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td valign="top" width="50%" style="padding-right:10px;">
                  <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:${C.cafe};font-weight:700;margin-bottom:6px;">Facturar a</div>
                  <div style="font-family:'Playfair Display',Georgia,serif;font-size:15px;color:${C.oscuro};font-weight:700;margin-bottom:3px;">${reserva.userName}</div>
                  <div style="font-size:12px;color:${C.gris};margin:2px 0;">${reserva.userEmail}</div>
                  ${reserva.telefono ? `<div style="font-size:12px;color:${C.gris};margin:2px 0;">Tel: ${reserva.telefono}</div>` : ""}
                </td>
                <td valign="top" width="50%" style="padding-left:10px;">
                  <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:${C.cafe};font-weight:700;margin-bottom:6px;">Reservación</div>
                  <div style="font-size:13px;color:${C.oscuro};margin:2px 0;"><strong>${formatDate(reserva.fecha)}</strong> · ${reserva.hora}</div>
                  <div style="font-size:12px;color:${C.gris};margin:2px 0;">${area ? area.nombre : reserva.area} · Mesa #${reserva.mesa.split("-m")[1]}</div>
                  <div style="font-size:12px;color:${C.gris};margin:2px 0;">${reserva.personas} ${reserva.personas === 1 ? "comensal" : "comensales"} · ${menu ? menu.nombre : reserva.menu}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TABLA DE PLATILLOS -->
        <tr>
          <td style="padding:0 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border-collapse:collapse;">
              <thead>
                <tr>
                  <th align="left" style="background:${C.oscuro};color:${C.dorado};padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Platillo</th>
                  <th align="left" style="background:${C.oscuro};color:${C.dorado};padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Categoría</th>
                  <th align="right" style="background:${C.oscuro};color:${C.dorado};padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Precio</th>
                </tr>
              </thead>
              <tbody>
                ${filasHTML || `<tr><td colspan="3" align="center" style="padding:20px;color:${C.grisClaro};font-size:13px;">Sin platillos en el pedido</td></tr>`}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- RESUMEN DE PRECIOS -->
        <tr>
          <td style="padding:0 22px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.fondo};border-radius:6px;">
              <tr><td style="padding:14px 18px 4px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="left" style="font-size:13px;color:${C.gris};padding:4px 0;">
                      ${
                        esAlaCarta
                          ? `A la Carta — ${reserva.personas} ${reserva.personas === 1 ? "comensal" : "comensales"}`
                          : `${menu ? menu.nombre : reserva.menu} (${reserva.personas} × ${formatCurrency(menu ? menu.precio : 0)})`
                      }
                    </td>
                    <td align="right" style="font-size:13px;color:${C.gris};padding:4px 0;">
                      ${formatCurrency(esAlaCarta ? subtotalAlaCarta : precioBase)}
                    </td>
                  </tr>
                  ${
                    !esAlaCarta && subtotalExtras > 0
                      ? `
                  <tr>
                    <td align="left"  style="font-size:13px;color:${C.rojo};padding:4px 0;">Platillos extra</td>
                    <td align="right" style="font-size:13px;color:${C.rojo};padding:4px 0;">${formatCurrency(subtotalExtras)}</td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td align="left"  style="font-size:13px;color:${C.gris};padding:4px 0;">IVA (16%)</td>
                    <td align="right" style="font-size:13px;color:${C.gris};padding:4px 0;">${formatCurrency(iva)}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="border-top:2px solid ${C.oscuro};padding:0;"></td>
                  </tr>
                  <tr>
                    <td align="left"  style="font-family:'Playfair Display',Georgia,serif;font-size:18px;color:${C.rojo};font-weight:700;padding:10px 0 4px;">TOTAL</td>
                    <td align="right" style="font-family:'Playfair Display',Georgia,serif;font-size:18px;color:${C.rojo};font-weight:700;padding:10px 0 4px;">${formatCurrency(total)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td align="center" style="border-top:1px dashed ${C.dorado};background:${C.fondo2};padding:18px 22px 24px;border-radius:0 0 8px 8px;">
            <div style="font-family:'Playfair Display',Georgia,serif;font-size:17px;color:${C.rojo};font-weight:700;">¡Gracias por tu visita!</div>
            <div style="font-size:20px;color:${C.cafe};margin:4px 0 12px;">Terima Kasih 🙏</div>
            <div style="font-size:11px;color:${C.grisClaro};line-height:1.5;">
              Rasa Nusantara · hola@rasanusantara.mx<br>
              Esta factura es un comprobante informativo generado automáticamente.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
}

// ==========================================================
// Envía la FACTURA al correo del cliente.
// Construye internamente el HTML optimizado para correo
// (construirHTMLFacturaEmail) — NO reutiliza el HTML del modal.
// Placeholders esperados en el template:
//   {{to_email}} {{to_name}} {{invoice_number}} {{{factura_html}}}
// ==========================================================
export async function enviarFacturaPorCorreo(reserva) {
  if (!emailjsDisponible()) return false;

  const hoy = new Date();
  const numeroFactura =
    `RN-${String(hoy.getFullYear()).slice(-2)}` +
    `${String(hoy.getMonth() + 1).padStart(2, "0")}` +
    `${String(hoy.getDate()).padStart(2, "0")}` +
    `-${reserva.id.slice(-5).toUpperCase()}`;

  const facturaHTML = construirHTMLFacturaEmail(reserva);

  const templateParams = {
    to_email: reserva.userEmail,
    to_name: reserva.userName,
    invoice_number: numeroFactura,
    reservation_date: formatDate(reserva.fecha),
    reservation_time: reserva.hora,
    factura_html: facturaHTML,
  };

  try {
    await window.emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateIdFactura,
      templateParams,
    );
    console.info(
      `%c[EmailJS]%c Factura ${numeroFactura} enviada a ${reserva.userEmail}`,
      "color:#4CAF50;font-weight:bold;",
      "color:inherit;",
    );
    return true;
  } catch (err) {
    console.error("[EmailJS] Error al enviar factura:", err);
    return false;
  }
}

// ==========================================================
// INICIALIZACIÓN (se ejecuta al importar este módulo)
// ==========================================================
if (window.emailjs && typeof window.emailjs.init === "function") {
  window.emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
}

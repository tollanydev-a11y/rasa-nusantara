/* ===================================================
   MÓDULO PRINCIPAL (main.js)
   Funcionalidades comunes a todas las páginas:
   - Menú hamburguesa responsivo
   - Scroll behavior del header
   - Notificaciones toast
   - Actualización de UI de autenticación
   - Helpers compartidos: formato moneda/fecha, traducción de
     estados, render de nivel de picante, render de imagen de
     platillo.
   =================================================== */

import { updateNavUI, logoutUser } from "./auth.js";

// ==========================================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  initMobileMenu();
  initLogout();
  updateNavUI();
  markActiveNavLink();
});

// ==========================================================
// HEADER: Efecto de scroll
// ==========================================================
function initHeader() {
  const header = document.getElementById("header");
  if (!header) return;

  window.addEventListener("scroll", () => {
    if (window.pageYOffset > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });
}

// ==========================================================
// MENÚ HAMBURGUESA RESPONSIVE
// ==========================================================
function initMobileMenu() {
  const hamburger = document.getElementById("hamburger");
  const navMenu = document.getElementById("nav-menu");

  if (!hamburger || !navMenu) return;

  const overlay = document.createElement("div");
  overlay.className = "menu-overlay";
  document.body.appendChild(overlay);

  const toggleMenu = () => {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
    overlay.classList.toggle("active");
    document.body.style.overflow = navMenu.classList.contains("active")
      ? "hidden"
      : "";
  };

  const closeMenu = () => {
    hamburger.classList.remove("active");
    navMenu.classList.remove("active");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  };

  hamburger.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", closeMenu);

  navMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1135) closeMenu();
  });
}

// ==========================================================
// LOGOUT
// ==========================================================
function initLogout() {
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    showConfirmModal(
      "Cerrar sesión",
      "¿Deseas cerrar sesión?",
      async () => {
        const result = await logoutUser();
        if (result.success) {
          showToast("Sesión cerrada correctamente", "success");
          setTimeout(() => { window.location.href = "index.html"; }, 800);
        }
      },
      { confirmText: "Cerrar sesión", cancelText: "Cancelar" }
    );
  });
}

// ==========================================================
// MARCAR ENLACE ACTIVO EN EL MENÚ
// ==========================================================
function markActiveNavLink() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const navLinks = document.querySelectorAll(".nav-menu a");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage || (currentPage === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
}

// ==========================================================
// SISTEMA DE NOTIFICACIONES TOAST
// ==========================================================

/**
 * Muestra una notificación toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - success | error | warning | info
 * @param {number} duration - Duración en ms (default 3000)
 */
export function showToast(message, type = "info", duration = 3000) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-xmark",
    warning: "fa-triangle-exclamation",
    info: "fa-circle-info",
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Hacer showToast disponible globalmente
window.showToast = showToast;

// ==========================================================
// UTILIDADES DE FORMATO
// ==========================================================

/**
 * Formatea un número como moneda (MXN)
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea una fecha ISO a formato legible en español
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD
 */
export function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ==========================================================
// HELPERS COMPARTIDOS (antes duplicados en varios módulos)
// ==========================================================

/**
 * Traduce el estado técnico de una reserva al texto mostrado
 * en la UI (compartido por admin, reservaciones y mis-reservaciones).
 */
export function traducirEstado(estado) {
  return (
    {
      confirmed: "Confirmada",
      pending: "Pendiente",
      cancelled: "Cancelada",
      pasada: "Completada",
    }[estado] || estado
  );
}

/**
 * Renderiza el nivel de picante de un platillo (0-4) como
 * chiles + etiqueta. Se usa tanto en el home como en la carta.
 */
export function renderSpicyLevel(level) {
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

/**
 * Renderiza una imagen de platillo con fallbacks en cascada:
 *   1. Si `platillo.imagen` existe y es una URL/data-URI válida → <img>.
 *      Si la imagen falla al cargar (onerror), cae al emoji.
 *   2. Si no hay `imagen` pero hay `icono` (y no hay `emoji`) → <i FontAwesome>.
 *   3. Por último, el emoji del platillo sobre un gradient.
 *
 * @param {Object} platillo - Objeto platillo de data.js
 * @param {string} [wrapperClass='menu-item-image'] - Clase base del contenedor
 * @returns {string} HTML del bloque de imagen
 */
export function renderPlatilloImage(
  platillo,
  wrapperClass = "menu-item-image",
) {
  const emoji = platillo.emoji || "🍽";
  const safeEmoji = emoji.replace(/"/g, "&quot;");

  // 1) Imagen real (URL http/https o data:)
  if (
    platillo.imagen &&
    typeof platillo.imagen === "string" &&
    platillo.imagen.trim()
  ) {
    return `
            <div class="${wrapperClass}">
                <img src="${platillo.imagen}"
                     alt="${platillo.nombre}"
                     loading="lazy"
                     onerror="this.parentElement.classList.add('${wrapperClass}--placeholder'); this.outerHTML='&lt;span class=&quot;menu-item-emoji&quot;&gt;${safeEmoji}&lt;/span&gt;';">
            </div>
        `;
  }

  // 2) Ícono FontAwesome (solo si no hay emoji definido)
  if (platillo.icono && platillo.icono.trim() && !platillo.emoji) {
    return `
            <div class="${wrapperClass} ${wrapperClass}--placeholder">
                <i class="fa-solid ${platillo.icono} menu-item-faicon"></i>
            </div>
        `;
  }

  // 3) Fallback: emoji grande en gradient
  return `
        <div class="${wrapperClass} ${wrapperClass}--placeholder">
            <span class="menu-item-emoji">${emoji}</span>
        </div>
    `;
}

// ==========================================================
// MODAL GENÉRICO DE CONFIRMACIÓN
// Reemplaza confirm() nativo en toda la aplicación.
// Uso:
//   showConfirmModal('Título', 'Mensaje', () => acción(), opts?)
//   opts: { confirmText, cancelText, danger }
// ==========================================================
export function showConfirmModal(title, message, onConfirm, opts = {}) {
  const {
    confirmText = "Aceptar",
    cancelText  = "Cancelar",
    danger      = false,
  } = opts;

  // Eliminar instancia previa
  document.getElementById("generic-modal")?.remove();

  const modal = document.createElement("div");
  modal.id = "generic-modal";
  modal.className = "generic-modal";
  modal.innerHTML = `
    <div class="generic-modal__backdrop"></div>
    <div class="generic-modal__card" role="dialog" aria-modal="true">
      <h3 class="generic-modal__title">${title}</h3>
      <p class="generic-modal__msg">${message}</p>
      <div class="generic-modal__actions">
        <button class="btn btn-outline" id="gm-cancel">${cancelText}</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="gm-confirm">${confirmText}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // Forzar reflow para que la animación arranque
  requestAnimationFrame(() => modal.classList.add("active"));

  const close = () => {
    modal.classList.remove("active");
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector("#gm-cancel").addEventListener("click", close);
  modal.querySelector(".generic-modal__backdrop").addEventListener("click", close);
  modal.querySelector("#gm-confirm").addEventListener("click", () => {
    close();
    onConfirm();
  });
}

// Exponer globalmente para módulos que no pueden importar fácilmente
window.showConfirmModal = showConfirmModal;

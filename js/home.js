/* ===================================================
   MÓDULO: HOME
   Se encarga de renderizar los platillos destacados
   en la página principal (index.html).

   Los dish-card ahora soportan imágenes reales (platillo.imagen).
   Si no hay imagen se muestra el emoji como fallback.
   =================================================== */

import { getPlatillos, refreshPlatillos } from './data.js';
import { formatCurrency, renderSpicyLevel } from './main.js';
import { USE_DEMO_MODE } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('platillos-destacados');
    if (!container) return;

    // En producción traer platillos desde Firestore
    if (!USE_DEMO_MODE) {
        try { await refreshPlatillos(); } catch (e) { /* fallback a defaults */ }
    }

    render(container);
});

function render(container) {
    const todos = getPlatillos().filter(p => p.disponible);

    // Mezcla con los platillos más representativos
    const destacados = [
        ...todos.filter(p => p.categoria === 'principal').slice(0, 3),
        ...todos.filter(p => p.categoria === 'entrada').slice(0, 1),
        ...todos.filter(p => p.categoria === 'postre').slice(0, 1),
        ...todos.filter(p => p.categoria === 'bebida').slice(0, 1)
    ];

    if (destacados.length === 0) {
        container.innerHTML = '<p class="empty-msg" style="grid-column: 1/-1;">No hay platillos disponibles en este momento.</p>';
        return;
    }

    container.innerHTML = destacados.map((p, i) => `
        <div class="dish-card" style="animation-delay: ${i * 60}ms;">
            ${renderDishImage(p)}
            <div class="dish-body">
                <h3>${p.nombre}</h3>
                <p class="dish-origin">${p.origen}</p>
                <p class="dish-description">${p.descripcion}</p>
                <div class="dish-footer">
                    <span class="dish-price">${formatCurrency(p.precio)}</span>
                    ${renderSpicyLevel(p.picante)}
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Renderiza el bloque .dish-image. Soporta:
 *   1. Imagen real (URL o data-URI) → <img> con onerror→emoji
 *   2. Sin imagen → emoji grande como ahora
 *
 * Siempre muestra el badge con el primer tag (o "Tradicional").
 */
function renderDishImage(p) {
    const badge = `<span class="dish-badge">${p.tags && p.tags[0] ? p.tags[0] : 'Tradicional'}</span>`;
    const safeEmoji = (p.emoji || '🍽').replace(/"/g, '&quot;');

    if (p.imagen && typeof p.imagen === 'string' && p.imagen.trim()) {
        return `
            <div class="dish-image dish-image--real">
                <img src="${p.imagen}"
                     alt="${p.nombre}"
                     loading="lazy"
                     onerror="this.parentElement.classList.remove('dish-image--real'); this.outerHTML='<span class=&quot;dish-emoji-fallback&quot;>${safeEmoji}</span>';">
                ${badge}
            </div>
        `;
    }

    return `
        <div class="dish-image">
            <span class="dish-emoji-fallback">${p.emoji || '🍽'}</span>
            ${badge}
        </div>
    `;
}

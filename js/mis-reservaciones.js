/* ===================================================
   MÓDULO: MIS RESERVACIONES (vista del cliente)
   Permite al cliente ver y gestionar (cancelar) sus reservas
   =================================================== */

import {
    getReservacionesDelUsuario,
    actualizarEstadoReserva,
    eliminarReserva
} from './reservaciones.js';
import { AREAS, MENUS } from './data.js';
import { getCurrentUser, protectPage } from './auth.js';
import {
    showToast,
    formatCurrency,
    formatDate,
    getTodayISO,
    traducirEstado
} from './main.js';

const state = {
    reservaciones: [],
    filtro: 'todas' // todas | proximas | pasadas | canceladas
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('mis-reservas-container')) return;
    if (!protectPage()) return;

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
    document.querySelectorAll('.mr-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mr-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.filtro = btn.dataset.mrFilter;
            render();
        });
    });
}

function render() {
    const container = document.getElementById('mis-reservas-container');

    let reservas = [...state.reservaciones];
    const hoy = getTodayISO();

    if (state.filtro === 'proximas') {
        reservas = reservas.filter(r => r.fecha >= hoy && r.estado !== 'cancelled');
    } else if (state.filtro === 'pasadas') {
        reservas = reservas.filter(r => r.fecha < hoy);
    } else if (state.filtro === 'canceladas') {
        reservas = reservas.filter(r => r.estado === 'cancelled');
    }

    reservas.sort((a, b) => {
        const fa = `${a.fecha} ${a.hora}`;
        const fb = `${b.fecha} ${b.hora}`;
        return fb.localeCompare(fa);
    });

    // Lista
    if (reservas.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <i class="fa-solid fa-calendar-xmark" style="font-size: 3rem; color: var(--color-secondary); margin-bottom: 15px;"></i>
                <h3>No tienes reservaciones</h3>
                <p style="color: var(--color-text-light); margin-bottom: 20px;">
                    ${state.filtro === 'todas' ? 'Aún no has hecho ninguna reservación.' : 'No hay reservaciones en esta categoría.'}
                </p>
                <a href="reservaciones.html" class="btn btn-primary">
                    <i class="fa-solid fa-calendar-plus"></i> Hacer una reservación
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = reservas.map(r => {
        const area = AREAS.find(a => a.id === r.area);
        const menu = MENUS[r.menu];
        const esPasada = r.fecha < hoy;

        return `
            <div class="my-res-card status-${r.estado}">
                <div class="my-res-main">
                    <strong>${formatDate(r.fecha)}</strong>
                    <span>
                        <i class="fa-solid fa-clock"></i> ${r.hora} ·
                        <i class="fa-solid fa-users"></i> ${r.personas} pax ·
                        ${area ? area.nombre : r.area} · Mesa #${r.mesa.split('-m')[1]}
                    </span>
                    <span style="margin-top:2px;">
                        <i class="fa-solid fa-utensils"></i> ${menu ? menu.nombre : r.menu} ·
                        <strong>${formatCurrency(r.total)}</strong>
                    </span>
                    ${r.comentarios ? `
                        <span style="margin-top:4px; font-style: italic;">
                            <i class="fa-solid fa-comment"></i> ${r.comentarios}
                        </span>
                    ` : ''}
                </div>
                <div class="my-res-right">
                    <span class="status-badge ${r.estado}">${traducirEstado(r.estado)}</span>
                    ${(r.estado !== 'cancelled' && !esPasada) ? `
                        <button class="btn-cancel-text" data-cancel-id="${r.id}">
                            <i class="fa-solid fa-xmark"></i> Cancelar
                        </button>
                    ` : ''}
                    ${esPasada ? `
                        <button class="btn-cancel-text" data-eliminar-id="${r.id}" title="Eliminar de mi historial">
                            <i class="fa-solid fa-trash"></i> Eliminar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Listeners
    container.querySelectorAll('[data-cancel-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Cancelar esta reservación?\nPodrás hacer una nueva cuando quieras.')) return;
            const ok = await actualizarEstadoReserva(btn.dataset.cancelId, 'cancelled');
            if (ok) {
                showToast('Reservación cancelada', 'warning');
                await cargar();
                render();
            }
        });
    });

    container.querySelectorAll('[data-eliminar-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar esta reservación de tu historial?')) return;
            const ok = await eliminarReserva(btn.dataset.eliminarId);
            if (ok) {
                showToast('Reservación eliminada', 'success');
                await cargar();
                render();
            }
        });
    });
}

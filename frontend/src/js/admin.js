import { AdminService } from './services/api.js';

document.addEventListener('DOMContentLoaded', () => {
    // Este es el correo admin "fijo" por si el rol no llega bien en el storage.
    const ADMIN_EMAIL = 'ddelpe@insdanielblanxart.cat';

    // Cogemos referencias del HTML para no repetir document.getElementById todo el rato.
    const searchInput = document.getElementById('admin-search');
    const reservasBody = document.getElementById('admin-reservas-body');
    const usersBody = document.getElementById('admin-users-body');
    const reservasInfo = document.getElementById('admin-reservas-info');
    const usersInfo = document.getElementById('admin-users-info');
    const btnRefreshReservas = document.getElementById('btn-refresh-reservas');
    const btnRefreshUsers = document.getElementById('btn-refresh-users');
    const btnToggleReservas = document.getElementById('btn-toggle-reservas');
    const btnToggleUsers = document.getElementById('btn-toggle-users');
    const cardReservas = document.getElementById('card-reservas');
    const cardUsers = document.getElementById('card-users');

    // Leemos datos de sesión de local y session.
    const localToken = localStorage.getItem('lux_token') || '';
    const localEmail = localStorage.getItem('lux_email') || '';
    const localRol = localStorage.getItem('lux_rol') || '';
    const sessionToken = sessionStorage.getItem('lux_token') || '';
    const sessionEmail = sessionStorage.getItem('lux_email') || '';
    const sessionRol = sessionStorage.getItem('lux_rol') || '';

    // Elegimos primero una sesión completa del mismo sitio (token + email).
    const hasFullLocal = Boolean(localToken && localEmail);
    const token = hasFullLocal ? localToken : (sessionToken || localToken);
    const email = hasFullLocal ? localEmail : (sessionEmail || localEmail);
    const rol = hasFullLocal ? localRol : (sessionRol || localRol || '');
    const isAdmin = rol === 'admin' || email.toLowerCase() === ADMIN_EMAIL;

    // Si no tiene token o no es admin, no puede entrar al panel.
    if (!token || !isAdmin) {
        window.location.href = '/pages/login.html';
        return;
    }

    // Estado simple para guardar datos cargados y el texto del buscador.
    const state = {
        reservas: [],
        users: [],
        search: '',
        editingReservaId: null,
        collapsedReservas: false,
        collapsedUsers: false
    };

    // Actualiza visualmente si un bloque está abierto o cerrado.
    function syncCollapseUi() {
        if (cardReservas) {
            cardReservas.classList.toggle('is-collapsed', state.collapsedReservas);
        }
        if (cardUsers) {
            cardUsers.classList.toggle('is-collapsed', state.collapsedUsers);
        }

        if (btnToggleReservas) {
            btnToggleReservas.textContent = state.collapsedReservas ? 'Mostrar' : 'Ocultar';
        }
        if (btnToggleUsers) {
            btnToggleUsers.textContent = state.collapsedUsers ? 'Mostrar' : 'Ocultar';
        }
    }

    // Evita que se cuele HTML raro en la tabla si viene algo inesperado de API.
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Formatea fechas para verlas bonitas en español.
    function formatDate(value) {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    // Formato simple para reservas: fecha + hora limpia (HH:mm).
    function formatReservationDateHour(value) {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;

        const datePart = d.toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const hourPart = d.toLocaleTimeString('es-ES', {
            hour: '2-digit', minute: '2-digit', hour12: false
        });

        return `${datePart} - ${hourPart}`;
    }

    // Pasa una fecha ISO a formato para input datetime-local.
    function toDateTimeLocalValue(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    // Busca el email real del usuario a partir de su user_id.
    function getReservationEmail(reservation) {
        if (reservation.user_email || reservation.userEmail) {
            return reservation.user_email || reservation.userEmail;
        }

        const userId = reservation.user_id || reservation.userId;
        if (!userId) return '-';

        const user = state.users.find((u) => String(u.id) === String(userId));
        return user?.email || userId;
    }

    // Filtra por texto libre (email, fecha, id, etc.)
    function matchesSearch(item) {
        if (!state.search) return true;
        const text = JSON.stringify(item).toLowerCase();
        return text.includes(state.search);
    }

    // Pinta la tabla de reservas.
    function renderReservas() {
        const rows = state.reservas.filter(matchesSearch);
        reservasBody.innerHTML = rows.map((r) => `
            <tr>
                <td>
                    ${state.editingReservaId === String(r.id)
                        ? `<input class="admin-inline-input" type="datetime-local" data-field="reservationDatetime" data-id="${escapeHtml(r.id)}" value="${escapeHtml(toDateTimeLocalValue(r.reservation_datetime || r.reservationDatetime))}">`
                        : escapeHtml(formatReservationDateHour(r.reservation_datetime || r.reservationDatetime))}
                </td>
                <td>${escapeHtml(getReservationEmail(r))}</td>
                <td>
                    ${state.editingReservaId === String(r.id)
                        ? `<input class="admin-inline-input admin-inline-input-small" type="number" min="1" max="20" data-field="people" data-id="${escapeHtml(r.id)}" value="${escapeHtml(r.people)}">`
                        : escapeHtml(r.people)}
                </td>
                <td>
                    ${state.editingReservaId === String(r.id)
                        ? `<input class="admin-inline-input admin-inline-input-small" type="number" min="1" max="30" data-field="tables" data-id="${escapeHtml(r.id)}" value="${escapeHtml(r.tables)}">`
                        : escapeHtml(r.tables)}
                </td>
                <td>
                    <div class="admin-actions">
                        ${state.editingReservaId === String(r.id)
                            ? `
                                <button class="btn-table" data-action="save-edit-reserva" data-id="${escapeHtml(r.id)}">Guardar</button>
                                <button class="btn-table" data-action="cancel-edit-reserva" data-id="${escapeHtml(r.id)}">Cancelar</button>
                              `
                            : `
                                <button class="btn-table" data-action="edit-reserva" data-id="${escapeHtml(r.id)}">Editar</button>
                                <button class="btn-table btn-table-danger" data-action="delete-reserva" data-id="${escapeHtml(r.id)}">Eliminar</button>
                              `}
                    </div>
                </td>
            </tr>
        `).join('');

        reservasInfo.textContent = `${rows.length} reservas visibles`;
    }

    // Pinta la tabla de usuarios.
    function renderUsers() {
        const rows = state.users.filter(matchesSearch);
        usersBody.innerHTML = rows.map((u) => {
            const email = u.email || '-';
            const created = formatDate(u.created_at);
            return `
                <tr>
                    <td>${escapeHtml(created)}</td>
                    <td>${escapeHtml(email)}</td>
                    <td>${escapeHtml(u.id || '-')}</td>
                    <td>
                        <div class="admin-actions">
                            <button class="btn-table btn-table-danger" data-action="delete-user" data-id="${escapeHtml(u.id)}">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (usersInfo) {
            usersInfo.textContent = `${rows.length} usuarios visibles`;
        }
    }

    // Carga reservas desde el backend.
    async function loadReservas() {
        const result = await AdminService.listReservations(token);
        if (!result.ok) {
            reservasInfo.textContent = result.dades?.detail || 'No se pudieron cargar las reservas.';
            return;
        }
        state.reservas = Array.isArray(result.dades?.data) ? result.dades.data : [];
        renderReservas();
    }

    // Carga usuarios desde el backend.
    async function loadUsers() {
        const result = await AdminService.listUsers(token);
        if (!result.ok) {
            if (usersInfo) {
                usersInfo.textContent = result.dades?.detail || 'No se pudieron cargar los usuarios.';
            }
            usersBody.innerHTML = '';
            return;
        }
        state.users = Array.isArray(result.dades?.data) ? result.dades.data : [];
        renderUsers();

        // Volvemos a pintar reservas para cambiar UUID -> email si hay match por user_id.
        renderReservas();
    }

    // Cuando escribes en el buscador, filtra al instante ambas tablas.
    searchInput?.addEventListener('input', () => {
        state.search = searchInput.value.trim().toLowerCase();
        renderReservas();
        renderUsers();
    });

    // Botones para recargar datos.
    btnRefreshReservas?.addEventListener('click', loadReservas);
    btnRefreshUsers?.addEventListener('click', loadUsers);

    btnToggleReservas?.addEventListener('click', () => {
        state.collapsedReservas = !state.collapsedReservas;
        syncCollapseUi();
    });

    btnToggleUsers?.addEventListener('click', () => {
        state.collapsedUsers = !state.collapsedUsers;
        syncCollapseUi();
    });

    // Delegación de eventos para acciones de reservas (editar / eliminar).
    reservasBody?.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'delete-reserva') {
            if (!confirm('¿Seguro que quieres eliminar esta reserva?')) return;
            await AdminService.deleteReservation(id, token);
            await loadReservas();
            return;
        }

        if (action === 'edit-reserva') {
            state.editingReservaId = String(id);
            renderReservas();
            return;
        }

        if (action === 'cancel-edit-reserva') {
            state.editingReservaId = null;
            renderReservas();
            return;
        }

        if (action === 'save-edit-reserva') {
            const peopleInput = reservasBody.querySelector(`input[data-field="people"][data-id="${id}"]`);
            const tableInput = reservasBody.querySelector(`input[data-field="tables"][data-id="${id}"]`);
            const datetimeInput = reservasBody.querySelector(`input[data-field="reservationDatetime"][data-id="${id}"]`);

            const peopleValue = Number(peopleInput?.value || 0);
            const tableValue = Number(tableInput?.value || 0);
            const dateRaw = datetimeInput?.value || '';

            if (!peopleValue || peopleValue < 1) {
                alert('Personas no válidas.');
                return;
            }

            if (!tableValue || tableValue < 1) {
                alert('Mesa no válida.');
                return;
            }

            if (!dateRaw) {
                alert('Fecha y hora no válidas.');
                return;
            }

            // Convertimos a ISO para que backend/supabase lo guarde bien con zona horaria.
            const isoDate = new Date(dateRaw).toISOString();

            await AdminService.updateReservation(id, {
                people: peopleValue,
                tables: tableValue,
                reservationDatetime: isoDate
            }, token);

            state.editingReservaId = null;
            await loadReservas();
        }
    });

    // Delegación de eventos para acciones de usuarios (rol / eliminar).
    usersBody?.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const userId = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'delete-user') {
            if (!confirm('¿Seguro que quieres eliminar este usuario?')) return;
            await AdminService.deleteUser(userId, token);
            await loadUsers();
            return;
        }

    });

    // Carga inicial del panel.
    loadReservas();
    loadUsers();
    syncCollapseUi();
});

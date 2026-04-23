import { AdminService, AuthService } from './services/api.js';

document.addEventListener('DOMContentLoaded', async () => {
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

    const sessionResult = await AuthService.getSession();
    const isAuthenticated = Boolean(sessionResult.ok && sessionResult.dades?.authenticated);
    const rol = String(sessionResult.dades?.user?.rol || '').toLowerCase();
    const isAdmin = rol === 'admin';
    const isCamarero = rol === 'camarero';
    const canManageReservas = isAdmin || isCamarero;

    // Si no tiene token o no tiene permisos de reservas, no puede entrar al panel.
    if (!isAuthenticated || !canManageReservas) {
        window.location.href = '/pages/login.html';
        return;
    }

    if (!isAdmin && cardUsers) {
        cardUsers.style.display = 'none';
    }

    // Estado simple para guardar datos cargados y el texto del buscador.
    const state = {
        reservas: [],
        users: [],
        search: '',
        editingReservaGroupKey: null,
        collapsedReservas: false,
        collapsedUsers: false
    };

    function getReservationId(reservation) {
        return String(
            reservation?.id
            ?? reservation?.reservation_id
            ?? reservation?.reservationId
            ?? ''
        );
    }

    function getReservationDateRaw(reservation) {
        return reservation?.reservation_datetime || reservation?.reservationDatetime || '';
    }

    function getReservationUserRef(reservation) {
        return String(reservation?.user_id || reservation?.userId || getReservationEmail(reservation) || '-');
    }

    function buildReservationGroupKey(reservation) {
        const userRef = getReservationUserRef(reservation);
        const dateRaw = getReservationDateRaw(reservation);
        const people = String(reservation?.people ?? '');
        return `${userRef}__${dateRaw}__${people}`;
    }

    // Agrupa filas de reservas que pertenecen a la misma reserva lógica (multi-mesa).
    function groupReservations(rows) {
        const groups = new Map();

        rows.forEach((row) => {
            const groupKey = buildReservationGroupKey(row);
            const rowId = getReservationId(row);
            const tableValue = row.tables;

            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    groupKey,
                    ids: [],
                    tables: [],
                    rows: [],
                    people: row.people,
                    reservationDatetime: getReservationDateRaw(row),
                    userEmail: getReservationEmail(row)
                });
            }

            const group = groups.get(groupKey);
            if (rowId) {
                group.ids.push(rowId);
            }

            if (tableValue !== null && tableValue !== undefined && tableValue !== '') {
                group.tables.push(tableValue);
            }

            group.rows.push(row);
        });

        return Array.from(groups.values()).map((group) => {
            const uniqueTables = [...new Set(group.tables.map((t) => String(t)))];
            return {
                ...group,
                tableCount: uniqueTables.length,
                tablesText: uniqueTables.join(', ')
            };
        });
    }

    function parseTablesInput(value) {
        const raw = String(value || '').trim();
        if (!raw) return [];

        const tokens = raw.split(/[\s,;]+/).filter(Boolean);
        const unique = [];
        const seen = new Set();

        tokens.forEach((token) => {
            const parsed = Number(token);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12 || seen.has(parsed)) {
                return;
            }
            seen.add(parsed);
            unique.push(parsed);
        });

        return unique;
    }

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
        const text = String(value).trim();
        const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
        if (!match) return value;

        const [, year, month, day, hour, minute] = match;
        return `${day}/${month}/${year} - ${hour}:${minute}`;
    }

    // Pasa una fecha ISO a formato para input datetime-local.
    function toDateTimeLocalValue(value) {
        if (!value) return '';
        const text = String(value).trim();
        const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
        if (!match) return '';

        const [, year, month, day, hour, minute] = match;
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
        return user?.email || '-';
    }

    // Filtra reservas por campos útiles, incluyendo email resuelto por user_id.
    function matchesReservaSearch(group) {
        if (!state.search) return true;

        const email = String(group.userEmail || '').toLowerCase();
        const datePretty = formatReservationDateHour(group.reservationDatetime).toLowerCase();

        const searchable = [email, datePretty].join(' ');
        return searchable.includes(state.search);
    }

    // Filtra usuarios por los campos visibles del listado.
    function matchesUserSearch(user) {
        if (!state.search) return true;

        const displayName = String(user.display_name || user.displayName || '').toLowerCase();
        const email = String(user.email || '').toLowerCase();
        const phone = String(user.phone || user.telefono || '').toLowerCase();
        const createdPretty = formatDate(user.created_at).toLowerCase();
        const role = String(user.rol || '').toLowerCase();

        const searchable = [displayName, email, phone, createdPretty, role].join(' ');
        return searchable.includes(state.search);
    }

    function normalizeRole(role) {
        const normalized = String(role || '').trim().toLowerCase();
        return normalized || 'client';
    }

    // Pinta la tabla de reservas.
    function renderReservas() {
        const groupedRows = groupReservations(state.reservas).filter(matchesReservaSearch);

        reservasBody.innerHTML = groupedRows.map((group) => `
            <tr>
                <td>
                    ${state.editingReservaGroupKey === group.groupKey
                        ? `<input class="admin-inline-input" type="datetime-local" data-field="reservationDatetime" data-group="${escapeHtml(group.groupKey)}" value="${escapeHtml(toDateTimeLocalValue(group.reservationDatetime))}">`
                        : escapeHtml(formatReservationDateHour(group.reservationDatetime))}
                </td>
                <td>${escapeHtml(group.userEmail)}</td>
                <td>
                    ${state.editingReservaGroupKey === group.groupKey
                        ? `<input class="admin-inline-input admin-inline-input-small" type="number" min="1" max="20" data-field="people" data-group="${escapeHtml(group.groupKey)}" value="${escapeHtml(group.people)}">`
                        : escapeHtml(group.people)}
                </td>
                <td>
                    ${state.editingReservaGroupKey === group.groupKey
                        ? `<input class="admin-inline-input" type="text" data-field="tables" data-group="${escapeHtml(group.groupKey)}" value="${escapeHtml(group.tablesText || '')}" placeholder="Ej: 1,2,3">`
                        : escapeHtml(group.tablesText || '-')}
                </td>
                <td>
                    <div class="admin-actions">
                        ${state.editingReservaGroupKey === group.groupKey
                            ? `
                                <button class="btn-table" data-action="save-edit-reserva" data-group="${escapeHtml(group.groupKey)}">Guardar</button>
                                <button class="btn-table" data-action="cancel-edit-reserva" data-group="${escapeHtml(group.groupKey)}">Cancelar</button>
                              `
                            : `
                                <button class="btn-table" data-action="edit-reserva" data-group="${escapeHtml(group.groupKey)}">Editar</button>
                                <button class="btn-table btn-table-danger" data-action="delete-reserva" data-group="${escapeHtml(group.groupKey)}">Eliminar</button>
                              `}
                    </div>
                </td>
            </tr>
        `).join('');

        const totalTables = groupedRows.reduce((acc, row) => acc + row.tableCount, 0);
        reservasInfo.textContent = `${groupedRows.length} reservas visibles (${totalTables} mesas)`;
    }

    // Pinta la tabla de usuarios.
    function renderUsers() {
        if (!isAdmin) {
            usersBody.innerHTML = '';
            if (usersInfo) usersInfo.textContent = '';
            return;
        }

        const rows = state.users.filter(matchesUserSearch);
        usersBody.innerHTML = rows.map((u) => {
            const displayName = (u.display_name || u.displayName || '').trim() || '-';
            const email = u.email || '-';
            const phone = (u.phone || u.telefono || '').trim() || '-';
            const created = formatDate(u.created_at);
            const role = normalizeRole(u.rol);

            return `
                <tr>
                    <td>${escapeHtml(created)}</td>
                    <td>${escapeHtml(displayName)}</td>
                    <td>${escapeHtml(email)}</td>
                    <td>${escapeHtml(phone)}</td>
                    <td>
                        <select class="admin-inline-input admin-role-select" data-field="user-role" data-id="${escapeHtml(u.id)}">
                            <option value="client" ${role === 'client' ? 'selected' : ''}>cliente</option>
                            <option value="camarero" ${role === 'camarero' ? 'selected' : ''}>camarero</option>
                            <option value="admin" ${role === 'admin' ? 'selected' : ''}>admin</option>
                        </select>
                    </td>
                    <td>
                        <div class="admin-actions">
                            <button class="btn-table" data-action="save-user-role" data-id="${escapeHtml(u.id)}">Guardar rol</button>
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
        const result = await AdminService.listReservations('');
        if (!result.ok) {
            reservasInfo.textContent = result.dades?.detail || 'No se pudieron cargar las reservas.';
            return;
        }
        state.reservas = Array.isArray(result.dades?.data) ? result.dades.data : [];
        state.editingReservaGroupKey = null;
        renderReservas();
    }

    // Carga usuarios desde el backend.
    async function loadUsers() {
        if (!isAdmin) return;

        const result = await AdminService.listUsers('');
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
    btnRefreshUsers?.addEventListener('click', () => {
        if (!isAdmin) return;
        loadUsers();
    });

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

        const groupKey = btn.dataset.group;
        const action = btn.dataset.action;
        const grouped = groupReservations(state.reservas);
        const targetGroup = grouped.find((g) => g.groupKey === groupKey);

        if (!targetGroup) return;

        if (action === 'delete-reserva') {
            if (!confirm('¿Seguro que quieres eliminar esta reserva?')) return;

            const idsToDelete = targetGroup.ids;
            if (!idsToDelete.length) {
                alert('No se pudo identificar la reserva para eliminarla.');
                return;
            }

            const result = await AdminService.deleteReservationGroup(idsToDelete, '');
            if (!result.ok) {
                alert(result.dades?.detail || 'No se pudo eliminar la reserva.');
                return;
            }

            await loadReservas();
            return;
        }

        if (action === 'edit-reserva') {
            state.editingReservaGroupKey = targetGroup.groupKey;
            renderReservas();
            return;
        }

        if (action === 'cancel-edit-reserva') {
            state.editingReservaGroupKey = null;
            renderReservas();
            return;
        }

        if (action === 'save-edit-reserva') {
            const peopleInput = reservasBody.querySelector(`input[data-field="people"][data-group="${groupKey}"]`);
            const datetimeInput = reservasBody.querySelector(`input[data-field="reservationDatetime"][data-group="${groupKey}"]`);
            const tablesInput = reservasBody.querySelector(`input[data-field="tables"][data-group="${groupKey}"]`);

            const peopleValue = Number(peopleInput?.value || 0);
            const dateRaw = datetimeInput?.value || '';
            const tablesValue = parseTablesInput(tablesInput?.value || '');

            if (!peopleValue || peopleValue < 1) {
                alert('Personas no válidas.');
                return;
            }

            if (!dateRaw) {
                alert('Fecha y hora no válidas.');
                return;
            }

            if (!tablesValue.length) {
                alert('Mesas no válidas. Usa números separados por coma.');
                return;
            }

            // Mantener hora local del input datetime-local y añadir segundos sin convertir a UTC.
            const reservationDatetime = dateRaw.length === 16 ? `${dateRaw}:00` : dateRaw;
            const idsToUpdate = targetGroup.ids;

            if (!idsToUpdate.length) {
                alert('No se pudo identificar la reserva para editarla.');
                return;
            }

            const payload = {
                ids: idsToUpdate,
                people: peopleValue,
                reservationDatetime,
                tables: tablesValue
            };

            const result = await AdminService.updateReservationGroup(payload, '');
            if (!result.ok) {
                alert(result.dades?.detail || 'No se pudo actualizar la reserva.');
                return;
            }

            state.editingReservaGroupKey = null;
            await loadReservas();
        }
    });

    // Delegación de eventos para eliminar usuarios.
    usersBody?.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (!isAdmin) return;

        const userId = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'save-user-role') {
            const roleInput = usersBody.querySelector(`select[data-field="user-role"][data-id="${userId}"]`);
            const selectedRole = normalizeRole(roleInput?.value || 'client');

            const result = await AdminService.updateUser(userId, { rol: selectedRole }, '');
            if (!result.ok) {
                alert(result.dades?.detail || 'No se pudo actualizar el rol del usuario.');
                return;
            }

            await loadUsers();
            return;
        }

        if (action === 'delete-user') {
            if (!confirm('¿Seguro que quieres eliminar este usuario?')) return;
            await AdminService.deleteUser(userId, '');
            await loadUsers();
            return;
        }

    });

    // Carga inicial del panel.
    loadReservas();
    if (isAdmin) {
        loadUsers();
    }
    syncCollapseUi();
});

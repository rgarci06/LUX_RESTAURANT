/**
 * CAPA 1: SERVICIOS DE COMUNICACIÓN (Frontend)
 * Este archivo hace de puente entre la web y el servidor.
 */

const API_URL = "https://lux-restaurant.onrender.com/api";

async function parseResponse(respuesta) {
    let dades = {};
    try {
        dades = await respuesta.json();
    } catch (_) {
        dades = {};
    }
    return { ok: respuesta.ok, status: respuesta.status, dades };
}

async function apiFetch(path, options = {}) {
    const mergedOptions = {
        credentials: 'include',
        ...options
    };
    return fetch(`${API_URL}${path}`, mergedOptions);
}

export const AuthService = {
    // Método para Iniciar Sesión
    login: async (email, password, remember = false) => {
        try {
            const respuesta = await apiFetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, remember })
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { detail: "El servidor Backend no responde." } };
        }
    },

    getSession: async () => {
        try {
            const respuesta = await apiFetch('/session', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { detail: "El servidor Backend no responde." } };
        }
    },

    logout: async () => {
        try {
            const respuesta = await apiFetch('/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { detail: "El servidor Backend no responde." } };
        }
    },

    // Método para Registrar Usuario
    register: async (payload) => {
        try {
            const respuesta = await apiFetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, rol: "client" })
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { detail: "El servidor Backend no responde." } };
        }
    },

    // Método para recuperar contraseña
    recoverPassword: async (email) => {
        try {
            const respuesta = await apiFetch('/recuperar-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { detail: "El servidor Backend no responde." } };
        }
    },

    // Método para confirmar nueva contraseña desde enlace de recuperación
    updatePassword: async (token, refresh, password) => {
        try {
            const respuesta = await apiFetch('/actualizar-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, refresh, password })
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { detail: "El servidor Backend no responde." } };
        }
    }
};

export const ReservationService = {
    createReservation: async (reservation) => {
        try {
            const respuesta = await apiFetch('/reservas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reservation)
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    }
};

export const MenuService = {
    // Trae toda la carta agrupada por categoria.
    listMenu: async () => {
        try {
            const respuesta = await apiFetch('/menu', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Crea un plato nuevo (solo admin).
    createMenuItem: async (payload) => {
        try {
            const respuesta = await apiFetch('/admin/menu', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Edita un plato por id (solo admin).
    updateMenuItem: async (itemId, payload) => {
        try {
            const respuesta = await apiFetch(`/admin/menu/${itemId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Borra un plato por id (solo admin).
    deleteMenuItem: async (itemId) => {
        try {
            const respuesta = await apiFetch(`/admin/menu/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    }
};

export const AdminService = {
    // Trae las reservas activas para el panel admin.
    listReservations: async () => {
        try {
            const respuesta = await apiFetch('/admin/reservas', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                cache: 'no-store'
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Edita una reserva concreta por su id.
    updateReservation: async (reservationId, payload) => {
        try {
            const respuesta = await apiFetch(`/admin/reservas/${reservationId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Edita una reserva lógica (grupo de filas) en una sola operación.
    updateReservationGroup: async (payload) => {
        try {
            const respuesta = await apiFetch('/admin/reservas/grupo/update', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Elimina una reserva concreta por su id.
    deleteReservation: async (reservationId) => {
        try {
            const respuesta = await apiFetch(`/admin/reservas/${reservationId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Elimina una reserva lógica (grupo de filas) en una sola operación.
    deleteReservationGroup: async (ids) => {
        try {
            const respuesta = await apiFetch('/admin/reservas/grupo/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids })
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Lista usuarios creados (para poder gestionarlos en admin).
    listUsers: async () => {
        try {
            const respuesta = await apiFetch('/admin/users', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Cambia datos del usuario (por ejemplo el rol).
    updateUser: async (userId, payload) => {
        try {
            const respuesta = await apiFetch(`/admin/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Borra un usuario por id.
    deleteUser: async (userId) => {
        try {
            const respuesta = await apiFetch(`/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return parseResponse(respuesta);
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    }
};

// Servicio para obtener mesas disponibles
export const MesasService = {
    getOcupadas: async (fecha, hora) => {
        try {
            const url = `${API_URL}/mesas/disponibles?fecha=${fecha}&hora=${hora}`;
            console.log('Consultando mesas disponibles:', url);
            
            const respuesta = await fetch(url, { credentials: 'include' });
            const datos = await parseResponse(respuesta);
            
            console.log('Respuesta de mesas:', datos.dades);
            return datos;
        } catch (error) {
            console.error('Error al obtener mesas:', error);
            return { ok: false, status: 0, dades: { detail: error.message, ocupadas: [] } };
        }
    }
};
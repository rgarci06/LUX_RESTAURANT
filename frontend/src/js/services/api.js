/**
 * CAPA 1: SERVICIOS DE COMUNICACIÓN (Frontend)
 * Este archivo actúa como el "puente" o "mensajero" entre la web y el servidor.
 * QUÉ HACE: Centraliza todas las llamadas HTTP (fetch). 
 * POR QUÉ ES CAPA 1: Porque sigue viviendo en el navegador del usuario, 
 * pero aislamos la lógica de red del diseño visual.
 */

// Detectamos si el navegador está en modo local o en internet
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const API_URL = isLocal 
    ? "http://localhost:8000/api" 
    : "https://lux-restaurant.onrender.com/api";

function buildAuthHeaders(token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

export const AuthService = {
    // Método para Iniciar Sesión
    login: async (email, password) => {
        try {
            const respuesta = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });
            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades: dades };
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { detail: "El servidor Backend no responde." } };
        }
    },

    // Método para Registrar Usuario
    register: async (payload) => {
        try {
            const respuesta = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ...payload, rol: "client" })
            });
            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades: dades };
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { detail: "El servidor Backend no responde." } };
        }
    },

    getSession: async () => {
        try {
            const respuesta = await fetch(`${API_URL}/session`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { authenticated: false, user: null } };
        }
    },

    logout: async () => {
        try {
            const respuesta = await fetch(`${API_URL}/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { detail: "El servidor Backend no responde." } };
        }
    }
};

export const ReservationService = {
    createReservation: async (reservation, token) => {
        try {
            const respuesta = await fetch(`${API_URL}/reservas`, {
                method: 'POST',
                headers: buildAuthHeaders(token),
                credentials: 'include',
                body: JSON.stringify(reservation)
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
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
            const respuesta = await fetch(`${API_URL}/menu`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Crea un plato nuevo (solo admin).
    createMenuItem: async (payload, token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/menu`, {
                method: 'POST',
                headers: buildAuthHeaders(token),
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Edita un plato por id (solo admin).
    updateMenuItem: async (itemId, payload, token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/menu/${itemId}`, {
                method: 'PATCH',
                headers: buildAuthHeaders(token),
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Borra un plato por id (solo admin).
    deleteMenuItem: async (itemId, token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/menu/${itemId}`, {
                method: 'DELETE',
                headers: buildAuthHeaders(token),
                credentials: 'include'
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    }
};

export const AdminService = {
    // Trae las reservas activas para el panel admin.
    listReservations: async (token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/reservas`, {
                method: 'GET',
                headers: buildAuthHeaders(token),
                credentials: 'include'
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Edita una reserva concreta por su id.
    updateReservation: async (reservationId, payload, token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/reservas/${reservationId}`, {
                method: 'PATCH',
                headers: buildAuthHeaders(token),
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Edita una reserva lógica (grupo de filas) en una sola operación.
    updateReservationGroup: async (payload, token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/reservas/grupo/update`, {
                method: 'PATCH',
                headers: buildAuthHeaders(token),
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Elimina una reserva concreta por su id.
    deleteReservation: async (reservationId, token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/reservas/${reservationId}`, {
                method: 'DELETE',
                headers: buildAuthHeaders(token),
                credentials: 'include'
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Elimina una reserva lógica (grupo de filas) en una sola operación.
    deleteReservationGroup: async (ids, token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/reservas/grupo/delete`, {
                method: 'POST',
                headers: buildAuthHeaders(token),
                credentials: 'include',
                body: JSON.stringify({ ids })
            });

            const dades = await respuesta.json();
            if (respuesta.ok) {
                return { ok: true, status: respuesta.status, dades };
            }

            if (respuesta.status === 404 && Array.isArray(ids) && ids.length > 0) {
                const results = await Promise.all(ids.map(async (id) => {
                    const fallbackResponse = await fetch(`${API_URL}/admin/reservas/${id}`, {
                        method: 'DELETE',
                        headers: buildAuthHeaders(token),
                        credentials: 'include'
                    });
                    const fallbackData = await fallbackResponse.json();
                    return { ok: fallbackResponse.ok, status: fallbackResponse.status, dades: fallbackData };
                }));
                const failed = results.find((result) => !result.ok);

                if (!failed) {
                    return {
                        ok: true,
                        status: 200,
                        dades: { ok: true, fallback: true, deleted_ids: ids }
                    };
                }

                return failed;
            }

            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Lista usuarios creados (para poder gestionarlos en admin).
    listUsers: async (token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/users`, {
                method: 'GET',
                headers: buildAuthHeaders(token),
                credentials: 'include'
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Cambia datos del usuario (por ejemplo el rol).
    updateUser: async (userId, payload, token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/users/${userId}`, {
                method: 'PATCH',
                headers: buildAuthHeaders(token),
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { ok: false, status: 0, dades: { detail: 'El servidor Backend no responde.' } };
        }
    },

    // Borra un usuario por id.
    deleteUser: async (userId, token) => {
        try {
            const respuesta = await fetch(`${API_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: buildAuthHeaders(token),
                credentials: 'include'
            });

            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades };
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
            
            const respuesta = await fetch(url);
            const dades = await respuesta.json();
            
            console.log('Respuesta de mesas:', dades);
            return { ok: respuesta.ok, status: respuesta.status, dades };
        } catch (error) {
            console.error('Error al obtener mesas:', error);
            return { ok: false, status: 0, dades: { detail: error.message, ocupadas: [] } };
        }
    }
};
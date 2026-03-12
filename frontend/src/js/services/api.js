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

export const AuthService = {
    // Método para Iniciar Sesión
    login: async (email, password) => {
        try {
            const respuesta = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
    register: async (email, password) => {
        try {
            const respuesta = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, rol: "client" })
            });
            const dades = await respuesta.json();
            return { ok: respuesta.ok, status: respuesta.status, dades: dades };
        } catch (error) {
            console.error("Error de conexión:", error);
            return { ok: false, status: 0, dades: { detail: "El servidor Backend no responde." } };
        }
    }
};
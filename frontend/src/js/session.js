/**
 * GESTOR DE SESIÓN DE CABECERA
 * Misión: Modificar el botón de ACCESO si el usuario está logueado.
 */

document.addEventListener('DOMContentLoaded', () => {
    const authLink = document.getElementById('auth-link');
    const token = localStorage.getItem('lux_token') || sessionStorage.getItem('lux_token');
    const email = localStorage.getItem('lux_email') || sessionStorage.getItem('lux_email');

    if (authLink) {
        // Li apliquem la classe mestra sempre
        authLink.className = "auth-nav-btn";

        if (token && email) {
            // L'usuari TÉ sessió
            const nomUsuari = email.split('@')[0].toUpperCase();
            authLink.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"></path>
                </svg>
                <span>${nomUsuari}</span>
            `;
            authLink.href = "#"; 
            authLink.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
            });
        } else {
            // L'usuari NO té sessió
            authLink.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"></path>
                </svg>
                <span>ACCESO</span>
            `;
            authLink.href = "/pages/login.html";
        }
    }
});
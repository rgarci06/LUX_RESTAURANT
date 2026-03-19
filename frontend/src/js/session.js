/**
 * GESTOR DE SESIÓN DE CABECERA
 * Misión: Modificar el botón de ACCESO si el usuario está logueado.
 */

document.addEventListener('DOMContentLoaded', () => {
    const authLink = document.getElementById('auth-link');
    const mobileAuthLink = document.querySelector('.mobile-menu-overlay .mobile-btn');
    const token = localStorage.getItem('lux_token') || sessionStorage.getItem('lux_token');
    const email = localStorage.getItem('lux_email') || sessionStorage.getItem('lux_email');
    const currentPath = window.location.pathname;
    const protectedRoutes = ['/pages/reserva.html'];
    const isProtectedRoute = protectedRoutes.some(route => currentPath.endsWith(route));
    const isAuthenticated = Boolean(token && email);

    if (isProtectedRoute && !isAuthenticated) {
        window.location.replace('/pages/login.html');
        return;
    }

    function logoutUser() {
        localStorage.clear();
        sessionStorage.clear();

        if (isProtectedRoute) {
            window.location.href = '/index.html';
            return;
        }

        window.location.reload();
    }

    if (authLink) {
        if (isAuthenticated) {
            // L'usuari TÉ sessió
            const nomUsuari = email.split('@')[0].toUpperCase();
            
            // En desktop: mostrar nombre en header
            authLink.className = "auth-nav-btn";
            authLink.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"></path>
                </svg>
                <span>${nomUsuari}</span>
            `;
            authLink.href = "#";
            authLink.addEventListener('click', (e) => {
                e.preventDefault();
                logoutUser();
            });
            
            // Ocultar el botón de acceso en móvil
            authLink.classList.add('hide-on-mobile');

            // En móvil se muestra solo el botón de logout con el nombre dentro del menú
            if (mobileAuthLink) {
                mobileAuthLink.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"></path>
                    </svg>
                    <span>${nomUsuari}</span>
                `;
                mobileAuthLink.href = '#';
                mobileAuthLink.className = 'mobile-btn mobile-btn-logout';
                mobileAuthLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    logoutUser();
                });
            }
        } else {
            // L'usuari NO té sessió
            authLink.className = "auth-nav-btn";
            authLink.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"></path>
                </svg>
                <span>ACCESO</span>
            `;
            authLink.href = "/pages/login.html";

            if (mobileAuthLink) {
                mobileAuthLink.textContent = 'ACCEDER';
                mobileAuthLink.href = '/pages/login.html';
                mobileAuthLink.className = 'btn-outline mobile-btn';
            }
        }
    }
});
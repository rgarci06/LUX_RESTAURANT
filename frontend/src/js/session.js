/**
 * GESTOR DE SESIÓN DE CABECERA
 * Misión: Modificar el botón de ACCESO si el usuario está logueado.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Correo admin principal (fallback por si el rol no viene bien guardado)
    const ADMIN_EMAIL = 'ddelpe@insdanielblanxart.cat';

    const authLink = document.getElementById('auth-link');
    const mobileAuthLink = document.querySelector('.mobile-menu-overlay .mobile-btn');
    const desktopNav = document.querySelector('.desktop-nav');
    const mobileNav = document.getElementById('mobile-nav-content');
    const localToken = localStorage.getItem('lux_token');
    const localEmail = localStorage.getItem('lux_email');
    const localRol = localStorage.getItem('lux_rol');
    const sessionToken = sessionStorage.getItem('lux_token');
    const sessionEmail = sessionStorage.getItem('lux_email');
    const sessionRol = sessionStorage.getItem('lux_rol');

    // Forma simple: usar primero una sesión completa (token + email) del mismo storage.
    const token = (localToken && localEmail) ? localToken : (sessionToken || localToken);
    const email = (localToken && localEmail) ? localEmail : (sessionEmail || localEmail);
    const rol = (localToken && localEmail) ? (localRol || 'client') : (sessionRol || localRol || 'client');
    const currentPath = window.location.pathname;
    const protectedRoutes = ['/pages/reserva.html', '/pages/admin.html'];
    const isProtectedRoute = protectedRoutes.some(route => currentPath.endsWith(route));
    const isAdminRoute = currentPath.endsWith('/pages/admin.html');
    const isAuthenticated = Boolean(token && email);
    const isAdmin = rol === 'admin' || (email || '').toLowerCase() === ADMIN_EMAIL;

    if (isProtectedRoute && !isAuthenticated) {
        window.location.replace('/pages/login.html');
        return;
    }

    if (isAdminRoute && !isAdmin) {
        window.location.replace('/index.html');
        return;
    }

    function injectAdminLinks() {
        if (!isAdmin) return;

        const hasAdminTextLink = (container) => {
            if (!container) return false;
            return Array.from(container.querySelectorAll('a')).some((a) => {
                const label = (a.textContent || '').trim().toLowerCase();
                return label === 'admin';
            });
        };

        const hasDesktopAdmin = desktopNav && (
            desktopNav.querySelector('.admin-nav-link')
            || Array.from(desktopNav.querySelectorAll('a')).some((a) => (a.getAttribute('href') || '').includes('/pages/admin.html'))
            || hasAdminTextLink(desktopNav)
        );

        if (desktopNav && !hasDesktopAdmin) {
            const adminLink = document.createElement('a');
            adminLink.href = '/pages/admin.html';
            adminLink.className = 'nav-link admin-nav-link';
            adminLink.textContent = 'Admin';

            if (currentPath.endsWith('/pages/admin.html')) {
                adminLink.classList.add('active-link');
            }

            desktopNav.appendChild(adminLink);
        }

        const hasMobileAdmin = mobileNav && (
            mobileNav.querySelector('.mobile-admin-link')
            || Array.from(mobileNav.querySelectorAll('a')).some((a) => (a.getAttribute('href') || '').includes('/pages/admin.html'))
            || hasAdminTextLink(mobileNav)
        );

        if (mobileNav && !hasMobileAdmin) {
            const adminMobileLink = document.createElement('a');
            adminMobileLink.href = '/pages/admin.html';
            adminMobileLink.className = 'mobile-link mobile-admin-link';
            adminMobileLink.textContent = 'ADMIN';

            if (currentPath.endsWith('/pages/admin.html')) {
                adminMobileLink.style.color = '#ffd700';
            }

            const insertBefore = mobileNav.querySelector('.mobile-btn');
            if (insertBefore) {
                mobileNav.insertBefore(adminMobileLink, insertBefore);
            } else {
                mobileNav.appendChild(adminMobileLink);
            }
        }
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
        injectAdminLinks();

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
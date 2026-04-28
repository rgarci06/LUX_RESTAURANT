document.addEventListener('DOMContentLoaded', () => {
    // este correo lo uso como apoyo por si el rol viene mal guardado
    const ADMIN_EMAIL = 'ddelpe@insdanielblanxart.cat';
    // esta función decodifica el JSON Web Token para extraer información.
    function decodeJwtPayload(token) {
        try {
            const parts = String(token || '').split('.');
            if (parts.length !== 3) return {};

            const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padding = '='.repeat((4 - (payload.length % 4)) % 4);
            const decoded = atob(payload + padding);
            const parsed = JSON.parse(decoded);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function resolveEmail(currentSession) {
        const directEmail = String(currentSession?.email || '').trim();
        if (directEmail) return directEmail;

        const payload = decodeJwtPayload(currentSession?.token);
        const payloadEmail = String(payload?.email || '').trim();
        if (payloadEmail) return payloadEmail;

        return '';
    }
    // leo la sesión desde el almacenamiento sea sessionStorage o localStorage y devuelvo un objeto con token, email y rol.
    function readSession(storage) {
        return {
            token: storage.getItem('lux_token') || '',
            email: storage.getItem('lux_email') || '',
            rol: storage.getItem('lux_rol') || ''
        };
    }
    // esta función dice si el usuario esta autenticado o no, y devuelve su sesión actual. Primero mira en sessionStorage y luego en localStorage.
    function resolveCurrentSession() {
        const sessionData = readSession(sessionStorage);
        
        // aqui mira si el sessionStorage tiene el token y el email, si lo tiene, da la sesión temporal
        if (sessionData.token && sessionData.email) {
            return sessionData; 
        }

        const localData = readSession(localStorage);
        
        if (localData.token && localData.email) {
            return localData;
        }

        return sessionData.token || sessionData.email || sessionData.rol
            ? sessionData
            : localData; 
    }

    const authLink = document.getElementById('auth-link');
    const mobileAuthLink = document.querySelector('.mobile-menu-overlay .mobile-btn');
    const desktopNav = document.querySelector('.desktop-nav');
    const mobileNav = document.getElementById('mobile-nav-content');
    const currentSession = resolveCurrentSession();
    const token = currentSession.token;
    const email = resolveEmail(currentSession);
    const rol = currentSession.rol || 'client';
    const currentPath = window.location.pathname;
    const protectedRoutes = ['/pages/reserva.html', '/pages/admin.html'];
    const isProtectedRoute = protectedRoutes.some(route => currentPath.endsWith(route));
    const isAdminRoute = currentPath.endsWith('/pages/admin.html');
    const isAuthenticated = Boolean(token && email);
    const normalizedRole = String(rol || '').toLowerCase();
    const isAdmin = normalizedRole === 'admin' || (email || '').toLowerCase() === ADMIN_EMAIL;
    const isCamarero = normalizedRole === 'camarero';
    const canManageReservas = isAdmin || isCamarero;

    if (isProtectedRoute && !isAuthenticated) {
        window.location.replace('/pages/login.html');
        return;
    }

    if (isAdminRoute && !canManageReservas) {
        window.location.replace('/index.html');
        return;
    }

    function injectAdminLinks() {
        if (!canManageReservas) return;

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
            // aqui trato el caso con sesion activa
            const nomUsuari = email.split('@')[0].toUpperCase();
            
            // en desktop muestro nombre y boton logout
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
            
            // oculto este boton en movil
            authLink.classList.add('hide-on-mobile');

            // en movil dejo el boton de salir dentro del menu
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
            // aqui trato el caso sin sesion
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
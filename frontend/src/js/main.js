document.addEventListener('DOMContentLoaded', () => {
    
    const navbar = document.getElementById('navbar');
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    const reserveCtas = document.querySelectorAll('#btn-reserva, .btn-reserve-full');
    
    // al bajar un poco pongo el header en modo scrolled
    window.addEventListener('scroll', () => {
        const header = document.querySelector('.main-header');
        const scrollPosition = window.scrollY || document.documentElement.scrollTop;

        if (scrollPosition > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // esto abre/cierra el menu movil
    const toggleMenu = () => {
        mobileMenu.classList.toggle('mobile-menu-open');
        
        if (mobileMenu.classList.contains('mobile-menu-open')) {
            menuBtn.classList.add('active-burger');
            document.body.style.overflow = 'hidden';
        } else {
            menuBtn.classList.remove('active-burger');
            document.body.style.overflow = 'auto';
        }
    };

    if (menuBtn) menuBtn.addEventListener('click', toggleMenu);

    // si no hay sesion mando al login, si hay mando a reserva
    if (reserveCtas.length > 0) {
        reserveCtas.forEach((cta) => {
            cta.addEventListener('click', (e) => {
            e.preventDefault();
            const token = localStorage.getItem('lux_token') || sessionStorage.getItem('lux_token');
            const email = localStorage.getItem('lux_email') || sessionStorage.getItem('lux_email');

            if (!token || !email) {
                window.location.href = '/pages/login.html';
                return;
            }

            window.location.href = '/pages/reserva.html';
        });
        });
    }
    
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenu.classList.contains('mobile-menu-open')) toggleMenu();
        });
    });
});
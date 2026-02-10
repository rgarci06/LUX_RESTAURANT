document.addEventListener('DOMContentLoaded', () => {
    
    const navbar = document.getElementById('navbar');
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    
    // --- 1. EFECTO SCROLL (Fondo Negro al bajar) ---
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            // Si bajamos 50px, añade la clase 'scrolled' (Fondo Negro)
            navbar.classList.add('scrolled');
        } else {
            // Si estamos arriba, quita la clase (Transparente)
            navbar.classList.remove('scrolled');
        }
    });

    // --- 2. MENÚ MÓVIL ---
    const toggleMenu = () => {
        mobileMenu.classList.toggle('mobile-menu-open');
        
        // Efecto icono hamburguesa
        if (mobileMenu.classList.contains('mobile-menu-open')) {
            menuBtn.classList.add('active-burger');
            document.body.style.overflow = 'hidden';
        } else {
            menuBtn.classList.remove('active-burger');
            document.body.style.overflow = 'auto';
        }
    };

    if (menuBtn) menuBtn.addEventListener('click', toggleMenu);
    
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenu.classList.contains('mobile-menu-open')) toggleMenu();
        });
    });
});
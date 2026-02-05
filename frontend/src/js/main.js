import '../css/style.css';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- ELEMENTOS ---
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileNavContent = document.getElementById('mobile-nav-content');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    const navbar = document.getElementById('navbar'); // El Header
    
    const iconBurger = document.getElementById('icon-burger');
    const iconClose = document.getElementById('icon-close');

    // --- EFECTO SCROLL EN NAVBAR ---
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            // Si bajamos 50px, ponemos fondo negro y blur
            navbar.classList.remove('bg-transparent', 'py-4', 'md:py-6');
            navbar.classList.add('bg-black/90', 'backdrop-blur-md', 'shadow-lg', 'py-3', 'md:py-4');
        } else {
            // Si estamos arriba, volvemos a transparente
            navbar.classList.add('bg-transparent', 'py-4', 'md:py-6');
            navbar.classList.remove('bg-black/90', 'backdrop-blur-md', 'shadow-lg', 'py-3', 'md:py-4');
        }
    });

    // --- LÓGICA MENÚ MÓVIL ---
    const toggleMenu = () => {
        const isClosed = mobileMenu.classList.contains('opacity-0');

        if (isClosed) {
            // ABRIR
            mobileMenu.classList.remove('opacity-0', 'pointer-events-none');
            mobileMenu.classList.add('opacity-100', 'pointer-events-auto');
            setTimeout(() => mobileNavContent.classList.remove('translate-y-10'), 50);
            
            iconBurger.classList.remove('rotate-0', 'scale-100', 'opacity-100');
            iconBurger.classList.add('rotate-90', 'scale-0', 'opacity-0');
            
            iconClose.classList.remove('-rotate-90', 'scale-50', 'opacity-0');
            iconClose.classList.add('rotate-0', 'scale-100', 'opacity-100');
            
            document.body.style.overflow = 'hidden'; 
        } else {
            // CERRAR
            mobileMenu.classList.remove('opacity-100', 'pointer-events-auto');
            mobileMenu.classList.add('opacity-0', 'pointer-events-none');
            mobileNavContent.classList.add('translate-y-10');
            
            iconBurger.classList.add('rotate-0', 'scale-100', 'opacity-100');
            iconBurger.classList.remove('rotate-90', 'scale-0', 'opacity-0');
            
            iconClose.classList.add('-rotate-90', 'scale-50', 'opacity-0');
            iconClose.classList.remove('rotate-0', 'scale-100', 'opacity-100');
            
            document.body.style.overflow = 'auto';
        }
    };

    if (menuBtn) menuBtn.addEventListener('click', toggleMenu);
    mobileLinks.forEach(link => link.addEventListener('click', toggleMenu));
});
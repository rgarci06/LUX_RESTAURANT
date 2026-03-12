document.addEventListener('DOMContentLoaded', () => {
    
    // Seleccionamos todos los botones y todas las categorías
    const tabs = document.querySelectorAll('.tab-btn');
    const categories = document.querySelectorAll('.menu-category');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            
            // 1. Quitar clase 'active' de todos los botones
            tabs.forEach(t => t.classList.remove('active'));
            // 2. Añadir clase 'active' al botón pulsado
            tab.classList.add('active');

            // 3. Obtener el objetivo (ej: "mains")
            const targetId = tab.getAttribute('data-target');

            // 4. Ocultar todas las categorías
            categories.forEach(cat => {
                cat.classList.remove('active');
                // Opcional: reiniciar animación forzando reflow si quisieras
            });

            // 5. Mostrar la categoría seleccionada
            const targetCategory = document.getElementById(targetId);
            if(targetCategory) {
                targetCategory.classList.add('active');
            }
        });
    });
});
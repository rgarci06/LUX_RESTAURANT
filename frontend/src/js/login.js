document.addEventListener('DOMContentLoaded', () => {
    
    // FORMULARIOS
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    const formTitle = document.getElementById('form-title');

    // BOTONES (Coinciden con los IDs del HTML nuevo)
    const btnToRegister = document.getElementById('btn-to-register');
    const btnToLogin = document.getElementById('btn-to-login');
    const linkForgot = document.getElementById('link-forgot');
    const btnBackFromForgot = document.getElementById('btn-back-from-forgot');

    // FUNCIÓN DE CAMBIO
    function switchForm(hide, show, title) {
        // 1. Ocultar
        hide.classList.add('hidden');
        hide.classList.remove('form-visible');
        
        // 2. Mostrar
        show.classList.remove('hidden');
        void show.offsetWidth; // Truco para reiniciar animación
        show.classList.add('form-visible');

        // 3. Título
        formTitle.textContent = title;
    }

    // EVENTOS (Con comprobación de seguridad)
    
    // Ir a Registro
    if(btnToRegister) {
        btnToRegister.addEventListener('click', () => {
            switchForm(loginForm, registerForm, "CREAR CUENTA");
        });
    }

    // Ir a Login (desde Registro)
    if(btnToLogin) {
        btnToLogin.addEventListener('click', () => {
            switchForm(registerForm, loginForm, "INICIAR SESIÓN");
        });
    }

    // Ir a Olvidé Contraseña
    if(linkForgot) {
        linkForgot.addEventListener('click', (e) => {
            e.preventDefault();
            switchForm(loginForm, forgotForm, "RECUPERAR CLAVE");
        });
    }

    // Volver a Login (desde Olvidé)
    if(btnBackFromForgot) {
        btnBackFromForgot.addEventListener('click', () => {
            switchForm(forgotForm, loginForm, "INICIAR SESIÓN");
        });
    }
});
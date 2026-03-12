/**
 * CAPA 1: LÓGICA DE INTERFAZ (Frontend)
 * Este archivo controla el DOM (el HTML de la página de login).
 * QUÉ HACE: Escucha cuando haces clic, lee lo que escribes y muestra alertas.
 * CONEXIÓN: No habla con la base de datos directamente; le pide el favor a 'api.js'.
 */

import { AuthService } from './services/api.js';
    
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. REFERENCIAS AL DOM
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    const formTitle = document.getElementById('form-title');

    const btnToRegister = document.getElementById('btn-to-register');
    const btnToLogin = document.getElementById('btn-to-login');
    const linkForgot = document.getElementById('link-forgot');
    const btnBackFromForgot = document.getElementById('btn-back-from-forgot');

    // 2. ANIMACIONES DE PANTALLA
    function switchForm(hide, show, title) {
        hide.classList.add('hidden');
        hide.classList.remove('form-visible');
        show.classList.remove('hidden');
        void show.offsetWidth; 
        show.classList.add('form-visible');
        formTitle.textContent = title;
    }

    if(btnToRegister) btnToRegister.addEventListener('click', () => switchForm(loginForm, registerForm, "CREAR CUENTA"));
    if(btnToLogin) btnToLogin.addEventListener('click', () => switchForm(registerForm, loginForm, "INICIAR SESIÓN"));
    if(linkForgot) linkForgot.addEventListener('click', (e) => { e.preventDefault(); switchForm(loginForm, forgotForm, "RECUPERAR CLAVE"); });
    if(btnBackFromForgot) btnBackFromForgot.addEventListener('click', () => switchForm(forgotForm, loginForm, "INICIAR SESIÓN"));

    // 3. REGISTRO (Usa el AuthService)
    if (registerForm) {
        const btnRegisterSubmit = registerForm.querySelector('.btn-login');

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = registerForm.querySelector('input[type="email"]');
            const passwordInput = registerForm.querySelector('input[type="password"]');

            if (!emailInput || !passwordInput || !emailInput.value || !passwordInput.value) {
                return alert("El correo y la contraseña son obligatorios.");
            }

            if(btnRegisterSubmit) btnRegisterSubmit.innerText = "REGISTRANDO...";
            
            if(btnRegisterSubmit) btnRegisterSubmit.innerText = "CREAR CUENTA";
        });
    }

    // 4. LOGIN (Usa el AuthService)
    if (loginForm) {
        const btnLoginSubmit = loginForm.querySelector('.btn-login');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = loginForm.querySelector('input[type="email"]');
            const passwordInput = loginForm.querySelector('input[type="password"]');
            const rememberCheck = loginForm.querySelector('input[type="checkbox"]');

            if (!emailInput || !passwordInput || !emailInput.value || !passwordInput.value) {
                return alert("Introduzca las credenciales.");
            }

            const isRemembered = rememberCheck ? rememberCheck.checked : false;

            if(btnLoginSubmit) btnLoginSubmit.innerText = "ACCEDIENDO...";

            // Llama al mensajero (api.js)
            const respuesta = await AuthService.login(emailInput.value, passwordInput.value);
            
            if (respuesta.ok) {
                const storage = isRemembered ? localStorage : sessionStorage;
                storage.setItem("lux_token", respuesta.dades.token);
                storage.setItem("lux_rol", respuesta.dades.rol);
                storage.setItem("lux_email", emailInput.value);
                
                const rol = respuesta.dades.rol;
                if (rol === "admin") window.location.href = "/pages/panel_admin.html";
                else if (rol === "gestor") window.location.href = "/pages/panel_gestor.html";
                else if (rol === "cambrer") window.location.href = "/pages/panel_cambrer.html";
                else window.location.href = "/index.html"; 
            } else {
                alert("Credenciales incorrectas o el usuario no existe.");
            }
            
            if(btnLoginSubmit) btnLoginSubmit.innerText = "ACCEDER";
        });
    }

    // 5. RECUPERAR CLAVE
    if (forgotForm) {
        const btnForgotSubmit = forgotForm.querySelector('.btn-login');
        
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = forgotForm.querySelector('input[type="email"]');
            if (!emailInput || !emailInput.value) return alert("Introduzca su correo electrónico.");

            if(btnForgotSubmit) btnForgotSubmit.innerText = "ENVIANDO...";
            setTimeout(() => {
                alert(`Si el correo existe en el sistema, recibirá un enlace en:\n${emailInput.value}`);
                forgotForm.reset();
                if(btnForgotSubmit) btnForgotSubmit.innerText = "ENVIAR ENLACE";
                if(btnBackFromForgot) btnBackFromForgot.click();
            }, 1500);
        });
    }
});
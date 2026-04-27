import { AuthService } from './services/api.js';
    
document.addEventListener('DOMContentLoaded', () => {

    // este aviso lo uso para mensajes rapidos en pantalla

    function showLuxAlert(message, type = 'info') {
        let container = document.querySelector('.lux-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'lux-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `lux-toast lux-toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        // esto hace que la animacion entre suave
        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, 3200);
    }
    
    // aqui cojo todos los elementos del login/register/forgot
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    const formTitle = document.getElementById('form-title');
    const btnToRegister = document.getElementById('btn-to-register');
    const btnToLogin = document.getElementById('btn-to-login');
    const linkForgot = document.getElementById('link-forgot');
    const btnBackFromForgot = document.getElementById('btn-back-from-forgot');
    const registerPassword = document.getElementById('register-password');
    const registerPasswordStrength = document.getElementById('register-password-strength');

    function getPasswordStrength(value) {
        let score = 0;
        if (value.length >= 6) score++;
        if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
        if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score++;
        if (score <= 1) return { label: 'Debil', className: 'weak' };
        if (score === 2) return { label: 'Media', className: 'medium' };
        return { label: 'Fuerte', className: 'strong' };
    }

    // con esto cambio de un formulario a otro
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

    document.querySelectorAll('.toggle-password').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            if (!targetId) return;
            const input = document.getElementById(targetId);
            if (!input) return;

            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.classList.toggle('active', show);
            btn.setAttribute('aria-pressed', show ? 'true' : 'false');
            btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
        });
    });

    if (registerPassword && registerPasswordStrength) {
        registerPassword.addEventListener('input', () => {
            if (!registerPassword.value) {
                registerPasswordStrength.textContent = '';
                registerPasswordStrength.className = 'password-strength';
                return;
            }
            const result = getPasswordStrength(registerPassword.value);
            registerPasswordStrength.textContent = `Seguridad: ${result.label}`;
            registerPasswordStrength.className = `password-strength ${result.className}`;
        });
    }

    // bloque de registro
    if (registerForm) {
        const btnRegisterSubmit = registerForm.querySelector('.btn-login');

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nameInput = registerForm.querySelector('input[name="nombre"]');
            const surnameInput = registerForm.querySelector('input[name="apellido"]');
            const phoneInput = registerForm.querySelector('input[name="telefono"]');
            const emailInput = registerForm.querySelector('input[name="email"]');
            const passwordInput = registerForm.querySelector('input[name="password"]');

            if (
                !nameInput || !surnameInput || !phoneInput || !emailInput || !passwordInput ||
                !nameInput.value || !surnameInput.value || !phoneInput.value || !emailInput.value || !passwordInput.value
            ) {
                return showLuxAlert("El nombre, apellido, teléfono, correo y contraseña son obligatorios.", 'warning');
            }

            if(btnRegisterSubmit) btnRegisterSubmit.innerText = "REGISTRANDO...";

            // aqui llamo al backend para crear usuario
            const respuesta = await AuthService.register({
                nombre: nameInput.value,
                apellido: surnameInput.value,
                telefono: phoneInput.value,
                email: emailInput.value,
                password: passwordInput.value
            });

            if (respuesta.ok) {
                showLuxAlert("Cuenta creada correctamente. Ya puedes iniciar sesión.", 'success');
                registerForm.reset();
                switchForm(registerForm, loginForm, "INICIAR SESIÓN");
            } else {
                const detail = (respuesta.dades?.detail || '').toString().toLowerCase();
                if (respuesta.status === 409 || detail.includes('registrado') || (detail.includes('already') && detail.includes('register'))) {
                    showLuxAlert("Este correo ya está registrado.", 'warning');
                } else {
                    showLuxAlert("No se pudo crear la cuenta. Inténtalo de nuevo.", 'error');
                }
            }

            if(btnRegisterSubmit) btnRegisterSubmit.innerText = "CREAR CUENTA";
        });
    }

    // bloque de login
    if (loginForm) {
        const btnLoginSubmit = loginForm.querySelector('.btn-login');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = loginForm.querySelector('input[type="email"]');
            const passwordInput = loginForm.querySelector('input[type="password"]');
            const rememberCheck = loginForm.querySelector('input[type="checkbox"]');

            if (!emailInput || !passwordInput || !emailInput.value || !passwordInput.value) {
                return showLuxAlert("Introduzca las credenciales.", 'warning');
            }

            const isRemembered = rememberCheck ? rememberCheck.checked : false;

            if(btnLoginSubmit) btnLoginSubmit.innerText = "ACCEDIENDO...";

            // aqui pido login al backend
            const respuesta = await AuthService.login(emailInput.value, passwordInput.value);
            
            if (respuesta.ok) {
                const storage = isRemembered ? localStorage : sessionStorage;
                storage.setItem("lux_token", respuesta.dades.token);
                storage.setItem("lux_rol", respuesta.dades.rol);
                storage.setItem("lux_email", emailInput.value);
                
                const rol = String(respuesta.dades.rol || '').toLowerCase();
                if (rol === "admin" || rol === "camarero") {
                    window.location.href = "/pages/admin.html";
                } else {
                    window.location.href = "/index.html";
                }
            } else {
                showLuxAlert("Credenciales incorrectas o el usuario no existe.", 'error');
            }
            
            if(btnLoginSubmit) btnLoginSubmit.innerText = "ACCEDER";
        });
    }

    // bloque para enviar email de recuperacion
        if (forgotForm) {
            const btnForgotSubmit = forgotForm.querySelector('.btn-login');
            
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const emailInput = forgotForm.querySelector('input[type="email"]');
                if (!emailInput || !emailInput.value) return showLuxAlert("Introduzca su correo electrónico.", 'warning');

                if(btnForgotSubmit) btnForgotSubmit.innerText = "ENVIANDO...";
                
                try {
                    const response = await AuthService.recoverPassword(emailInput.value);

                    if (response.ok) {
                        showLuxAlert(`Si el correo existe, recibirá un enlace en ${emailInput.value}`, 'success');
                        forgotForm.reset();
                        if(btnBackFromForgot) btnBackFromForgot.click();
                    } else {
                        showLuxAlert("No se pudo enviar el correo. Inténtalo más tarde.", 'error');
                    }
                } catch (error) {
                    console.error("Error al recuperar clave:", error);
                    showLuxAlert("Error de conexión con el servidor.", 'error');
                }

                if(btnForgotSubmit) btnForgotSubmit.innerText = "ENVIAR ENLACE";
            });
        }
});
document.addEventListener('DOMContentLoaded', () => {
    
    // =======================================================
    // 1. GESTIÓ VISUAL: ALTERNANÇA DE FORMULARIS
    // =======================================================
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    const formTitle = document.getElementById('form-title');

    const btnToRegister = document.getElementById('btn-to-register');
    const btnToLogin = document.getElementById('btn-to-login');
    const linkForgot = document.getElementById('link-forgot');
    const btnBackFromForgot = document.getElementById('btn-back-from-forgot');

    function switchForm(hide, show, title) {
        hide.classList.add('hidden');
        hide.classList.remove('form-visible');
        show.classList.remove('hidden');
        void show.offsetWidth; 
        show.classList.add('form-visible');
        formTitle.textContent = title;
    }

    if(btnToRegister) { btnToRegister.addEventListener('click', () => { switchForm(loginForm, registerForm, "CREAR COMPTE"); }); }
    if(btnToLogin) { btnToLogin.addEventListener('click', () => { switchForm(registerForm, loginForm, "INICIAR SESSIÓ"); }); }
    if(linkForgot) { linkForgot.addEventListener('click', (e) => { e.preventDefault(); switchForm(loginForm, forgotForm, "RECUPERAR CLAU"); }); }
    if(btnBackFromForgot) { btnBackFromForgot.addEventListener('click', () => { switchForm(forgotForm, loginForm, "INICIAR SESSIÓ"); }); }

    // =======================================================
    // 2. LÒGICA DE CONNEXIÓ (BACKEND I SUPABASE)
    // =======================================================
    const API_URL = "http://localhost:8000/api";

    // --- A. GESTIÓ DEL REGISTRE ---
    if (registerForm) {
        // Busquem el botó específicament dins d'aquest formulari
        const btnRegisterSubmit = registerForm.querySelector('.btn-login');

        const processarRegistre = async (e) => {
            e.preventDefault();
            console.log("1. S'ha detectat el clic al botó de registre."); 

            // Cercar els elements d'input
            const emailInput = registerForm.querySelector('input[type="email"]');
            const passwordInput = registerForm.querySelector('input[type="password"]');

            if (!emailInput || !passwordInput || !emailInput.value || !passwordInput.value) {
                alert("El correu i la contrasenya són camps obligatoris.");
                return;
            }

            const email = emailInput.value;
            const password = passwordInput.value;
            console.log("2. Dades recollides. Correu:", email);

            try {
                // Indicador visual de càrrega
                btnRegisterSubmit.innerText = "REGISTRANT...";
                
                console.log("3. Iniciant connexió amb el servidor a:", `${API_URL}/register`);

                const resposta = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, password: password, rol: "client" })
                });
                
                const dades = await resposta.json();
                console.log("4. Resposta del servidor:", dades);
                
                if (resposta.ok) {
                    alert("Usuari registrat correctament. Procediu a iniciar sessió.");
                    btnToLogin.click();
                    registerForm.reset();
                } else {
                    alert("Error en el registre: " + dades.detail);
                }
            } catch (error) {
                console.error("Error crític de connexió:", error);
                alert("Error de comunicació amb el servidor. Comproveu que el backend estigui actiu.");
            } finally {
                // Restaurar l'estat del botó
                btnRegisterSubmit.innerText = "CREAR CUENTA";
            }
        };

        // Assignar l'esdeveniment tant a l'enviament del formulari com al clic directe
        registerForm.addEventListener('submit', processarRegistre);
        if (btnRegisterSubmit) {
            btnRegisterSubmit.addEventListener('click', (e) => {
                if (btnRegisterSubmit.type === 'button') {
                    processarRegistre(e);
                }
            });
        }
    }

    // --- B. GESTIÓ DE L'INICI DE SESSIÓ (AMB CONTROL DE ROLS) ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = loginForm.querySelector('input[type="email"]').value;
            const password = loginForm.querySelector('input[type="password"]').value;

            try {
                const resposta = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, password: password })
                });
                
                const dades = await resposta.json();
                
                if (resposta.ok) {
                    // Emmagatzemament segur del token i del rol a nivell de client
                    localStorage.setItem("lux_token", dades.token);
                    localStorage.setItem("lux_rol", dades.rol);
                    
                    // Redirecció basada en el Control d'Accés per Rols (RBAC)
                    if (dades.rol === "admin") {
                        alert("Accés autoritzat: Administrador.");
                        window.location.href = "panel_admin.html";
                        
                    } else if (dades.rol === "gestor") {
                        alert("Accés autoritzat: Gestor.");
                        window.location.href = "panel_gestor.html";
                        
                    } else if (dades.rol === "cambrer") {
                        alert("Accés autoritzat: Cambrer.");
                        window.location.href = "panel_cambrer.html";
                        
                    } else {
                        alert("Inici de sessió completat.");
                        window.location.href = "../index.html"; 
                    }
                    
                } else {
                    alert("Credencials incorrectes. Torneu a intentar-ho.");
                }
            } catch (error) {
                console.error("Error de connexió:", error);
                alert("Error de comunicació amb el servidor.");
            }
        });
    }
});
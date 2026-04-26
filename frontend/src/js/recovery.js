document.addEventListener('DOMContentLoaded', () => {

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

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, 3200);
    }

    // 1. Extraer la llave (token) de la URL que nos manda el correo
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.replace('#', '?'));
    const token = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');

    // Si alguien entra escribiendo la URL a mano sin venir del correo, lo echamos
    if (!token || !refreshToken) {
        showLuxAlert("Enlace inválido o caducado.", 'error');
        setTimeout(() => { window.location.href = "login.html"; }, 2000);
        return;
    }

    // 2. Controlar el formulario
    const recoveryForm = document.getElementById('recovery-form');
    const btnSubmit = recoveryForm.querySelector('.btn-login');

    recoveryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const pwd1 = document.getElementById('new-pwd').value;
        const pwd2 = document.getElementById('confirm-pwd').value;

        if (pwd1 !== pwd2) {
            return showLuxAlert("Las contraseñas no coinciden.", 'warning');
        }

        if (pwd1.length < 6) {
            return showLuxAlert("La contraseña debe tener al menos 6 caracteres.", 'warning');
        }

        btnSubmit.innerText = "GUARDANDO...";

        try {
            // URL de tu servidor Python en LOCAL (cambiar a Render cuando subas a Vercel)
            const res = await fetch(`https://lux-restaurant.onrender.com`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    token: token, 
                    refresh: refreshToken, 
                    password: pwd1 
                })
            });

            if(res.ok) {
                showLuxAlert("¡Contraseña actualizada con éxito!", 'success');
                // Si va bien, lo mandamos al login
                setTimeout(() => { window.location.href = "login.html"; }, 2000);
            } else {
                showLuxAlert("Error al actualizar. El enlace puede haber caducado.", 'error');
                btnSubmit.innerText = "GUARDAR CONTRASEÑA";
            }
        } catch (error) {
            console.error(error);
            showLuxAlert("Error de conexión con el servidor.", 'error');
            btnSubmit.innerText = "GUARDAR CONTRASEÑA";
        }
    });
});
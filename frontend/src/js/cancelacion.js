document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const ids = urlParams.get('ids');

    const icon = document.getElementById('cancel-icon');
    const title = document.getElementById('cancel-title');
    const subtitle = document.getElementById('cancel-subtitle');
    const message = document.getElementById('cancel-message');

    if (!ids) {
        showError("Enlace inválido", "No se han encontrado datos de la reserva para cancelar.");
        return;
    }

    try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const baseApiUrl = isLocal
            ? 'http://localhost:8000/api'
            : 'https://lux-restaurant.onrender.com/api';
        const apiUrl = `${baseApiUrl}/cancelar-reserva?ids=${encodeURIComponent(ids)}`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        const contentType = response.headers.get('content-type') || '';
        let data = null;

        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const rawText = await response.text();
            throw new Error(`Respuesta no JSON (${response.status}): ${rawText.slice(0, 180)}...`);
        }

        if (response.ok) {
            // ÉXITO
            icon.textContent = "✓";
            icon.style.color = "#d4af37";
            title.textContent = "RESERVA CANCELADA";
            title.style.background = "linear-gradient(to bottom, #fef08a, #d4af37, #a16207)";
            title.style.webkitBackgroundClip = "text";
            title.style.color = "transparent";
            subtitle.textContent = "Las mesas vuelven a estar disponibles";
            message.textContent = "Tu reserva ha sido anulada correctamente. Esperamos poder atenderte en otra ocasión y que disfrutes de la experiencia LUX muy pronto.";
        } else {
            // ERROR DEL BACKEND
            if (response.status === 401) {
                window.location.href = '/pages/login.html';
                return;
            }
            showError("No se pudo cancelar", data?.detail || "La reserva ya ha sido cancelada previamente o no existe.");
        }

    } catch (error) {
        // ERROR DE RED / FORMATO
        showError("Error de conexión", "No hemos podido conectar con el servidor o la respuesta no es válida.");
        console.error("Error cancelando:", error);
    }

    function showError(titulo, texto) {
        icon.textContent = "✕";
        icon.style.color = "#ff4444";
        title.textContent = titulo;
        title.style.background = "none";
        title.style.color = "#ff4444";
        subtitle.textContent = "Ha ocurrido un problema";
        message.textContent = texto;
    }
});
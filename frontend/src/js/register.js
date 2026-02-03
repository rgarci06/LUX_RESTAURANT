const pass = document.getElementById('password');
const confirmPass = document.getElementById('confirm_password');
const submitBtn = document.getElementById('submitBtn');
const matchText = document.getElementById('match-text');

// Función para mostrar/ocultar contraseña
function togglePass(id, icon) {
    const input = document.getElementById(id);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function validateForm() {
    const val = pass.value;
    const confVal = confirmPass.value;

    // 1. Validar Requisitos
    const isLength = val.length >= 8;
    const isUpper = /[A-Z]/.test(val);
    const isNumber = /[0-9]/.test(val);

    document.getElementById('length').className = isLength ? 'requirement valid' : 'requirement';
    document.getElementById('upper').className = isUpper ? 'requirement valid' : 'requirement';
    document.getElementById('number').className = isNumber ? 'requirement valid' : 'requirement';

    // 2. Validar Coincidencia
    if (confVal === "") {
        matchText.className = "match-message";
    } else if (val === confVal) {
        matchText.innerText = "✔ Las contraseñas coinciden";
        matchText.className = "match-message success";
    } else {
        matchText.innerText = "✖ Las contraseñas no coinciden";
        matchText.className = "match-message error";
    }

    // 3. Habilitar Botón
    const allRequirements = isLength && isUpper && isNumber;
    const match = (val === confVal) && val !== "";
    submitBtn.disabled = !(allRequirements && match);
}

pass.addEventListener('input', validateForm);
confirmPass.addEventListener('input', validateForm);

document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert("¡Registro procesado con éxito!");
});
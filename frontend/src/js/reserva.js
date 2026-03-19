import { ReservationService, MesasService } from './services/api.js';

// sistema de reservas para el restaurante

document.addEventListener('DOMContentLoaded', () => {
    function showLuxToast(message, type = 'info', duration = 6000) {
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
        }, duration);
    }

    // Mapa base del salon: x e y son porcentajes dentro del contenedor .table-map.
    // Ejemplo: x:25, y:20 coloca la mesa al 25% del ancho y 20% del alto.
    const TABLE_LAYOUT = [
        { id: 1, x: 25, y: 20, zone: 'gold' },
        { id: 2, x: 43, y: 20, zone: 'gold' },
        { id: 3, x: 61, y: 20, zone: 'gold' },
        { id: 4, x: 79, y: 20, zone: 'gold' },
        { id: 5, x: 25, y: 40, zone: 'gold' },
        { id: 6, x: 43, y: 40, zone: 'gold' },
        { id: 7, x: 61, y: 40, zone: 'gold' },
        { id: 8, x: 79, y: 40, zone: 'gold' },
        { id: 9, x: 25, y: 74, zone: 'gold' },
        { id: 10, x: 43, y: 74, zone: 'gold' },
        { id: 11, x: 61, y: 74, zone: 'gold' },
        { id: 12, x: 79, y: 74, zone: 'gold' }
    ];

    // aqui guardo toda la info de la reserva
    const state = {
        people: 2,
        selectedDate: null,
        selectedTime: null,
        selectedTables: [],
        maxTables: 1,
        occupiedTables: [] // Mesas que ya están reservadas en esta fecha/hora
    };

    // cojo los elementos del html
    const peopleCount = document.getElementById('people-count');
    const peopleInfo = document.getElementById('people-info');
    const calendarGrid = document.getElementById('calendar-grid');
    const middaySlots = document.getElementById('midday-slots');
    const eveningSlots = document.getElementById('evening-slots');
    const tableMap = document.getElementById('table-map');
    const tableInstruction = document.getElementById('table-instruction');
    const btnConfirm = document.getElementById('btn-confirm');
    const stepContact = document.getElementById('step-contact');
    const stepDate = document.getElementById('step-date');
    const stepTime = document.getElementById('step-time');
    const stepTables = document.getElementById('step-tables');

    function getSessionEmail() {
        return localStorage.getItem('lux_email') || sessionStorage.getItem('lux_email') || '';
    }

    function getSessionToken() {
        return localStorage.getItem('lux_token') || sessionStorage.getItem('lux_token') || '';
    }

    // Convierte una fecha local a formato YYYY-MM-DD (sin desfases por zona horaria).
    function formatDateLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // paso 1: elegir cuanta gente va a venir
    function updatePeopleCount(delta) {
        state.people = Math.max(1, Math.min(20, state.people + delta));
        peopleCount.textContent = state.people;
        state.selectedDate = null;
        state.selectedTime = null;
        
        // calculo cuantas mesas necesitan segun la gente
        if (state.people <= 4) {
            state.maxTables = 1;
            peopleInfo.textContent = 'Reservarás 1 mesa';
        } else if (state.people <= 6) {
            state.maxTables = 2;
            peopleInfo.textContent = 'Reservarás 2 mesas';
        } else if (state.people <= 8) {
            state.maxTables = 3;
            peopleInfo.textContent = 'Reservarás 3 mesas';
        } else {
            peopleInfo.textContent = 'Por favor, contacta con nosotros para grupos grandes';
        }

        // si son mas de 8 personas muestro mensaje de contacto
        if (state.people > 8) {
            stepContact.classList.remove('hidden');
            stepDate.classList.add('hidden');
            stepTime.classList.add('hidden');
            stepTables.classList.add('hidden');
        } else {
            stepContact.classList.add('hidden');
            stepDate.classList.remove('hidden');
            stepTime.classList.add('hidden');
            stepTables.classList.remove('hidden');
            generateCalendar();
            generateTables();
        }

        validateForm();
    }

    document.querySelector('.btn-increment').addEventListener('click', () => updatePeopleCount(1));
    document.querySelector('.btn-decrement').addEventListener('click', () => updatePeopleCount(-1));

    // paso 2: calendario para elegir el dia
    function generateCalendar() {
        calendarGrid.innerHTML = '';
        const today = new Date();
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            const dayOfWeek = date.getDay();
            // los lunes esta cerrado
            const isOpen = dayOfWeek !== 1;

            const card = document.createElement('div');
            card.classList.add('day-card');
            if (!isOpen) card.classList.add('disabled');
            card.dataset.date = formatDateLocal(date);
            card.dataset.dayOfWeek = dayOfWeek;

            card.innerHTML = `
                <div class="day-name">${days[dayOfWeek]}</div>
                <div class="day-number">${date.getDate()}</div>
                <div class="day-month">${months[date.getMonth()]}</div>
            `;

            if (isOpen) {
                card.addEventListener('click', () => selectDate(card, dayOfWeek));
            }

            calendarGrid.appendChild(card);
        }
    }

    function selectDate(card, dayOfWeek) {
        document.querySelectorAll('.day-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.selectedDate = card.dataset.date;
        state.selectedTime = null;
        stepTime.classList.remove('hidden');
        generateTimeSlots(dayOfWeek);
        validateForm();
    }

    // paso 3: elegir la hora de la reserva
    function generateTimeSlots(dayOfWeek) {
        middaySlots.innerHTML = '';
        eveningSlots.innerHTML = '';

        // horarios de mediodia (todos los dias menos lunes)
        const middayTimes = ['13:00', '14:00', '15:00'];
        const middayAvailable = dayOfWeek !== 1;

        middayTimes.forEach(time => {
            const slot = document.createElement('div');
            slot.classList.add('time-slot');
            if (!middayAvailable) slot.classList.add('disabled');
            slot.textContent = time;
            slot.dataset.time = time;

            if (middayAvailable) {
                slot.addEventListener('click', () => selectTime(slot));
            }

            middaySlots.appendChild(slot);
        });

        // horarios de noche (tambien todos los dias menos lunes)
        const eveningTimes = ['20:00', '21:00', '22:00', '23:00'];
        const eveningAvailable = dayOfWeek !== 1;

        eveningTimes.forEach(time => {
            const slot = document.createElement('div');
            slot.classList.add('time-slot');
            if (!eveningAvailable) slot.classList.add('disabled');
            slot.textContent = time;
            slot.dataset.time = time;

            if (eveningAvailable) {
                slot.addEventListener('click', () => selectTime(slot));
            }

            eveningSlots.appendChild(slot);
        });
    }

    function selectTime(slot) {
        document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
        slot.classList.add('selected');
        state.selectedTime = slot.dataset.time;
        // Cargamos las mesas ocupadas para esta fecha y hora
        loadOccupiedTables();
        validateForm();
    }

    // Función para cargar las mesas que ya están ocupadas en la fecha/hora seleccionada
    async function loadOccupiedTables() {
        if (!state.selectedDate || !state.selectedTime) {
            state.occupiedTables = [];
            return;
        }

        try {
            console.log(`Cargando mesas ocupadas para ${state.selectedDate} a las ${state.selectedTime}`);
            
            const result = await MesasService.getOcupadas(state.selectedDate, state.selectedTime);
            
            console.log('Resultado completo:', result);
            
            if (result.ok && result.dades) {
                state.occupiedTables = result.dades.ocupadas || [];
                console.log('Mesas marcadas como ocupadas:', state.occupiedTables);
                updateTableVisuals();
            } else {
                console.error('Error en respuesta:', result.dades?.detail || 'Error desconocido');
                state.occupiedTables = [];
            }
        } catch (error) {
            console.error('Error al cargar mesas ocupadas:', error);
            state.occupiedTables = [];
        }
    }

    // Actualiza los estilos visuales de las mesas (rojo para ocupadas)
    function updateTableVisuals() {
        document.querySelectorAll('.table-slot').forEach(table => {
            const tableId = parseInt(table.dataset.id);
            if (state.occupiedTables.includes(tableId)) {
                table.classList.add('occupied');
                table.classList.add('disabled');
            } else {
                table.classList.remove('occupied');
                // Solo removemos 'disabled' si no estaba pre-deshabilitada
                if (!table.classList.contains('was-disabled')) {
                    table.classList.remove('disabled');
                }
            }
        });
    }

    // paso 4: escojer las mesas
    function generateTables() {
        tableMap.innerHTML = '';
        tableMap.classList.add('real-map');
        state.selectedTables = [];

        // Elementos de distribución del salón.
        const roomElements = [
            { className: 'room-block room-main-aisle' },
            { className: 'room-block room-bar-left', text: 'Barra' },
            { className: 'room-door-label', text: 'Puerta' }
        ];

        roomElements.forEach(el => {
            const block = document.createElement('div');
            block.className = el.className;
            if (el.text) {
                block.textContent = el.text;
            }
            tableMap.appendChild(block);
        });

        TABLE_LAYOUT.forEach(item => {
            const table = document.createElement('div');
            table.classList.add('table-slot');
            table.classList.add(`zone-${item.zone}`);
            table.dataset.id = item.id;
            table.style.left = `${item.x}%`;
            table.style.top = `${item.y}%`;

            table.innerHTML = `
                <div class="table-number">${String(item.id).padStart(2, '0')}</div>
            `;

            table.addEventListener('click', () => selectTable(table));
            tableMap.appendChild(table);
        });

        updateTableInstruction();
    }

    function selectTable(table) {
        const tableId = parseInt(table.dataset.id);

        // Impedir seleccionar mesas ocupadas
        if (state.occupiedTables.includes(tableId)) {
            showLuxToast('Esta mesa ya está ocupada en esa fecha y hora', 'error');
            return;
        }

        if (table.classList.contains('selected')) {
            // quitar la mesa si ya estaba seleccionada
            table.classList.remove('selected');
            state.selectedTables = state.selectedTables.filter(id => id !== tableId);
        } else {
            // añadir mesa si no hemos llegado al maximo
            if (state.selectedTables.length < state.maxTables) {
                table.classList.add('selected');
                state.selectedTables.push(tableId);
            }
        }

        updateTableInstruction();
        validateForm();
    }

    // actualizo el texto que dice cuantas mesas faltan
    function updateTableInstruction() {
        const remaining = state.maxTables - state.selectedTables.length;
        if (state.maxTables === 1) {
            tableInstruction.textContent = state.selectedTables.length === 0 
                ? 'Selecciona 1 mesa' 
                : 'Mesa seleccionada';
        } else {
            tableInstruction.textContent = remaining > 0 
                ? `Selecciona ${state.maxTables} mesas (faltan ${remaining})` 
                : `Has seleccionado ${state.maxTables} mesas`;
        }
    }

    // compruebo si estan todos los pasos completos
    function validateForm() {
        const isValid = state.people <= 8 
            && state.selectedDate 
            && state.selectedTime 
            && state.selectedTables.length === state.maxTables;

        btnConfirm.disabled = !isValid;
    }

    function resetReservationForm() {
        state.people = 2;
        state.selectedDate = null;
        state.selectedTime = null;
        state.selectedTables = [];
        state.maxTables = 1;
        peopleCount.textContent = '2';
        updatePeopleCount(0);
    }

    btnConfirm.addEventListener('click', async () => {
        if (!btnConfirm.disabled) {
            const email = getSessionEmail();
            const token = getSessionToken();

            if (!email) {
                alert('Necesitas tener sesión iniciada para guardar la reserva.');
                window.location.href = '/pages/login.html';
                return;
            }

            // Validar que ninguna de las mesas seleccionadas esté ocupada (por seguridad)
            const mesasOcupadas = state.selectedTables.filter(id => state.occupiedTables.includes(id));
            if (mesasOcupadas.length > 0) {
                showLuxToast(`Las mesas ${mesasOcupadas.join(', ')} ya no están disponibles. Selecciona otras.`, 'error');
                resetReservationForm();
                generateCalendar();
                generateTables();
                return;
            }

            const reservationDateTime = `${state.selectedDate}T${state.selectedTime}:00`;

            // enviar a la base de datos
            const reservation = {
                people: state.people,
                tables: state.selectedTables,
                user_email: email,
                reservationDatetime: reservationDateTime
            };

            btnConfirm.disabled = true;
            const previousButtonText = btnConfirm.textContent;
            btnConfirm.textContent = 'Guardando...';

            const result = await ReservationService.createReservation(reservation, token);

            btnConfirm.textContent = previousButtonText;

            console.log('Reservation:', reservation);

            if (result.ok) {
                showLuxToast(
                    `Reserva confirmada para ${state.selectedDate} a las ${state.selectedTime}. Mesas: ${state.selectedTables.join(', ')}`,
                    'success',
                    6000
                );
                resetReservationForm();
                return;
            }

            alert(`No se pudo guardar la reserva: ${result.dades?.detail || 'Error desconocido'}`);
            validateForm();
        }
    });

    // inicio todo al cargar la pagina
    updatePeopleCount(0);
    generateCalendar();
    generateTables();
});

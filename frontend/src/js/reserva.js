import { ReservationService, MesasService } from './services/api.js';

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

    // Mapa base del salon
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

    // info de la reserva
    const state = {
        people: 2,
        selectedDate: null,
        selectedTime: null,
        selectedTables: [],
        maxTables: 1,
        occupiedTables: []
    };

    // elementos del html
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

    // Elementos del Popup (Modal)
    const modal = document.getElementById('reservation-modal');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');
    const modalDate = document.getElementById('modal-date');
    const modalTime = document.getElementById('modal-time');
    const modalPeople = document.getElementById('modal-people');
    const modalTable = document.getElementById('modal-table');

    function getSessionEmail() {
        return localStorage.getItem('lux_email') || sessionStorage.getItem('lux_email') || '';
    }

    function getSessionToken() {
        return localStorage.getItem('lux_token') || sessionStorage.getItem('lux_token') || '';
    }

    function formatDateLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // elegir cuanta gente va a venir
    function updatePeopleCount(delta) {
        state.people = Math.max(1, Math.min(20, state.people + delta));
        if (peopleCount) peopleCount.textContent = state.people;
        state.selectedDate = null;
        state.selectedTime = null;
        
        if (state.people <= 4) {
            state.maxTables = 1;
            if (peopleInfo) peopleInfo.textContent = 'Reservarás 1 mesa';
        } else if (state.people <= 6) {
            state.maxTables = 2;
            if (peopleInfo) peopleInfo.textContent = 'Reservarás 2 mesas';
        } else if (state.people <= 8) {
            state.maxTables = 3;
            if (peopleInfo) peopleInfo.textContent = 'Reservarás 3 mesas';
        } else {
            if (peopleInfo) peopleInfo.textContent = 'Por favor, contacta con nosotros para grupos grandes';
        }

        if (state.people > 8) {
            if (stepContact) stepContact.classList.remove('hidden');
            if (stepDate) stepDate.classList.add('hidden');
            if (stepTime) stepTime.classList.add('hidden');
            if (stepTables) stepTables.classList.add('hidden');
        } else {
            if (stepContact) stepContact.classList.add('hidden');
            if (stepDate) stepDate.classList.remove('hidden');
            if (stepTime) stepTime.classList.add('hidden');
            if (stepTables) stepTables.classList.remove('hidden');
            generateCalendar();
            generateTables();
        }

        validateForm();
    }

    const btnInc = document.querySelector('.btn-increment');
    const btnDec = document.querySelector('.btn-decrement');
    if (btnInc) btnInc.addEventListener('click', () => updatePeopleCount(1));
    if (btnDec) btnDec.addEventListener('click', () => updatePeopleCount(-1));

    // calendario para elegir el dia
    function generateCalendar() {
        if (!calendarGrid) return;
        calendarGrid.innerHTML = '';
        const today = new Date();
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            const dayOfWeek = date.getDay();
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
        if (stepTime) stepTime.classList.remove('hidden');
        generateTimeSlots(dayOfWeek);
        validateForm();
    }

    // elegir la hora de la reserva
    function generateTimeSlots(dayOfWeek) {
        if (!middaySlots || !eveningSlots) return;
        middaySlots.innerHTML = '';
        eveningSlots.innerHTML = '';

        const middayTimes = ['13:00', '13:30', '14:00', '14:30', '15:00'];
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

        const eveningTimes = ['20:00', '20:30', '21:00', '21:30', '22:00', '22:30'];
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
        loadOccupiedTables();
        validateForm();
    }

    async function loadOccupiedTables() {
        if (!state.selectedDate || !state.selectedTime) {
            state.occupiedTables = [];
            return;
        }

        try {
            const result = await MesasService.getOcupadas(state.selectedDate, state.selectedTime);
            if (result.ok && result.dades) {
                state.occupiedTables = result.dades.ocupadas || [];
                updateTableVisuals();
            } else {
                state.occupiedTables = [];
            }
        } catch (error) {
            state.occupiedTables = [];
        }
    }
    // cambia el color de las mesas ocupadas y deshabilita su selección
    function updateTableVisuals() {
        document.querySelectorAll('.table-slot').forEach(table => {
            const tableId = parseInt(table.dataset.id);
            if (state.occupiedTables.includes(tableId)) {
                table.classList.add('occupied', 'disabled');
                table.classList.remove('selected');
                state.selectedTables = state.selectedTables.filter(id => id !== tableId);
            } else {
                table.classList.remove('occupied');
                if (!table.classList.contains('was-disabled')) {
                    table.classList.remove('disabled');
                }
            }
        });
        updateTableInstruction();
        validateForm();
    }

    // escojer las mesas
    function generateTables() {
        if (!tableMap) return;
        tableMap.innerHTML = '';
        tableMap.classList.add('real-map');
        state.selectedTables = [];

        const roomElements = [
            { className: 'room-block room-main-aisle' },
            { className: 'room-block room-bar-left', text: 'BARRA' },
            { className: 'room-door-label', text: 'ENTRADA' }
        ];

        roomElements.forEach(el => {
            const block = document.createElement('div');
            block.className = el.className;
            if (el.text) block.textContent = el.text;
            tableMap.appendChild(block);
        });

        TABLE_LAYOUT.forEach(item => {
            const table = document.createElement('div');
            table.className = `table-slot zone-${item.zone}`;
            table.dataset.id = item.id;
            table.style.left = `${item.x}%`;
            table.style.top = `${item.y}%`;

            table.innerHTML = `<div class="table-number">T${item.id}</div>`;
            table.addEventListener('click', () => selectTable(table));
            tableMap.appendChild(table);
        });

        updateTableInstruction();
    }

    function selectTable(table) {
        const tableId = parseInt(table.dataset.id);

        if (state.occupiedTables.includes(tableId)) {
            showLuxToast('Esta mesa ya está ocupada en esa fecha y hora', 'warning');
            return;
        }
        
        if (table.classList.contains('selected')) {
            table.classList.remove('selected');
            state.selectedTables = state.selectedTables.filter(id => id !== tableId);
        } else {
            if (state.selectedTables.length < state.maxTables) {
                table.classList.add('selected');
                state.selectedTables.push(tableId);
            }
        }

        updateTableInstruction();
        validateForm();
    }

    function updateTableInstruction() {
        if (!tableInstruction) return;
        const remaining = state.maxTables - state.selectedTables.length;
        if (state.maxTables === 1) {
            tableInstruction.textContent = state.selectedTables.length === 0 ? 'Selecciona 1 mesa' : 'Mesa seleccionada';
        } else {
            tableInstruction.textContent = remaining > 0 ? `Selecciona ${state.maxTables} mesas (faltan ${remaining})` : `Has seleccionado ${state.maxTables} mesas`;
        }
    }

    function validateForm() {
        if (!btnConfirm) return;
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
        if (peopleCount) peopleCount.textContent = '2';
        updatePeopleCount(0);
        document.querySelectorAll('.day-card, .time-slot, .table-slot').forEach(el => el.classList.remove('selected'));
        if (stepTime) stepTime.classList.add('hidden');
    }

    // Mostra el Popup al hacer click en el primer botón de confirmar
    if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
            if (!btnConfirm.disabled && modal) {
                
                // cambia el formato para mostrar la fecha
                const [year, month, day] = state.selectedDate.split('-');
                const dateObj = new Date(year, month - 1, day);
                const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                
                if (modalDate) modalDate.textContent = dateObj.toLocaleDateString('es-ES', opcionesFecha);
                if (modalTime) modalTime.textContent = state.selectedTime + "H";
                if (modalPeople) modalPeople.textContent = state.people + (state.people > 1 ? " Personas" : " Persona");
                if (modalTable) modalTable.textContent = "Mesa(s): " + state.selectedTables.join(', ');

                // animación del model
                modal.classList.remove('hidden');
                setTimeout(() => modal.classList.add('active'), 10);
            }
        });
    }

    // Cerrar el Popup al hacer click en Cancelar
    if (btnModalCancel) {
        btnModalCancel.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 350);
        });
    }

    // Ejecutar la llamada a la Base de Datos al darle a "Sí, Reservar" per segona vegada
    if (btnModalConfirm) {
        btnModalConfirm.addEventListener('click', async () => {
            const email = getSessionEmail();
            const token = getSessionToken();

            if (!email) {
                showLuxToast('Necesitas iniciar sesión para guardar la reserva.', 'warning');
                setTimeout(() => window.location.href = '../pages/login.html', 2000);
                return;
            }

            // canvia la mesas selecionades a ocupades
            const mesasOcupadas = state.selectedTables.filter(id => state.occupiedTables.includes(id));
            if (mesasOcupadas.length > 0) {
                showLuxToast(`Las mesas ${mesasOcupadas.join(', ')} acaban de ser ocupadas.`, 'error');
                modal.classList.remove('active');
                setTimeout(() => modal.classList.add('hidden'), 350);
                resetReservationForm();
                return;
            }

            const reservationDateTime = `${state.selectedDate}T${state.selectedTime}:00`;
            const reservation = {
                people: state.people,
                tables: state.selectedTables,
                user_email: email,
                reservationDatetime: reservationDateTime
            };

            // Bloquear botones mientras carga
            btnModalConfirm.disabled = true;
            btnModalCancel.disabled = true;
            const previousText = btnModalConfirm.textContent;
            btnModalConfirm.textContent = 'PROCESANDO...';

            try {
                const result = await ReservationService.createReservation(reservation, token);

                if (result.ok) {
                    window.location.href = 'confirmacion.html';
                } else {
                    showLuxToast(`Error: ${result.dades?.detail || 'No se pudo guardar la reserva'}`, 'error');
                }
            } catch (error) {
                showLuxToast('Ocurrió un error de conexión.', 'error');
            } finally {
                // Restaurar botones si falla
                btnModalConfirm.disabled = false;
                btnModalCancel.disabled = false;
                btnModalConfirm.textContent = previousText;
            }
        });
    }

    // inicio todo al cargar la pagina
    updatePeopleCount(0);
});
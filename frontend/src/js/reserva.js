// ========================================
// RESERVATION SYSTEM - LUX RESTAURANT
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        people: 2,
        selectedDate: null,
        selectedTime: null,
        selectedTables: [],
        maxTables: 1
    };

    // Elements
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

    // ========================================
    // STEP 1: PEOPLE SELECTOR
    // ========================================
    function updatePeopleCount(delta) {
        state.people = Math.max(1, Math.min(20, state.people + delta));
        peopleCount.textContent = state.people;
        
        // Calculate max tables
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

        // Show/hide contact message for large groups
        if (state.people > 8) {
            stepContact.classList.remove('hidden');
            stepDate.classList.add('hidden');
            stepTime.classList.add('hidden');
            stepTables.classList.add('hidden');
        } else {
            stepContact.classList.add('hidden');
            stepDate.classList.remove('hidden');
            stepTime.classList.remove('hidden');
            stepTables.classList.remove('hidden');
            generateCalendar();
            generateTables();
        }

        validateForm();
    }

    document.querySelector('.btn-increment').addEventListener('click', () => updatePeopleCount(1));
    document.querySelector('.btn-decrement').addEventListener('click', () => updatePeopleCount(-1));

    // ========================================
    // STEP 2: CALENDAR
    // ========================================
    function generateCalendar() {
        calendarGrid.innerHTML = '';
        const today = new Date();
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            const dayOfWeek = date.getDay();
            // Check if restaurant is open (Tuesday-Sunday)
            const isOpen = dayOfWeek !== 1; // closed on Monday

            const card = document.createElement('div');
            card.classList.add('day-card');
            if (!isOpen) card.classList.add('disabled');
            card.dataset.date = date.toISOString().split('T')[0];
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
        generateTimeSlots(dayOfWeek);
        validateForm();
    }

    // ========================================
    // STEP 3: TIME SLOTS
    // ========================================
    function generateTimeSlots(dayOfWeek) {
        middaySlots.innerHTML = '';
        eveningSlots.innerHTML = '';

        // Midday slots: Tue-Sun (all days except Monday)
        const middayTimes = ['13:00', '14:00', '15:00'];
        const middayAvailable = dayOfWeek !== 1; // Open Tue-Sun

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

        // Evening slots: Tue-Sun (all days except Monday)
        const eveningTimes = ['20:00', '21:00', '22:00', '23:00'];
        const eveningAvailable = dayOfWeek !== 1; // Open Tue-Sun

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
        validateForm();
    }

    // ========================================
    // STEP 4: TABLE MAP
    // ========================================
    function generateTables() {
        tableMap.innerHTML = '';
        state.selectedTables = [];

        const totalTables = 12;
        for (let i = 1; i <= totalTables; i++) {
            const table = document.createElement('div');
            table.classList.add('table-slot');
            table.dataset.id = i;

            table.innerHTML = `
                <div class="table-number">Mesa ${i}</div>
                <div class="table-capacity">4 personas</div>
            `;

            table.addEventListener('click', () => selectTable(table));
            tableMap.appendChild(table);
        }

        updateTableInstruction();
    }

    function selectTable(table) {
        const tableId = parseInt(table.dataset.id);

        if (table.classList.contains('selected')) {
            // Deselect
            table.classList.remove('selected');
            state.selectedTables = state.selectedTables.filter(id => id !== tableId);
        } else {
            // Select if not at max
            if (state.selectedTables.length < state.maxTables) {
                table.classList.add('selected');
                state.selectedTables.push(tableId);
            }
        }

        updateTableInstruction();
        validateForm();
    }

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

    // ========================================
    // VALIDATION & CONFIRM
    // ========================================
    function validateForm() {
        const isValid = state.people <= 8 
            && state.selectedDate 
            && state.selectedTime 
            && state.selectedTables.length === state.maxTables;

        btnConfirm.disabled = !isValid;
    }

    btnConfirm.addEventListener('click', () => {
        if (!btnConfirm.disabled) {
            // enviar a la base de datos
            const reservation = {
                people: state.people,
                date: state.selectedDate,
                time: state.selectedTime,
                tables: state.selectedTables
            };

            console.log('Reservation:', reservation);
            alert(`¡Reserva confirmada!\n\nPersonas: ${state.people}\nFecha: ${state.selectedDate}\nHora: ${state.selectedTime}\nMesas: ${state.selectedTables.join(', ')}`);
            
            // Reset form
            state.people = 2;
            state.selectedDate = null;
            state.selectedTime = null;
            state.selectedTables = [];
            state.maxTables = 1;
            
            peopleCount.textContent = '2';
            updatePeopleCount(0);
        }
    });

    // ========================================
    // INITIALIZE
    // ========================================
    updatePeopleCount(0);
    generateCalendar();
    generateTables();
});

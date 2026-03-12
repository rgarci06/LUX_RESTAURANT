// sistema de reservas para el restaurante

document.addEventListener('DOMContentLoaded', () => {
    // aqui guardo toda la info de la reserva
    const state = {
        people: 2,
        selectedDate: null,
        selectedTime: null,
        selectedTables: [],
        maxTables: 1
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

    // paso 1: elegir cuanta gente va a venir
    function updatePeopleCount(delta) {
        state.people = Math.max(1, Math.min(20, state.people + delta));
        peopleCount.textContent = state.people;
        
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
            stepTime.classList.remove('hidden');
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
        validateForm();
    }

    // paso 4: escojer las mesas
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
            
            // reseteo el formulario para otra reserva
            state.people = 2;
            state.selectedDate = null;
            state.selectedTime = null;
            state.selectedTables = [];
            state.maxTables = 1;
            
            peopleCount.textContent = '2';
            updatePeopleCount(0);
        }
    });

    // inicio todo al cargar la pagina
    updatePeopleCount(0);
    generateCalendar();
    generateTables();
});

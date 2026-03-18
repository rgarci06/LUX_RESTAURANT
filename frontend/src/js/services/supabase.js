import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const RESERVATIONS_TABLE = import.meta.env.VITE_SUPABASE_RESERVAS_TABLE || 'reservas';
const RESERVATION_DATETIME_COLUMN = import.meta.env.VITE_SUPABASE_RESERVATION_DATETIME_COLUMN || 'reservation_datetime';

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = isConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const ReservationService = {
    isConfigured,

    async createReservation(reservation) {
        if (!supabase) {
            return {
                ok: false,
                disabled: true,
                error: 'Supabase no configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
            };
        }

        const rows = reservation.tables.map((tableId) => ({
            people: reservation.people,
            tables: tableId,
            user_email: reservation.user_email,
            [RESERVATION_DATETIME_COLUMN]: reservation.reservationDatetime
        }));

        const { data, error } = await supabase
            .from(RESERVATIONS_TABLE)
            .insert(rows)
            .select();

        if (error) {
            return { ok: false, disabled: false, error: error.message };
        }

        return { ok: true, disabled: false, data };
    }
};

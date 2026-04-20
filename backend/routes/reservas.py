from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from supabase import Client, create_client

from main import (
    SUPABASE_KEY,
    SUPABASE_RESERVATIONS_TABLE,
    SUPABASE_RESERVATION_DATETIME_COLUMN,
    SUPABASE_USER_EMAIL_COLUMN,
    SUPABASE_USER_ID_COLUMN,
    SUPABASE_URL,
    enviar_correo_reserva,
    extract_bearer_token,
    extract_user_id_from_jwt,
    parse_iso_datetime,
    supabase,
)

router = APIRouter()


class ReservaPayload(BaseModel):
    people: int
    tables: list[int]
    user_email: str
    reservationDatetime: str


@router.post("/api/reservas")
def crear_reserva(reserva: ReservaPayload, authorization: str | None = Header(default=None)):
    try:
        token = extract_bearer_token(authorization)
        if not token:
            raise HTTPException(status_code=401, detail="Necesitas iniciar sesion para crear una reserva")

        if not reserva.tables:
            raise HTTPException(status_code=400, detail="Debes seleccionar al menos una mesa")

        auth_user_id = extract_user_id_from_jwt(token)
        if not auth_user_id:
            raise HTTPException(status_code=401, detail="No se pudo validar tu sesion")

        rows = [
            {
                "people": reserva.people,
                "tables": table_id,
                SUPABASE_USER_ID_COLUMN: auth_user_id,
                SUPABASE_RESERVATION_DATETIME_COLUMN: reserva.reservationDatetime,
                **({SUPABASE_USER_EMAIL_COLUMN: reserva.user_email} if SUPABASE_USER_EMAIL_COLUMN else {}),
            }
            for table_id in reserva.tables
        ]

        request_supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        request_supabase.postgrest.auth(token)

        respuesta = request_supabase.table(SUPABASE_RESERVATIONS_TABLE).insert(rows).execute()

        try:
            ids_insertados = [str(fila["id"]) for fila in respuesta.data]
            ids_string = ",".join(ids_insertados)

            fecha_reserva, hora_reserva = reserva.reservationDatetime.split("T")
            mesas_string = ", ".join([f"T{mesa}" for mesa in reserva.tables])

            enviar_correo_reserva(
                email_cliente=reserva.user_email,
                fecha=fecha_reserva,
                hora=hora_reserva,
                personas=reserva.people,
                mesas=mesas_string,
                ids_reserva=ids_string,
            )
        except Exception as e_correo:
            print(f"Error procesando datos para el correo: {e_correo}")

        return {"ok": True, "data": respuesta.data}
    except HTTPException:
        raise
    except Exception as e:
        error_text = str(e)
        normalized_error = error_text.lower()

        if (
            "jwt expired" in normalized_error
            or "pgrst303" in normalized_error
            or "invalid jwt" in normalized_error
            or "token is malformed" in normalized_error
            or "unable to parse or verify signature" in normalized_error
        ):
            raise HTTPException(
                status_code=401,
                detail="Tu sesion ha expirado. Inicia sesion de nuevo para reservar.",
            )

        if "row-level security policy" in normalized_error or "42501" in error_text:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Supabase esta bloqueando el insert por RLS. Crea una policy INSERT en la tabla reservas "
                    "para el rol authenticated y valida user_id = auth.uid()."
                ),
            )

        raise HTTPException(status_code=400, detail=f"No se pudo guardar la reserva: {error_text}")


@router.get("/api/cancelar-reserva")
def cancelar_reserva(ids: str):
    try:
        lista_ids = [int(id_mesa.strip()) for id_mesa in ids.split(",")]
        request_supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        request_supabase.table(SUPABASE_RESERVATIONS_TABLE).delete().in_("id", lista_ids).execute()

        html_content = """
        <html>
            <body style="background:#0a0a0a; color:#fff; text-align:center; padding-top:100px; font-family:'Helvetica Neue', Arial, sans-serif;">
                <h1 style="color:#d4af37; letter-spacing: 4px;">LUX RESTAURANT</h1>
                <div style="border: 1px solid #333; padding: 40px; max-width: 500px; margin: 0 auto; border-radius: 8px; background: #111;">
                    <h2 style="margin-bottom: 20px;">Reserva Cancelada</h2>
                    <p style="color: #ccc; line-height: 1.6;">Tu reserva ha sido anulada correctamente. Las mesas vuelven a estar disponibles.</p>
                    <p style="color: #ccc;">Esperamos poder atenderte en otra ocasión.</p>
                    <a href="http://localhost:5173" style="display: inline-block; margin-top: 30px; color: #d4af37; text-decoration: none; border-bottom: 1px solid #d4af37;">Volver al inicio</a>
                </div>
            </body>
        </html>
        """
        return HTMLResponse(content=html_content, status_code=200)
    except Exception as e:
        return HTMLResponse(content=f"<h1 style='color:red; text-align:center;'>Error al cancelar: {e}</h1>", status_code=400)


@router.get("/api/mesas/disponibles")
def get_mesas_disponibles(fecha: str, hora: str):
    try:
        if not fecha or not hora:
            return {"ok": False, "error": "Falta fecha o hora", "ocupadas": []}

        reservation_datetime = f"{fecha}T{hora}:00"
        dt_busqueda = parse_iso_datetime(reservation_datetime)
        if not dt_busqueda:
            return {"ok": False, "error": "Formato de fecha/hora inválido", "ocupadas": []}

        respuesta = (
            supabase.table(SUPABASE_RESERVATIONS_TABLE)
            .select(f"tables, {SUPABASE_RESERVATION_DATETIME_COLUMN}")
            .execute()
        )

        rows = respuesta.data if isinstance(respuesta.data, list) else []

        ocupadas = []
        for row in rows:
            dt_fila = parse_iso_datetime(row.get(SUPABASE_RESERVATION_DATETIME_COLUMN))

            if (
                dt_fila
                and dt_fila.year == dt_busqueda.year
                and dt_fila.month == dt_busqueda.month
                and dt_fila.day == dt_busqueda.day
                and dt_fila.hour == dt_busqueda.hour
                and dt_fila.minute == dt_busqueda.minute
            ):
                table_id = row.get("tables")
                if table_id is not None and table_id not in ocupadas:
                    ocupadas.append(table_id)

        return {"ok": True, "ocupadas": ocupadas}
    except Exception as e:
        print(f"Error en /api/mesas/disponibles: {str(e)}")
        return {"ok": False, "error": str(e), "ocupadas": []}

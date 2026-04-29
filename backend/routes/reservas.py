from datetime import datetime, timezone
import os
import socket
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
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
    extract_bearer_token,
    extract_user_id_from_jwt,
    parse_iso_datetime,
    supabase,
)

router = APIRouter()


def enviar_correo_reserva(email_cliente, fecha, hora, personas, mesas, ids_reserva):
    # Envia correo de confirmacion de la reserva con enlace de cancelacion usando SMTP.
    remitente = (os.getenv("SMTP_USER") or "garciamagroraul5@gmail.com").strip()
    password = (os.getenv("SMTP_PASSWORD") or "iyxt rqmz jcqu osta").replace(" ", "").strip()

    try:
        smtp_host = socket.gethostbyname("smtp.gmail.com")
    except Exception:
        smtp_host = "smtp.gmail.com"

    msg = MIMEMultipart()
    msg["From"] = f"LUX Restaurant <{remitente}>"
    msg["To"] = email_cliente
    msg["Subject"] = "Tu reserva en LUX está confirmada"

    url_cancelar = f"https://lux-restaurant-six.vercel.app/pages/cancelacion.html?ids={ids_reserva}"

    html = f"""
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111111; color: #ffffff; padding: 50px 30px; text-align: center; border: 1px solid #d4af37; border-radius: 8px;">
        <h1 style="color: #d4af37; letter-spacing: 6px; font-weight: 300; margin-bottom: 5px; text-transform: uppercase;">Lux</h1>
        <h3 style="color: #aaaaaa; letter-spacing: 4px; font-weight: 300; margin-top: 0; margin-bottom: 40px; font-size: 12px; text-transform: uppercase;">Restaurant</h3>

        <h2 style="font-weight: 400; margin-bottom: 20px; color: #ffffff;">Reserva Confirmada!</h2>

        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(212,175,55,0.2); padding: 20px; border-radius: 8px; text-align: left; margin-bottom: 30px;">
            <p style="color: #ccc; margin-bottom: 10px;"><strong>Fecha:</strong> {fecha}</p>
            <p style="color: #ccc; margin-bottom: 10px;"><strong>Hora:</strong> {hora}</p>
            <p style="color: #ccc; margin-bottom: 10px;"><strong>Comensales:</strong> {personas}</p>
            <p style="color: #ccc; margin-bottom: 0;"><strong>Mesa(s):</strong> {mesas}</p>
        </div>

        <p style="color: #cccccc; font-size: 14px; margin-bottom: 30px;">Si surge algun imprevisto, puedes cancelar tu reserva haciendo clic en el boton inferior con hasta 24 horas de antelacion.</p>

        <a href="{url_cancelar}" style="display: inline-block; background-color: transparent; color: #ff4444; border: 1px solid #ff4444; padding: 12px 25px; text-decoration: none; font-weight: bold; font-size: 12px; border-radius: 4px; letter-spacing: 1px;">
            CANCELAR RESERVA
        </a>
    </div>
    """
    msg.attach(MIMEText(html, "html"))

    try:
        server = smtplib.SMTP(smtp_host, 587, timeout=15)
        try:
            server.starttls()
            server.login(remitente, password)
            server.send_message(msg)
        finally:
            server.quit()
        print("Correo de confirmacion enviado a:", email_cliente)
    except Exception as e:
        print("Error al enviar el correo por SMTP 587:", e)
        print(os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD"), "Host resuelto:", smtp_host)  # Debug info
        try:
            server = smtplib.SMTP_SSL(smtp_host, 465, timeout=15)
            try:
                server.login(remitente, password)
                server.send_message(msg)
            finally:
                server.quit()
            print("Correo de confirmacion enviado a:", email_cliente, "usando SMTP_SSL 465")
        except Exception as ssl_error:
            print("Error al enviar el correo por SMTP_SSL 465:", ssl_error)


class ReservaPayload(BaseModel):
    people: int
    tables: list[int]
    user_email: str
    reservationDatetime: str


@router.post("/api/reservas")
def crear_reserva(
    reserva: ReservaPayload,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
):
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

            background_tasks.add_task(
                enviar_correo_reserva,
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
        
        # Conectamos con Supabase
        request_supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        request_supabase.table(SUPABASE_RESERVATIONS_TABLE).delete().in_("id", lista_ids).execute()
        
        # Ahora devolvemos un JSON limpio, no un HTML
        return {"ok": True, "mensaje": "Reserva cancelada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al cancelar: {str(e)}")


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

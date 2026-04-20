"""
CAPA 2: LOGICA DE NEGOCIO (Backend / Servidor)
Archivo principal y utilidades compartidas para routers.
"""

import base64
import json
import os
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib import error as urlerror
from urllib import request as urlrequest

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or os.getenv("SUPABASE_KEY")
SUPABASE_RESERVATIONS_TABLE = os.getenv("SUPABASE_RESERVATIONS_TABLE", "reservas")
SUPABASE_MENU_TABLE = os.getenv("SUPABASE_MENU_TABLE", "menu_items")
SUPABASE_USER_ID_COLUMN = os.getenv("SUPABASE_USER_ID_COLUMN", "user_id").strip()
SUPABASE_USER_EMAIL_COLUMN = os.getenv("SUPABASE_USER_EMAIL_COLUMN", "").strip()
SUPABASE_RESERVATION_DATETIME_COLUMN = os.getenv("SUPABASE_RESERVATION_DATETIME_COLUMN", "reservation_datetime")
SUPABASE_RESERVATION_ID_COLUMN = os.getenv("SUPABASE_RESERVATION_ID_COLUMN", "id").strip()
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "ddelpe@insdanielblanxart.cat").strip().lower()

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Faltan SUPABASE_URL o una clave de Supabase en backend/.env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    return token.strip()


def extract_user_id_from_jwt(token: str) -> str | None:
    """Extrae el claim `sub` (UUID del usuario) desde el payload del JWT."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        payload = parts[1]
        padding = "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload + padding)
        payload_data = json.loads(decoded.decode("utf-8"))
        user_id = payload_data.get("sub")
        if not isinstance(user_id, str) or not user_id:
            return None
        return user_id
    except Exception:
        return None


def decode_jwt_payload(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}

        payload = parts[1]
        padding = "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload + padding)
        payload_data = json.loads(decoded.decode("utf-8"))
        return payload_data if isinstance(payload_data, dict) else {}
    except Exception:
        return {}


def require_admin(authorization: str | None) -> tuple[str, dict]:
    token = extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Necesitas iniciar sesion")

    payload = decode_jwt_payload(token)
    email = str(payload.get("email", "")).strip().lower()
    user_metadata = payload.get("user_metadata") or {}
    app_metadata = payload.get("app_metadata") or {}
    rol = str(user_metadata.get("rol") or app_metadata.get("rol") or "").strip().lower()

    if email != ADMIN_EMAIL and rol != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")

    return token, payload


def require_reservas_manager(authorization: str | None) -> tuple[str, dict]:
    token = extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Necesitas iniciar sesion")

    payload = decode_jwt_payload(token)
    email = str(payload.get("email", "")).strip().lower()
    user_metadata = payload.get("user_metadata") or {}
    app_metadata = payload.get("app_metadata") or {}
    rol = str(user_metadata.get("rol") or app_metadata.get("rol") or "").strip().lower()

    if email == ADMIN_EMAIL or rol in {"admin", "camarero"}:
        return token, payload

    raise HTTPException(status_code=403, detail="No tienes permisos para gestionar reservas")


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        text = str(value).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def admin_rest_request(method: str, path: str, body: dict | None = None) -> dict:
    admin_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY

    if not admin_key:
        raise HTTPException(
            status_code=500,
            detail="Falta una clave de Supabase en backend/.env para usar el panel admin",
        )

    url = f"{SUPABASE_URL}/auth/v1{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urlrequest.Request(url, data=data, method=method)
    req.add_header("apikey", admin_key)
    req.add_header("Authorization", f"Bearer {admin_key}")
    req.add_header("Content-Type", "application/json")

    try:
        with urlrequest.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return {}
            return json.loads(raw)
    except urlerror.HTTPError as e:
        raw = e.read().decode("utf-8") if e.fp else ""
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {"detail": raw}

        payload_text = json.dumps(payload).lower()
        if (
            "valid bearer token" in payload_text
            or "not_admin" in payload_text
            or "permission" in payload_text
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "La clave usada para admin no tiene permisos. "
                    "Configura SUPABASE_SERVICE_ROLE_KEY en backend/.env y reinicia el backend."
                ),
            )

        raise HTTPException(status_code=e.code, detail=payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en llamada admin auth: {e}")


def normalize_menu_item(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "category": str(row.get("category") or "").strip().lower(),
        "name": str(row.get("name") or "").strip(),
        "description": str(row.get("description") or "-").strip() or "-",
        "price": str(row.get("price") or "-").strip() or "-",
        "badge": str(row.get("badge") or "").strip(),
        "sort_order": row.get("sort_order"),
    }


def menu_supabase_client() -> Client:
    menu_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY
    if not menu_key:
        raise HTTPException(status_code=500, detail="Falta la clave de Supabase para leer la carta")

    return create_client(SUPABASE_URL, menu_key)


def enviar_correo_reserva(email_cliente, fecha, hora, personas, mesas, ids_reserva):
    remitente = "garciamagroraul5@gmail.com"
    password = "zqkc ftfn qbjw knab"

    msg = MIMEMultipart()
    msg["From"] = f"LUX Restaurant <{remitente}>"
    msg["To"] = email_cliente
    msg["Subject"] = "Tu reserva en LUX está confirmada"

    url_cancelar = f"http://localhost:8000/api/cancelar-reserva?ids={ids_reserva}"

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
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(remitente, password)
        server.send_message(msg)
        server.quit()
        print("Correo de confirmacion enviado a:", email_cliente)
    except Exception as e:
        print("Error al enviar el correo:", e)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def inici():
    return {"missatge": "Servidor LUX funcionant"}


from routes.admin import router as admin_router
from routes.login import router as login_router
from routes.menu import router as menu_router
from routes.reservas import router as reservas_router

app.include_router(menu_router)
app.include_router(login_router)
app.include_router(reservas_router)
app.include_router(admin_router)

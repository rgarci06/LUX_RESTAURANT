"""
CAPA 2: LÓGICA DE NEGOCIO (Backend / Servidor)
Este código corre en tu ordenador (servidor), no en el navegador del cliente.

QUÉ HACE: Recibe los datos del Frontend, los procesa y decide si son válidos.
SEGURIDAD: Es la única capa que tiene las llaves (API Keys) para hablar con Supabase. 
Nunca dejamos que el Frontend hable con la base de datos por seguridad.
"""

import os
import json
import base64

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

load_dotenv()

app = FastAPI()

# --- BLOC 1: CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite que tanto Localhost como Vercel se conecten
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- BLOC 2: CONNEXIÓ ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SUPABASE_RESERVATIONS_TABLE = os.getenv("SUPABASE_RESERVATIONS_TABLE", "reservas")
SUPABASE_USER_ID_COLUMN = os.getenv("SUPABASE_USER_ID_COLUMN", "user_id").strip()
SUPABASE_USER_EMAIL_COLUMN = os.getenv("SUPABASE_USER_EMAIL_COLUMN", "").strip()
SUPABASE_RESERVATION_DATETIME_COLUMN = os.getenv("SUPABASE_RESERVATION_DATETIME_COLUMN", "reservation_datetime")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Faltan SUPABASE_URL o una clave de Supabase en backend/.env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    return token.strip()


def _extract_user_id_from_jwt(token: str) -> str | None:
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

# --- BLOC 3: MODELS ---
class UsuariLogin(BaseModel):
    email: str
    password: str

class UsuariRegistre(BaseModel):
    email: str
    password: str
    rol: str = "client" # Per defecte, tothom que es registra és "client"

class ReservaPayload(BaseModel):
    people: int
    tables: list[int]
    user_email: str
    reservationDatetime: str

# --- BLOC 4: RUTES ---
@app.get("/")
def inici():
    return {"missatge": "Servidor LUX funcionant"}

@app.post("/api/register")
def registrar(user: UsuariRegistre):
    try:
        # PROFE, MIRA: Guardem el rol a les "metadata" de l'usuari
        respuesta = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
            "options": {
                "data": {
                    "rol": user.rol
                }
            }
        })

        # si el correo ya esta registrado, muestra el error
        user_resp = getattr(respuesta, "user", None)
        identities = getattr(user_resp, "identities", None) if user_resp else None
        if user_resp and isinstance(identities, list) and len(identities) == 0:
            raise HTTPException(status_code=409, detail="El correo ya está registrado")

        return {"missatge": "Usuari creat correctament"}
    except HTTPException:
        raise
    except Exception as e:
        error_text = str(e).lower()
        if "already" in error_text and "register" in error_text:
            raise HTTPException(status_code=409, detail="El correo ya está registrado")
        raise HTTPException(status_code=400, detail="No se pudo completar el registro")

@app.post("/api/login")
def entrar(user: UsuariLogin):
    try:
        respuesta = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        
        # Agafem el rol que tenia guardat l'usuari (si no en té, posem "client")
        rol_usuari = respuesta.user.user_metadata.get("rol", "client")
        
        # Retornem el token I EL ROL al Frontend
        return {
            "token": respuesta.session.access_token,
            "rol": rol_usuari
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Correu o contrasenya incorrectes")

@app.post("/api/reservas")
def crear_reserva(reserva: ReservaPayload, authorization: str | None = Header(default=None)):
    try:
        token = _extract_bearer_token(authorization)
        if not token:
            raise HTTPException(status_code=401, detail="Necesitas iniciar sesion para crear una reserva")

        if not reserva.user_email:
            raise HTTPException(status_code=400, detail="El correo del usuario es obligatorio")

        if not reserva.tables:
            raise HTTPException(status_code=400, detail="Debes seleccionar al menos una mesa")

        # Guardamos el user_id real del usuario autenticado para cumplir la policy RLS.
        auth_user_id = _extract_user_id_from_jwt(token)
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

        respuesta = (
            request_supabase
            .table(SUPABASE_RESERVATIONS_TABLE)
            .insert(rows)
            .execute()
        )

        return {
            "ok": True,
            "data": respuesta.data,
        }
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
                detail="Tu sesion ha expirado. Inicia sesion de nuevo para reservar."
            )

        if "row-level security policy" in normalized_error or "42501" in error_text:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Supabase esta bloqueando el insert por RLS. Crea una policy INSERT en la tabla reservas "
                    "para el rol authenticated y valida user_id = auth.uid()."
                )
            )

        raise HTTPException(status_code=400, detail=f"No se pudo guardar la reserva: {error_text}")
import json
import os
from datetime import datetime, timezone
from urllib import error as urlerror
from urllib import request as urlrequest

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
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
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "lux_access_token").strip() or "lux_access_token"

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Faltan SUPABASE_URL o una clave de Supabase en backend/.env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# Extrae el token del header Authorization.
def extract_bearer_token(authorization: str | None, request: Request | None = None) -> str | None:
    if not authorization:
        if request is not None:
            cookie_token = request.cookies.get(AUTH_COOKIE_NAME)
            if cookie_token:
                return cookie_token.strip()
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    return token.strip()


def _normalize_user_payload(user_obj) -> dict:
    if user_obj is None:
        return {}

    if hasattr(user_obj, "model_dump"):
        dumped = user_obj.model_dump()
        return dumped if isinstance(dumped, dict) else {}

    if isinstance(user_obj, dict):
        return user_obj

    return {}


def get_authenticated_user(authorization: str | None, request: Request | None = None) -> tuple[str, dict]:
    token = extract_bearer_token(authorization, request)
    if not token:
        raise HTTPException(status_code=401, detail="Necesitas iniciar sesion")

    try:
        user_response = supabase.auth.get_user(token)
        user_obj = getattr(user_response, "user", None)
        user_payload = _normalize_user_payload(user_obj)
        if not user_payload.get("id"):
            raise HTTPException(status_code=401, detail="Sesion invalida o expirada")
        return token, user_payload
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion invalida o expirada")


# Valida que el usuario autenticado tenga permisos de administrador.
def require_admin(authorization: str | None, request: Request | None = None) -> tuple[str, dict]:
    token, user_payload = get_authenticated_user(authorization, request)
    user_metadata = user_payload.get("user_metadata") or {}
    app_metadata = user_payload.get("app_metadata") or {}
    rol = str(user_metadata.get("rol") or app_metadata.get("rol") or "").strip().lower()

    if rol != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")

    return token, user_payload


# Valida que el usuario tenga permisos para gestionar reservas (admin o camarero).
def require_reservas_manager(authorization: str | None, request: Request | None = None) -> tuple[str, dict]:
    token, user_payload = get_authenticated_user(authorization, request)
    user_metadata = user_payload.get("user_metadata") or {}
    app_metadata = user_payload.get("app_metadata") or {}
    rol = str(user_metadata.get("rol") or app_metadata.get("rol") or "").strip().lower()

    if rol in {"admin", "camarero"}:
        return token, user_payload

    raise HTTPException(status_code=403, detail="No tienes permisos para gestionar reservas")


# Convierte un texto ISO a datetime en UTC.
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


# Llama a la API Admin de Supabase Auth con la service role key.
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


# Normaliza una fila del menu para devolver un formato estable.
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


# Crea un cliente de Supabase para operaciones de la carta.
def menu_supabase_client() -> Client:
    menu_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY
    if not menu_key:
        raise HTTPException(status_code=500, detail="Falta la clave de Supabase para leer la carta")

    return create_client(SUPABASE_URL, menu_key)


app = FastAPI()

frontend_origins_env = os.getenv("FRONTEND_ORIGINS", "")
if frontend_origins_env.strip():
    FRONTEND_ORIGINS = [origin.strip() for origin in frontend_origins_env.split(",") if origin.strip()]
else:
    FRONTEND_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://lux-restaurant-six.vercel.app",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
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

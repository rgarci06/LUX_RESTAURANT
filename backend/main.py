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
from datetime import datetime, timezone
from urllib import request as urlrequest
from urllib import error as urlerror

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
    allow_origins=["*"], # Ens podem connectar tant des de localhost com des de vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- BLOC 2: CONNEXIÓ ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or os.getenv("SUPABASE_KEY")
SUPABASE_RESERVATIONS_TABLE = os.getenv("SUPABASE_RESERVATIONS_TABLE", "reservas")
SUPABASE_USER_ID_COLUMN = os.getenv("SUPABASE_USER_ID_COLUMN", "user_id").strip()
SUPABASE_USER_EMAIL_COLUMN = os.getenv("SUPABASE_USER_EMAIL_COLUMN", "").strip()
SUPABASE_RESERVATION_DATETIME_COLUMN = os.getenv("SUPABASE_RESERVATION_DATETIME_COLUMN", "reservation_datetime")
SUPABASE_RESERVATION_ID_COLUMN = os.getenv("SUPABASE_RESERVATION_ID_COLUMN", "id").strip()
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "ddelpe@insdanielblanxart.cat").strip().lower()

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


def _decode_jwt_payload(token: str) -> dict:
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


def _require_admin(authorization: str | None) -> tuple[str, dict]:
    # Esta función comprueba que el usuario tenga token y permisos de admin.
    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Necesitas iniciar sesion")

    payload = _decode_jwt_payload(token)
    email = str(payload.get("email", "")).strip().lower()
    user_metadata = payload.get("user_metadata") or {}
    app_metadata = payload.get("app_metadata") or {}
    rol = str(user_metadata.get("rol") or app_metadata.get("rol") or "").strip().lower()

    # Permitimos admin por rol o por correo admin fijo.
    if email != ADMIN_EMAIL and rol != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")

    return token, payload


def _require_reservas_manager(authorization: str | None) -> tuple[str, dict]:
    # Permite gestionar reservas a admin y camarero.
    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Necesitas iniciar sesion")

    payload = _decode_jwt_payload(token)
    email = str(payload.get("email", "")).strip().lower()
    user_metadata = payload.get("user_metadata") or {}
    app_metadata = payload.get("app_metadata") or {}
    rol = str(user_metadata.get("rol") or app_metadata.get("rol") or "").strip().lower()

    if email == ADMIN_EMAIL or rol in {"admin", "camarero", "cambrer"}:
        return token, payload

    raise HTTPException(status_code=403, detail="No tienes permisos para gestionar reservas")


def _parse_iso_datetime(value: str | None) -> datetime | None:
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


def _admin_rest_request(method: str, path: str, body: dict | None = None) -> dict:
    # Esta función llama a la API Admin de Supabase con la service role key.
    admin_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY

    if not admin_key:
        raise HTTPException(
            status_code=500,
            detail="Falta una clave de Supabase en backend/.env para usar el panel admin"
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

        # Mensaje más claro cuando la clave no es service role.
        payload_text = json.dumps(payload).lower()
        if "valid bearer token" in payload_text or "not_admin" in payload_text or "permission" in payload_text:
            raise HTTPException(
                status_code=403,
                detail=(
                    "La clave usada para admin no tiene permisos. "
                    "Configura SUPABASE_SERVICE_ROLE_KEY en backend/.env y reinicia el backend."
                )
            )

        raise HTTPException(status_code=e.code, detail=payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en llamada admin auth: {e}")

# Estructura dels models
class UsuariLogin(BaseModel):
    email: str
    password: str

class UsuariRegistre(BaseModel):
    email: str
    password: str
    rol: str = "client" # Per defecte, tothom que es registra és client

class ReservaPayload(BaseModel):
    people: int
    tables: list[int]
    user_email: str
    reservationDatetime: str


class AdminReservaUpdate(BaseModel):
    people: int | None = None
    reservationDatetime: str | None = None
    tables: int | None = None
    user_email: str | None = None


class AdminReservaGroupUpdate(BaseModel):
    ids: list[str]
    people: int | None = None
    reservationDatetime: str | None = None
    tables: list[int] | None = None


class AdminReservaGroupDelete(BaseModel):
    ids: list[str]


class AdminUserUpdate(BaseModel):
    rol: str

class RecuperarPassword(BaseModel):
    email: str

class ActualizarPassword(BaseModel):
    token: str
    refresh: str
    password: str

# --- BLOC 4: RUTES ---
@app.get("/")
def inici():
    return {"missatge": "Servidor LUX funcionant"}

@app.post("/api/register")
def registrar(user: UsuariRegistre):
    try:
        # Guardem el rol a les "metadata" de l'usuari
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

        if not reserva.tables:
            raise HTTPException(status_code=400, detail="Debes seleccionar al menos una mesa")

        # Guardamos el user_id real del usuario autenticado para cumplir la policy RLS de Supabase
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


@app.get("/api/mesas/disponibles")
def get_mesas_disponibles(fecha: str, hora: str):
    """
    Endpoint para obtener qué mesas están ocupadas en una fecha y hora específica.
    La fecha debe estar en formato YYYY-MM-DD y la hora en formato HH:mm.
    Devuelve una lista de table IDs que YA ESTÁN OCUPADAS.
    """
    try:
        # Validamos que los parámetros no sean vacíos
        if not fecha or not hora:
            return {"ok": False, "error": "Falta fecha o hora", "ocupadas": []}
        
        # Combinamos fecha y hora para crear el datetime de búsqueda: YYYY-MM-DDTHH:mm:00
        reservation_datetime = f"{fecha}T{hora}:00"
        
        # Parseamos la fecha de entrada
        dt_busqueda = _parse_iso_datetime(reservation_datetime)
        if not dt_busqueda:
            return {"ok": False, "error": "Formato de fecha/hora inválido", "ocupadas": []}

        # Obtenemos TODAS las reservas de esa fecha y hora
        respuesta = (
            supabase
            .table(SUPABASE_RESERVATIONS_TABLE)
            .select(f"tables, {SUPABASE_RESERVATION_DATETIME_COLUMN}")
            .execute()
        )

        rows = respuesta.data if isinstance(respuesta.data, list) else []

        # Filtramos en Python para que coincidan EXACTAMENTE en fecha Y hora
        ocupadas = []
        for row in rows:
            dt_fila = _parse_iso_datetime(row.get(SUPABASE_RESERVATION_DATETIME_COLUMN))
            
            # Comparamos año, mes, día, hora Y minuto exactamente
            if (dt_fila and 
                dt_fila.year == dt_busqueda.year and 
                dt_fila.month == dt_busqueda.month and 
                dt_fila.day == dt_busqueda.day and 
                dt_fila.hour == dt_busqueda.hour and
                dt_fila.minute == dt_busqueda.minute):
                
                # La mesa está ocupada en esa fecha/hora
                table_id = row.get("tables")
                if table_id is not None and table_id not in ocupadas:
                    ocupadas.append(table_id)

        return {"ok": True, "ocupadas": ocupadas}
    
    except Exception as e:
        print(f"Error en /api/mesas/disponibles: {str(e)}")
        return {"ok": False, "error": str(e), "ocupadas": []}


@app.get("/api/admin/reservas")
def admin_listar_reservas(authorization: str | None = Header(default=None)):
    try:
        # Admin y camarero pueden ver/gestionar reservas.
        _require_reservas_manager(authorization)
        now_utc = datetime.now(timezone.utc)
        today_start_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)

        respuesta = (
            supabase
            .table(SUPABASE_RESERVATIONS_TABLE)
            .select("*")
            .order(SUPABASE_RESERVATION_DATETIME_COLUMN, desc=True)
            .limit(1000)
            .execute()
        )

        rows = respuesta.data if isinstance(respuesta.data, list) else []
        active_rows = []
        old_ids = []

        for row in rows:
            dt = _parse_iso_datetime(row.get(SUPABASE_RESERVATION_DATETIME_COLUMN))
            row_id = row.get(SUPABASE_RESERVATION_ID_COLUMN)

            # Se consideran activas todas las reservas de hoy en adelante.
            if dt and dt >= today_start_utc:
                active_rows.append(row)
            # Solo marcamos para borrar las que sí tienen fecha válida y son de días pasados.
            elif dt and row_id is not None:
                old_ids.append(row_id)

        # Borrado suave automático de reservas antiguas (si hay id disponible).
        if old_ids:
            try:
                supabase.table(SUPABASE_RESERVATIONS_TABLE).delete().in_(SUPABASE_RESERVATION_ID_COLUMN, old_ids).execute()
            except Exception:
                pass

        active_rows.sort(
            key=lambda r: _parse_iso_datetime(r.get(SUPABASE_RESERVATION_DATETIME_COLUMN)) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=False
        )

        # Para mostrar el email también a camarero sin exponer la tabla de usuarios,
        # resolvemos user_id -> email en backend y lo añadimos al payload de reservas.
        user_ids = {
            str(row.get(SUPABASE_USER_ID_COLUMN)).strip()
            for row in active_rows
            if row.get(SUPABASE_USER_ID_COLUMN)
            and not row.get("user_email")
            and not row.get("userEmail")
        }

        if user_ids:
            try:
                users_response = _admin_rest_request("GET", "/admin/users?page=1&per_page=1000")
                users = users_response.get("users", []) if isinstance(users_response, dict) else []
                email_by_id = {}

                for user in users:
                    if not isinstance(user, dict):
                        continue
                    user_id = str(user.get("id") or "").strip()
                    user_email = str(user.get("email") or "").strip()
                    if user_id and user_email:
                        email_by_id[user_id] = user_email

                for row in active_rows:
                    if row.get("user_email") or row.get("userEmail"):
                        continue
                    uid = str(row.get(SUPABASE_USER_ID_COLUMN) or "").strip()
                    if uid and uid in email_by_id:
                        row["user_email"] = email_by_id[uid]
            except Exception:
                # Si falla la resolución de emails, no rompemos el listado de reservas.
                pass

        return {"ok": True, "data": active_rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudieron cargar reservas: {e}")


@app.patch("/api/admin/reservas/{reservation_id}")
def admin_editar_reserva(reservation_id: str, payload: AdminReservaUpdate, authorization: str | None = Header(default=None)):
    try:
        # Admin y camarero pueden editar reservas.
        _require_reservas_manager(authorization)

        # Solo actualizamos campos que realmente llegan en la petición.
        update_data = {}
        if payload.people is not None:
            update_data["people"] = payload.people
        if payload.reservationDatetime:
            update_data[SUPABASE_RESERVATION_DATETIME_COLUMN] = payload.reservationDatetime
        if payload.tables is not None:
            update_data["tables"] = payload.tables
        if payload.user_email is not None and SUPABASE_USER_EMAIL_COLUMN:
            update_data[SUPABASE_USER_EMAIL_COLUMN] = payload.user_email

        if not update_data:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")

        respuesta = (
            supabase
            .table(SUPABASE_RESERVATIONS_TABLE)
            .update(update_data)
            .eq(SUPABASE_RESERVATION_ID_COLUMN, reservation_id)
            .execute()
        )

        return {"ok": True, "data": respuesta.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo editar la reserva: {e}")


@app.delete("/api/admin/reservas/{reservation_id}")
def admin_eliminar_reserva(reservation_id: str, authorization: str | None = Header(default=None)):
    try:
        # Admin y camarero pueden eliminar reservas.
        _require_reservas_manager(authorization)
        respuesta = (
            supabase
            .table(SUPABASE_RESERVATIONS_TABLE)
            .delete()
            .eq(SUPABASE_RESERVATION_ID_COLUMN, reservation_id)
            .execute()
        )
        return {"ok": True, "data": respuesta.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar la reserva: {e}")


@app.patch("/api/admin/reservas/grupo/update")
def admin_editar_reserva_grupo(payload: AdminReservaGroupUpdate, authorization: str | None = Header(default=None)):
    try:
        _require_reservas_manager(authorization)

        reservation_ids = [str(rid).strip() for rid in payload.ids if str(rid).strip()]
        if not reservation_ids:
            raise HTTPException(status_code=400, detail="Debes enviar al menos un id de reserva")

        update_data = {}
        if payload.people is not None:
            update_data["people"] = payload.people
        if payload.reservationDatetime:
            update_data[SUPABASE_RESERVATION_DATETIME_COLUMN] = payload.reservationDatetime

        rows_response = (
            supabase
            .table(SUPABASE_RESERVATIONS_TABLE)
            .select("*")
            .in_(SUPABASE_RESERVATION_ID_COLUMN, reservation_ids)
            .execute()
        )
        rows = rows_response.data if isinstance(rows_response.data, list) else []

        if not rows:
            raise HTTPException(status_code=404, detail="No se encontraron reservas para editar")

        # Conservamos el orden original de ids para que mesas se reasignen de forma estable.
        by_id = {str(row.get(SUPABASE_RESERVATION_ID_COLUMN)): row for row in rows}
        ordered_rows = [by_id[rid] for rid in reservation_ids if rid in by_id]
        if not ordered_rows:
            ordered_rows = rows

        if payload.tables is None:
            if not update_data:
                raise HTTPException(status_code=400, detail="No hay campos para actualizar")

            respuesta = (
                supabase
                .table(SUPABASE_RESERVATIONS_TABLE)
                .update(update_data)
                .in_(SUPABASE_RESERVATION_ID_COLUMN, reservation_ids)
                .execute()
            )
            return {"ok": True, "data": respuesta.data}

        normalized_tables = []
        seen = set()
        for table_id in payload.tables:
            if table_id is None:
                continue
            table_int = int(table_id)
            if table_int < 1 or table_int in seen:
                continue
            seen.add(table_int)
            normalized_tables.append(table_int)

        if not normalized_tables:
            raise HTTPException(status_code=400, detail="Debes indicar al menos una mesa valida")

        # Reasignamos/actualizamos filas existentes.
        for idx, table_id in enumerate(normalized_tables[:len(ordered_rows)]):
            row = ordered_rows[idx]
            row_id = row.get(SUPABASE_RESERVATION_ID_COLUMN)
            if row_id is None:
                continue

            patch_data = {**update_data, "tables": table_id}
            (
                supabase
                .table(SUPABASE_RESERVATIONS_TABLE)
                .update(patch_data)
                .eq(SUPABASE_RESERVATION_ID_COLUMN, row_id)
                .execute()
            )

        seed = ordered_rows[0]

        # Si hay más mesas nuevas que filas existentes, insertamos las filas que faltan.
        if len(normalized_tables) > len(ordered_rows):
            for table_id in normalized_tables[len(ordered_rows):]:
                insert_data = {
                    "tables": table_id,
                    "people": update_data.get("people", seed.get("people")),
                    SUPABASE_RESERVATION_DATETIME_COLUMN: update_data.get(
                        SUPABASE_RESERVATION_DATETIME_COLUMN,
                        seed.get(SUPABASE_RESERVATION_DATETIME_COLUMN)
                    ),
                    SUPABASE_USER_ID_COLUMN: seed.get(SUPABASE_USER_ID_COLUMN),
                }

                if SUPABASE_USER_EMAIL_COLUMN:
                    insert_data[SUPABASE_USER_EMAIL_COLUMN] = seed.get(SUPABASE_USER_EMAIL_COLUMN)

                (
                    supabase
                    .table(SUPABASE_RESERVATIONS_TABLE)
                    .insert(insert_data)
                    .execute()
                )

        # Si hay menos mesas nuevas que filas existentes, borramos sobrantes.
        if len(normalized_tables) < len(ordered_rows):
            extra_ids = [
                row.get(SUPABASE_RESERVATION_ID_COLUMN)
                for row in ordered_rows[len(normalized_tables):]
                if row.get(SUPABASE_RESERVATION_ID_COLUMN) is not None
            ]

            if extra_ids:
                (
                    supabase
                    .table(SUPABASE_RESERVATIONS_TABLE)
                    .delete()
                    .in_(SUPABASE_RESERVATION_ID_COLUMN, extra_ids)
                    .execute()
                )

        return {"ok": True, "data": {"updated_ids": reservation_ids, "tables": normalized_tables}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo editar la reserva en grupo: {e}")


@app.post("/api/admin/reservas/grupo/delete")
def admin_eliminar_reserva_grupo(payload: AdminReservaGroupDelete, authorization: str | None = Header(default=None)):
    try:
        _require_reservas_manager(authorization)

        reservation_ids = [str(rid).strip() for rid in payload.ids if str(rid).strip()]
        if not reservation_ids:
            raise HTTPException(status_code=400, detail="Debes enviar al menos un id de reserva")

        respuesta = (
            supabase
            .table(SUPABASE_RESERVATIONS_TABLE)
            .delete()
            .in_(SUPABASE_RESERVATION_ID_COLUMN, reservation_ids)
            .execute()
        )

        return {"ok": True, "data": respuesta.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar la reserva en grupo: {e}")


@app.get("/api/admin/users")
def admin_listar_usuarios(authorization: str | None = Header(default=None)):
    try:
        # Validación de admin antes de listar usuarios.
        _require_admin(authorization)
        response = _admin_rest_request("GET", "/admin/users")
        users = response.get("users", []) if isinstance(response, dict) else []

        users = sorted(
            users,
            key=lambda u: (u.get("created_at") if isinstance(u, dict) else getattr(u, "created_at", "")) or "",
            reverse=True,
        )

        # Devolvemos solo lo que necesitas en la tabla: id, email, creado, rol.
        normalized = []
        for u in users:
            if isinstance(u, dict):
                metadata = (u.get("user_metadata") or u.get("raw_user_meta_data") or {})
                normalized.append(
                    {
                        "id": u.get("id"),
                        "email": u.get("email"),
                        "created_at": u.get("created_at"),
                        "rol": (metadata.get("rol") if isinstance(metadata, dict) else None) or "client",
                    }
                )
            else:
                metadata = getattr(u, "user_metadata", {}) or {}
                normalized.append(
                    {
                        "id": getattr(u, "id", None),
                        "email": getattr(u, "email", None),
                        "created_at": getattr(u, "created_at", None),
                        "rol": metadata.get("rol", "client") if isinstance(metadata, dict) else "client",
                    }
                )

        return {"ok": True, "data": normalized}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudieron cargar usuarios: {e}")


@app.patch("/api/admin/users/{user_id}")
def admin_editar_usuario(user_id: str, payload: AdminUserUpdate, authorization: str | None = Header(default=None)):
    try:
        # Validación de admin antes de editar usuario.
        _require_admin(authorization)
        rol = payload.rol.strip().lower()
        if rol == "cambrer":
            rol = "camarero"

        if rol not in {"admin", "client", "camarero"}:
            raise HTTPException(status_code=400, detail="Rol no valido")

        respuesta = _admin_rest_request(
            "PUT",
            f"/admin/users/{user_id}",
            {
                "user_metadata": {
                    "rol": rol
                }
            }
        )

        return {"ok": True, "data": respuesta}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo actualizar el usuario: {e}")


@app.delete("/api/admin/users/{user_id}")
def admin_eliminar_usuario(user_id: str, authorization: str | None = Header(default=None)):
    try:
        # Validación de admin antes de eliminar usuario.
        _require_admin(authorization)
        respuesta = _admin_rest_request("DELETE", f"/admin/users/{user_id}")
        return {"ok": True, "data": respuesta}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar el usuario: {e}")
    
@app.post("/api/recuperar-password")
def pedir_recuperacion(datos: RecuperarPassword):
    try:
        # URL TEMPORAL PARA LOCALHOST (Asegúrate de que el puerto sea el de tu Vite, ej: 5173)
        url_destino = "http://localhost:5173/pages/recovery.html"
        
        supabase.auth.reset_password_email(
            datos.email, 
            options={"redirect_to": url_destino}
        )
        return {"mensaje": "Correo de recuperación enviado."}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Error al enviar el correo: " + str(e))

@app.post("/api/actualizar-password")
def cambiar_password(datos: ActualizarPassword):
    try:
        # A) Iniciamos una sesión temporal usando las dos llaves del correo
        supabase.auth.set_session(datos.token, datos.refresh)
        
        # B) Ahora que Supabase sabe que somos nosotros, actualizamos la clave
        supabase.auth.update_user({"password": datos.password})
        
        # C) Por seguridad, cerramos la sesión justo después
        supabase.auth.sign_out()
        
        return {"mensaje": "Contraseña cambiada con éxito!"}
    except Exception as e:
        # Este print te mostrará el error exacto en la terminal negra de VS Code si falla
        print(f"Error de Supabase: {str(e)}") 
        raise HTTPException(status_code=400, detail="Error al cambiar clave: " + str(e))
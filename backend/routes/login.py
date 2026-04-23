import os

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from main import AUTH_COOKIE_NAME, admin_rest_request, get_authenticated_user, supabase

router = APIRouter()

AUTH_COOKIE_SECURE = (os.getenv("AUTH_COOKIE_SECURE", "false").strip().lower() == "true")
_auth_cookie_samesite_env = os.getenv("AUTH_COOKIE_SAMESITE", "").strip().lower()
AUTH_COOKIE_MAX_AGE_SECONDS = int(os.getenv("AUTH_COOKIE_MAX_AGE_SECONDS", "28800"))


def resolve_cookie_security(request: Request) -> tuple[bool, str]:
    host = (request.url.hostname or "").strip().lower()
    is_local = host in {"localhost", "127.0.0.1"}

    secure = AUTH_COOKIE_SECURE
    if not secure and not is_local and request.url.scheme == "https":
        secure = True

    samesite = _auth_cookie_samesite_env or ("none" if secure else "lax")
    return secure, samesite


def set_auth_cookie(response: Response, request: Request, token: str):
    secure, samesite = resolve_cookie_security(request)
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=AUTH_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )


def clear_auth_cookie(response: Response, request: Request):
    secure, samesite = resolve_cookie_security(request)
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


class UsuariLogin(BaseModel):
    email: str
    password: str


class UsuariRegistre(BaseModel):
    email: str
    password: str
    nombre: str
    apellido: str
    telefono: str


class RecuperarPassword(BaseModel):
    email: str


class ActualizarPassword(BaseModel):
    token: str
    refresh: str
    password: str


@router.post("/api/register")
def registrar(user: UsuariRegistre):
    try:
        nombre = str(user.nombre or "").strip()
        apellido = str(user.apellido or "").strip()
        telefono = str(user.telefono or "").strip()
        rol = "client"

        if not nombre or not apellido or not telefono:
            raise HTTPException(status_code=400, detail="Nombre, apellido y telefono son obligatorios")

        display_name = f"{nombre} {apellido}".strip()

        respuesta = supabase.auth.sign_up(
            {
                "email": user.email,
                "password": user.password,
                "options": {
                    "data": {
                        "rol": rol,
                        "nombre": nombre,
                        "apellido": apellido,
                        "display_name": display_name,
                        "telefono": telefono,
                    }
                },
            }
        )

        user_resp = getattr(respuesta, "user", None)
        user_id = getattr(user_resp, "id", None) if user_resp else None
        if user_id:
            admin_rest_request(
                "PUT",
                f"/admin/users/{user_id}",
                {
                    "phone": telefono,
                    "user_metadata": {
                        "rol": rol,
                        "nombre": nombre,
                        "apellido": apellido,
                        "display_name": display_name,
                        "telefono": telefono,
                    },
                },
            )

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


@router.post("/api/login")
def entrar(user: UsuariLogin, request: Request, response: Response):
    try:
        respuesta = supabase.auth.sign_in_with_password({"email": user.email, "password": user.password})
        set_auth_cookie(response, request, respuesta.session.access_token)
        rol_usuari = respuesta.user.user_metadata.get("rol", "client")
        return {"rol": rol_usuari}
    except Exception:
        raise HTTPException(status_code=401, detail="Correu o contrasenya incorrectes")


@router.get("/api/session")
def session_actual(request: Request):
    try:
        _, user_payload = get_authenticated_user(None, request)
        user_metadata = user_payload.get("user_metadata") or {}
        app_metadata = user_payload.get("app_metadata") or {}
        rol = str(user_metadata.get("rol") or app_metadata.get("rol") or "client").strip().lower() or "client"
        email = str(user_payload.get("email") or "").strip()

        return {
            "ok": True,
            "authenticated": True,
            "user": {
                "id": user_payload.get("id"),
                "email": email,
                "rol": rol,
            },
        }
    except HTTPException:
        return {"ok": True, "authenticated": False, "user": None}
    except Exception:
        return {"ok": True, "authenticated": False, "user": None}


@router.post("/api/logout")
def logout(request: Request, response: Response):
    clear_auth_cookie(response, request)
    return {"ok": True}


@router.post("/api/recuperar-password")
def pedir_recuperacion(datos: RecuperarPassword):
    try:
        url_destino = "http://localhost:5173/pages/recovery.html"
        supabase.auth.reset_password_email(datos.email, options={"redirect_to": url_destino})
        return {"mensaje": "Correo de recuperación enviado."}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Error al enviar el correo: " + str(e))


@router.post("/api/actualizar-password")
def cambiar_password(datos: ActualizarPassword):
    try:
        supabase.auth.set_session(datos.token, datos.refresh)
        supabase.auth.update_user({"password": datos.password})
        supabase.auth.sign_out()
        return {"mensaje": "Contraseña cambiada con éxito!"}
    except Exception as e:
        print(f"Error de Supabase: {str(e)}")
        raise HTTPException(status_code=400, detail="Error al cambiar clave: " + str(e))

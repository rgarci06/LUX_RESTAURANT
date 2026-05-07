import os

from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel

from main import (
    SESSION_COOKIE_NAME,
    admin_rest_request,
    decode_jwt_payload,
    resolve_access_token,
    supabase,
)

router = APIRouter()


class UsuariLogin(BaseModel):
    email: str
    password: str
    remember: bool = False


class UsuariRegistre(BaseModel):
    email: str
    password: str
    nombre: str
    apellido: str
    telefono: str
    rol: str = "client"


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

        if not nombre or not apellido or not telefono:
            raise HTTPException(status_code=400, detail="Nombre, apellido y telefono son obligatorios")

        display_name = f"{nombre} {apellido}".strip()

        respuesta = supabase.auth.sign_up(
            {
                "email": user.email,
                "password": user.password,
                "options": {
                    "data": {
                        "rol": user.rol,
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
                        "rol": user.rol,
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
def entrar(user: UsuariLogin, response: Response):
    try:
        respuesta = supabase.auth.sign_in_with_password({"email": user.email, "password": user.password})
        access_token = str(getattr(respuesta.session, "access_token", "") or "").strip()
        if not access_token:
            raise HTTPException(status_code=401, detail="No se pudo iniciar sesion")

        rol_usuari = respuesta.user.user_metadata.get("rol", "client")

        max_age = 60 * 60 * 24 * 30 if user.remember else None
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=access_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=max_age,
            path="/",
        )

        return {
            "ok": True,
            "email": user.email,
            "rol": rol_usuari,
            "remember": user.remember,
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Correu o contrasenya incorrectes")


@router.get("/api/session")
def get_session(session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)):
    token = resolve_access_token(None, session_token)
    if not token:
        raise HTTPException(status_code=401, detail="No hay sesion activa")

    payload = decode_jwt_payload(token)
    email = str(payload.get("email") or "").strip()
    user_metadata = payload.get("user_metadata") or {}
    app_metadata = payload.get("app_metadata") or {}
    rol = str(user_metadata.get("rol") or app_metadata.get("rol") or "client").strip().lower() or "client"

    if not email:
        raise HTTPException(status_code=401, detail="Sesion invalida")

    return {"ok": True, "email": email, "rol": rol}


@router.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        secure=True,
        samesite="none",
    )
    return {"ok": True, "message": "Sesion cerrada"}


@router.post("/api/recuperar-password")
def pedir_recuperacion(datos: RecuperarPassword):
    try:
        url_destino = "https://lux-restaurant-six.vercel.app/pages/recovery.html"
        supabase.auth.reset_password_email(
            datos.email, 
            options={"redirect_to": url_destino}
        )
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

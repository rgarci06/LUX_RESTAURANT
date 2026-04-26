from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from main import admin_rest_request, supabase

router = APIRouter()


class UsuariLogin(BaseModel):
    email: str
    password: str


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
def entrar(user: UsuariLogin):
    try:
        respuesta = supabase.auth.sign_in_with_password({"email": user.email, "password": user.password})
        rol_usuari = respuesta.user.user_metadata.get("rol", "client")
        return {"token": respuesta.session.access_token, "rol": rol_usuari}
    except Exception:
        raise HTTPException(status_code=401, detail="Correu o contrasenya incorrectes")


@router.post("/api/recuperar-password")
def pedir_recuperacion(datos: RecuperarPassword):
    try:
        url_destino = "https://lux-restaurant.onrender.com/pages/recovery.html"
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

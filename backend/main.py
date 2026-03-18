"""
CAPA 2: LÓGICA DE NEGOCIO (Backend / Servidor)
Este código corre en tu ordenador (servidor), no en el navegador del cliente.

QUÉ HACE: Recibe los datos del Frontend, los procesa y decide si son válidos.
SEGURIDAD: Es la única capa que tiene las llaves (API Keys) para hablar con Supabase. 
Nunca dejamos que el Frontend hable con la base de datos por seguridad.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

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
SUPABASE_URL = "https://mqbxykdsfyjtkpgltsvm.supabase.co"
SUPABASE_KEY = "sb_publishable_sYua2XDzotC1BSKsgTvMQw_zNvWYsYs"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- BLOC 3: MODELS ---
class UsuariLogin(BaseModel):
    email: str
    password: str

class UsuariRegistre(BaseModel):
    email: str
    password: str
    rol: str = "client" # Per defecte, tothom que es registra és "client"

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
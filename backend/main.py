from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

app = FastAPI()

# --- BLOC 1: CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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

# --- BLOC 4: RUTES ---
@app.get("/")
def inici():
    return {"missatge": "Servidor LUX funcionant amb ROLS! 👑"}

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
        return {"missatge": "Usuari creat correctament"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
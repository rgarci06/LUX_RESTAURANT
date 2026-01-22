from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

app = FastAPI()

# Cuando Vercel te dé tu URL (ej: lux-restaurant.vercel.app), ponla aquí:
origins = [
    "http://localhost:5173",
    "https://lux_restaurant.app" 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello": "World"}
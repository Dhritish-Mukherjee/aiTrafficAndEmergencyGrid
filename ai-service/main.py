from fastapi import FastAPI
from dotenv import load_dotenv
import os

# load .env file
load_dotenv()

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

import os
import subprocess
import sys
from pathlib import Path

def crear_entorno_virtual():

    carpeta_actual = Path(__file__).resolve().parent
    ruta_venv = carpeta_actual / "venv"
    subprocess.run([sys.executable, "-m", "venv", str(ruta_venv)], check=True)
    activate = ruta_venv / "Scripts" / "activate.bat" if os.name == "nt" else ruta_venv / "bin" / "activate"
    
    if os.name == "nt":
        os.system(f'start cmd /k "{activate}"')

    else:
        print(f"source {activate}")

    req = carpeta_actual / "requirements.txt"
    
    if req.exists():
        opcion = input("¿Deseas instalar requirements.txt? (s/n): ").lower()
        
        if opcion == "s":
            pip_path = ruta_venv / "Scripts" / "pip.exe" if os.name == "nt" else ruta_venv / "bin" / "pip"
            subprocess.run([str(pip_path), "install", "-r", str(req)], check=True)

if __name__ == "__main__":
    crear_entorno_virtual()

# ACTIVAR ENTORNO: venv\Scripts\activate Powershell: .\venv\Scripts\activate
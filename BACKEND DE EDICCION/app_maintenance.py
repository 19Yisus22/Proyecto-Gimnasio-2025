from flask_cors import CORS
import json
from datetime import datetime
from dotenv import load_dotenv
from passlib.hash import scrypt
from supabase import create_client
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
import os, uuid, secrets, cloudinary, cloudinary.uploader, json
from werkzeug.security import check_password_hash as werkzeug_check
from flask import Flask, request, jsonify, render_template, session, redirect, url_for

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
env_path = os.path.join(BASE_DIR, ".env")

if os.path.exists(env_path):
    load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET
)

app = Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)
CORS(app, supports_credentials=True)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.secret_key = os.getenv("SECRET_KEY", secrets.token_hex(24))
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'ico'}

# FUNCIONANDO COMPLETAMENTE

def allowed_file(filename):
    ext = filename.rsplit(".",1)[-1].lower() if "." in filename else ""
    return ext in ALLOWED_EXTENSIONS

def subir_imagen_cloudinary(base64_img, carpeta):
    res = cloudinary.uploader.upload(base64_img, folder=carpeta)
    return res.get("secure_url", "")

def obtener_id_usuario():
    user = session.get("user")
    if not user:
        return None
    return user.get("id_usuario")

@app.route("/")
def index():
    user = session.get("user")
    return render_template("inicio.html", user=user)

@app.route("/registro", methods=["GET", "POST", "OPTIONS"])
def registro():
    if request.method == "OPTIONS":
        return "", 200
    if request.method == "GET":
        return render_template("registro.html")
    if not request.is_json:
        return jsonify({"ok": False, "error": "Content-Type JSON requerido"}), 415

    data = request.get_json()
    required_fields = ["cedula", "nombre", "apellido", "correo", "contrasena"]
    if not all(data.get(f) for f in required_fields):
        return jsonify({"ok": False, "error": "Todos los campos obligatorios"}), 400

    hashed = scrypt.hash(data["contrasena"])
    default_img = "/static/uploads/default_icon_profile.png"

    rol_res = supabase.table("roles").select("*").eq("nombre_rol", "miembro").maybe_single().execute()
    if not rol_res or not rol_res.data:
        return jsonify({"ok": False, "error": "Rol 'miembro' no encontrado en la base de datos"}), 400

    id_rol = rol_res.data.get("id_rol")

    res = supabase.table("usuarios").insert({
        "cedula": data["cedula"],
        "nombre": data["nombre"],
        "apellido": data["apellido"],
        "genero": data.get("genero", ""),
        "telefono": data.get("telefono", ""),
        "direccion": data.get("direccion", ""),
        "fecha_nacimiento": data.get("fecha_nacimiento", None),
        "correo": data["correo"],
        "contrasena": hashed,
        "metodo_pago": "Efectivo",
        "imagen_url": default_img,
        "id_rol": id_rol
    }).execute()

    if not res.data:
        return jsonify({"ok": False, "error": "No se pudo registrar"}), 400

    session["user"] = {
        "id_usuario": res.data[0]["id_usuario"],
        "nombre": res.data[0]["nombre"],
        "apellido": res.data[0]["apellido"],
        "correo": res.data[0]["correo"],
        "imagen_url": default_img,
        "rol": {"id_rol": id_rol, "nombre_rol": "miembro"}
    }

    return jsonify({"ok": True, "mensaje": "Usuario registrado correctamente", "usuario": res.data}), 201

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html", user=session.get("user"))

    if not request.is_json:
        return jsonify({"ok": False, "error": "Content-Type JSON requerido"}), 415

    data = request.get_json()
    correo = data.get("correo", "").strip().lower()
    contrasena = data.get("contrasena", "")

    if not correo or not contrasena:
        return jsonify({"ok": False, "error": "Correo y contraseña obligatorios"}), 400

    # Buscar usuario en Supabase
    res = supabase.table("usuarios").select("*").eq("correo", correo).maybe_single().execute()
    usuario = res.data

    if not usuario:
        return jsonify({"ok": False, "error": "Correo no registrado"}), 404

    # Verificar contraseña usando passlib scrypt
    if not scrypt.verify(contrasena, usuario.get("contrasena", "")):
        return jsonify({"ok": False, "error": "Contraseña incorrecta"}), 401

    # Obtener rol del usuario
    rol_res = supabase.table("roles").select("*").eq("id_rol", usuario.get("id_rol")).maybe_single().execute()
    rol = rol_res.data if rol_res.data else {"nombre_rol": "visitante"}

    # Guardar datos del usuario en sesión
    session["user"] = {
        "id_usuario": usuario.get("id_usuario"),
        "nombre": usuario.get("nombre"),
        "apellido": usuario.get("apellido"),
        "correo": usuario.get("correo"),
        "imagen_url": usuario.get("imagen_url") or "/static/uploads/default_icon_profile.png",
        "rol": {"id_rol": usuario.get("id_rol"), "nombre_rol": rol.get("nombre_rol")}
    }

    # Mapear redirección según rol
    redirect_map = {
        "miembro": "/index_miembro",
        "entrenador": "/index_entrenador",
        "recepcionista": "/index_recepcionista",
        "nutricionista": "/index_nutricionista",
        "administrador": "/index_admin",
        "visitante": "/"
    }

    return jsonify({"ok": True, "user": session["user"], "redirect": redirect_map.get(rol.get("nombre_rol"), "/")})

@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"ok": True, "redirect": url_for("index")})


# MODULO NUTRICIONISTA

@app.route("/index_nutricionista")
def index_nutricionista():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/nutricionista_modulos_render/<modulo>")
def nutricionista_modulos_render(modulo):
    return render_template(f"nutritionist_modules/{modulo}.html", user=session.get("user"))

# SECCION GESTION USUARIOS

# FUNCIONES APARTADO GESTION USUARIOS / MODULO GESTION USUARIOS - NUTRICIONISTA

@app.route("/api/nutricionista/perfil/buscar", methods=["GET"])
def nutricionista_buscar_miembro():
    q = request.args.get("q", "")
    res = supabase.table("usuarios").select("*").ilike("nombre", f"%{q}%").execute()
    items = [{"id": u["id_usuario"], "name": u["nombre"], "email": u["correo"]} for u in res.data]
    return jsonify({"items": items})

@app.route("/api/nutricionista/perfil/get/<member_id>", methods=["GET"])
def nutricionista_obtener_perfil(member_id):
    usuario_resp = supabase.table("usuarios").select("*").eq("id_usuario", member_id).single().execute()
    usuario = usuario_resp.data
    if not usuario:
        return jsonify({"error": "Miembro no encontrado"}), 404

    progreso_resp = supabase.table("n_progreso_miembro").select("*").eq("id_miembro", member_id).order("fecha", desc=True).execute()
    progreso = progreso_resp.data if progreso_resp.data else []

    objetivos_resp = supabase.table("m_objetivos").select("*").eq("id_miembro", member_id).order("fecha_limite").execute()
    objetivos = objetivos_resp.data if objetivos_resp.data else []

    estado_salud_resp = supabase.table("m_estado_salud").select("*").eq("id_miembro", member_id).order("fecha", desc=True).execute()
    estados_salud = estado_salud_resp.data if estado_salud_resp.data else []

    historial = {
        "fechas": [p["fecha"] for p in progreso],
        "peso": [float(p["peso"]) if p["peso"] is not None else None for p in progreso],
        "grasa": [float(p["grasa_corporal"]) if p["grasa_corporal"] is not None else None for p in progreso],
        "masa_muscular": [float(p["masa_muscular"]) if p["masa_muscular"] is not None else None for p in progreso]
    }

    last_update = progreso[0]["fecha"] if progreso else None

    return jsonify({
        "usuario": {
            "nombre": usuario.get("nombre", ""),
            "apellido": usuario.get("apellido", ""),
            "genero": usuario.get("genero", ""),
            "telefono": usuario.get("telefono", ""),
            "direccion": usuario.get("direccion", ""),
            "cedula": usuario.get("cedula", ""),
            "fecha_nacimiento": usuario.get("fecha_nacimiento", ""),
            "correo": usuario.get("correo", ""),
            "avatar": usuario.get("imagen_url", ""),
            "estado": "Activo"
        },
        "objetivos": objetivos,
        "estados_salud": estados_salud,
        "progreso": progreso,
        "historial": historial,
        "last_update": last_update
    })

@app.route("/api/nutricionista/progreso/registrar", methods=["POST"])
def nutricionista_registrar_progreso():
    data = request.json
    insert_data = {
        "id_miembro": data["id_miembro"],
        "peso": data.get("peso"),
        "grasa_corporal": data.get("grasa_corporal"),
        "masa_muscular": data.get("masa_muscular"),
        "observaciones": data.get("observaciones")
    }
    res = supabase.table("n_progreso_miembro").insert(insert_data).execute()
    return jsonify(res.data)

# SECCION PLAN NUTRICIONAL

# FUNCIONES APARTADO EVALUACION INICIAL / MODULO PLAN NUTRICIONAL - NUTRICIONISTA

@app.route("/api/nutricionista/n_evaluacion_inicial", methods=["POST"])
def n_evaluacion_inicial_crear():
    data = request.json
    insert_data = {
        "id_miembro": data.get("id_miembro"),
        "nombre": data.get("nombre"),
        "edad": data.get("edad"),
        "sexo": data.get("sexo"),
        "peso": data.get("peso"),
        "altura": data.get("altura"),
        "actividad": data.get("actividad"),
        "restricciones": data.get("restricciones")
    }
    res = supabase.table("n_evaluacion_inicial").insert(insert_data).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_evaluacion_inicial/<id_miembro>", methods=["GET"])
def n_evaluacion_inicial_obtener(id_miembro):
    res = supabase.table("n_evaluacion_inicial").select("*").eq("id_miembro", id_miembro).execute()
    return jsonify(res.data)

# SECCION PLAN NUTRICIONAL

# FUNCIONES APARTADO CREAR PLAN / MODULO PLAN NUTRICIONAL - NUTRICIONISTA

@app.route("/api/nutricionista/n_planes_nutricion", methods=["POST"])
def n_planes_nutricion_crear():
    data = request.json
    insert_data = {
        "id_miembro": data.get("id_miembro"),
        "id_nutricionista": data.get("id_nutricionista"),
        "descripcion": data.get("descripcion"),
        "calorias": data.get("calorias"),
        "proteina": data.get("proteina"),
        "grasa": data.get("grasa"),
        "carbohidratos": data.get("carbohidratos"),
        "plantilla": data.get("plantilla"),
        "fecha_inicio": data.get("fecha_inicio"),
        "fecha_fin": data.get("fecha_fin"),
        "feedback": data.get("feedback", ""),
        "recomendaciones": data.get("recomendaciones", "")
    }
    res = supabase.table("n_planes_nutricion").insert(insert_data).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_planes_nutricion/miembro/<id_miembro>", methods=["GET"])
def n_planes_nutricion_por_miembro(id_miembro):
    res = supabase.table("n_planes_nutricion").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=True).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_planes_nutricion", methods=["GET"])
def n_planes_nutricion_todos():
    res = supabase.table("n_planes_nutricion").select("*").order("fecha_creacion", desc=True).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_planes_nutricion/<id_plan>", methods=["PUT"])
def n_planes_nutricion_actualizar(id_plan):
    data = request.json
    update_data = {
        "descripcion": data.get("descripcion"),
        "calorias": data.get("calorias"),
        "proteina": data.get("proteina"),
        "grasa": data.get("grasa"),
        "carbohidratos": data.get("carbohidratos"),
        "plantilla": data.get("plantilla"),
        "fecha_inicio": data.get("fecha_inicio"),
        "fecha_fin": data.get("fecha_fin"),
        "feedback": data.get("feedback"),
        "recomendaciones": data.get("recomendaciones")
    }
    clean = {k: v for k, v in update_data.items() if v is not None}
    res = supabase.table("n_planes_nutricion").update(clean).eq("id_plan", id_plan).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_planes_nutricion/<id_plan>", methods=["DELETE"])
def n_planes_nutricion_eliminar(id_plan):
    res = supabase.table("n_planes_nutricion").delete().eq("id_plan", id_plan).execute()
    return jsonify(res.data)

# SECCION PLAN NUTRICIONAL

# FUNCIONES APARTADO RESGISTRAR PROGRESO / MODULO PLAN NUTRICIONAL - NUTRICIONISTA

@app.route("/api/nutricionista/n_sesiones_progreso", methods=["POST"])
def n_sesiones_progreso_crear():
    data = request.json
    insert_data = {
        "id_plan": data.get("id_plan"),
        "id_miembro": data.get("id_miembro"),
        "fecha": data.get("fecha"),
        "hora": data.get("hora"),
        "peso": data.get("peso"),
        "grasa_corporal": data.get("grasa_corporal"),
        "masa_muscular": data.get("masa_muscular"),
        "seguimiento_dieta": data.get("seguimiento_dieta"),
        "observaciones": data.get("observaciones"),
        "notas": data.get("notas"),
        "estado": data.get("estado", "programada")
    }
    res = supabase.table("n_sesiones_progreso").insert(insert_data).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_sesiones_progreso/miembro/<id_miembro>", methods=["GET"])
def n_sesiones_progreso_por_miembro(id_miembro):
    res = supabase.table("n_sesiones_progreso").select("*").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_sesiones_progreso", methods=["GET"])
def n_sesiones_progreso_todos():
    res = supabase.table("n_sesiones_progreso").select("*").order("fecha", desc=True).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_sesiones_progreso/<id_sesion>", methods=["PUT"])
def n_sesiones_progreso_actualizar(id_sesion):
    data = request.json
    update_data = {
        "fecha": data.get("fecha"),
        "hora": data.get("hora"),
        "peso": data.get("peso"),
        "grasa_corporal": data.get("grasa_corporal"),
        "masa_muscular": data.get("masa_muscular"),
        "seguimiento_dieta": data.get("seguimiento_dieta"),
        "observaciones": data.get("observaciones"),
        "notas": data.get("notas"),
        "estado": data.get("estado")
    }
    clean = {k: v for k, v in update_data.items() if v is not None}
    res = supabase.table("n_sesiones_progreso").update(clean).eq("id_sesion", id_sesion).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_sesiones_progreso/<id_sesion>", methods=["DELETE"])
def n_sesiones_progreso_eliminar(id_sesion):
    res = supabase.table("n_sesiones_progreso").delete().eq("id_sesion", id_sesion).execute()
    return jsonify(res.data)

# SECCION PLAN NUTRICIONAL

# FUNCIONES APARTADO CHAT/FEEDBACK / MODULO PLAN NUTRICIONAL - NUTRICIONISTA

@app.route("/api/nutricionista/n_chat_nutricion", methods=["POST"])
def n_chat_nutricion_crear():
    try:
        data = request.json
        insert_data = {
            "id_miembro": data.get("id_miembro"),
            "id_nutricionista": data.get("id_nutricionista"),
            "mensaje": data.get("mensaje"),
            "remitente": data.get("remitente")
        }
        res = supabase.table("n_chat_nutricion").insert(insert_data).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/nutricionista/n_chat_nutricion/miembro/<id_miembro>", methods=["GET"])
def n_chat_por_miembro(id_miembro):
    try:
        res = supabase.table("n_chat_nutricion").select("*").eq("id_miembro", id_miembro).order("fecha_hora", desc=False).execute()
        return jsonify(res.data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# SECCION PLAN NUTRICIONAL

# FUNCIONES APARTADO CREAR INGESTA / MODULO PLAN NUTRICIONAL - NUTRICIONISTA
    
@app.route("/api/nutricionista/n_ingesta", methods=["POST"])
def n_ingesta_crear():
    data = request.json
    insert_data = {
        "id_miembro": data.get("id_miembro"),
        "id_plan": data.get("id_plan"),
        "fecha": data.get("fecha"),
        "alimento": data.get("alimento"),
        "cantidad": data.get("cantidad"),
        "calorias": data.get("calorias"),
        "proteina": data.get("proteina"),
        "grasa": data.get("grasa"),
        "carbohidratos": data.get("carbohidratos")
    }
    res = supabase.table("n_ingesta").insert(insert_data).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_ingesta/miembro/<id_miembro>", methods=["GET"])
def n_ingesta_por_miembro(id_miembro):
    res = supabase.table("n_ingesta").select("*").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/n_ingesta/<id_ingesta>", methods=["DELETE"])
def n_ingesta_eliminar(id_ingesta):
    res = supabase.table("n_ingesta").delete().eq("id_ingesta", id_ingesta).execute()
    return jsonify(res.data)

# SECCION PLAN NUTRICIONAL

# FUNCIONES APARTADO CREAR PROGRESO / MODULO PLAN NUTRICIONAL - NUTRICIONISTA

@app.route("/api/nutricionista/progreso/registrar", methods=["POST"])
def n_progreso_registrar():
    data = request.json
    insert_data = {
        "id_miembro": data.get("id_miembro"),
        "fecha": data.get("fecha"),
        "peso": data.get("peso"),
        "grasa_corporal": data.get("grasa_corporal"),
        "masa_muscular": data.get("masa_muscular"),
        "seguimiento_dieta": data.get("seguimiento_dieta"),
        "observaciones": data.get("observaciones")
    }
    res = supabase.table("n_progreso_miembro").insert(insert_data).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/progreso/listar/<id_miembro>", methods=["GET"])
def n_progreso_listar(id_miembro):
    res = supabase.table("n_progreso_miembro").select("*").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    return jsonify(res.data)







@app.route("/api/nutricionista/documentos", methods=["POST"])
def n_documentos_crear():
    data = request.json
    insert_data = {
        "id_miembro": data.get("id_miembro"),
        "nombre": data.get("nombre"),
        "url": data.get("url")
    }
    res = supabase.table("n_documentos_medicos").insert(insert_data).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/documentos/miembro/<id_miembro>", methods=["GET"])
def n_documentos_por_miembro(id_miembro):
    res = supabase.table("n_documentos_medicos").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=True).execute()
    return jsonify(res.data)

@app.route("/api/nutricionista/documentos/<id_imagen>", methods=["DELETE"])
def n_documentos_eliminar(id_imagen):
    res = supabase.table("n_documentos_medicos").delete().eq("id_imagen", id_imagen).execute()
    return jsonify(res.data)













# APP RUN

if __name__=="__main__":
    app.run(debug=True, port=3000)

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
DATE_FORMAT = "%Y-%m-%d"

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

# MODULOS MIEMBROS

@app.route("/index_miembro")
def index_miembro():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/miembros_modulos_render/<modulo>")
def miembros_modulos_render(modulo):
    return render_template(f"member_modules/{modulo}.html", user=session.get("user"))

# SECCION CLASES

# FUNCIONES APARTADO CLASES / MODULO CLASES RESERVAS - MIEMBRO (ARREGLAR BOTON RESERVAS)

@app.route("/api/miembros_entrenamientos", methods=["GET"])
def miembros_entrenamientos_listar():
    id_miembro = obtener_id_usuario()
    if not id_miembro:
        return jsonify({"ok": False, "message": "Usuario no autenticado"}), 401
    data = supabase.table("m_entrenamientos_personales").select("*").eq("id_miembro", id_miembro).execute()
    return jsonify({"ok": True, "data": data.data})

@app.route("/api/miembros_entrenamientos", methods=["POST"])
def miembros_entrenamientos_crear():
    body = request.json
    id_miembro = obtener_id_usuario()
    if not id_miembro:
        return jsonify({"ok": False, "message": "Usuario no autenticado"}), 401
    nuevo = {
        "id_miembro": id_miembro,
        "id_entrenador": body.get("id_entrenador"),
        "descripcion": body.get("descripcion"),
        "duracion_semanas": body.get("duracion_semanas"),
        "sesiones_semana": body.get("sesiones_semana"),
        "nivel": body.get("nivel", "principiante")
    }
    resp = supabase.table("m_entrenamientos_personales").insert(nuevo).execute()
    return jsonify({"ok": True, "data": resp.data})

@app.route("/api/miembros_entrenamientos/<id_entrenamiento>", methods=["PUT"])
def miembros_entrenamientos_actualizar(id_entrenamiento):
    body = request.json
    resp = supabase.table("m_entrenamientos_personales").update(body).eq("id_entrenamiento", id_entrenamiento).execute()
    return jsonify({"ok": True, "data": resp.data})

@app.route("/api/miembros_entrenamientos/<id_entrenamiento>", methods=["DELETE"])
def miembros_entrenamientos_borrar(id_entrenamiento):
    resp = supabase.table("m_entrenamientos_personales").delete().eq("id_entrenamiento", id_entrenamiento).execute()
    return jsonify({"ok": True, "data": resp.data})

# SECCION CLASES Y RESERVAS

# FUNCIONES APARTADO RESERVAS / MODULO CLASES RESERVAS - MIEMBRO

@app.route("/api/miembros/reservas", methods=["GET"])
def miembros_reservas():
    clases = supabase.table("a_gestion_clases").select("*").order("horario_inicio").execute()
    clases_data = []
    for c in clases.data:
        nombre_instructor = "Sin asignar"
        if c.get("instructor_id"):
            instructor = supabase.table("usuarios").select("nombre,apellido").eq("id_usuario", c["instructor_id"]).maybe_single().execute()
            if instructor.data:
                nombre_instructor = f"{instructor.data['nombre']} {instructor.data['apellido']}"
        reservas = supabase.table("m_reservas").select("*").eq("id_clase", c["id_clase"]).eq("estado", "reservada").execute()
        ocupados = len(reservas.data if reservas.data else [])
        total = c.get("capacidad_max", 0)
        clases_data.append({
            "id_clase": str(c["id_clase"]),
            "tipo_clase": c["tipo_clase"],
            "instructor": nombre_instructor,
            "horario": f"{c['horario_inicio'][:-3]} - {c['horario_fin'][:-3]}",
            "fecha": c.get("fecha"),
            "capacidad_max": total,
            "ocupados": ocupados,
            "cupos_disponibles": f"{ocupados}/{total}"
        })
    return jsonify({"ok": True, "clases": clases_data})

@app.route('/api/miembros/reservas_crear', methods=['POST'])
def miembros_reservas_crear():
    data = request.get_json()
    id_miembro = data.get("id_miembro")
    id_clase = data.get("id_clase")

    if not id_miembro or not id_clase:
        return jsonify({"error": "id_miembro y id_clase son obligatorios"}), 400

    try:
        existe_res = supabase.table("m_reservas").select("*").eq("id_miembro", id_miembro).eq("id_clase", id_clase).execute()
    except Exception as e:
        return jsonify({"error": "Error verificando reserva existente", "detalle": str(e)}), 500

    if existe_res is None or getattr(existe_res, "data", None) is None:
        return jsonify({"error": "Error inesperado consultando reservas"}), 500

    if len(existe_res.data) > 0:
        return jsonify({"error": "La reserva ya existe"}), 400

    try:
        nueva_res = supabase.table("m_reservas").insert({
            "id_miembro": id_miembro,
            "id_clase": id_clase
        }).execute()
    except Exception as e:
        return jsonify({"error": "Error creando la reserva", "detalle": str(e)}), 500

    if nueva_res is None or getattr(nueva_res, "data", None) is None:
        return jsonify({"error": "Error inesperado creando reserva"}), 500

    return jsonify({"mensaje": "Reserva creada exitosamente"}), 201

@app.route("/api/miembros/mis_reservas", methods=["GET"])
def miembros_mis_reservas():
    id_miembro = obtener_id_usuario()
    if not id_miembro:
        return jsonify({"ok": False, "message": "Usuario no autenticado"}), 401
    reservas = supabase.table("m_reservas").select("*").eq("id_miembro", id_miembro).execute()
    clases_reservadas = []
    for r in reservas.data:
        clase = supabase.table("a_gestion_clases").select("*").eq("id_clase", r["id_clase"]).maybe_single().execute()
        if not clase.data:
            continue
        c = clase.data
        nombre_instructor = "Sin asignar"
        if c.get("instructor_id"):
            instructor = supabase.table("usuarios").select("nombre,apellido").eq("id_usuario", c["instructor_id"]).maybe_single().execute()
            if instructor.data:
                nombre_instructor = f"{instructor.data['nombre']} {instructor.data['apellido']}"
        reservas_clase = supabase.table("m_reservas").select("*").eq("id_clase", c["id_clase"]).eq("estado", "reservada").execute()
        ocupados = len(reservas_clase.data if reservas_clase.data else [])
        total = c.get("capacidad_max", 0)
        clases_reservadas.append({
            "id_reserva": r["id_reserva"],
            "id_clase": c["id_clase"],
            "tipo_clase": c["tipo_clase"],
            "instructor": nombre_instructor,
            "horario": f"{c['horario_inicio'][:-3]} - {c['horario_fin'][:-3]}",
            "estado": r.get("estado", "reservada"),
            "cupos_disponibles": f"{ocupados}/{total}"
        })
    return jsonify({"ok": True, "clases": clases_reservadas})

@app.route("/api/miembros/cancelar_reservas/<id_reserva>", methods=["PUT"])
def miembros_reservas_cancelar(id_reserva):
    resp = supabase.table("m_reservas").update({"estado": "cancelada"}).eq("id_reserva", id_reserva).execute()
    return jsonify({"ok": True, "data": resp.data})

@app.route("/api/miembros/completar_reservas/<id_reserva>", methods=["PUT"])
def miembros_reservas_completar(id_reserva):
    resp = supabase.table("m_reservas").update({"estado": "completada"}).eq("id_reserva", id_reserva).execute()
    return jsonify({"ok": True, "data": resp.data})

@app.route("/api/miembros/eliminar_reserva/<id_reserva>", methods=["DELETE"])
def miembros_reservas_eliminar(id_reserva):
    resp = supabase.table("m_reservas").delete().eq("id_reserva", id_reserva).execute()
    return jsonify({"ok": True, "data": resp.data})

# SECCION PROGRESO FISICO

# FUNCIONES APARTADO RESERVAS / MODULO CLASES RESERVAS - MIEMBRO

@app.route("/api/miembros_progreso", methods=["GET"])
def miembros_progreso_listar():
    data = supabase.table("m_progreso").select("*").execute()
    return jsonify({"ok": True, "data": data.data})

@app.route("/api/miembros_objetivos", methods=["GET"])
def miembros_objetivos_listar():
    id_usuario = obtener_id_usuario()
    if not id_usuario:
        return jsonify({"ok": False, "error":"Usuario no autenticado"}), 200
    data = supabase.table("m_objetivos").select("*").eq("id_miembro", id_usuario).execute()
    return jsonify({"ok": True, "data": data.data})

@app.route("/api/miembros_objetivos", methods=["POST"])
def miembros_objetivos_crear():
    id_usuario = obtener_id_usuario()
    if not id_usuario:
        return jsonify({"ok": False, "error":"Usuario no autenticado"}), 200
    body = request.json
    body["id_miembro"] = id_usuario
    resp = supabase.table("m_objetivos").insert(body).execute()
    return jsonify({"ok": True, "data": resp.data})

@app.route("/api/miembros_objetivos/<id_objetivo>", methods=["PUT"])
def miembros_objetivos_actualizar(id_objetivo):
    id_usuario = obtener_id_usuario()
    if not id_usuario:
        return jsonify({"ok": False, "error":"Usuario no autenticado"}), 200
    body = request.json
    resp = supabase.table("m_objetivos").update(body).eq("id_objetivo", id_objetivo).eq("id_miembro", id_usuario).execute()
    return jsonify({"ok": True, "data": resp.data})

@app.route("/api/miembros_objetivos/<id_objetivo>", methods=["DELETE"])
def miembros_objetivos_eliminar(id_objetivo):
    id_usuario = session.get("user", {}).get("id_usuario")
    if not id_usuario: return jsonify({"ok": False, "error":"Usuario no autenticado"}), 401
    resp = supabase.table("m_objetivos").delete().eq("id_objetivo", id_objetivo).eq("id_miembro", id_usuario).execute()
    return jsonify({"ok": True, "data": resp.data})

# SECCION PLAN NUTRICIONAL

# FUNCIONES APARTADO PLAN NUTRICIONAL / MODULO PLAN NUTRICIONAL - MIEMBRO

@app.route("/api/miembros/obtener_progreso", methods=["GET"])
def miembros_obtener_progreso():
    if "id_miembro" not in session:
        return jsonify({"ok": False, "error": "no_autenticado"}), 401
    id_miembro = session["id_miembro"]
    data = supabase.table("m_progreso").select("*").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    return jsonify({"ok": True, "data": data.data})

@app.route("/api/miembros/registrar_peso", methods=["POST"])
def miembros_registrar_peso():
    if "id_miembro" not in session:
        return jsonify({"ok": False, "error": "no_autenticado"}), 401
    id_miembro = session["id_miembro"]
    datos = request.json
    insertar = supabase.table("m_progreso").insert({
        "id_miembro": id_miembro,
        "peso": datos["peso"],
        "objetivo_personal": datos.get("objetivo_personal", "")
    }).execute()
    return jsonify({"ok": True, "data": insertar.data})

@app.route("/api/miembros/obtener_objetivo", methods=["GET"])
def miembros_obtener_objetivo():
    if "id_miembro" not in session:
        return jsonify({"ok": False, "error": "no_autenticado"}), 401
    id_miembro = session["id_miembro"]
    data = supabase.table("m_objetivos").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=True).limit(1).execute()
    return jsonify({"ok": True, "data": data.data})

@app.route("/api/miembros/actualizar_objetivo", methods=["POST"])
def miembros_actualizar_objetivo():
    if "id_miembro" not in session:
        return jsonify({"ok": False, "error": "no_autenticado"}), 401
    id_miembro = session["id_miembro"]
    datos = request.json
    actualizar = supabase.table("m_objetivos").insert({
        "id_miembro": id_miembro,
        "descripcion": datos["descripcion"],
        "fecha_limite": datos["fecha_limite"]
    }).execute()
    return jsonify({"ok": True, "data": actualizar.data})

@app.route("/api/miembros/plan_nutricional", methods=["GET"])
def miembros_plan_nutricional():
    if "id_miembro" not in session:
        return jsonify({"ok": False, "error": "no_autenticado"}), 401
    id_miembro = session["id_miembro"]
    progreso = supabase.table("m_progreso").select("*").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    objetivo = supabase.table("m_objetivos").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=True).limit(1).execute()
    return jsonify({
        "ok": True,
        "progreso": progreso.data,
        "objetivo": objetivo.data
    })


############### |FIN MODULO| ###################



# MODULOS ENTRENADOR

@app.route("/index_entrenador")
def index_entrenador():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/entrenador_modulos_render/<modulo>")
def entrenador_modulos_render(modulo):
    return render_template(f"trainer_modules/{modulo}.html", user=session.get("user"))

# SECCION GESTION USUARIOS

# FUNCIONES SECCION CALENDARIO / MODULO MIS CLASES - ENTRENADOR

@app.route("/api/entrenador/calendario/crear", methods=["POST"])
def entrenador_crea_recordatorio_calendario():
    data = request.get_json()
    payload = {
        "id_miembro": data["id_miembro"],
        "titulo": data["titulo"],
        "descripcion": data.get("descripcion"),
        "tipo_recordatorio": data.get("tipo_recordatorio"),
        "imagen_url": data.get("imagen_url"),
        "fecha": data.get("fecha"),
        "hora": data.get("hora")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("e_registro_calendario").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/entrenador/calendario/miembro/<id_miembro>", methods=["GET"])
def entrenador_listar_calendario_miembro(id_miembro):
    resp = (
        supabase.table("e_registro_calendario")
        .select("*")
        .eq("id_miembro", id_miembro)
        .order("fecha", desc=True)
        .execute()
    )
    return jsonify(resp.data), 200

@app.route("/api/entrenador/calendario/<id_recordatorio>", methods=["PUT"])
def entrenador_actualiza_recordatorio_calendario(id_recordatorio):
    data = request.get_json()
    payload = {
        "titulo": data.get("titulo"),
        "descripcion": data.get("descripcion"),
        "tipo_recordatorio": data.get("tipo_recordatorio"),
        "imagen_url": data.get("imagen_url"),
        "leida": data.get("leida"),
        "fecha": data.get("fecha"),
        "hora": data.get("hora")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = (
        supabase.table("e_registro_calendario")
        .update(payload)
        .eq("id_recordatorio", id_recordatorio)
        .execute()
    )
    return jsonify(resp.data), 200

@app.route("/api/entrenador/calendario/<id_recordatorio>", methods=["DELETE"])
def entrenador_elimina_recordatorio_calendario(id_recordatorio):
    resp = (
        supabase.table("e_registro_calendario")
        .delete()
        .eq("id_recordatorio", id_recordatorio)
        .execute()
    )
    return jsonify(resp.data), 200

# SECCION RESERVAS

# FUNCIONES SECCCION RESERVAS / MODULO MIS CLASES - ENTRENADOR (ARREGLAR TODO)

@app.route("/api/miembros", methods=["GET"])
def listar_miembros():
    roles = supabase.table("roles").select("id_rol").eq("nombre_rol", "miembro").execute()
    id_rol_miembro = roles.data[0]["id_rol"]
    resp = supabase.table("usuarios").select("*").eq("id_rol", id_rol_miembro).execute()
    return jsonify(resp.data), 200

@app.route("/api/reservas", methods=["POST"])
def crear_reserva():
    data = request.get_json()
    resp = supabase.table("m_reservas").insert({
        "id_miembro": data["id_miembro"],
        "id_clase": data["id_clase"],
        "fecha_reserva": data.get("fecha_reserva"),
        "estado": "reservada",
        "notas": data.get("notas")
    }).execute()
    return jsonify(resp.data), 200

@app.route("/api/reservas", methods=["GET"])
def listar_reservas():
    resp = supabase.table("m_reservas").select("*").execute()
    return jsonify(resp.data), 200

@app.route("/api/reservas/miembro/<id_miembro>", methods=["GET"])
def reservas_por_miembro(id_miembro):
    resp = supabase.table("m_reservas").select("*").eq("id_miembro", id_miembro).execute()
    return jsonify(resp.data), 200

@app.route("/api/reservas/<id_reserva>", methods=["PUT"])
def actualizar_reserva(id_reserva):
    data = request.get_json()
    resp = supabase.table("m_reservas").update(data).eq("id_reserva", id_reserva).execute()
    return jsonify(resp.data), 200

@app.route("/api/reservas/<id_reserva>", methods=["DELETE"])
def eliminar_reserva(id_reserva):
    resp = supabase.table("m_reservas").delete().eq("id_reserva", id_reserva).execute()
    return jsonify(resp.data), 200

# SECCION NOTIFICACIONES

# FUNCIONES SECCION NOTIFICACIONES / MODULO MIS CLASES - ENTRENADOR

@app.route("/api/notificaciones/<id_notificacion>", methods=["PUT"])
def actualizar_notificacion(id_notificacion):
    data = request.get_json()
    payload = {
        "titulo": data.get("titulo"),
        "descripcion": data.get("descripcion"),
        "tipo_notificacion": data.get("tipo_notificacion"),
        "imagen_url": data.get("imagen_url"),
        "leida": data.get("leida")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = (
        supabase.table("m_notificaciones_miembros")
        .update(payload)
        .eq("id_notificacion_miembro", id_notificacion)
        .execute()
    )
    return jsonify(resp.data), 200

@app.route("/api/notificaciones/<id_notificacion>", methods=["DELETE"])
def eliminar_notificacion(id_notificacion):
    resp = (
        supabase.table("m_notificaciones_miembros")
        .delete()
        .eq("id_notificacion_miembro", id_notificacion)
        .execute()
    )
    return jsonify(resp.data), 200

@app.route("/api/progreso", methods=["POST"])
def crear_progreso():
    data = request.get_json()
    payload = {
        "id_miembro": data.get("id_miembro"),
        "fecha": data.get("fecha") or datetime.now().date().isoformat(),
        "peso": data.get("peso"),
        "grasa_corporal": data.get("grasa_corporal"),
        "masa_muscular": data.get("masa_muscular"),
        "calorias_quemadas": data.get("calorias_quemadas"),
        "fuerza": data.get("fuerza"),
        "resistencia": data.get("resistencia"),
        "notas": data.get("notas"),
        "objetivo_personal": data.get("objetivo_personal")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("m_progreso").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/progreso/<id_miembro>", methods=["GET"])
def obtener_progreso(id_miembro):
    resp = (
        supabase.table("m_progreso")
        .select("*")
        .eq("id_miembro", id_miembro)
        .order("fecha", desc=False)
        .execute()
    )
    return jsonify(resp.data), 200

@app.route("/api/progreso/<id_progreso>", methods=["PUT"])
def actualizar_progreso(id_progreso):
    data = request.get_json()
    payload = {
        "fecha": data.get("fecha"),
        "peso": data.get("peso"),
        "grasa_corporal": data.get("grasa_corporal"),
        "masa_muscular": data.get("masa_muscular"),
        "calorias_quemadas": data.get("calorias_quemadas"),
        "fuerza": data.get("fuerza"),
        "resistencia": data.get("resistencia"),
        "notas": data.get("notas"),
        "objetivo_personal": data.get("objetivo_personal")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("m_progreso").update(payload).eq("id_progreso", id_progreso).execute()
    return jsonify(resp.data), 200

@app.route("/api/progreso/<id_progreso>", methods=["DELETE"])
def eliminar_progreso(id_progreso):
    resp = (
        supabase.table("m_progreso")
        .delete()
        .eq("id_progreso", id_progreso)
        .execute()
    )
    return jsonify(resp.data), 200

# SECCION PROGRESO

# FUNCIONES APARTADO PROGRESO / MODULO MIS CLASES CLASES - ENTRENADOR

@app.route("/miembros_progreso")
def entrenador_miembros_progreso():
    miembros_data = supabase.table("usuarios").select(
        "id_usuario,nombre,apellido,roles(nombre_rol),progreso(id_progreso,peso,grasa_corporal,masa_muscular,calorias_quemadas,fuerza,resistencia,fecha,objetivo_personal),entrenamientos_personales!entrenamientos_personales_id_miembro_fkey(id_entrenador)"
    ).eq("roles.nombre_rol", "miembro").execute()

    miembros = []
    for m in miembros_data.data:
        historial = m.get("progreso", [])
        ultimo = max(historial, key=lambda x: x["fecha"], default={})
        entrenador_nombre = ""
        if m.get("entrenamientos_personales"):
            entrenador_id = m["entrenamientos_personales"][0].get("id_entrenador")
            if entrenador_id:
                entrenador_data = supabase.table("usuarios").select("nombre,apellido").eq("id_usuario", entrenador_id).execute()
                if entrenador_data.data:
                    entrenador_nombre = f'{entrenador_data.data[0]["nombre"]} {entrenador_data.data[0]["apellido"]}'
        miembros.append({
            "id": m["id_usuario"],
            "nombre": f'{m["nombre"]} {m["apellido"]}',
            "entrenador": entrenador_nombre,
            "peso": ultimo.get("peso", 0),
            "grasa_corporal": ultimo.get("grasa_corporal", 0),
            "masa_muscular": ultimo.get("masa_muscular", 0),
            "fuerza": ultimo.get("fuerza", 0),
            "resistencia": ultimo.get("resistencia", 0),
            "calorias": ultimo.get("calorias_quemadas", 0),
            "ultima_sesion": ultimo.get("fecha", ""),
            "objetivo_personal": ultimo.get("objetivo_personal", "")
        })
    return jsonify({"ok": True, "miembros": miembros})

@app.route("/entrenadores")
def entrenadores():
    rol_entrenador = supabase.table("roles").select("id_rol").eq("nombre_rol", "Entrenador").execute()
    if not rol_entrenador.data:
        return jsonify({"ok": False, "entrenadores": []})
    id_rol_entrenador = rol_entrenador.data[0]["id_rol"]

    entrenadores_data = supabase.table("usuarios").select("id_usuario,nombre,apellido").eq("id_rol", id_rol_entrenador).execute()
    entrenadores = [
        {"id": e["id_usuario"], "nombre": f'{e["nombre"]} {e["apellido"]}'}
        for e in entrenadores_data.data
    ]
    return jsonify({"ok": True, "entrenadores": entrenadores})

@app.route("/miembro_detalle/<id>")
def entrenador_miembro_detalle(id):
    historial_data = supabase.table("progreso").select(
        "fecha,peso,grasa_corporal,masa_muscular,fuerza,resistencia,calorias_quemadas,objetivo_personal"
    ).eq("id_miembro", id).order("fecha", ascending=True).execute()
    historial = historial_data.data
    if historial:
        for h in historial:
            h["calorias"] = h.pop("calorias_quemadas", 0)
        return jsonify({"ok": True, "historial": historial})
    return jsonify({"ok": False})

# SECCION ENTRENAMIENTOS PERSONALIZADOS

# FUNCIONES APARTADO CARGAR MIEMBROS / MODULO ENTRENAMIENTOS PERSONALIZADOS - ENTRENADOR

@app.route("/api/miembro/<id_miembro>", methods=["GET"])
def entrenador_obtener_info_miembro(id_miembro):
    resp = (
        supabase.table("usuarios")
        .select("*")
        .eq("id_usuario", id_miembro)
        .single()
        .execute()
    )
    return jsonify(resp.data), 200

# SECCION ESTADO SALUD

# FUNCIONES APARTADO ESTADO DE SALUD / MODULO ENTRENAMIENTOS PERSONALIZADOS - ENTRENADOR

@app.route("/api/estado_salud/<id_miembro>", methods=["GET"])
def entrenador_obtener_estado_salud(id_miembro):
    resp = supabase.table("m_estado_salud").select("*").eq("id_miembro", id_miembro).order("fecha", desc=False).execute()
    return jsonify(resp.data), 200

@app.route("/api/estado_salud", methods=["POST"])
def entrenador_crear_estado_salud():
    data = request.get_json()
    payload = {
        "id_estado": str(uuid.uuid4()),
        "id_miembro": data.get("id_miembro"),
        "fecha": data.get("fecha"),
        "hora": data.get("hora"),
        "nota": data.get("nota")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("m_estado_salud").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/estado_salud/<id_estado>", methods=["PUT"])
def entrenador_actualizar_estado_salud(id_estado):
    data = request.get_json()
    payload = {
        "nota": data.get("nota"),
        "fecha": data.get("fecha"),
        "hora": data.get("hora")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("m_estado_salud").update(payload).eq("id_estado", id_estado).execute()
    return jsonify(resp.data), 200

@app.route("/api/estado_salud/<id_estado>", methods=["DELETE"])
def entrenador_eliminar_estado_salud(id_estado):
    resp = supabase.table("m_estado_salud").delete().eq("id_estado", id_estado).execute()
    return jsonify(resp.data), 200

# SECCION PLAN ENTRENAMIENTO

# FUNCIONES APARTADO PLAN ENTRENAMIENTO PERSONALIZADO / MODULO ENTRENAMIENTOS PERSONALIZADOS - ENTRENADOR

@app.route("/api/planes/<id_miembro>", methods=["GET"])
def entrenador_obtener_planes(id_miembro):
    filtro = request.args.get("filtro")
    query = supabase.table("m_entrenamientos_personales").select("*").eq("id_miembro", id_miembro)

    if filtro == "semana":
        query = query.gte("fecha_creacion", (datetime.date.today() - datetime.timedelta(days=7)).isoformat())
    elif filtro == "mes":
        query = query.gte("fecha_creacion", (datetime.date.today() - datetime.timedelta(days=30)).isoformat())
    elif filtro == "6meses":
        query = query.gte("fecha_creacion", (datetime.date.today() - datetime.timedelta(days=180)).isoformat())

    resp = query.order("fecha_creacion", desc=True).execute()
    return jsonify(resp.data), 200

@app.route("/api/planes", methods=["POST"])
def entrenador_crear_plan():
    data = request.get_json()
    payload = {
        "id_entrenamiento": str(uuid.uuid4()),
        "id_miembro": data.get("id_miembro"),
        "id_entrenador": data.get("id_entrenador"),
        "descripcion": data.get("descripcion"),
        "duracion_semanas": data.get("duracion_semanas"),
        "sesiones_semana": data.get("sesiones_semana"),
        "nivel": data.get("nivel")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("m_entrenamientos_personales").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/planes/<id_entrenamiento>", methods=["PUT"])
def entrenador_actualizar_plan(id_entrenamiento):
    data = request.get_json()
    payload = {
        "descripcion": data.get("descripcion"),
        "duracion_semanas": data.get("duracion_semanas"),
        "sesiones_semana": data.get("sesiones_semana"),
        "nivel": data.get("nivel")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("m_entrenamientos_personales").update(payload).eq("id_entrenamiento", id_entrenamiento).execute()
    return jsonify(resp.data), 200

@app.route("/api/planes/<id_entrenamiento>", methods=["DELETE"])
def entrenador_eliminar_plan(id_entrenamiento):
    resp = supabase.table("m_entrenamientos_personales").delete().eq("id_entrenamiento", id_entrenamiento).execute()
    return jsonify(resp.data), 200

# SECCION SEGUIMIENTO O PROGRESO

# FUNCIONES APARTADO SEGUIMIENTO DIARIO / MODULO ENTRENAMIENTOS PERSONALIZADOS - ENTRENADOR

@app.route("/api/progreso/<id_progreso>", methods=["PUT"])
def entrenador_actualizar_progreso(id_progreso):
    data = request.get_json()
    payload = {
        "peso": data.get("peso"),
        "grasa_corporal": data.get("grasa_corporal"),
        "masa_muscular": data.get("masa_muscular"),
        "notas": data.get("notas"),
        "objetivo_personal": data.get("objetivo_personal"),
        "fecha": data.get("fecha")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("progreso").update(payload).eq("id_progreso", id_progreso).execute()
    return jsonify(resp.data), 200

@app.route("/api/progreso/<id_progreso>", methods=["DELETE"])
def entrenador_eliminar_progreso(id_progreso):
    try:
        uuid_obj = uuid.UUID(id_progreso)
    except ValueError:
        return jsonify({"error": "ID inválido"}), 400
    resp = supabase.table("progreso").delete().eq("id_progreso", str(uuid_obj)).execute()
    return jsonify(resp.data), 200

# SECCION FEEDBACK

# FUNCIONES APARTADO FEEDBACK / MODULO ENTRENAMIENTOS PERSONALIZADOS - ENTRENADOR

@app.route("/api/feedback/<id_miembro>", methods=["GET"])
def entrenador_obtener_feedback(id_miembro):
    resp = supabase.table("m_feedback_entrenadores").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=False).execute()
    return jsonify(resp.data), 200

@app.route("/api/feedback", methods=["POST"])
def entrenador_crear_feedback():
    data = request.get_json()
    cal = int(data.get("calificacion", 0))
    if cal < 1 or cal > 5:
        return jsonify({"error": "calificacion invalida"}), 400
    if not data.get("mensaje") or not data.get("mensaje").strip():
        return jsonify({"error": "mensaje requerido"}), 400
    payload = {
        "id_feedback": str(uuid.uuid4()),
        "id_entrenador": data.get("id_entrenador"),
        "id_miembro": data.get("id_miembro"),
        "mensaje": data.get("mensaje"),
        "calificacion": cal
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("m_feedback_entrenadores").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/feedback/<id_feedback>", methods=["PUT"])
def entrenador_actualizar_feedback(id_feedback):
    data = request.get_json()
    cal = int(data.get("calificacion", 0))
    if cal < 1 or cal > 5:
        return jsonify({"error": "calificacion invalida"}), 400
    payload = {
        "mensaje": data.get("mensaje"),
        "calificacion": cal
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("m_feedback_entrenadores").update(payload).eq("id_feedback", id_feedback).execute()
    return jsonify(resp.data), 200

@app.route("/api/feedback/<id_feedback>", methods=["DELETE"])
def entrenador_eliminar_feedback(id_feedback):
    resp = supabase.table("m_feedback_entrenadores").delete().eq("id_feedback", id_feedback).execute()
    return jsonify(resp.data), 200

# FIN MODULO - ENTRENADOR


# MODULO ADMINISTRADOR

@app.route("/index_admin")
def index_admin():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/admin_modulos_render/<modulo>")
def admin_modulos_render(modulo):
    return render_template(f"admin_modules/{modulo}.html", user=session.get("user"))

# SECCION GESTION USUARIOS

# FUNCIONES APARTADO CREAR Y EDITAR USUARIO / MODULO GESTION USUSARIOS - ADMINISTRADOR

@app.route("/usuarios/obtener/<id_usuario>", methods=["GET"])
def obtener_usuario(id_usuario):
    response = supabase.table("usuarios").select("*, roles:roles(id_rol, nombre_rol)").eq("id_usuario", id_usuario).single().execute()
    return jsonify(response.data)

@app.route("/usuarios/listar", methods=["GET"])
def listar_usuarios():
    rol = request.args.get("rol")
    usuarios_query = supabase.table("usuarios").select("*, roles:roles(id_rol, nombre_rol)").execute()
    usuarios = usuarios_query.data
    if rol:
        usuarios = [u for u in usuarios if u.get("roles", {}).get("nombre_rol") == rol]
    return jsonify(usuarios)

@app.route("/usuarios/crear", methods=["POST"])
def crear_usuario():
    data = request.json
    required_fields = ["nombre","apellido","correo","contrasena","cedula","rol"]
    if not all(data.get(f) for f in required_fields):
        return jsonify({"ok": False, "msg": "Faltan datos"}), 400

    rol_nombre = data["rol"]
    rol_resp = supabase.table("roles").select("id_rol").eq("nombre_rol", rol_nombre).maybe_single().execute()
    if not rol_resp.data:
        return jsonify({"ok": False, "msg": "Rol no encontrado"}), 400

    id_rol = rol_resp.data.get("id_rol")
    hashed_password = scrypt.hash(data["contrasena"])
    imagen_url = "/static/uploads/default_icon_profile.png"

    usuario_data = {
        "id_rol": id_rol,
        "imagen_url": imagen_url,
        "nombre": data["nombre"],
        "apellido": data["apellido"],
        "genero": data.get("genero"),
        "telefono": data.get("telefono"),
        "direccion": data.get("direccion"),
        "cedula": data["cedula"],
        "fecha_nacimiento": data.get("fecha_nacimiento"),
        "correo": data["correo"],
        "metodo_pago": data.get("metodo_pago","Efectivo"),
        "contrasena": hashed_password,
        "membresia_activa": data.get("membresia_activa", False)
    }

    response = supabase.table("usuarios").insert(usuario_data).execute()
    if response.data:
        return jsonify({"ok": True, "msg": "Usuario creado correctamente", "usuario": response.data})
    return jsonify({"ok": False, "msg": "Error al crear usuario", "error": response.error}), 400

@app.route("/usuarios/editar/<id_usuario>", methods=["PUT"])
def editar_usuario(id_usuario):
    data = request.json
    if "rol" in data:
        rol_nombre = data.pop("rol")
        rol_resp = supabase.table("roles").select("id_rol").eq("nombre_rol", rol_nombre).execute()
        if rol_resp.data and len(rol_resp.data) > 0:
            data["id_rol"] = rol_resp.data[0]["id_rol"]
    response = supabase.table("usuarios").update(data).eq("id_usuario", id_usuario).execute()
    return jsonify(response.data)

@app.route("/usuarios/eliminar", methods=["DELETE"])
def eliminar_usuario():
    correo = request.json.get("correo")
    response = supabase.table("usuarios").delete().eq("correo", correo).execute()
    return jsonify(response.data)

# SECCION CLASES GENERALES

# FUNCIONES APARTADO CREAR|EDITAR CLASES / MODULO CLASES GENERALES - ADMINISTRADOR

@app.route("/api/admin/entrenadores", methods=["GET"])
def admin_entrenadores():
    rol = supabase.table("roles").select("id_rol").eq("nombre_rol", "entrenador").execute()
    if not rol.data:
        return jsonify({"ok": True, "entrenadores": []})
    
    id_entrenador = rol.data[0]["id_rol"]
    res = supabase.table("usuarios").select("id_usuario,nombre,apellido").eq("id_rol", id_entrenador).execute()
    
    entrenadores = [
        {"id": u["id_usuario"], "nombre": f'{u["nombre"]} {u["apellido"]}'}
        for u in res.data
    ]
    return jsonify({"ok": True, "entrenadores": entrenadores})

@app.route("/api/admin/clases_general", methods=["GET"])
def admin_gestion_clases_general():
    res = supabase.table("a_gestion_clases").select("*").order("horario_inicio", desc=False).execute()
    clases = []
    for c in res.data:
        instr = None
        if c.get("instructor_id"):
            ires = supabase.table("usuarios").select("nombre,apellido").eq("id_usuario", c["instructor_id"]).execute()
            if ires.data:
                instr = f"{ires.data[0]['nombre']} {ires.data[0]['apellido']}"
        clases.append({
            "id_clase": c["id_clase"],
            "nombre": c.get("nombre"),
            "descripcion": c.get("descripcion"),
            "tipo_clase": c.get("tipo_clase"),
            "nivel_dificultad": c.get("nivel_dificultad"),
            "instructor_id": c.get("instructor_id"),
            "instructor_nombre": instr,
            "capacidad_max": c.get("capacidad_max"),
            "horario_inicio": c.get("horario_inicio"),
            "horario_fin": c.get("horario_fin"),
            "sala": c.get("sala"),
            "estado": c.get("estado"),
            "fecha": c.get("fecha"),
            "fecha_creacion": c.get("fecha_creacion")
        })
    return jsonify({"ok": True, "data": clases})

@app.route("/api/admin/clases_general", methods=["POST"])
def admin_gestion_clases_general_post():
    body = request.get_json()
    fecha = body.get("fecha") if body.get("fecha") else None
    nuevo = {
        "nombre": body.get("nombre"),
        "descripcion": body.get("descripcion"),
        "tipo_clase": body.get("tipo_clase"),
        "nivel_dificultad": body.get("nivel_dificultad"),
        "instructor_id": body.get("instructor_id"),
        "capacidad_max": body.get("capacidad_max"),
        "horario_inicio": body.get("horario_inicio"),
        "horario_fin": body.get("horario_fin"),
        "sala": body.get("sala"),
        "estado": body.get("estado"),
        "fecha": fecha
    }
    resp = supabase.table("a_gestion_clases").insert(nuevo).execute()
    return jsonify({"ok": True, "data": resp.data}), 201

@app.route("/api/admin/clases_general/<id_clase>", methods=["PUT"])
def admin_gestion_clases_general_put(id_clase):
    body = request.get_json()
    fecha = body.get("fecha") if body.get("fecha") else None
    update = {
        "nombre": body.get("nombre"),
        "descripcion": body.get("descripcion"),
        "tipo_clase": body.get("tipo_clase"),
        "nivel_dificultad": body.get("nivel_dificultad"),
        "instructor_id": body.get("instructor_id"),
        "capacidad_max": body.get("capacidad_max"),
        "horario_inicio": body.get("horario_inicio"),
        "horario_fin": body.get("horario_fin"),
        "sala": body.get("sala"),
        "estado": body.get("estado"),
        "fecha": fecha
    }
    resp = supabase.table("a_gestion_clases").update(update).eq("id_clase", id_clase).execute()
    return jsonify({"ok": True, "data": resp.data})

@app.route("/api/admin/clases_general/<id_clase>", methods=["DELETE"])
def admin_gestion_clases_general_delete(id_clase):
    resp = supabase.table("a_gestion_clases").delete().eq("id_clase", id_clase).execute()
    return jsonify({"ok": True, "data": resp.data})

# SECCION ANALISIS Y REPORTES

# FUNCIONES APARTADO CREAR|EDITAR USUARIO / MODULO ANALISIS Y REPORTES - ADMINISTRADOR

@app.route("/api/admin/reportes_data", methods=["GET"])
def admin_reportes_data():
    tipo = request.args.get("tipo")
    usuarios_ids = request.args.get("usuarios", "")
    usuarios_ids = [u.strip() for u in usuarios_ids.split(",") if u.strip()]

    labels = []
    valores = []
    detalles = []

    if tipo == "asistencia":
        query = supabase.table("M_Reservas").select("*")
        if usuarios_ids:
            query = query.in_("id_miembro", usuarios_ids)
        reservas = query.execute().data or []
        resumen = {}
        for r in reservas:
            uid = r["id_miembro"]
            resumen[uid] = resumen.get(uid, 0) + 1
            detalles.append({
                "nombre": uid,
                "asistencia": 1,
                "pagos_totales": 0,
                "retencion": 0,
                "satisfaccion": 0,
                "progreso": 0,
                "nutricion": ""
            })
        labels = list(resumen.keys())
        valores = list(resumen.values())

    elif tipo == "progreso":
        query = supabase.table("M_Progreso").select("*")
        if usuarios_ids:
            query = query.in_("id_miembro", usuarios_ids)
        prog_data = query.execute().data or []
        for p in prog_data:
            labels.append(p["fecha"])
            valores.append(p.get("peso", 0))
            detalles.append({
                "nombre": p["id_miembro"],
                "asistencia": 0,
                "pagos_totales": 0,
                "retencion": 0,
                "satisfaccion": 0,
                "progreso": p.get("peso", 0),
                "nutricion": ""
            })

    return jsonify({"labels": labels, "valores": valores, "detalles": detalles})

@app.route("/api/admin/usuarios_buscar")
def admin_usuarios_buscar():
    cedula = request.args.get("cedula")
    resp = supabase.table("Usuarios").select("*").eq("cedula", cedula).execute()
    if resp.data and len(resp.data) > 0:
        return jsonify(resp.data[0])
    return jsonify(None)

@app.route("/api/admin/obtener_reportes", methods=["GET"])
def admin_obtener_reportes():
    tipo = request.args.get("tipo")
    inicio = request.args.get("inicio")
    fin = request.args.get("fin")
    cedula = request.args.get("cedula")
    filtros_usuario = {}
    if cedula:
        resp_user = supabase.table("Usuarios").select("id_usuario").eq("cedula", cedula).single().execute()
        if resp_user.data:
            filtros_usuario["id_miembro"] = resp_user.data["id_usuario"]

    labels = []
    valores = []
    detalles = []

    if tipo == "asistencia":
        query = supabase.table("M_Reservas").select("*")
        if filtros_usuario:
            query = query.eq("id_miembro", filtros_usuario["id_miembro"])
        reservas = query.execute().data or []
        reservas_por_clase = {}
        for r in reservas:
            reservas_por_clase[r["id_clase"]] = reservas_por_clase.get(r["id_clase"], 0) + 1
        labels = list(reservas_por_clase.keys())
        valores = list(reservas_por_clase.values())
        for r in reservas:
            detalles.append({
                "nombre": r["id_miembro"],
                "asistencia": 1,
                "pagos_totales": 0,
                "retencion": 0,
                "satisfaccion": 0,
                "progreso": 0,
                "nutricion": ""
            })

    if tipo == "progreso":
        query = supabase.table("M_Progreso").select("*")
        if filtros_usuario:
            query = query.eq("id_miembro", filtros_usuario["id_miembro"])
        progreso_data = query.execute().data or []
        for p in progreso_data:
            labels.append(p["fecha"])
            valores.append(p.get("peso", 0))
            detalles.append({
                "nombre": filtros_usuario.get("id_miembro"),
                "asistencia": 0,
                "pagos_totales": 0,
                "retencion": 0,
                "satisfaccion": 0,
                "progreso": p.get("peso", 0),
                "nutricion": ""
            })

    return jsonify({"labels": labels, "valores": valores, "detalles": detalles})

@app.route("/api/admin/reportes_comentario", methods=["POST"])
def admin_agregar_comentario():
    data = request.json
    id_usuario = data.get("id_usuario")
    mensaje = data.get("mensaje")
    id_clase = data.get("id_clase")
    calificacion = data.get("calificacion")
    if not id_usuario or not mensaje:
        return jsonify({"ok": False, "msg": "Datos incompletos"}), 400
    resp = supabase.table("M_Feedback_Clases").insert({
        "id_usuario": id_usuario,
        "mensaje": mensaje,
        "id_clase": id_clase,
        "calificacion": calificacion
    }).execute()
    if resp.data:
        return jsonify({"ok": True, "msg": "Comentario agregado correctamente"})
    return jsonify({"ok": False, "msg": "Error al agregar comentario"}), 500

# SECCION SISTEMA PUBLICIDAD

# FUNCIONES APARTADO SISTEMA PUBLICIDAD / MODULO SISTEMA PUBLICIDAD - ADMINISTRADOR

@app.route("/api/admin/notificaciones", methods=["POST"])
def admin_guardar_notificaciones():
    data = request.get_json()
    titulo = data.get("titulo", "")
    descripcion = data.get("descripcion", "")
    imagen_base64 = data.get("imagen_url", "")
    imagen_url = ""

    if imagen_base64:
        imagen_url = subir_imagen_cloudinary(
            imagen_base64,
            "dinamic_img/marketing_gimnasio/notificaciones"
        )

    record = {
        "titulo": titulo,
        "descripcion": descripcion,
        "imagen_url": imagen_url
    }

    supabase.table("a_notificaciones").insert(record).execute()
    fila = supabase.table("a_notificaciones").select("*").order("fecha", desc=True).limit(1).execute()
    return jsonify({"ok": True, "msg": "Notificación creada", "notificacion": fila.data[0]})

@app.route("/api/admin/notificaciones", methods=["GET"])
def admin_obtener_notificaciones():
    resp = supabase.table("a_notificaciones").select("*").order("fecha", desc=True).execute()
    return jsonify(resp.data or [])

@app.route("/api/admin/notificaciones/<id_notificacion>", methods=["DELETE"])
def admin_eliminar_notificacion(id_notificacion):
    supabase.table("a_notificaciones").delete().eq("id_notificacion", id_notificacion).execute()
    return jsonify({"ok": True, "msg": "Notificación eliminada"})

@app.route("/api/admin/notificaciones/<id_notificacion>", methods=["PUT"])
def admin_actualizar_notificacion(id_notificacion):
    data = request.get_json()
    titulo = data.get("titulo", "")
    descripcion = data.get("descripcion", "")
    imagen_base64 = data.get("imagen_url", "")
    imagen_url = ""

    if imagen_base64 and imagen_base64.startswith("data:"):
        imagen_url = subir_imagen_cloudinary(
            imagen_base64,
            "dinamic_img/marketing_gimnasio/notificaciones"
        )
    else:
        imagen_url = data.get("imagen_url_actual", "")

    record = {
        "titulo": titulo,
        "descripcion": descripcion,
        "imagen_url": imagen_url
    }

    supabase.table("a_notificaciones").update(record).eq("id_notificacion", id_notificacion).execute()

    fila = supabase.table("a_notificaciones").select("*").eq("id_notificacion", id_notificacion).limit(1).execute()
    return jsonify({"ok": True, "msg": "Notificación actualizada", "notificacion": fila.data[0]})

@app.route("/api/admin/marketing", methods=["POST"])
def admin_guardar_marketing():
    data = request.get_json()

    info_inicio = data.get("info_inicio", "")
    carrusel = data.get("carrusel", [])
    secciones = data.get("secciones", [])

    final_carrusel = []
    final_secciones = []

    for item in carrusel:
        imagen = item.get("imagen_url", "")

        if imagen.startswith("data:image"):
            imagen = subir_imagen_cloudinary(
                imagen, 
                "dinamic_img/marketing_gimnasio/carrusel"
            )

        final_carrusel.append({
            "imagen_url": imagen,
            "titulo": item.get("titulo", ""),
            "descripcion": item.get("descripcion", "")
        })

    for item in secciones:
        imagen = item.get("imagen_url", "")

        if imagen.startswith("data:image"):
            imagen = subir_imagen_cloudinary(
                imagen, 
                "dinamic_img/marketing_gimnasio/secciones"
            )

        final_secciones.append({
            "imagen_url": imagen,
            "titulo": item.get("titulo", ""),
            "descripcion": item.get("descripcion", "")
        })

    record = {
        "info_inicio": info_inicio,
        "carrusel": final_carrusel,
        "secciones": final_secciones
    }

    resp = supabase.table("a_marketing_sistema").select("*").limit(1).execute()

    if resp.data:
        supabase.table("a_marketing_sistema") \
            .update(record) \
            .eq("id_marketing", resp.data[0]["id_marketing"]) \
            .execute()

        return jsonify({"ok": True, "msg": "Marketing actualizado correctamente"})

    supabase.table("a_marketing_sistema").insert(record).execute()

    return jsonify({"ok": True, "msg": "Marketing guardado correctamente"})

@app.route("/api/admin/inicio/imagenes", methods=["GET"])
def admin_marketing_get():
    resp = supabase.table("a_marketing_sistema").select("*").limit(1).execute()

    if not resp.data:
        return jsonify({
            "info_inicio": "",
            "carrusel": [],
            "secciones": []
        })

    data = resp.data[0]

    carrusel = data.get("carrusel") or []
    secciones = data.get("secciones") or []

    if isinstance(carrusel, str):
        carrusel = json.loads(carrusel)

    if isinstance(secciones, str):
        secciones = json.loads(secciones)

    return jsonify({
        "info_inicio": data.get("info_inicio", ""),
        "carrusel": carrusel,
        "secciones": secciones
    })

# FALTA POR TERMINAR
    return render_template(f"nutritionist_modules/{modulo}.html", user=session.get("user"))

# MODULOS NUTRICIONISTA - ENDPOINTS

# SECCION BUSQUEDA DE MIEMBROS

@app.route("/api/nutricionista/perfil/buscar", methods=["GET"])
def nutricionista_buscar_miembros():
    query = request.args.get("q", "").lower()
    if not query:
        return jsonify({"items": []}), 200
    
    rol_res = supabase.table("roles").select("id_rol").eq("nombre_rol", "miembro").maybe_single().execute()
    if not rol_res or not rol_res.data:
        return jsonify({"items": []}), 200
    
    id_rol_miembro = rol_res.data["id_rol"]
    usuarios = supabase.table("usuarios").select("*").eq("id_rol", id_rol_miembro).execute()
    
    items = []
    for u in usuarios.data:
        nombre_completo = f"{u.get('nombre', '')} {u.get('apellido', '')}".lower()
        if query in nombre_completo or query in u.get("correo", "").lower():
            items.append({
                "id": u["id_usuario"],
                "name": f"{u.get('nombre', '')} {u.get('apellido', '')}",
                "email": u.get("correo", "")
            })
    
    return jsonify({"items": items}), 200

# SECCION EVALUACION INICIAL

@app.route("/api/nutricionista/n_evaluacion_inicial", methods=["POST"])
def nutricionista_crear_evaluacion():
    data = request.get_json()
    payload = {
        "id_miembro": data.get("id_miembro"),
        "nombre": data.get("nombre"),
        "edad": data.get("edad"),
        "sexo": data.get("sexo"),
        "peso": data.get("peso"),
        "altura": data.get("altura"),
        "actividad": data.get("actividad"),
        "restricciones": data.get("restricciones")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("n_evaluacion_inicial").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/nutricionista/n_evaluacion_inicial/<id_miembro>", methods=["GET"])
def nutricionista_obtener_evaluacion(id_miembro):
    resp = supabase.table("n_evaluacion_inicial").select("*").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    return jsonify(resp.data), 200

# SECCION PLANES NUTRICIONALES

@app.route("/api/nutricionista/n_planes_nutricion", methods=["POST"])
def nutricionista_crear_plan():
    data = request.get_json()
    payload = {
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
        "estado": data.get("estado", True),
        "feedback": data.get("feedback", ""),
        "recomendaciones": data.get("recomendaciones", "")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("n_planes_nutricion").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/nutricionista/n_planes_nutricion/miembro/<id_miembro>", methods=["GET"])
def nutricionista_obtener_planes_miembro(id_miembro):
    resp = supabase.table("n_planes_nutricion").select("*").eq("id_miembro", id_miembro).order("fecha_inicio", desc=True).execute()
    return jsonify(resp.data), 200

@app.route("/api/nutricionista/n_planes_nutricion/<id_plan>", methods=["DELETE"])
def nutricionista_eliminar_plan(id_plan):
    resp = supabase.table("n_planes_nutricion").delete().eq("id_plan", id_plan).execute()
    return jsonify({"ok": True, "data": resp.data}), 200

# SECCION INGESTA

@app.route("/api/nutricionista/n_ingesta", methods=["POST"])
def nutricionista_crear_ingesta():
    data = request.get_json()
    payload = {
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
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("n_ingesta").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/nutricionista/n_ingesta/miembro/<id_miembro>", methods=["GET"])
def nutricionista_obtener_ingesta_miembro(id_miembro):
    resp = supabase.table("n_ingesta").select("*").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    return jsonify(resp.data), 200

@app.route("/api/nutricionista/n_ingesta/<id_ingesta>", methods=["DELETE"])
def nutricionista_eliminar_ingesta(id_ingesta):
    resp = supabase.table("n_ingesta").delete().eq("id_ingesta", id_ingesta).execute()
    return jsonify({"ok": True, "data": resp.data}), 200

# SECCION FEEDBACK

@app.route("/api/nutricionista/feedback/registrar", methods=["POST"])
def nutricionista_crear_feedback():
    data = request.get_json()
    payload = {
        "id_plan": data.get("id_plan"),
        "fecha": data.get("fecha"),
        "calificacion": data.get("calificacion"),
        "comentarios": data.get("comentarios")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("n_feedback_plan").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/nutricionista/feedback/listar/<id_plan>", methods=["GET"])
def nutricionista_obtener_feedback(id_plan):
    resp = supabase.table("n_feedback_plan").select("*").eq("id_plan", id_plan).order("fecha", desc=True).execute()
    return jsonify(resp.data), 200

@app.route("/api/nutricionista/feedback/<id_feedback>", methods=["DELETE"])
def nutricionista_eliminar_feedback(id_feedback):
    resp = supabase.table("n_feedback_plan").delete().eq("id_feedback", id_feedback).execute()
    return jsonify({"ok": True, "data": resp.data}), 200

# SECCION PROGRESO

@app.route("/api/nutricionista/progreso/registrar", methods=["POST"])
def nutricionista_crear_progreso():
    data = request.get_json()
    payload = {
        "id_miembro": data.get("id_miembro"),
        "fecha": data.get("fecha"),
        "peso": data.get("peso"),
        "grasa_corporal": data.get("grasa_corporal"),
        "masa_muscular": data.get("masa_muscular"),
        "seguimiento_dieta": data.get("seguimiento_dieta"),
        "observaciones": data.get("observaciones")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("n_progreso_miembro").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/nutricionista/progreso/listar/<id_miembro>", methods=["GET"])
def nutricionista_obtener_progreso(id_miembro):
    resp = supabase.table("n_progreso_miembro").select("*").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    return jsonify(resp.data), 200

@app.route("/api/nutricionista/progreso/<id_progreso>", methods=["DELETE"])
def nutricionista_eliminar_progreso(id_progreso):
    resp = supabase.table("n_progreso_miembro").delete().eq("id_progreso", id_progreso).execute()
    return jsonify({"ok": True, "data": resp.data}), 200

# SECCION CHAT

@app.route("/api/nutricionista/n_chat_nutricion", methods=["POST"])
def nutricionista_enviar_mensaje():
    data = request.get_json()
    payload = {
        "id_miembro": data.get("id_miembro"),
        "id_nutricionista": data.get("id_nutricionista"),
        "mensaje": data.get("mensaje"),
        "remitente": data.get("tipo", "nutricionista")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("n_chat_nutricionista").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/nutricionista/n_chat_nutricion/miembro/<id_miembro>", methods=["GET"])
def nutricionista_obtener_chat(id_miembro):
    resp = supabase.table("n_chat_nutricionista").select("*").eq("id_miembro", id_miembro).order("fecha_hora", desc=False).execute()
    mensajes = []
    for m in resp.data:
        mensajes.append({
            "id_mensaje": m.get("id_mensaje"),
            "mensaje": m.get("mensaje"),
            "tipo": m.get("remitente"),
            "fecha": m.get("fecha_hora")
        })
    return jsonify(mensajes), 200

# APP RUN

if __name__=="__main__":
    app.run(debug=True, port=3000)
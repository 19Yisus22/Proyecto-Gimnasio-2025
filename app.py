from flask_cors import CORS
import json
import re
from datetime import datetime
from dotenv import load_dotenv
from passlib.hash import scrypt
from supabase import create_client
from datetime import datetime, timezone 
from werkzeug.utils import secure_filename
from datetime import datetime, date, timedelta
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

# FUNCIONES APARTADO CLASES / MODULO CLASES RESERVAS - MIEMBRO

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

@app.route("/api/miembros/clases", methods=["GET"])
def miembros_clases():
    # 1. Obtener clases
    clases_res = supabase.table("a_gestion_clases").select("*").order("horario_inicio").execute()
    if not clases_res:
        return jsonify({"ok": False, "message": "Error al obtener clases del servidor"}), 500
    
    clases_data = []
    
    # 2. Obtener reservas ocupadas (Reservada O Completada) para el cálculo de cupos
    # AJUSTE: Contar reservas en estado 'reservada' o 'completada' (cupos no devueltos al completar).
    reservas_ocupadas_res = supabase.table("m_clases_reservadas").select("id_clase", "fecha").in_("estado", ["reservada", "completada"]).execute()
    
    # Manejo defensivo
    reservas_ocupadas_data = reservas_ocupadas_res.data if reservas_ocupadas_res else []

    ocupados_por_clase_fecha = {}
    instructor_ids = set()
    
    # Contar ocupados por (id_clase, fecha)
    for r in reservas_ocupadas_data:
        key = (r["id_clase"], r["fecha"])
        ocupados_por_clase_fecha[key] = ocupados_por_clase_fecha.get(key, 0) + 1

    # Recolectar IDs de instructores
    for c in clases_res.data:
        instructor_id = c.get("instructor_id")
        if instructor_id:
            instructor_ids.add(instructor_id)

    # 3. Obtener nombres de instructores
    instructor_cache = {}
    if instructor_ids:
        instructors_res = supabase.table("usuarios").select("id_usuario,nombre,apellido").in_("id_usuario", list(instructor_ids)).execute()
        # Manejo defensivo
        if instructors_res:
            for u in instructors_res.data:
                # Asumimos que si el ID está referenciado en a_gestion_clases, es un entrenador válido.
                instructor_cache[u["id_usuario"]] = f"{u['nombre']} {u['apellido']}"

    # 4. Construir lista final
    for c in clases_res.data:
        instructor_id = c.get("instructor_id")
        nombre_instructor = instructor_cache.get(instructor_id) if instructor_id else "No Asignado"
        
        # Clave compuesta por id_clase y fecha
        key = (c["id_clase"], c["fecha"])
        ocupados = ocupados_por_clase_fecha.get(key, 0)
        
        total = c.get("capacidad_max", 0)
        disponibles = max(0, total - ocupados)
        
        clases_data.append({
            "id_clase": str(c["id_clase"]),
            "nombre": c.get("nombre"),
            "descripcion": c.get("descripcion"),
            "tipo_clase": c["tipo_clase"],
            "instructor": nombre_instructor,
            "instructor_id": instructor_id,
            "horario": f"{c['horario_inicio'][:-3]} - {c['horario_fin'][:-3]}",
            "horario_inicio": c.get("horario_inicio"),
            "horario_fin": c.get("horario_fin"),
            "fecha": c.get("fecha"),
            "sala": c.get("sala"),
            "capacidad_max": total,
            "ocupados": ocupados,
            "cupos_disponibles": f"{disponibles}/{total}",
            "nivel_dificultad": c.get("nivel_dificultad"),
        })
    return jsonify({"ok": True, "clases": clases_data})

@app.route('/api/miembros/crear_reservas', methods=['POST'])
def miembros_reservas_crear():
    id_miembro = obtener_id_usuario()
    if not id_miembro:
        return jsonify({"ok": False, "message": "Usuario no autenticado"}), 401
        
    data = request.get_json()
    id_clase = data.get("id_clase")
    fecha_reserva = data.get("fecha")
    
    if not id_clase or not fecha_reserva:
        return jsonify({"ok": False, "message": "id_clase y fecha son obligatorios"}), 400

    try:
        existe_res = supabase.table("m_clases_reservadas").select("id_reserva").eq("id_miembro", id_miembro).eq("id_clase", id_clase).eq("fecha", fecha_reserva).eq("estado", "reservada").maybe_single().execute()

        if existe_res and existe_res.data:
             return jsonify({"ok": False, "message": "Ya tienes una reserva ACTIVA para esta clase en la fecha seleccionada"}), 400
        class_res = supabase.table("a_gestion_clases").select("*").eq("id_clase", id_clase).maybe_single().execute()
        
        if not class_res or not class_res.data:
            return jsonify({"ok": False, "message": "Clase no encontrada"}), 404

        clase = class_res.data
        reservas_ocupadas_res = supabase.table("m_clases_reservadas").select("id_reserva").eq("id_clase", id_clase).eq("fecha", fecha_reserva).in_("estado", ["reservada", "completada"]).execute()
        reservas_ocupadas_data = reservas_ocupadas_res.data if reservas_ocupadas_res else []
        ocupados = len(reservas_ocupadas_data)
        total = clase.get("capacidad_max", 0)
        
        if ocupados >= total:
            return jsonify({"ok": False, "message": "No hay cupos disponibles para esta clase en la fecha seleccionada"}), 400

        reservation_data = {
            "id_miembro": id_miembro,
            "id_clase": id_clase,
            "id_entrenador": clase.get("instructor_id"), 
            "nombre": clase["nombre"],
            "descripcion": clase.get("descripcion"),
            "tipo_clase": clase["tipo_clase"],
            "nivel_dificultad": clase.get("nivel_dificultad"),
            "capacidad_max": clase["capacidad_max"],
            "horario_inicio": clase["horario_inicio"],
            "horario_fin": clase["horario_fin"],
            "fecha": fecha_reserva,
            "sala": clase.get("sala"),
            "estado": "reservada",
            "asistencia_confirmada": False
        }

        insert_res = supabase.table("m_clases_reservadas").insert(reservation_data).execute()
        
        if not insert_res or not insert_res.data:
            raise Exception("La inserción en la base de datos no devolvió datos de éxito.")
            
    except Exception as e:
        return jsonify({"ok": False, "message": f"Error creando la reserva: {str(e)}"}), 500
    return jsonify({"ok": True, "message": "Reserva creada exitosamente"})

@app.route("/api/miembros/mis_reservas", methods=["GET"])
def miembros_mis_reservas():
    id_miembro = obtener_id_usuario()
    if not id_miembro:
        return jsonify({"ok": False, "message": "Usuario no autenticado"}), 401
        
    reservas_response = supabase.table("m_clases_reservadas").select("*").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    
    if not reservas_response:
         return jsonify({"ok": False, "message": "Error al obtener reservas del servidor"}), 500
         
    reservas = reservas_response.data
    
    instructor_ids = set()
    for r in reservas:
        instructor_id = r.get("id_entrenador")
        if instructor_id:
            instructor_ids.add(instructor_id)

    instructor_cache = {}
    if instructor_ids:
        instructors_res = supabase.table("usuarios").select("id_usuario,nombre,apellido").in_("id_usuario", list(instructor_ids)).execute()
        if instructors_res:
            for u in instructors_res.data:
                instructor_cache[u["id_usuario"]] = f"{u['nombre']} {u['apellido']}"
            
    clases_reservadas = []
    total_reservas_comprometidas = 0
    total_completadas = 0

    for r in reservas:

        if r.get("estado") in ["reservada", "completada"]:
            total_reservas_comprometidas += 1
            if r.get("asistencia_confirmada") == True:
                total_completadas += 1

        instructor_id = r.get("id_entrenador")
        nombre_instructor = instructor_cache.get(instructor_id) if instructor_id else "No Asignado"
        
        ocupados = 0
        total = r.get("capacidad_max", 0)
        
        if r.get("fecha"):

            ocupados_res = supabase.table("m_clases_reservadas").select("id_reserva").eq("id_clase", r["id_clase"]).eq("fecha", r["fecha"]).in_("estado", ["reservada", "completada"]).execute()
            ocupados_data = ocupados_res.data if ocupados_res else []
            ocupados = len(ocupados_data)
        
        disponibles = max(0, total - ocupados)
        clases_reservadas.append({
            "id_reserva": r["id_reserva"],
            "id_clase": r["id_clase"],
            "nombre": r["nombre"],
            "descripcion": r.get("descripcion"),
            "tipo_clase": r["tipo_clase"],
            "nivel_dificultad": r.get("nivel_dificultad"),
            "capacidad_max": total,
            "horario_inicio": r["horario_inicio"],
            "horario_fin": r["horario_fin"],
            "fecha": r["fecha"],
            "sala": r["sala"],
            "instructor": nombre_instructor,
            "instructor_id": instructor_id,
            "horario": f"{r['horario_inicio'][:-3]} - {r['horario_fin'][:-3]}",
            "estado": r.get("estado", "reservada"),
            "asistencia_confirmada": r.get("asistencia_confirmada", False),
            "cupos_disponibles": f"{disponibles}/{total}"
        })

    progreso_porcentaje = (total_completadas / total_reservas_comprometidas * 100) if total_reservas_comprometidas > 0 else 0
    return jsonify({"ok": True, "clases": clases_reservadas, "progreso": progreso_porcentaje})

@app.route("/api/miembros/cancelar_reservas/<id_reserva>", methods=["PUT"])
def miembros_reservas_cancelar(id_reserva):
    id_miembro = obtener_id_usuario()
    if not id_miembro:
        return jsonify({"ok": False, "message": "Usuario no autenticado"}), 401
    
    resp = supabase.table("m_clases_reservadas").update({
        "estado": "cancelada", 
        "asistencia_confirmada": False
    }).eq("id_reserva", id_reserva).eq("id_miembro", id_miembro).eq("estado", "reservada").execute()
    
    if resp and resp.data:
        return jsonify({"ok": True, "message": "Reserva cancelada exitosamente"})
    return jsonify({"ok": False, "message": "Error al cancelar la reserva o la reserva no está activa"}), 500

@app.route("/api/miembros/completar_reservas/<id_reserva>", methods=["PUT"])
def miembros_reservas_completar(id_reserva):
    id_miembro = obtener_id_usuario()
    if not id_miembro:
        return jsonify({"ok": False, "message": "Usuario no autenticado"}), 401
    
    resp = supabase.table("m_clases_reservadas").update({
        "estado": "completada", 
        "asistencia_confirmada": True
    }).eq("id_reserva", id_reserva).eq("id_miembro", id_miembro).eq("estado", "reservada").execute()

    if resp and resp.data:
        return jsonify({"ok": True, "message": "Reserva marcada como completada"})
    return jsonify({"ok": False, "message": "Error al completar la reserva o la reserva no estaba activa"}), 500

@app.route("/api/miembros/reservas/<id_reserva>", methods=["DELETE"])
def miembros_reservas_eliminar(id_reserva):
    id_miembro = obtener_id_usuario()
    if not id_miembro:
        return jsonify({"ok": False, "message": "Usuario no autenticado"}), 401
    
    try:
        reserva_res = supabase.table("m_clases_reservadas").select("estado").eq("id_reserva", id_reserva).eq("id_miembro", id_miembro).maybe_single().execute()
    
        if not reserva_res or not reserva_res.data:
            return jsonify({"ok": False, "message": "Reserva no encontrada"}), 404
        
        if reserva_res.data.get("estado") == "reservada":
            return jsonify({"ok": False, "message": "No se puede eliminar una reserva activa. Primero debes cancelarla."}), 400
        
        resp = supabase.table("m_clases_reservadas").delete().eq("id_reserva", id_reserva).eq("id_miembro", id_miembro).execute()

        if resp and resp.data:
            return jsonify({"ok": True, "message": "Reserva eliminada exitosamente"})
        return jsonify({"ok": False, "message": "Error al eliminar la reserva"}), 500
        
    except Exception as e:
        return jsonify({"ok": False, "message": f"Error al eliminar: {str(e)}"}), 500

@app.route("/api/miembros/feedback/entrenador", methods=["POST"])
def miembros_feedback_entrenador():
    id_miembro = obtener_id_usuario()
    if not id_miembro:
        return jsonify({"ok": False, "message": "Usuario no autenticado"}), 401

    data = request.get_json()
    id_entrenador = data.get("id_entrenador")
    mensaje = data.get("mensaje")
    calificacion = data.get("calificacion")

    if not id_entrenador or not mensaje or calificacion is None:
        return jsonify({"ok": False, "message": "Datos de feedback incompletos"}), 400
    
    try:
        calificacion = int(calificacion)
        if not (1 <= calificacion <= 5):
            return jsonify({"ok": False, "message": "La calificación debe ser entre 1 y 5"}), 400
    except ValueError:
        return jsonify({"ok": False, "message": "La calificación debe ser un número"}), 400

    try:
        resp = supabase.table("e_feedback_miembros").insert({
            "id_entrenador": id_entrenador,
            "id_miembro": id_miembro,
            "mensaje": mensaje,
            "calificacion": calificacion,
        }).execute()

        if resp and resp.data:
            return jsonify({"ok": True, "message": "Feedback al entrenador enviado exitosamente"})
        else:
            return jsonify({"ok": False, "message": "Error al guardar el feedback"}), 500
            
    except Exception as e:
        return jsonify({"ok": False, "message": "Error interno del servidor al enviar feedback", "detalle": str(e)}), 500

@app.route("/api/miembros/feedback/clase", methods=["POST"])
def miembros_feedback_clase():
    id_miembro = obtener_id_usuario()
    if not id_miembro:
        return jsonify({"ok": False, "message": "Usuario no autenticado"}), 401

    data = request.get_json()
    id_clase = data.get("id_clase")
    mensaje = data.get("mensaje")
    calificacion = data.get("calificacion")

    if not id_clase or not mensaje or calificacion is None:
        return jsonify({"ok": False, "message": "Datos de feedback de clase incompletos"}), 400

    try:
        calificacion = int(calificacion)
        if not (1 <= calificacion <= 5):
            return jsonify({"ok": False, "message": "La calificación debe ser entre 1 y 5"}), 400
    except ValueError:
        return jsonify({"ok": False, "message": "La calificación debe ser un número"}), 400

    try:
        clase_res = supabase.table("a_gestion_clases").select("instructor_id").eq("id_clase", id_clase).maybe_single().execute()
        
        id_entrenador = None
        if clase_res and clase_res.data:
            id_entrenador = clase_res.data.get("instructor_id")
        
        feedback_data = {
            "id_clase": id_clase,
            "id_miembro": id_miembro,
            "mensaje": mensaje,
            "calificacion": calificacion,
        }
        
        if id_entrenador:
            feedback_data["id_entrenador"] = id_entrenador
        resp = supabase.table("e_feedback_clases").insert(feedback_data).execute()

        if resp and resp.data:
            return jsonify({"ok": True, "message": "Feedback de clase enviado exitosamente"})
        else:
            return jsonify({"ok": False, "message": "Error al guardar el feedback de clase"}), 500
            
    except Exception as e:
        return jsonify({"ok": False, "message": "Error interno del servidor al enviar feedback de clase", "detalle": str(e)}), 500

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

@app.route("/api/miembros/obtener_progreso_historico", methods=["GET"])
def miembros_obtener_progreso_historico():
    try:
        id_miembro = obtener_id_usuario()
        data = supabase.table("n_progreso_miembro").select("fecha, peso, grasa_corporal, masa_muscular").eq("id_miembro", id_miembro).order("fecha", desc=False).execute()
        return jsonify({"ok": True, "data": data.data})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/miembros/registrar_progreso", methods=["POST"])
def miembros_registrar_progreso():
    try:
        id_miembro = obtener_id_usuario()
        datos = request.json
        insertar = supabase.table("n_progreso_miembro").insert({
            "id_miembro": id_miembro,
            "peso": datos.get("peso"),
            "grasa_corporal": datos.get("grasa_corporal"),
            "masa_muscular": datos.get("masa_muscular"),
            "seguimiento_dieta": datos.get("seguimiento_dieta", ""),
            "observaciones": datos.get("observaciones", "")
        }).execute()
        return jsonify({"ok": True, "data": insertar.data})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/miembros/obtener_objetivo", methods=["GET"])
def miembros_obtener_objetivo():
    try:
        id_miembro = obtener_id_usuario()
        data = supabase.table("m_objetivos").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=True).limit(1).execute()
        return jsonify({"ok": True, "data": data.data})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/miembros/actualizar_objetivo", methods=["POST"])
def miembros_actualizar_objetivo():
    try:
        id_miembro = obtener_id_usuario()
        datos = request.json
        actualizar = supabase.table("m_objetivos").insert({
            "id_miembro": id_miembro,
            "descripcion": datos.get("descripcion"),
            "fecha_limite": datos.get("fecha_limite")
        }).execute()
        return jsonify({"ok": True, "data": actualizar.data})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/miembros/plan_nutricional", methods=["GET"])
def miembros_obtener_datos_combinados():
    try:
        id_miembro = obtener_id_usuario()
        progreso = supabase.table("n_progreso_miembro").select("*").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
        objetivo = supabase.table("m_objetivos").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=True).limit(1).execute()
        return jsonify({
            "ok": True,
            "progreso": progreso.data,
            "objetivo": objetivo.data
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/nutricion/obtener_plan_actual", methods=["GET"])
def nutricion_obtener_plan_actual():
    try:
        id_miembro = obtener_id_usuario()
        data = supabase.table("n_planes_nutricion").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=True).limit(1).execute()
        return jsonify({"ok": True, "data": data.data})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/nutricion/registrar_ingesta", methods=["POST"])
def nutricion_registrar_ingesta():
    try:
        id_miembro = obtener_id_usuario()
        datos = request.json
        insertar = supabase.table("n_ingesta").insert({
            "id_miembro": id_miembro,
            "alimento": datos.get("alimento"),
            "cantidad": datos.get("cantidad"),
            "calorias": datos.get("calorias"),
            "proteina": datos.get("proteina"), 
            "grasa": datos.get("grasa"), 
            "carbohidratos": datos.get("carbohidratos")
        }).execute()
        return jsonify({"ok": True, "data": insertar.data})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/nutricion/obtener_ingesta", methods=["GET"])
def nutricion_obtener_ingesta():
    try:
        id_miembro = obtener_id_usuario()
        hoy = datetime.now().strftime(DATE_FORMAT)
        data = supabase.table("n_ingesta").select("*").eq("id_miembro", id_miembro).eq("fecha", hoy).order("id_ingesta", desc=True).execute()
        return jsonify({"ok": True, "data": data.data})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/nutricion/obtener_chat", methods=["GET"])
def nutricion_obtener_chat():
    try:
        id_miembro = obtener_id_usuario()
        data = supabase.table("n_chat_nutricion").select("*").eq("id_miembro", id_miembro).order("fecha_hora", desc=False).execute()
        return jsonify({"ok": True, "data": data.data})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/nutricion/enviar_mensaje", methods=["POST"])
def nutricion_enviar_mensaje():
    try:
        id_miembro = obtener_id_usuario()
        datos = request.json
        
        fecha_hora_utc = datetime.now(timezone.utc).isoformat()
        
        insertar = supabase.table("n_chat_nutricion").insert({
            "id_miembro": id_miembro,
            "id_nutricionista": datos.get("id_nutricionista"),
            "mensaje": datos.get("mensaje"),
            "fecha_hora": fecha_hora_utc 
        }).execute()
        return jsonify({"ok": True, "data": insertar.data})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


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

# FUNCIONES SECCCION RESERVAS / MODULO MIS CLASES - ENTRENADOR

@app.route("/api/miembros", methods=["GET"])
def listar_miembros():
    roles = supabase.table("roles").select("id_rol").eq("nombre_rol", "miembro").execute()
    if not roles.data:
        return jsonify({"error": "Rol 'miembro' no encontrado"}), 404
    id_rol_miembro = roles.data[0]["id_rol"]
    resp = supabase.table("usuarios").select("*").eq("id_rol", id_rol_miembro).execute()
    return jsonify(resp.data), 200

@app.route("/api/reservas", methods=["POST"])
def crear_reserva():
    data = request.get_json()
    resp = supabase.table("m_clases_reservadas").insert({
        "id_miembro": data["id_miembro"],
        "id_clase": data["id_clase"],
        "id_entrenador": data.get("id_entrenador"),
        "estado": "reservada",
    }).execute()
    return jsonify(resp.data), 201

@app.route("/api/reservas/<id_reserva>", methods=["PUT"])
def actualizar_reserva(id_reserva):
    data = request.get_json()
    update_data = {}
    if "asistencia_confirmada" in data:
        update_data["asistencia_confirmada"] = data["asistencia_confirmada"]
    
    if not update_data:
        return jsonify({"error": "No se proporcionaron datos para actualizar."}), 400
    
    resp = supabase.table("m_clases_reservadas").update(update_data).eq("id_reserva", id_reserva).execute()
    return jsonify(resp.data), 200

@app.route("/api/reservas/<id_reserva>", methods=["DELETE"])
def eliminar_reserva(id_reserva):
    resp = supabase.table("m_clases_reservadas").delete().eq("id_reserva", id_reserva).execute()
    return jsonify({"mensaje": f"Reserva {id_reserva} eliminada"}), 200

@app.route("/api/reservas/miembro/<id_miembro>", methods=["GET"])
def reservas_por_miembro(id_miembro):
    try:
        query = supabase.table("m_clases_reservadas").select(
            "id_reserva, id_clase, estado, asistencia_confirmada, fecha_creacion, clase:a_gestion_clases(nombre, horario_inicio, horario_fin, instructor:usuarios(nombre, apellido))"
        ).eq("id_miembro", id_miembro).eq("estado", "reservada")
        
        resp = query.execute()
        
    except Exception as e:
        return jsonify({"error": "Error interno del servidor al consultar reservas."}), 500

    reservas_data = []
    for r in resp.data:
        clase_info = r.get('clase') 
        
        if isinstance(clase_info, list) and clase_info:
            clase_info = clase_info[0]
        
        clase_valida = clase_info and isinstance(clase_info, dict)
        
        nombre_clase = clase_valida and clase_info.get("nombre") or "Clase Desconocida" 
        horario_inicio = clase_valida and clase_info.get("horario_inicio") or ""
        horario_fin = clase_valida and clase_info.get("horario_fin") or ""
        
        instructor_info = clase_valida and clase_info.get("instructor")
        if isinstance(instructor_info, list) and instructor_info:
            instructor_info = instructor_info[0]
        
        nombre_entrenador = "No Asignado"
        if instructor_info and isinstance(instructor_info, dict):
            nombre_entrenador = f"{instructor_info.get('nombre', '')} {instructor_info.get('apellido', '')}".strip()
        
        reservas_data.append({
            "id_reserva": r.get("id_reserva"),
            "id_miembro": id_miembro, 
            "id_clase": r.get("id_clase"),
            "nombre_entrenador": nombre_entrenador,
            "estado": r.get("estado"),
            "asistencia_confirmada": r.get("asistencia_confirmada"),
            "fecha_creacion": r.get("fecha_creacion"),
            "nombre_clase": nombre_clase,
            "horario_inicio": horario_inicio,
            "horario_fin": horario_fin,
        })
    
    return jsonify(reservas_data), 200

# SECCION NOTIFICACIONES

# FUNCIONES SECCION NOTIFICACIONES / MODULO MIS CLASES - ENTRENADOR

@app.route("/api/notificaciones", methods=["POST"])
def crear_notificacion():
    data = request.get_json()
    payload = {
        "id_miembro": data.get("id_miembro"),
        "titulo": data.get("titulo"),
        "descripcion": data.get("descripcion"),
        "tipo_notificacion": data.get("tipo_notificacion"),
        "fecha": datetime.now().date().isoformat() # Usamos la fecha actual por defecto
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    
    # El campo 'leida' ha sido omitido ya que su gestión corresponde al miembro.
    resp = supabase.table("m_notificaciones_miembros").insert(payload).execute()
    return jsonify(resp.data), 201

@app.route("/api/notificaciones/<id_miembro>", methods=["GET"])
def obtener_notificaciones_miembro(id_miembro):
    resp = (
        supabase.table("m_notificaciones_miembros")
        .select("*")
        .eq("id_miembro", id_miembro)
        .order("fecha", desc=True)
        .execute()
    )
    return jsonify(resp.data), 200

@app.route("/api/notificaciones/<id_notificacion>", methods=["PUT"])
def actualizar_notificacion(id_notificacion):
    """Actualiza una notificación específica (sin campo 'leida')."""
    data = request.get_json()
    payload = {
        "titulo": data.get("titulo"),
        "descripcion": data.get("descripcion"),
        "tipo_notificacion": data.get("tipo_notificacion"),
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

# SECCION PROGRESO

# FUNCIONES SECCION NOTIFICACIONES / MODULO PROGRESO MIEMBROS - ENTRENADOR

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

# SECCION FEEDBACK

# FUNCIONES APARTADO FEEDBACK / MODULO ENTRENAMIENTOS PERSONALIZADOS - ENTRENADOR

@app.route("/api/feedback/<id_miembro>", methods=["GET"])
def entrenador_obtener_feedback(id_miembro):
    resp = supabase.table("e_feedback_miembros").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=False).execute()
    return jsonify(resp.data), 200

@app.route("/api/feedback", methods=["POST"])
def entrenador_crear_feedback():
    data = request.get_json()
    cal = data.get("calificacion")
    
    try:
        cal = int(cal)
        if not (1 <= cal <= 5):
            return jsonify({"error": "Calificación inválida. Debe ser un número entre 1 y 5."}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "Calificación requerida y debe ser un número entero."}), 400

    if not data.get("mensaje") or not data.get("mensaje").strip():
        return jsonify({"error": "Mensaje requerido"}), 400
        
    payload = {
        "id_feedback": str(uuid.uuid4()),
        "id_entrenador": data.get("id_entrenador"),
        "id_miembro": data.get("id_miembro"),
        "mensaje": data.get("mensaje"),
        "calificacion": cal
    }
    
    payload = {k: v for k, v in payload.items() if v is not None}
    
    resp = supabase.table("m_feedback_entrenadores").insert(payload).execute()
    
    if resp.data:
        return jsonify(resp.data), 201
    else:
        return jsonify({"error": "Error al crear el feedback en la base de datos"}), 500

@app.route("/api/feedback/<id_feedback>", methods=["PUT"])
def entrenador_actualizar_feedback(id_feedback):
    data = request.get_json()
    payload = {}

    mensaje = data.get("mensaje")
    if mensaje is not None:
        if not mensaje.strip():
            return jsonify({"error": "El mensaje no puede estar vacío"}), 400
        payload["mensaje"] = mensaje

    cal = data.get("calificacion")
    if cal is not None:
        try:
            cal = int(cal)
            if not (1 <= cal <= 5):
                return jsonify({"error": "Calificación inválida. Debe ser un número entre 1 y 5."}), 400
            payload["calificacion"] = cal
        except (TypeError, ValueError):
            return jsonify({"error": "La calificación debe ser un número entero."}), 400

    if not payload:
        return jsonify({"error": "Datos de actualización no proporcionados"}), 400

    resp = supabase.table("m_feedback_entrenadores").update(payload).eq("id_feedback", id_feedback).execute()
    
    if resp.data:
        return jsonify(resp.data), 200
    else:
        return jsonify({"error": "Error al actualizar el feedback"}), 500

@app.route("/api/feedback/<id_feedback>", methods=["DELETE"])
def entrenador_eliminar_feedback(id_feedback):
    resp = supabase.table("m_feedback_entrenadores").delete().eq("id_feedback", id_feedback).execute()
    return jsonify(resp.data), 200

@app.route("/api/calificaciones_clases/<id_instructor>", methods=["GET"])
def instructor_obtener_calificaciones_clases(id_instructor):
    calificacion_param = request.args.get("calificacion")
    
    query = supabase.table("e_feedback_miembros").select("*").eq("id_entrenador", id_instructor)
    
    if calificacion_param is not None:
        try:
            cal = int(calificacion_param)
            
            if not (1 <= cal <= 5):
                return jsonify({"error": "Calificación inválida. Debe ser un número entre 1 y 5."}), 400
            
            query = query.eq("calificacion", cal)
            
        except ValueError:
            return jsonify({"error": "La calificación debe ser un número entero."}), 400
    
    try:
        resp = query.execute()
        return jsonify(resp.data), 200
    except Exception as e:
        return jsonify({"error": "Ocurrió un error al obtener las calificaciones."}), 500 

# MODULO PROGRESO MIEMBROS

    @app.route("/api/entrenador/cargarDashboardStats", methods=["GET"])
    def cargar_dashboard_stats():
        """
        Carga las cuatro estadísticas principales del dashboard.
        1. Total de Miembros (rol 'miembro') - Usa id_rol para el filtro.
        2. Total de Metas Alcanzadas.
        3. Total de Asistencia Confirmada.
        4. Total de Calorías Quemadas.
        """
        try:
            # 1. Obtener el ID del rol 'miembro'
            # Usamos .limit(1) y .maybe_single() para mayor seguridad si hubiera duplicados
            res_rol = supabase.from_('roles').select('id_rol').eq('nombre', 'miembro').limit(1).maybe_single().execute()
            id_rol_miembro = res_rol.data.get('id_rol') if res_rol.data else None

            total_miembros = 0
            if id_rol_miembro:
                # 1. Total Miembros (rol 'miembro')
                # Consulta simple filtrando solo por id_rol para evitar errores de alias/join
                res_miembros = supabase.from_('usuarios').select(
                    'id_usuario', 
                    count='exact'
                ).eq('id_rol', id_rol_miembro).execute()
                total_miembros = res_miembros.count if res_miembros.count is not None else 0

            # 2. Metas Alcanzadas (m_objetivos donde estado='cumplido')
            res_metas = supabase.from_('m_objetivos').select(
                'id_objetivo', 
                count='exact'
            ).eq('estado', 'cumplido').execute()
            metas_cumplidas = res_metas.count if res_metas.count is not None else 0

            # 3. Asistencia Confirmada (m_clases_reservadas donde asistencia_confirmada=TRUE)
            res_asistencia = supabase.from_('m_clases_reservadas').select(
                'id_reserva', 
                count='exact'
            ).eq('asistencia_confirmada', True).execute()
            asistencia_confirmada = res_asistencia.count if res_asistencia.count is not None else 0

            # 4. Total Calorías Quemadas (Suma de calorias_quemadas en m_progreso)
            res_calorias = supabase.from_('m_progreso').select('calorias_quemadas').execute()
            total_calorias = sum(p.get('calorias_quemadas') or 0 for p in res_calorias.data)
            
            return jsonify({
                "ok": True,
                "stats": {
                    "totalMiembros": total_miembros,
                    "metasAlcanzadas": metas_cumplidas,
                    "asistenciaConfirmada": asistencia_confirmada,
                    "caloriasTotales": total_calorias
                }
            })

        except Exception as e:
            print(f"Error al cargar estadísticas del dashboard: {e}")
            return jsonify({"ok": False, "mensaje": f"Error interno al obtener estadísticas: {str(e)}"}), 500


    @app.route("/api/entrenador/cargarMiembros", methods=["GET"])
    def cargar_miembros():
        """
        Carga la lista de todos los usuarios con rol 'miembro'.
        CORRECCIÓN: Asegura que la consulta principal solo filtre por id_rol.
        """
        try:
            # Paso 1: Obtener el ID del rol 'miembro'
            res_rol = supabase.from_('roles').select('id_rol').eq('nombre', 'miembro').limit(1).maybe_single().execute()
            id_rol_miembro = res_rol.data.get('id_rol') if res_rol.data else None

            if not id_rol_miembro:
                # Si no se encuentra el rol, asumimos que no hay miembros (o la tabla roles está mal)
                return jsonify({"ok": True, "miembros": [], "mensaje": "No se encontró el ID para el rol 'miembro'. Asegure que la tabla 'roles' contiene un rol con nombre 'miembro'."})

            # Paso 2: Consulta principal de usuarios, filtrando solo por id_rol
            # SIN intentar hacer joins implícitos en el SELECT para evitar el error de alias
            res_members = supabase.from_('usuarios').select(
                'id_usuario, nombre, disciplina, id_entrenador'
            ).eq('id_rol', id_rol_miembro).execute()
            
            miembros_data = []
            if res_members.data:
                for member in res_members.data:
                    member_id = member['id_usuario']
                    trainer_id = member.get('id_entrenador')
                    trainer_name = None
                    
                    # Paso 3: Consulta secundaria para el nombre del entrenador (si aplica)
                    if trainer_id:
                        # Asumo que los entrenadores también son usuarios
                        res_trainer = supabase.from_('usuarios').select('nombre').eq('id_usuario', trainer_id).limit(1).maybe_single().execute()
                        if res_trainer.data:
                            trainer_name = res_trainer.data.get('nombre')
                    
                    # Paso 4: Fetch the latest membership status (m_membresias)
                    res_membership = supabase.from_('m_membresias').select('estado, fecha_fin').eq('id_miembro', member_id).order('fecha_fin', desc=True).limit(1).execute()
                    latest_membership = res_membership.data[0] if res_membership.data else {}
                    
                    # Paso 5: Fetch the latest progress data (m_progreso)
                    res_progress = supabase.from_('m_progreso').select('*').eq('id_miembro', member_id).order('fecha', desc=True).limit(1).execute()
                    latest_progress = res_progress.data[0] if res_progress.data else {}
                    
                    
                    # Paso 6: Ensambla la estructura de datos
                    miembro_info = {
                        'id': member_id, 
                        'nombre': member['nombre'],
                        'disciplina': member.get('disciplina'),
                        'entrenador': trainer_name,
                        
                        # Datos de la Membresía - Usar get() para valores por defecto seguros
                        'estado_membresia': latest_membership.get('estado', 'Sin Registrar'),
                        'fecha_fin': latest_membership.get('fecha_fin'), 
                        
                        # Métricas del último registro en m_progreso
                        'peso': latest_progress.get('peso'),
                        'imc': latest_progress.get('imc'),
                        'calorias_quemadas': latest_progress.get('calorias_quemadas'),
                        'objetivo_personal': latest_progress.get('objetivo_personal'),
                        'ultima_sesion': latest_progress.get('fecha'),
                    }
                    miembros_data.append(miembro_info)

            return jsonify({"ok": True, "miembros": miembros_data})

        except Exception as e:
            print(f"Error al cargar miembros: {e}")
            # Retornamos el error completo para facilitar la depuración por parte del usuario
            return jsonify({"ok": False, "mensaje": f"Error interno del servidor al obtener la lista de miembros: {str(e)}"}), 500

    @app.route("/api/entrenador/registrarMetricas", methods=["POST"])
    def registrar_metricas():
        """
        Registra nuevas métricas de progreso en la tabla m_progreso.
        """
        try:
            data = request.json
            
            required_fields = ['id_miembro', 'peso', 'calorias_quemadas']
            if not all(field in data for field in required_fields):
                return jsonify({"ok": False, "mensaje": "Faltan campos obligatorios."}), 400

            metricas = {
                'id_miembro': data.get('id_miembro'), # id_miembro debe ser el id_usuario
                'peso': float(data.get('peso')),
                'imc': float(data.get('imc')) if data.get('imc') else None,
                'calorias_quemadas': int(data.get('calorias_quemadas', 0)),
                'fuerza': float(data.get('fuerza')) if data.get('fuerza') else None,
                'resistencia': float(data.get('resistencia')) if data.get('resistencia') else None,
                'masa_muscular': float(data.get('masa_muscular')) if data.get('masa_muscular') else None,
                'grasa_corporal': float(data.get('grasa_corporal')) if data.get('grasa_corporal') else None,
                'notas': data.get('notas'),
                'objetivo_personal': data.get('objetivo_personal'),
                'fecha': datetime.now(timezone.utc).isoformat()
            }
            
            res = supabase.from_('m_progreso').insert([metricas]).execute()
            
            if res.data:
                return jsonify({"ok": True, "mensaje": "Métricas registradas exitosamente."})
            else:
                error_message = res.error.get('message', 'Error desconocido al registrar métricas.') if res.error else 'No data returned on insertion.'
                print(f"Supabase Error: {error_message}")
                return jsonify({"ok": False, "mensaje": error_message}), 500
            
        except ValueError:
            return jsonify({"ok": False, "mensaje": "Error de formato en los datos numéricos o nulos."}), 400
        except Exception as e:
            print(f"Error al registrar métricas: {e}")
            return jsonify({"ok": False, "mensaje": "Error interno del servidor al registrar métricas."}), 500

    @app.route("/api/entrenador/cargarDetalle/<id_miembro>", methods=["GET"])
    def cargar_detalle(id_miembro):
        """
        Carga el historial completo de métricas de progreso para un miembro específico.
        (id_miembro es el id_usuario en este contexto)
        """
        try:
            res = supabase.from_('m_progreso').select('*').eq('id_miembro', id_miembro).order('fecha', desc=False).execute()
            
            if res.data:
                historial = res.data
                for entry in historial:
                    # Formatea la fecha para mejor visualización en el frontend
                    if entry.get('fecha'):
                        # Asume que la fecha es ISO 8601 UTC y la formatea
                        entry['fecha'] = datetime.fromisoformat(entry['fecha'].replace('Z', '+00:00')).strftime('%Y-%m-%d')

                return jsonify({"ok": True, "historial": historial})
            
            return jsonify({"ok": False, "mensaje": "No se encontró historial para el miembro."}), 404

        except Exception as e:
            print(f"Error al cargar detalle: {e}")
            return jsonify({"ok": False, "mensaje": "Error interno del servidor al obtener el historial."}), 500

    @app.route("/api/entrenador/cargarEntrenadores", methods=["GET"])
    def cargar_entrenadores():
        """
        Carga la lista de todos los entrenadores/staff.
        Filtra por el rol 'entrenador'.
        """
        try:
            # Paso 1: Obtener el ID del rol 'entrenador'
            res_rol = supabase.from_('roles').select('id_rol').eq('nombre', 'entrenador').limit(1).maybe_single().execute()
            id_rol_entrenador = res_rol.data.get('id_rol') if res_rol.data else None
            
            if not id_rol_entrenador:
                return jsonify({"ok": True, "entrenadores": [], "mensaje": "Rol 'entrenador' no encontrado."})


            # Paso 2: Consulta de usuarios con rol 'entrenador'
            res = supabase.from_('usuarios').select('id_usuario, nombre').eq('id_rol', id_rol_entrenador).execute()
            
            # Mapea los resultados para que el frontend los reciba como {id: ..., nombre: ...}
            entrenadores_list = [{"id": e['id_usuario'], "nombre": e['nombre']} for e in res.data]
            
            return jsonify({"ok": True, "entrenadores": entrenadores_list})

        except Exception as e:
            print(f"Error al cargar entrenadores: {e}")
            return jsonify({"ok": False, "mensaje": "Error interno del servidor al obtener entrenadores."}), 500


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

    sesiones_resp = supabase.table("n_sesiones_progreso").select("*").eq("id_miembro", member_id).order("fecha", desc=True).execute()
    sesiones = sesiones_resp.data if sesiones_resp.data else []

    historial = {
        "fechas": [p["fecha"] for p in progreso],
        "peso": [float(p["peso"]) if p["peso"] is not None else None for p in progreso],
        "grasa": [float(p["grasa_corporal"]) if p["grasa_corporal"] is not None else None for p in progreso],
        "masa_muscular": [float(p["masa_muscular"]) if p["masa_muscular"] is not None else None for p in progreso]
    }

    last_update = progreso[0]["fecha"] if progreso else None

    edad = None
    if usuario.get("fecha_nacimiento"):
        from datetime import datetime
        fecha_nac = datetime.strptime(usuario["fecha_nacimiento"], "%Y-%m-%d")
        hoy = datetime.now()
        edad = hoy.year - fecha_nac.year - ((hoy.month, hoy.day) < (fecha_nac.month, fecha_nac.day))

    return jsonify({
        "usuario": {
            "nombre": f"{usuario.get('nombre', '')} {usuario.get('apellido', '')}".strip(),
            "correo": usuario.get("correo", ""),
            "avatar": usuario.get("imagen_url", ""),
            "edad": edad,
            "telefono": usuario.get("telefono", ""),
            "direccion": usuario.get("direccion", ""),
            "estado": "Activo"
        },
        "objetivos": objetivos,
        "estado_salud": estados_salud,
        "sesiones": sesiones,
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
def n_chat_nutricion_enviar_nutricionista():
    try:
        data = request.json
        
        insert_data = {
            "id_miembro": data.get("id_miembro"),
            "id_nutricionista": data.get("id_nutricionista"),
            "mensaje": data.get("mensaje"),
        }
        
        if not all(insert_data.values()):
             return jsonify({"error": "Faltan campos requeridos: 'id_miembro', 'id_nutricionista' y 'mensaje' son obligatorios."}), 400

        res = supabase.table("n_chat_nutricion").insert(insert_data).execute()
        
        return jsonify(res.data), 201
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

# OTRO

@app.route("/api/nutricionista/perfil/buscar", methods=["GET"])
def api_nutricionista_perfil_buscar():
    q = request.args.get('q', '').lower()
    if not q:
        return jsonify({"items": []})

    
    search_results = supabase.table("usuarios").select("id_usuario, nombre, correo").or_(f"nombre.ilike.%{q}%, correo.ilike.%{q}%").execute()

    items = [{"id": u["id_usuario"], "nombre": u["nombre"], "correo": u["correo"]} for u in search_results.data]
    return jsonify({"items": items})

@app.route("/api/nutricionista/perfil/get/<id_miembro>", methods=["GET"])
def api_nutricionista_perfil_get(id_miembro):
    
    usuario_response = supabase.table("usuarios").select("id_usuario, nombre, correo, avatar, edad, telefono, direccion").eq("id_usuario", id_miembro).execute()
    usuario_data = usuario_response.data[0] if usuario_response.data else None

    if not usuario_data:
        return jsonify({"error": "Miembro no encontrado"}), 404

    
    historial_response = supabase.table("n_sesiones_progreso").select("fecha, peso, grasa_corporal, masa_muscular, observaciones").eq("id_miembro", id_miembro).order("fecha", desc=False).execute()
    historial_data = historial_response.data
    
    fechas = [h["fecha"] for h in historial_data]
    peso = [h["peso"] for h in historial_data]
    grasa = [h["grasa_corporal"] for h in historial_data]
    masa_muscular = [h["masa_muscular"] for h in historial_data]

    last_update = historial_data[-1]["fecha"] if historial_data else None

    
    objetivos_response = supabase.table("n_objetivos").select("descripcion").eq("id_miembro", id_miembro).order("fecha_inicio", desc=True).execute()
    objetivos_data = objetivos_response.data

    
    salud_response = supabase.table("n_estado_salud").select("fecha, hora, nota").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    salud_data = salud_response.data

    
    sesiones_response = supabase.table("n_sesiones_evaluacion").select("id_sesion, fecha, hora, notas, estado").eq("id_miembro", id_miembro).order("fecha", desc=True).execute()
    sesiones_data = sesiones_response.data

    return jsonify({
        "usuario": usuario_data,
        "objetivos": objetivos_data,
        "estado_salud": salud_data,
        "sesiones": sesiones_data,
        "historial": {
            "fechas": fechas,
            "peso": peso,
            "grasa": grasa,
            "masa_muscular": masa_muscular,
        },
        "last_update": last_update
    })

@app.route("/api/nutricionista/progreso/registrar", methods=["POST"])
def api_nutricionista_progreso_registrar():
    data = request.json
    id_miembro = data.get("id_miembro")
    peso = data.get("peso")
    grasa_corporal = data.get("grasa_corporal")
    masa_muscular = data.get("masa_muscular")
    observaciones = data.get("observaciones")
    
    if not id_miembro:
        return jsonify({"error": "Faltan campos requeridos (id_miembro)"}), 400

    try:
        data_to_insert = {
            "id_miembro": id_miembro,
            "peso": peso,
            "grasa_corporal": grasa_corporal,
            "masa_muscular": masa_muscular,
            "observaciones": observaciones,
            "fecha": datetime.now().strftime("%Y-%m-%d") 
        }
        
        response = supabase.table("n_sesiones_progreso").insert(data_to_insert).execute()
        
        return jsonify({"message": "Métricas de progreso registradas con éxito", "data": response.data}), 201
    except Exception as e:
        return jsonify({"error": f"Error al registrar las métricas: {str(e)}"}), 500

@app.route("/api/nutricionista/sesiones/crear", methods=["POST"])
def api_nutricionista_sesiones_crear():
    data = request.json
    id_miembro = data.get("id_miembro")
    fecha = data.get("fecha")
    hora = data.get("hora")
    notas = data.get("notas")
    estado = data.get("estado", "programada")
    
    if not id_miembro or not fecha or not hora:
        return jsonify({"error": "Faltan campos requeridos (id_miembro, fecha, hora)"}), 400

    try:
        data_to_insert = {
            "id_miembro": id_miembro,
            "fecha": fecha,
            "hora": hora,
            "notas": notas,
            "estado": estado
        }
        
        response = supabase.table("n_sesiones_evaluacion").insert(data_to_insert).execute()
        
        return jsonify({"message": "Sesión registrada con éxito", "data": response.data}), 201
    except Exception as e:
        return jsonify({"error": f"Error al registrar la sesión: {str(e)}"}), 500

@app.route("/api/nutricionista/sesiones/eliminar/<id_sesion>", methods=["DELETE"])
def api_nutricionista_sesiones_eliminar(id_sesion):
    try:
        
        response = supabase.table("n_sesiones_evaluacion").delete().eq("id_sesion", id_sesion).execute()
        
        return jsonify({"message": f"Sesión {id_sesion} eliminada con éxito", "data": response.data}), 200
    except Exception as e:
        return jsonify({"error": f"Error al eliminar la sesión: {str(e)}"}), 500

@app.route("/api/nutricionista/sesiones/actualizar_estado/<id_sesion>", methods=["PUT"])
def api_nutricionista_sesiones_actualizar_estado(id_sesion):
    data = request.json
    nuevo_estado = data.get("estado")
    
    if nuevo_estado not in ["programada", "realizada", "cancelada"]:
        return jsonify({"error": "Estado no válido"}), 400

    try:
        
        response = supabase.table("n_sesiones_evaluacion").update({"estado": nuevo_estado}).eq("id_sesion", id_sesion).execute()
        
        return jsonify({"message": f"Estado de la sesión {id_sesion} actualizado a {nuevo_estado}", "data": response.data}), 200
    except Exception as e:
        return jsonify({"error": f"Error al actualizar el estado de la sesión: {str(e)}"}), 500

# MODULO RECEPCIONISTA

@app.route("/index_recepcionista")
def index_recepcionista():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/recepcionista_modulos_render/<modulo>")
def recepcionista_modulos_render(modulo):
    user_data = session.get("user")
    if not user_data:
        user_data = {"rol": "invitado"}
    return render_template(f"receptionist_modules/{modulo}.html", user=user_data)

# SECCION PAGOS MEMBRESIAS

# FUNCIONES APARTADO PAGO EMMBRESIA / MODULO PAGO MEMBRESIAS - RECEPCIONISTA

def get_user_id_by_identificador(identificador):
    if not identificador:
        return None
    
    try:
        response = supabase.table("usuarios").select("id_usuario").eq("cedula", identificador).single().execute()
        return response.data["id_usuario"]
    except Exception:
        return None

def obtener_id_usuario():
    user = session.get("user")
    if not user:
        return None
    return user.get("id_usuario")

@app.route("/api/recepcionista/registrar_miembro", methods=["POST"])
def recepcionista_registrar_miembro():
    data = request.json
    if not data:
        return jsonify({"success": False, "message": "No se recibieron datos."}), 400
    contrasena = data.get("contrasena")
    if not contrasena:
        return jsonify({"success": False, "message": "Contraseña es obligatoria."}), 400
    contrasena_hash = scrypt.hash(contrasena)
    datos_usuario = {
        "nombre": data.get("nombre"),
        "apellido": data.get("apellido"),
        "cedula": data.get("cedula"),
        "correo": data.get("correo"),
        "contrasena": contrasena_hash,
        "id_rol": data.get("id_rol"),
        "telefono": data.get("telefono"),
        "fecha_nacimiento": data.get("fecha_nacimiento"),
        "metodo_pago": data.get("metodo_pago")
    }
    try:
        response = supabase.table("usuarios").insert(datos_usuario).execute()
        if response.data:
            miembro_id = response.data[0]["id_usuario"]
            return jsonify({"success": True, "miembro_id": miembro_id, "message": "Miembro registrado con éxito."}), 201
        else:
            return jsonify({"success": False, "message": "Fallo al registrar miembro en Supabase.", "error": response.error}), 500
    except Exception as e:
        return jsonify({"success": False, "message": f"Error al registrar miembro: {str(e)}"}), 500

@app.route("/api/recepcionista/registrar_pago_y_membresia", methods=["POST"])
def recepcionista_registrar_pago_y_membresia():
    data = request.json
    if not data or not data.get("identificador"):
        return jsonify({"success": False, "message": "No se recibieron datos o el identificador es obligatorio."}), 400
    identificador = data.get("identificador")
    miembro_id = get_user_id_by_identificador(identificador)
    if not miembro_id:
        return jsonify({"success": False, "message": "Miembro no encontrado o Cédula/ID inválida."}), 404
    tipo_membresia = data.get("tipo_membresia").lower()
    fecha_inicio = data.get("fecha_inicio")
    fecha_fin = data.get("fecha_fin")
    monto = data.get("monto")
    metodo_pago = data.get("metodo_pago")
    try:
        datos_membresia = {
            "id_miembro": miembro_id,
            "tipo_membresia": tipo_membresia,
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "precio": monto,
            "estado": "activa",
            "metodo_pago": metodo_pago
        }
        res_membresia = supabase.table("m_membresias").insert(datos_membresia).execute()
        if not res_membresia.data:
            return jsonify({"success": False, "message": "Fallo al registrar el contrato de membresía.", "error": res_membresia.error}), 500
        membresia_id = res_membresia.data[0]["id_membresia"]
        datos_pago = {
            "id_miembro": miembro_id,
            "id_membresia": membresia_id,
            "monto": monto,
            "metodo_pago": metodo_pago,
            "tipo_pago": data.get("tipo_pago", "Renovacion"),
            "referencia_pago": data.get("referencia_pago"),
            "estado_pago": "Completado"
        }
        res_pago = supabase.table("a_transacciones_pagos").insert(datos_pago).execute()
        if res_pago.data:
            return jsonify({"success": True, "membresia_id": membresia_id, "transaccion_id": res_pago.data[0]["id_transaccion"], "message": "Membresía y pago registrados con éxito."}), 201
        else:
            return jsonify({"success": False, "message": "Fallo al registrar la transacción de pago.", "error": res_pago.error}), 500
    except Exception as e:
        return jsonify({"success": False, "message": f"Error en la transacción de membresía/pago: {str(e)}"}), 500

@app.route("/api/recepcionista/actualizar_estado_membresia", methods=["POST"])
def actualizar_estado_membresia():
    data = request.json
    identificador = data.get("identificador")
    fecha_inicio = data.get("fecha_inicio")
    fecha_fin = data.get("fecha_fin")
    if not identificador or not fecha_inicio or not fecha_fin:
        return jsonify({"success": False, "message": "Datos incompletos."}), 400
    miembro_id = get_user_id_by_identificador(identificador)
    if not miembro_id:
        return jsonify({"success": False, "message": "Miembro no encontrado."}), 404
    try:
        res_membresia = supabase.table("m_membresias").select("*").eq("id_miembro", miembro_id).neq("estado", "cancelada").order("fecha_fin", desc=True).limit(1).execute()
        if not res_membresia.data:
            return jsonify({"success": False, "message": "No hay membresías previas."}), 404
        membresia_id = res_membresia.data[0]["id_membresia"]
        update_data = {
            "estado": "activa",
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin
        }
        res_update = supabase.table("m_membresias").update(update_data).eq("id_membresia", membresia_id).execute()
        if res_update.data:
            return jsonify({"success": True, "message": "Estado de membresía actualizado."}), 200
        else:
            return jsonify({"success": False, "message": "No se pudo actualizar la membresía."}), 500
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/recepcionista/obtener_estado_miembro", methods=["POST"])
def obtener_estado_miembro():
    data = request.json
    identificador = data.get("identificador")
    if not identificador:
        return jsonify({"success": False, "message": "Identificador es obligatorio."}), 400
    id_miembro = get_user_id_by_identificador(identificador)
    if not id_miembro:
        return jsonify({"success": False, "status": "No Miembro", "nombre": "No encontrado"}), 200
    try:
        res_usuario = supabase.table("usuarios").select("nombre, apellido").eq("id_usuario", id_miembro).single().execute()
        nombre_completo = f"{res_usuario.data['nombre']} {res_usuario.data['apellido']}"
        today = date.today().isoformat()
        res_membresia = supabase.table("m_membresias").select("*").eq("id_miembro", id_miembro).neq("estado", "cancelada").order("fecha_fin", desc=True).limit(1).execute()
        status = "No Membresía"
        monto_pendiente = 0.0
        if res_membresia.data:
            membresia = res_membresia.data[0]
            fecha_fin = datetime.strptime(membresia["fecha_fin"], "%Y-%m-%d").date().isoformat()
            if membresia["estado"] == "activa" and fecha_fin >= today:
                status = "Activo"
            elif membresia["estado"] == "activa" and fecha_fin < today:
                status = "Vencido"
                monto_pendiente = float(membresia["precio"])
            elif membresia["estado"] == "vencida":
                status = "Vencido"
                monto_pendiente = float(membresia["precio"])
            else:
                status = "Inactivo/Otro"
        return jsonify({"success": True, "status": status, "nombre": nombre_completo, "id_miembro": id_miembro, "monto_pendiente": monto_pendiente}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Error al buscar estado: {str(e)}"}), 500

@app.route("/api/recepcionista/membresias", methods=["GET"])
def listar_membresias():
    try:
        response = supabase.table("m_membresias").select("*, usuarios!m_membresias_id_miembro_fkey(nombre, apellido, cedula)").order("fecha_inicio", desc=True).limit(50).execute()
        return jsonify({"success": True, "data": response.data}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Error al listar membresías: {str(e)}"}), 500

@app.route("/api/recepcionista/membresia/<id_membresia>", methods=["GET", "PUT"])
def gestionar_membresia(id_membresia):
    if request.method == "GET":
        try:
            response = supabase.table("m_membresias").select("*, usuarios!m_membresias_id_miembro_fkey(nombre, apellido, cedula)").eq("id_membresia", id_membresia).single().execute()
            return jsonify({"success": True, "data": response.data}), 200
        except Exception as e:
            return jsonify({"success": False, "message": f"Membresía no encontrada o error: {str(e)}"}), 404
    elif request.method == "PUT":
        data = request.json
        if not data:
            return jsonify({"success": False, "message": "No se recibieron datos para actualizar."}), 400
        try:
            update_data = {}
            if "estado" in data:
                update_data["estado"] = data["estado"].lower()
            if "fecha_fin" in data:
                update_data["fecha_fin"] = data["fecha_fin"]
            if "precio" in data:
                update_data["precio"] = data["precio"]
            if not update_data:
                return jsonify({"success": False, "message": "No hay campos válidos para actualizar."}), 400
            response = supabase.table("m_membresias").update(update_data).eq("id_membresia", id_membresia).execute()
            if response.data:
                return jsonify({"success": True, "message": "Membresía actualizada con éxito.", "data": response.data[0]}), 200
            else:
                return jsonify({"success": False, "message": "Fallo al actualizar membresía.", "error": response.error}), 500
        except Exception as e:
            return jsonify({"success": False, "message": f"Error al actualizar membresía: {str(e)}"}), 500

@app.route("/api/recepcionista/transacciones", methods=["GET"])
def listar_transacciones():
    try:
        fecha_desde = request.args.get('fecha_desde', (date.today() - timedelta(days=30)).isoformat())
        response = supabase.table("a_transacciones_pagos").select("*, usuarios!a_transacciones_pagos_id_miembro_fkey(nombre, apellido), m_membresias(tipo_membresia)").gte("fecha_transaccion", fecha_desde).order("fecha_transaccion", desc=True).limit(50).execute()
        return jsonify({"success": True, "data": response.data}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Error al listar transacciones: {str(e)}"}), 500

@app.route("/api/recepcionista/checkins_hoy", methods=["GET"])
def listar_checkins_hoy():
    try:
        today = date.today().isoformat()
        response = supabase.table("r_checkins").select("*, usuarios_miembro:usuarios!r_checkins_id_miembro_fkey(nombre, apellido, cedula), usuarios_recepcionista:usuarios!r_checkins_id_recepcionista_fkey(nombre)").gte("fecha_entrada", today).order("fecha_entrada", desc=True).limit(50).execute()
        return jsonify({"success": True, "data": response.data}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Error al listar check-ins de hoy: {str(e)}"}), 500

@app.route("/api/recepcionista/dashboard_stats", methods=["GET"])
def obtener_estadisticas_dashboard():
    try:
        today = date.today().isoformat()
        next_week = (date.today() + timedelta(days=7)).isoformat()
        res_activos = supabase.table("m_membresias").select("id_membresia", count="exact").eq("estado", "activa").gte("fecha_fin", today).execute()
        total_activos = res_activos.count
        res_vencimiento = supabase.table("m_membresias").select("id_membresia", count="exact").eq("estado", "activa").gte("fecha_fin", today).lte("fecha_fin", next_week).execute()
        vencimientos_proximos = res_vencimiento.count
        res_pagos_vencidos = supabase.table("a_transacciones_pagos").select("id_transaccion", count="exact").eq("estado_pago", "Pendiente").execute()
        pagos_pendientes = res_pagos_vencidos.count
        return jsonify({"success": True, "total_activos": total_activos, "vencimientos_proximos": vencimientos_proximos, "pagos_pendientes": pagos_pendientes}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Error al obtener estadísticas: {str(e)}"}), 500

# SECCION CITAS

# FUNCIONES APARTADO CITAS / MODULO CITAS - RECEPCIONISTA

def obtener_id_y_nombre_por_cedula(cedula):
    try:
        response = supabase.table('usuarios').select('id_usuario, nombre, apellido').eq('cedula', cedula).execute()
        
        if response.data:
            user = response.data[0]
            return {
                "id_usuario": user.get('id_usuario'),
                "nombre_completo": f"{user.get('nombre')} {user.get('apellido')}"
            }
        return None
    except Exception as e:
        print(f"Error al buscar usuario por cédula: {e}")
        return None

@app.route('/api/reservar_cita', methods=['POST'])
def reservar_cita():
    data = request.get_json()
    
    try:
        cedula = data.get('cedula')
        tipo_servicio = data.get('tipo_servicio')
        fecha_str = data.get('fecha')
        hora_str = data.get('hora')
        
        if not all([cedula, tipo_servicio, fecha_str, hora_str]):
            return jsonify({"mensaje": "Error: Faltan campos obligatorios."}), 400
            
        miembro_data = obtener_id_y_nombre_por_cedula(cedula)
        if not miembro_data:
            return jsonify({"mensaje": "Error: La cédula proporcionada no está registrada en el sistema."}), 404

        id_miembro = miembro_data['id_usuario']

        try:
            datetime.strptime(fecha_str, DATE_FORMAT)
            if len(hora_str) == 5:
                hora_str += ':00'
            datetime.strptime(hora_str, '%H:%M:%S') 
        except ValueError as e:
            return jsonify({"mensaje": "Error en el formato de datos (Fecha u Hora).", "detalles": str(e)}), 400

        if tipo_servicio not in ['Nutrición', 'Masaje', 'Sauna']:
            return jsonify({"mensaje": "Tipo de servicio inválido. Debe ser Nutrición, Masaje o Sauna."}), 400

        cita_data = {
            "id_miembro": id_miembro,
            "tipo_servicio": tipo_servicio,
            "fecha": fecha_str,
            "hora": hora_str,
            "estado": "Reservada"
        }

        response = supabase.table('r_citas').insert(cita_data).execute()
        
        if response.data:
            cita_registrada = response.data[0]
            cita_id = cita_registrada.get("id_cita")
            
            if not cita_id:
                return jsonify({"mensaje": "Cita registrada, pero no se pudo obtener el ID de Supabase.", "detalles": "ID nulo."}), 500
            
            return jsonify({
                "mensaje": "Cita registrada exitosamente.",
                "id_cita": cita_id
            }), 200
        else:
            error_message = response.error.get('message', 'Error desconocido de Supabase.') if response.error else 'Error sin detalles.'
            return jsonify({"mensaje": "Error al insertar la cita en la base de datos.", "detalles": error_message}), 500

    except Exception as e:
        return jsonify({"mensaje": "Error interno del servidor al procesar la solicitud.", "detalles": str(e)}), 500

@app.route('/api/consultar_citas_por_cedula', methods=['POST'])
def consultar_citas_por_cedula():
    data = request.get_json()
    cedula = data.get('cedula')
    page = data.get('page', 1)
    limit = 15

    if not cedula:
        return jsonify({"mensaje": "La cédula es requerida para la consulta."}), 400

    try:
        response_user = supabase.table('usuarios').select('id_usuario').eq('cedula', cedula).limit(1).maybe_single().execute()

        if not response_user.data:
            return jsonify({"mensaje": "Miembro no encontrado o cédula incorrecta.", "citas": {}, "total": 0, "paginas": 0}), 404

        id_miembro = response_user.data.get('id_usuario')
        
        offset = (page - 1) * limit
        
        response_count = supabase.table('r_citas').select('id_cita', count='exact')\
            .eq('id_miembro', id_miembro)\
            .eq('estado', 'Reservada')\
            .execute()
        
        total_citas = response_count.count if response_count.count else 0
        total_paginas = (total_citas + limit - 1) // limit if total_citas > 0 else 0
        
        response_citas = supabase.table('r_citas').select('*')\
            .eq('id_miembro', id_miembro)\
            .eq('estado', 'Reservada')\
            .order('fecha', desc=False)\
            .order('hora', desc=False)\
            .range(offset, offset + limit - 1)\
            .execute()

        citas_formateadas = []
        for cita in response_citas.data:
            citas_formateadas.append({
                "id_cita": cita.get("id_cita"),
                "tipo_servicio": cita.get("tipo_servicio"),
                "fecha": cita.get("fecha"),
                "hora": str(cita.get("hora")),
                "estado": cita.get("estado")
            })

        return jsonify({
            "mensaje": "Citas encontradas exitosamente.",
            "citas": citas_formateadas,
            "total": total_citas,
            "pagina_actual": page,
            "total_paginas": total_paginas
        }), 200

    except Exception as e:
        error_details = str(e)
        if 'response_user' in locals() and response_user.error:
             error_details = response_user.error.get('message', str(e))
        return jsonify({"mensaje": "Error interno del servidor al consultar las citas.", "detalles": error_details}), 500

@app.route('/api/cancelar_cita', methods=['DELETE'])
def cancelar_cita():
    data = request.get_json()
    id_cita = data.get('id_cita')

    if not id_cita:
        return jsonify({"mensaje": "El ID de la cita es requerido para la cancelación."}), 400

    try:
        uuid.UUID(id_cita)
    except ValueError:
        return jsonify({"mensaje": "Formato de ID de cita inválido."}), 400

    try:
        response = supabase.table('r_citas').update({"estado": "Cancelada"}).eq('id_cita', id_cita).execute()
        
        if response.data and len(response.data) > 0:
            return jsonify({"mensaje": "Cita cancelada exitosamente.", "id_cita_cancelada": id_cita}), 200
        else:
            return jsonify({"mensaje": "No se encontró la cita con el ID proporcionado para cancelar."}), 404

    except Exception as e:
        error_details = str(e)
        if 'response' in locals() and response.error:
            error_details = response.error.get('message', str(e))
        return jsonify({"mensaje": "Error interno del servidor al cancelar la cita.", "detalles": error_details}), 500

# APP RUN

if __name__=="__main__":
    app.run(debug=True, port=3000)
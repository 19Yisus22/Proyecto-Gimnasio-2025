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



# MODULOS CASI TERMINADOS:
# MODULOS ENTRENADOR

@app.route("/index_entrenador")
def index_entrenador():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/entrenador_modulos_render/<modulo>")
def entrenador_modulos_render(modulo):
    return render_template(f"trainer_modules/{modulo}.html", user=session.get("user"))

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




# FUNCIONES SECCION PROGRESO MODULO CLASES - ENTRENADOR

@app.route("/miembros_progreso")
def miembros_progreso():
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
def miembro_detalle(id):
    historial_data = supabase.table("progreso").select(
        "fecha,peso,grasa_corporal,masa_muscular,fuerza,resistencia,calorias_quemadas,objetivo_personal"
    ).eq("id_miembro", id).order("fecha", ascending=True).execute()
    historial = historial_data.data
    if historial:
        for h in historial:
            h["calorias"] = h.pop("calorias_quemadas", 0)
        return jsonify({"ok": True, "historial": historial})
    return jsonify({"ok": False})


# FUNCIONES GESTION ENTRENAMIENTOS - ENTRENADOR

@app.route("/api/miembro/<id_miembro>", methods=["GET"])
def obtener_miembro(id_miembro):
    resp = (
        supabase.table("usuarios")
        .select("*")
        .eq("id_usuario", id_miembro)
        .single()
        .execute()
    )
    return jsonify(resp.data), 200

@app.route("/api/progreso", methods=["POST"])
def crear_progreso_gestion():
    data = request.get_json()
    payload = {
        "id_progreso": str(uuid.uuid4()),
        "id_miembro": data.get("id_miembro"),
        "fecha": data.get("fecha"),
        "peso": data.get("peso"),
        "grasa_corporal": data.get("grasa_corporal"),
        "masa_muscular": data.get("masa_muscular"),
        "notas": data.get("notas"),
        "objetivo_personal": data.get("objetivo_personal")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("progreso").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/progreso/<id_miembro>", methods=["GET"])
def obtener_progreso_gestion(id_miembro):
    resp = supabase.table("progreso").select("*").eq("id_miembro", id_miembro).order("fecha", desc=False).execute()
    return jsonify(resp.data), 200

@app.route("/api/sesiones/<id_miembro>", methods=["GET"])
def api_listar_sesiones(id_miembro):
    resp = supabase.table("entrenamientos_personales").select("*").eq("id_miembro", id_miembro).order("fecha_hora", desc=False).execute()
    return jsonify(resp.data), 200

@app.route("/api/sesion", methods=["POST"])
def crear_sesion():
    data = request.get_json()
    payload = {
        "id_entrenamiento": str(uuid.uuid4()),
        "id_miembro": data.get("id_miembro"),
        "id_entrenador": data.get("id_entrenador"),
        "fecha_hora": data.get("fecha_hora"),
        "hora_inicio": data.get("hora_inicio"),
        "duracion": data.get("duracion"),
        "tipo": data.get("tipo"),
        "notas": data.get("notas"),
        "estado": data.get("estado")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("entrenamientos_personales").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/estado_salud/<id_miembro>", methods=["GET"])
def obtener_estado_salud(id_miembro):
    resp = supabase.table("estado_salud").select("*").eq("id_miembro", id_miembro).order("fecha", desc=False).execute()
    return jsonify(resp.data), 200

@app.route("/api/estado_salud", methods=["POST"])
def crear_estado_salud():
    data = request.get_json()
    payload = {
        "id_estado": str(uuid.uuid4()),
        "id_miembro": data.get("id_miembro"),
        "fecha": data.get("fecha"),
        "hora": data.get("hora"),
        "nota": data.get("nota")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("estado_salud").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/estado_salud/<id_estado>", methods=["DELETE"])
def eliminar_estado_salud(id_estado):
    resp = supabase.table("estado_salud").delete().eq("id_estado", id_estado).execute()
    return jsonify(resp.data), 200

@app.route("/api/estado_salud/<id_estado>", methods=["PUT"])
def actualizar_estado_salud(id_estado):
    data = request.get_json()
    payload = {
        "nota": data.get("nota"),
        "fecha": data.get("fecha"),
        "hora": data.get("hora")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("estado_salud").update(payload).eq("id_estado", id_estado).execute()
    return jsonify(resp.data), 200

@app.route("/api/notas/<id_miembro>", methods=["GET"])
def obtener_notas(id_miembro):
    resp = supabase.table("feedback_entrenadores").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=False).execute()
    return jsonify(resp.data), 200

@app.route("/api/notas", methods=["POST"])
def crear_nota():
    data = request.get_json()
    payload = {
        "id_feedback": str(uuid.uuid4()),
        "id_entrenador": data.get("id_entrenador"),
        "id_miembro": data.get("id_miembro"),
        "mensaje": data.get("mensaje"),
        "calificacion": None,
        "respuesta_entrenador": None
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("feedback_entrenadores").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/planes/<id_miembro>", methods=["GET"])
def obtener_planes(id_miembro):
    resp = supabase.table("planes").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=False).execute()
    return jsonify(resp.data), 200

@app.route("/api/planes", methods=["POST"])
def crear_plan():
    data = request.get_json()
    payload = {
        "id_plan": str(uuid.uuid4()),
        "id_miembro": data.get("id_miembro"),
        "objetivo": data.get("descripcion"),
        "categoria": data.get("categoria"),
        "semanas": data.get("semanas"),
        "frecuencia": data.get("frecuencia")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("planes").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/planes/<id_plan>", methods=["DELETE"])
def eliminar_plan(id_plan):
    resp = supabase.table("planes").delete().eq("id_plan", id_plan).execute()
    return jsonify(resp.data), 200

@app.route("/api/planes/<id_plan>", methods=["PUT"])
def actualizar_plan(id_plan):
    data = request.get_json()
    payload = {
        "objetivo": data.get("descripcion"),
        "categoria": data.get("categoria"),
        "semanas": data.get("semanas"),
        "frecuencia": data.get("frecuencia")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("planes").update(payload).eq("id_plan", id_plan).execute()
    return jsonify(resp.data), 200

@app.route("/api/progreso/<id_progreso>", methods=["PUT"])
def actualizar_progreso_otro(id_progreso):
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
def eliminar_progreso_getion(id_progreso):
    try:
        uuid_obj = uuid.UUID(id_progreso)
    except ValueError:
        return jsonify({"error": "ID inválido"}), 400
    resp = supabase.table("progreso").delete().eq("id_progreso", str(uuid_obj)).execute()
    return jsonify(resp.data), 200

@app.route("/api/feedback/<id_miembro>", methods=["GET"])
def obtener_feedback(id_miembro):
    resp = supabase.table("feedback_entrenadores").select("*").eq("id_miembro", id_miembro).order("fecha_creacion", desc=False).execute()
    return jsonify(resp.data), 200

@app.route("/api/feedback", methods=["POST"])
def crear_feedback():
    data = request.get_json()
    payload = {
        "id_feedback": str(uuid.uuid4()),
        "id_entrenador": data.get("id_entrenador") or None,
        "id_miembro": data.get("id_miembro") or None,
        "mensaje": data.get("mensaje"),
        "respuesta_entrenador": data.get("respuesta_entrenador")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    if "mensaje" not in payload or not payload["mensaje"].strip():
        return jsonify({"error": "El campo 'mensaje' es obligatorio"}), 400
    resp = supabase.table("feedback_entrenadores").insert(payload).execute()
    return jsonify(resp.data), 200

@app.route("/api/feedback/<id_feedback>", methods=["DELETE"])
def eliminar_feedback(id_feedback):
    resp = supabase.table("feedback_entrenadores").delete().eq("id_feedback", id_feedback).execute()
    return jsonify(resp.data), 200

@app.route("/api/feedback/<id_feedback>", methods=["PUT"])
def actualizar_feedback(id_feedback):
    data = request.get_json()
    payload = {
        "mensaje": data.get("mensaje"),
        "respuesta_entrenador": data.get("respuesta_entrenador")
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    resp = supabase.table("feedback_entrenadores").update(payload).eq("id_feedback", id_feedback).execute()
    return jsonify(resp.data), 200










if __name__=="__main__":
    app.run(debug=True, port=3000)
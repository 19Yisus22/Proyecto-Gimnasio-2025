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
        return jsonify({"ok": False, "error":"Usuario no autenticado"}), 200  # Retorna 200 para que JS no rompa
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



# APP RUN

if __name__=="__main__":
    app.run(debug=True, port=3000)








'''# INDEXS SIN CONFIGURAR

# MODULO PERFIL - ARREGLAR

@app.route("/index_perfil")
def index_perfil():
    return render_template("mi_perfil.html", user=session.get("user"))

@app.route("/api/usuario/actualizar_completo", methods=["POST"])
def actualizar_completo():
    if "user_id" not in session:
        return jsonify({"success": False, "message": "No autenticado"}), 401
    data = request.form.to_dict()
    update_fields = {
        "nombre": data.get("nombrePerfil"),
        "apellido": data.get("apellidoPerfil"),
        "telefono": data.get("telefonoPerfil"),
        "direccion": data.get("direccionPerfil"),
        "metodo_pago": data.get("metodoPagoPerfil"),
        "correo": data.get("correoPerfil")
    }
    if "imagen_url" in request.files and request.files["imagen_url"]:
        file = request.files["imagen_url"]
        if '.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS:
            filename = secure_filename(file.filename)
            local_path = os.path.join(UPLOAD_DIR, filename)
            file.save(local_path)
            upload_result = cloudinary.uploader.upload(local_path, folder="usuarios")
            url = upload_result.get("secure_url")
            update_fields["imagen_url"] = url
            os.remove(local_path)
    result = supabase.table("usuarios").update(update_fields).eq("id_usuario", session["user_id"]).execute()
    return jsonify({"success": result.status_code == 200})

@app.route("/api/usuario/cambiar_contrasena", methods=["POST"])
def cambiar_contrasena():
    if "user_id" not in session:
        return jsonify({"success": False, "message": "No autenticado"}), 401
    data = request.get_json()
    nueva = data.get("contrasena")
    if not nueva:
        return jsonify({"success": False, "message": "Contraseña vacía"}), 400
    result = supabase.table("usuarios").update({"contrasena": nueva}).eq("id_usuario", session["user_id"]).execute()
    return jsonify({"success": result.status_code == 200})


@app.route("/index_recepcionista")
def index_recepcionista():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/recepcionista_modulos_render/<modulo>")
def recepcionista_modulos_render(modulo):
    return render_template(f"receptionist_modules/{modulo}.html", user=session.get("user"))

@app.route("/index_nutricionista")
def index_nutricionista():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/nutricionista_modulos_render/<modulo>")
def nutricionista_modulos_render(modulo):
    return render_template(f"nutritionist_modules/{modulo}.html", user=session.get("user"))
'''
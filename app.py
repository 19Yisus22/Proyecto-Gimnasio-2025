from flask_cors import CORS
from datetime import datetime
from dotenv import load_dotenv
from passlib.hash import scrypt
from supabase import create_client
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
import os, uuid, secrets, cloudinary, cloudinary.uploader
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
cloudinary.config(cloud_name=CLOUDINARY_CLOUD_NAME, api_key=CLOUDINARY_API_KEY, api_secret=CLOUDINARY_API_SECRET)

app = Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)
CORS(app, supports_credentials=True)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.secret_key = os.getenv("SECRET_KEY", secrets.token_hex(24))
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png','jpg','jpeg','gif','ico'}

# FUNCIONANDO

def allowed_file(filename):
    ext = filename.rsplit(".",1)[-1].lower() if "." in filename else ""
    return ext in ALLOWED_EXTENSIONS

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
    id_rol = rol_res.data.get("id_rol") if rol_res.data else None
    res = supabase.table("usuarios").insert({
        "cedula": data["cedula"],
        "nombre": data["nombre"],
        "apellido": data["apellido"],
        "genero": data.get("genero", ""),
        "telefono": data.get("telefono", ""),
        "direccion": data.get("direccion", ""),
        "fecha_nacimiento": data.get("fecha_nacimiento", ""),
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
    res = supabase.table("usuarios").select("*").eq("correo", correo).maybe_single().execute()
    usuario = res.data
    if not usuario:
        return jsonify({"ok": False, "error": "Correo no registrado"}), 404
    stored_password = usuario.get("contrasena", "")
    if not scrypt.verify(contrasena, stored_password):
        return jsonify({"ok": False, "error": "Contraseña incorrecta"}), 401
    rol_res = supabase.table("roles").select("*").eq("id_rol", usuario.get("id_rol")).maybe_single().execute()
    rol = rol_res.data if rol_res.data else {"nombre_rol": "visitante"}
    session["user"] = {
        "id_usuario": usuario.get("id_usuario"),
        "nombre": usuario.get("nombre"),
        "apellido": usuario.get("apellido"),
        "correo": usuario.get("correo"),
        "imagen_url": usuario.get("imagen_url") or "/static/uploads/default_icon_profile.png",
        "rol": {"id_rol": usuario.get("id_rol"), "nombre_rol": rol.get("nombre_rol")}
    }
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

# MODULOS MIEMBROS - ARREGLAR

@app.route("/index_miembro")
def index_miembro():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/clases_reservas", methods=["GET","POST"])
def clases_reservas():
    if request.method=="GET":
        if request.headers.get("Accept")=="application/json":
            clases = supabase.table("clases").select("*").execute()
            reservas = supabase.table("reservas").select("*").execute()
            return jsonify({"ok": True, "clases": getattr(clases,"data",[]), "reservas": getattr(reservas,"data",[])})
        return render_template("member_modules/clases_reservas.html", user=session.get("user"))
    data = request.get_json()
    insert = supabase.table("reservas").insert(data).execute()
    return jsonify(insert.data), 201

@app.route("/plan_nutricional", methods=["GET","POST"])
def plan_nutricional():
    if request.method=="GET":
        if request.headers.get("Accept")=="application/json":
            planes = supabase.table("planes_nutricion").select("*").execute()
            return jsonify({"ok": True, "planes": getattr(planes,"data",[])})
        return render_template("member_modules/plan_nutricional.html", user=session.get("user"))
    data = request.get_json()
    insert = supabase.table("planes_nutricion").insert(data).execute()
    return jsonify(insert.data), 201

@app.route("/progreso_entrenamiento", methods=["GET","POST"])
def progreso_entrenamiento():
    if request.method=="GET":
        if request.headers.get("Accept")=="application/json":
            progreso = supabase.table("progreso").select("*").execute()
            return jsonify({"ok": True, "progreso": getattr(progreso,"data",[])})
        return render_template("member_modules/progreso_entrenamiento.html", user=session.get("user"))
    data = request.get_json()
    insert = supabase.table("progreso").insert(data).execute()
    return jsonify(insert.data), 201

@app.route("/feedback_clases", methods=["GET", "POST", "DELETE"])
def feedback_clases():
    user = session.get("user")
    id_usuario = user.get("id_usuario") if user else None

    if request.method == "GET":
        return render_template("member_modules/soporte.html", user=user)

    if request.method == "POST":
        data = request.get_json()
        if data and id_usuario:
            data["id_usuario"] = id_usuario
            data["id_comentario"] = str(uuid.uuid4())
            data["fecha_creacion"] = datetime.now().isoformat()
            supabase.table("feedback_clases").insert(data).execute()
        return render_template("member_modules/soporte.html", user=user)

    if request.method == "DELETE":
        data = request.get_json()
        id_comentario = data.get("id_comentario") if data else None
        if id_comentario:
            supabase.table("feedback_clases").delete().eq("id_comentario", id_comentario).execute()
        return render_template("member_modules/soporte.html", user=user)

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






@app.route("/index_entrenador")
def index_entrenador():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/index_recepcionista")
def index_recepcionista():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/index_nutricionista")
def index_nutricionista():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/index_admin")
def index_admin():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/admin/<modulo>")
def admin_modulos(modulo):
    return render_template(f"administrator_modules/{modulo}.html", user=session.get("user"))

if __name__=="__main__":
    app.run(debug=True, port=3000)

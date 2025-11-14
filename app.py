from flask_cors import CORS
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

@app.route("/miembros_modulos_render/<modulo>")
def miembros_modulos_render(modulo):
    return render_template(f"member_modules/{modulo}.html", user=session.get("user"))

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






# MODULO ENTRENADOR

@app.route("/index_entrenador")
def index_entrenador():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/entrenador_modulos_render/<modulo>")
def entrenador_modulos_render(modulo):
    return render_template(f"trainer_modules/{modulo}.html", user=session.get("user"))

@app.route("/clases_entrenador")
def clases_entrenador():
    return render_template("trainer_modules/clases_entrenador.html", user=session.get("user"))


# FUNCIONES PROGRESO DE MIEMBROS - ENTRENADOR

@app.route("/progreso_miembros")
def progreso_miembros():
    return render_template("trainer_modules/progreso_miembros.html", user=session.get("user"))

@app.route("/miembros_progreso")
def miembros_progreso():
    miembros_data = supabase.table("usuarios").select(
        "id_usuario,nombre,apellido,roles(nombre_rol),progreso(id_progreso,peso,imc,calorias_quemadas,fecha),entrenamientos_personales!entrenamientos_personales_id_miembro_fkey(id_entrenador)"
    ).execute()
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
            "disciplina": "",
            "entrenador": entrenador_nombre,
            "peso": ultimo.get("peso", 0),
            "imc": ultimo.get("imc", 0),
            "calorias": ultimo.get("calorias_quemadas", 0),
            "metas_alcanzadas": "50%",
            "ultima_sesion": ultimo.get("fecha", "")
        })
    return jsonify({"ok": True, "miembros": miembros})

@app.route("/miembro_detalle/<id>")
def miembro_detalle(id):
    historial_data = supabase.table("progreso").select(
        "fecha,peso,imc,calorias_quemadas"
    ).eq("id_miembro", id).order("fecha", ascending=True).execute()
    historial = historial_data.data
    if historial:
        for h in historial:
            h["calorias"] = h.pop("calorias_quemadas", 0)
        return jsonify({"ok": True, "historial": historial})
    return jsonify({"ok": False})

@app.route("/registrar_metricas", methods=["POST"])
def registrar_metricas():
    data = request.get_json()
    supabase.table("progreso").insert({
        "id_miembro": data["id"],
        "fecha": datetime.now().isoformat(),
        "peso": float(data["peso"]),
        "imc": float(data["imc"]),
        "calorias_quemadas": int(data["calorias"]),
        "notas": data.get("observaciones", "")
    }).execute()
    return jsonify({"ok": True})







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





# MODULO ADMINISTRADOR

@app.route("/index_admin")
def index_admin():
    return render_template("inicio.html", user=session.get("user"))

@app.route("/admin_modulos_render/<modulo>")
def admin_modulos_render(modulo):
    return render_template(f"admin_modules/{modulo}.html", user=session.get("user"))

# FUNCIONES USUARIOS - ADMINISTRADOR

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

# FUNCIONES REPORTES - ADMINISTRADOR

@app.route("/reportes/data", methods=["GET"])
def reportes_data():
    tipo = request.args.get("tipo")
    usuarios_ids = request.args.get("usuarios", "")
    usuarios_ids = [u.strip() for u in usuarios_ids.split(",") if u.strip()]

    labels = []
    valores = []
    detalles = []

    if tipo == "asistencia":
        query = supabase.table("reservas").select("*")
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
        query = supabase.table("progreso").select("*")
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

@app.route("/usuarios/buscar")
def buscar_usuario():
    cedula = request.args.get("cedula")
    response = supabase.table("usuarios").select("*").eq("cedula", cedula).execute()
    if response.data and len(response.data) > 0:
        return jsonify(response.data[0])
    return jsonify(None)

@app.route("/reportes/data", methods=["GET"])
def obtener_reportes():
    tipo = request.args.get("tipo")
    inicio = request.args.get("inicio")
    fin = request.args.get("fin")
    cedula = request.args.get("cedula")
    filtros_usuario = {}
    if cedula:
        usuario_resp = supabase.table("usuarios").select("id_usuario").eq("cedula", cedula).single().execute()
        if usuario_resp.data:
            filtros_usuario["id_miembro"] = usuario_resp.data["id_usuario"]

    detalles = []
    labels = []
    valores = []

    if tipo == "asistencia":
        query = supabase.table("reservas").select("*")
        if filtros_usuario:
            query = query.eq("id_miembro", filtros_usuario["id_miembro"])
        reservas = query.execute().data
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
        query = supabase.table("progreso").select("*")
        if filtros_usuario:
            query = query.eq("id_miembro", filtros_usuario["id_miembro"])
        progreso_data = query.execute().data
        for p in progreso_data:
            labels.append(p["fecha"])
            valores.append(p["peso"] or 0)
            detalles.append({
                "nombre": filtros_usuario.get("id_miembro"),
                "asistencia": 0,
                "pagos_totales": 0,
                "retencion": 0,
                "satisfaccion": 0,
                "progreso": p["peso"],
                "nutricion": ""
            })

    return jsonify({"labels": labels, "valores": valores, "detalles": detalles})

@app.route("/reportes/comentario", methods=["POST"])
def agregar_comentario():
    data = request.json
    id_usuario = data.get("id_usuario")
    mensaje = data.get("mensaje")
    id_clase = data.get("id_clase", None)
    calificacion = data.get("calificacion", None)
    if not id_usuario or not mensaje:
        return jsonify({"ok": False, "msg": "Datos incompletos"}), 400
    response = supabase.table("feedback_clases").insert({
        "id_usuario": id_usuario,
        "mensaje": mensaje,
        "id_clase": id_clase,
        "calificacion": calificacion
    }).execute()
    if response.status_code in [200, 201]:
        return jsonify({"ok": True, "msg": "Comentario agregado correctamente"})
    return jsonify({"ok": False, "msg": "Error al agregar comentario"}), 500















# FUNCIONES CONFIGURACION - ADMINISTRADOR

@app.route("/api/admin/configuracion", methods=["POST"])
def guardar_configuracion():
    data = request.json
    resp = supabase.table("configuracion_sistema").select("*").limit(1).execute()

    record = {
        "hora_apertura": data.get("hora_apertura"),
        "hora_cierre": data.get("hora_cierre"),
        "precio_membresia": data.get("precio_membresia"),
        "capacidad_clases": data.get("capacidad_clases"),
        "max_reservas_usuario": data.get("max_reservas_usuario"),
        "pico_usuarios": data.get("pico_usuarios"),
        "idioma": data.get("idioma", "es"),
        "fecha_actualizacion": "now()"
    }

    if resp.data:
        supabase.table("configuracion_sistema").update(record).eq("id_config", resp.data[0]["id_config"]).execute()
        return jsonify({"ok": True, "msg": "Configuración actualizada"})

    supabase.table("configuracion_sistema").insert(record).execute()
    return jsonify({"ok": True, "msg": "Configuración guardada"})


@app.route("/api/admin/configuracion", methods=["GET"])
def obtener_configuracion():
    resp = supabase.table("configuracion_sistema").select("*").limit(1).execute()
    return jsonify(resp.data[0] if resp.data else {})


@app.route("/api/admin/notificaciones", methods=["POST"])
def guardar_notificaciones():
    archivo = request.files.get("archivo")
    titulo = request.form.get("titulo")
    descripcion = request.form.get("descripcion")

    url_archivo = None
    if archivo:
        upload = cloudinary.uploader.upload(
            archivo,
            folder="marketing_gimnasio/notificaciones",
            public_id=str(uuid.uuid4()),
            resource_type="image"
        )
        url_archivo = upload.get("secure_url")

    record = {
        "id_usuario": None,
        "titulo": titulo,
        "descripcion": descripcion,
        "imagen_url": url_archivo,
        "fecha": "now()"
    }

    supabase.table("notificaciones").insert(record).execute()
    return jsonify({"ok": True, "msg": "Notificación creada"})


@app.route("/api/admin/notificaciones", methods=["GET"])
def obtener_notificaciones():
    resp = supabase.table("notificaciones").select("*").order("fecha", desc=True).execute()
    return jsonify(resp.data or [])


@app.route("/api/admin/notificaciones/<id_notificacion>", methods=["DELETE"])
def eliminar_notificacion(id_notificacion):
    supabase.table("notificaciones").delete().eq("id_notificacion", id_notificacion).execute()
    return jsonify({"ok": True, "msg": "Notificación eliminada"})


@app.route("/api/admin/notificaciones/<id_notificacion>", methods=["PUT"])
def actualizar_notificacion(id_notificacion):
    data = request.form
    archivo = request.files.get("archivo")

    update_data = {
        "titulo": data.get("titulo"),
        "descripcion": data.get("descripcion"),
        "fecha": "now()"
    }

    if archivo:
        upload = cloudinary.uploader.upload(
            archivo,
            folder="marketing_gimnasio/notificaciones",
            public_id=str(uuid.uuid4()),
            resource_type="image"
        )
        update_data["imagen_url"] = upload.get("secure_url")

    supabase.table("notificaciones").update(update_data).eq("id_notificacion", id_notificacion).execute()
    return jsonify({"ok": True, "msg": "Notificación actualizada"})


@app.route("/api/admin/marketing", methods=["POST"])
def guardar_marketing():
    info_inicio = request.form.get("info_inicio", "")
    carrusel = []
    secciones = []

    def subir_cloud(arch, carpeta):
        res = cloudinary.uploader.upload(
            arch,
            folder=f"marketing_gimnasio/{carpeta}",
            public_id=str(uuid.uuid4()),
            resource_type="image"
        )
        return res["secure_url"]

    for key in request.files:
        if "carrusel" in key:
            idx = int(key.split("[")[1].split("]")[0])
            archivo = request.files[key]
            url = subir_cloud(archivo, "carrusel")
            while len(carrusel) <= idx:
                carrusel.append({"imagen": None, "titulo": "", "descripcion": ""})
            carrusel[idx]["imagen"] = url

    for key in request.form:
        if "carrusel" in key:
            idx = int(key.split("[")[1].split("]")[0])
            campo = key.split("][")[1].replace("]", "")
            valor = request.form[key]
            while len(carrusel) <= idx:
                carrusel.append({"imagen": None, "titulo": "", "descripcion": ""})
            carrusel[idx][campo] = valor

    for key in request.files:
        if "secciones" in key:
            idx = int(key.split("[")[1].split("]")[0])
            archivo = request.files[key]
            url = subir_cloud(archivo, "secciones")
            while len(secciones) <= idx:
                secciones.append({"imagen": None, "titulo": "", "descripcion": ""})
            secciones[idx]["imagen"] = url

    for key in request.form:
        if "secciones" in key:
            idx = int(key.split("[")[1].split("]")[0])
            campo = key.split("][")[1].replace("]", "")
            valor = request.form[key]
            while len(secciones) <= idx:
                secciones.append({"imagen": None, "titulo": "", "descripcion": ""})
            secciones[idx][campo] = valor

    resp = supabase.table("marketing_sistema").select("*").limit(1).execute()

    if resp.data:
        previo = resp.data[0]
        carrusel_prev = json.loads(previo["carrusel"])
        secciones_prev = json.loads(previo["secciones"])

        for i in range(len(carrusel)):
            if carrusel[i]["imagen"] is None and i < len(carrusel_prev):
                carrusel[i]["imagen"] = carrusel_prev[i]["imagen"]

        for i in range(len(secciones)):
            if secciones[i]["imagen"] is None and i < len(secciones_prev):
                secciones[i]["imagen"] = secciones_prev[i]["imagen"]

        supabase.table("marketing_sistema").update({
            "info_inicio": info_inicio,
            "carrusel": json.dumps(carrusel),
            "secciones": json.dumps(secciones),
            "fecha_actualizacion": "now()"
        }).eq("id_marketing", previo["id_marketing"]).execute()

        return jsonify({"ok": True, "msg": "Marketing actualizado"})

    supabase.table("marketing_sistema").insert({
        "info_inicio": info_inicio,
        "carrusel": json.dumps(carrusel),
        "secciones": json.dumps(secciones),
        "fecha_actualizacion": "now()"
    }).execute()

    return jsonify({"ok": True, "msg": "Marketing guardado"})

@app.route("/api/inicio/imagenes")
def inicio_imagenes():
    resp = supabase.table("marketing_sistema").select("*").limit(1).execute()
    if not resp.data:
        return jsonify({"carrusel": [], "secciones": [], "info_inicio": ""})
    data = resp.data[0]
    return jsonify({
        "carrusel": json.loads(data["carrusel"]),
        "secciones": json.loads(data["secciones"]),
        "info_inicio": data["info_inicio"]
    })












if __name__=="__main__":
    app.run(debug=True, port=3000)

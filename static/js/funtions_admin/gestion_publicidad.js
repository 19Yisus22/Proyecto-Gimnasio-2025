let idNotificacionEditando = null;
let carruselIndex = 0, seccionIndex = 0;

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function toast(msg, tipo = "success") {
  const div = document.createElement("div");
  div.className = "toast align-items-center text-bg-" + tipo + " border-0 toast-notificacion";
  div.innerHTML = `
    <div class="d-flex w-100">
      ${msg}
      <button type="button" class="btn-close btn-close-white ms-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  document.getElementById("toastContainer").appendChild(div);
  new bootstrap.Toast(div).show();
}

document.getElementById("archivoNotificacion").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    document.getElementById("previewNotificacionImg").src = ev.target.result;
    document.getElementById("previewNotificacion").style.display = "block";
  };
  r.readAsDataURL(file);
});

async function crearNotificacion() {
  const fileInput = document.getElementById("archivoNotificacion");
  const titulo = document.getElementById("tituloNotificacion").value;
  const desc = document.getElementById("descNotificacion").value;

  if (!titulo || !desc)
    return toast("Ingrese título y descripción", "warning");

  let imagen = "";
  if (fileInput.files[0]) imagen = await toBase64(fileInput.files[0]);

  fetch("/api/admin/notificaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titulo, descripcion: desc, imagen_url: imagen })
  })
    .then(r => r.json())
    .then(d => {
      toast(d.msg);
      fileInput.value = "";
      document.getElementById("previewNotificacion").style.display = "none";
      document.getElementById("tituloNotificacion").value = "";
      document.getElementById("descNotificacion").value = "";
      cargarAlertas();
    });
}

function cargarAlertas() {
  fetch("/api/admin/notificaciones")
    .then(r => r.json())
    .then(data => {
      const cont = document.getElementById("contenedorAlertas");
      cont.innerHTML = "";

      data.forEach(a => {
        const div = document.createElement("div");
        div.className = "alert alert-warning d-flex justify-content-between align-items-center";

        div.innerHTML = `
          <div class="d-flex align-items-center gap-3">
            <div style="width:80px;height:80px;border-radius:10px;overflow:hidden;background:#ddd">
              <img src="${a.imagen_url || ''}" style="width:100%;height:100%;object-fit:cover">
            </div>
            <div>
              <strong>${a.titulo}</strong><br>
              ${a.descripcion}
            </div>
          </div>

          <div>
            <button class="btn btn-sm btn-warning me-2"
              onclick="abrirModalEditar('${a.id_notificacion}','${a.imagen_url || ''}','${a.titulo}','${a.descripcion}')">
              Editar
            </button>

            <button class="btn btn-sm btn-danger" onclick="eliminarAlerta('${a.id_notificacion}')">
              Eliminar
            </button>
          </div>
        `;

        cont.appendChild(div);
      });
    });
}

function eliminarAlerta(id) {
  fetch("/api/admin/notificaciones/" + id, { method: "DELETE" })
    .then(r => r.json())
    .then(d => {
      toast(d.msg);
      cargarAlertas();
    });
}

function abrirModalEditar(id, img, titulo, descripcion) {
  idNotificacionEditando = id;
  modalImgActual.src = img || "";
  modalTitulo.value = titulo;
  modalDescripcion.value = descripcion;
  modalArchivoNuevo.value = "";
  new bootstrap.Modal(document.getElementById("modalEditarNotificacion")).show();
}

async function guardarEdicionNotificacion() {
  let imagen = "";
  if (modalArchivoNuevo.files[0]) imagen = await toBase64(modalArchivoNuevo.files[0]);

  fetch("/api/admin/notificaciones/" + idNotificacionEditando, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      titulo: modalTitulo.value,
      descripcion: modalDescripcion.value,
      imagen_url: imagen
    })
  })
    .then(r => r.json())
    .then(d => {
      toast(d.msg);
      cargarAlertas();
      bootstrap.Modal.getInstance(document.getElementById("modalEditarNotificacion")).hide();
    });
}

function agregarCarrusel(url = "", titulo = "", desc = "") {
  const container = document.getElementById("carruselContainer");
  const div = document.createElement("div");
  div.className = "section-preview";
  div.dataset.index = carruselIndex;
  if (url) div.dataset.url = url;

  div.innerHTML = `
    <div class="preview-img-box" style="display:${url ? 'block' : 'none'}">
      <img src="${url}">
    </div>
    <input type="file" class="form-control" onchange="previewInputImage(this);actualizarPreview()">
    <input type="text" class="form-control" placeholder="Título" value="${titulo}" onchange="actualizarPreview()">
    <input type="text" class="form-control" placeholder="Descripción" value="${desc}" onchange="actualizarPreview()">
    <button class="btn btn-danger btn-sm" onclick="eliminarSeccion(this)">Eliminar</button>
  `;

  container.appendChild(div);
  carruselIndex++;
  actualizarPreview();
}

function agregarSeccion(url = "", titulo = "", desc = "") {
  const container = document.getElementById("seccionesContainer");
  const div = document.createElement("div");
  div.className = "section-preview";
  div.dataset.index = seccionIndex;
  if (url) div.dataset.url = url;

  div.innerHTML = `
    <div class="preview-img-box" style="display:${url ? 'block' : 'none'}">
      <img src="${url}">
    </div>
    <input type="file" class="form-control" onchange="previewInputImage(this);actualizarPreview()">
    <input type="text" class="form-control" placeholder="Título" value="${titulo}" onchange="actualizarPreview()">
    <input type="text" class="form-control" placeholder="Descripción" value="${desc}" onchange="actualizarPreview()">
    <button class="btn btn-danger btn-sm" onclick="eliminarSeccion(this)">Eliminar</button>
  `;

  container.appendChild(div);
  seccionIndex++;
  actualizarPreview();
}

function previewInputImage(input) {
  const file = input.files[0];
  const box = input.parentElement.querySelector(".preview-img-box");
  const img = box.querySelector("img");

  if (!file) {
    box.style.display = "none";
    return;
  }

  const r = new FileReader();
  r.onload = e => {
    img.src = e.target.result;
    box.style.display = "block";
  };
  r.readAsDataURL(file);
}

function eliminarSeccion(btn) {
  btn.parentElement.remove();
  actualizarPreview();
}

function actualizarPreview() {
  const previewCarrusel = document.querySelector("#previewCarrusel .carousel-inner");
  const previewSecciones = document.getElementById("previewSecciones");
  const previewInfo = document.getElementById("previewInfo");

  previewCarrusel.innerHTML = "";
  previewSecciones.innerHTML = "";

  document.querySelectorAll("#carruselContainer .section-preview").forEach((div, i) => {
    const imgInput = div.querySelector('input[type="file"]');
    const title = div.querySelectorAll('input')[1].value;
    const desc = div.querySelectorAll('input')[2].value;

    const item = document.createElement("div");
    item.className = "carousel-item" + (i === 0 ? " active" : "");

    let imgTag = document.createElement("img");
    imgTag.className = "d-block";

    if (imgInput.files[0]) {
      const reader = new FileReader();
      reader.onload = () => { imgTag.src = reader.result; };
      reader.readAsDataURL(imgInput.files[0]);
    } else if (div.dataset.url) {
      imgTag.src = div.dataset.url;
    }

    const caption = document.createElement("div");
    caption.className = "carousel-caption-below";
    caption.innerHTML = `<strong>${title}</strong><br>${desc}`;

    item.appendChild(imgTag);
    item.appendChild(caption);
    previewCarrusel.appendChild(item);
  });

  document.querySelectorAll("#seccionesContainer .section-preview").forEach(div => {
    const wrapper = document.createElement("div");
    const imgInput = div.querySelector('input[type="file"]');
    const title = div.querySelectorAll('input')[1].value;
    const desc = div.querySelectorAll('input')[2].value;

    let imgTag = document.createElement("img");

    if (imgInput.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        imgTag.src = reader.result;
        wrapper.appendChild(imgTag);
      };
      reader.readAsDataURL(imgInput.files[0]);
    } else if (div.dataset.url) {
      imgTag.src = div.dataset.url;
      wrapper.appendChild(imgTag);
    }

    if (title || desc) {
      const divText = document.createElement("div");
      divText.innerHTML = `<strong>${title}</strong><br>${desc}`;
      wrapper.appendChild(divText);
    }

    previewSecciones.appendChild(wrapper);
  });

  previewInfo.textContent = document.getElementById("infoInicio").value;
}

async function guardarMarketing() {
  const btn = document.getElementById("btnGuardarMarketing");
  btn.textContent = "Guardando...";

  const carrusel = [];
  for (const div of document.querySelectorAll("#carruselContainer .section-preview")) {
    let imagen = "";
    const imgInput = div.querySelector('input[type="file"]');

    if (imgInput.files[0]) imagen = await toBase64(imgInput.files[0]);
    else imagen = div.dataset.url || "";

    carrusel.push({
      imagen_url: imagen,
      titulo: div.querySelectorAll('input')[1].value,
      descripcion: div.querySelectorAll('input')[2].value
    });
  }

  const secciones = [];
  for (const div of document.querySelectorAll("#seccionesContainer .section-preview")) {
    let imagen = "";
    const imgInput = div.querySelector('input[type="file"]');

    if (imgInput.files[0]) imagen = await toBase64(imgInput.files[0]);
    else imagen = div.dataset.url || "";

    secciones.push({
      imagen_url: imagen,
      titulo: div.querySelectorAll('input')[1].value,
      descripcion: div.querySelectorAll('input')[2].value
    });
  }

  const info_inicio = document.getElementById("infoInicio").value;

  fetch("/api/admin/marketing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ info_inicio, carrusel, secciones })
  })
    .then(r => r.json())
    .then(d => {
      toast(d.msg);
      actualizarPreviewsBackend();
      btn.textContent = "Compartir publicidad en el inicio";
    });
}

function actualizarPreviewsBackend() {
  fetch("/api/admin/inicio/imagenes")
    .then(r => r.json())
    .then(data => {
      document.getElementById("carruselContainer").innerHTML = "";
      document.getElementById("seccionesContainer").innerHTML = "";

      data.carrusel.forEach(c => agregarCarrusel(c.imagen_url, c.titulo, c.descripcion));
      data.secciones.forEach(s => agregarSeccion(s.imagen_url, s.titulo, s.descripcion));

      document.getElementById("infoInicio").value = data.info_inicio || "";
      actualizarPreview();
    });
}

document.addEventListener("DOMContentLoaded", () => {
  cargarAlertas();
  actualizarPreviewsBackend();
});

async function subirImagenCloudinary(archivo) {
    const formData = new FormData();
    formData.append("file", archivo);
    formData.append("upload_preset", "preset_gimnasio");

    const res = await fetch("https://api.cloudinary.com/v1_1/dmknjcrua/image/upload", {
        method: "POST",
        body: formData
    });

    const data = await res.json();
    return data.secure_url || "";
}

async function guardarNotificacion(form) {
    const archivo = form.querySelector("input[type=file]").files[0];
    const titulo = form.querySelector("[name=titulo]").value.trim();
    const descripcion = form.querySelector("[name=descripcion]").value.trim();

    let imagen_url = "";
    if (archivo) {
        imagen_url = await subirImagenCloudinary(archivo);
    }

    const body = new FormData();
    body.append("titulo", titulo);
    body.append("descripcion", descripcion);
    if (archivo) body.append("archivo", archivo);
    if (imagen_url) body.append("imagen_url", imagen_url);

    const resp = await fetch("/api/admin/notificaciones", {
        method: "POST",
        body
    });

    return resp.json();
}

async function actualizarNotificacion(id, form) {
    const archivo = form.querySelector("input[type=file]").files[0];
    const titulo = form.querySelector("[name=titulo]").value.trim();
    const descripcion = form.querySelector("[name=descripcion]").value.trim();
    let imagen_url = form.querySelector("[name=imagen_url]").value.trim();

    if (archivo) {
        imagen_url = await subirImagenCloudinary(archivo);
    }

    const body = new FormData();
    body.append("titulo", titulo);
    body.append("descripcion", descripcion);
    if (archivo) body.append("archivo", archivo);
    body.append("imagen_url", imagen_url);

    const resp = await fetch(`/api/admin/notificaciones/${id}`, {
        method: "PUT",
        body
    });

    return resp.json();
}

async function cargarNotificaciones() {
    const resp = await fetch("/api/admin/notificaciones");
    const data = await resp.json();
    mostrarNotificaciones(data);
}

function mostrarNotificaciones(lista) {
    const cont = document.getElementById("listaNotificaciones");
    cont.innerHTML = "";

    lista.forEach(notif => {
        const item = document.createElement("div");
        item.className = "notificacion-item";

        item.innerHTML = `
            <h4>${notif.titulo}</h4>
            <p>${notif.descripcion}</p>
            ${notif.imagen_url ? `<img src="${notif.imagen_url}" class="img-noti" />` : ""}
        `;

        cont.appendChild(item);
    });
}
document.addEventListener("DOMContentLoaded", () => {
  const nombre = document.getElementById("nombreClase");
  const descripcion = document.getElementById("descripcionClase");
  const tipo = document.getElementById("tipoClase");
  const nivel = document.getElementById("nivelClase");
  const instructor = document.getElementById("instructorClase");
  const capacidad = document.getElementById("capacidadClase");
  const horaInicio = document.getElementById("horaInicioClase");
  const horaFin = document.getElementById("horaFinClase");
  const sala = document.getElementById("salaClase");
  const fecha = document.getElementById("fechaClase");
  const estado = document.getElementById("estadoClase");
  const editId = document.getElementById("editIdClase");
  const btnGuardar = document.getElementById("btnGuardar");
  const btnCancelar = document.getElementById("btnCancelar");
  const tabla = document.getElementById("tablaClasesAdmin");
  const buscar = document.getElementById("buscarClaseGlobal");
  const filtroTipo = document.getElementById("filtroTipo");
  const filtroFranja = document.getElementById("filtroHorarioFranja");
  const toastContainer = document.getElementById("toastContainer");

  function toast(msg, type="success") {
    const color = type === "error" ? "bg-danger" : "bg-success";
    const t = document.createElement("div");
    t.className = `toast align-items-center text-white ${color} border-0 show mb-2`;
    t.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  async function cargarInstructores() {
    const res = await fetch("/api/admin/entrenadores");
    const data = await res.json();
    if (!data.ok) return;
    instructor.innerHTML = `<option value="">Seleccionar Instructor</option>` + data.entrenadores.map(e => `<option value="${e.id}">${e.nombre}</option>`).join("");
  }

  async function cargarClases() {
    const res = await fetch("/api/admin/clases_general");
    const data = await res.json();
    if (!data.ok) { toast("Error cargando clases", "error"); return; }
    window._clasesAdmin = data.data;
    renderTabla(data.data);
  }

  function franjaDeHora(h) {
    if (!h) return "";
    const [hh] = h.split(":");
    const hhNum = parseInt(hh,10);
    if (hhNum >= 6 && hhNum <= 11) return "Mañana";
    if (hhNum >= 12 && hhNum <= 16) return "Tarde";
    return "Noche";
  }

  function renderTabla(clases) {
    tabla.innerHTML = "";
    const q = buscar.value.toLowerCase();
    const tipoSel = filtroTipo.value;
    const franjaSel = filtroFranja.value;
    const filtradas = clases.filter(c => {
      const nombreMatch = c.nombre?.toLowerCase().includes(q);
      const tipoMatch = c.tipo_clase?.toLowerCase().includes(q);
      const instructorMatch = c.instructor_nombre?.toLowerCase().includes(q);
      const pasaTexto = q === "" || nombreMatch || tipoMatch || instructorMatch;
      const pasaTipo = tipoSel === "" || c.tipo_clase === tipoSel;
      const franja = franjaDeHora(c.horario_inicio);
      const pasaFranja = franjaSel === "" || franja === franjaSel;
      return pasaTexto && pasaTipo && pasaFranja;
    });

    if (filtradas.length === 0) {
      tabla.innerHTML = `<tr><td colspan="10">No hay clases</td></tr>`;
      return;
    }

    filtradas.forEach(c => {
      const tr = document.createElement("tr");
      const horarioText = `${c.horario_inicio.slice(0,5)} - ${c.horario_fin.slice(0,5)}`;
      const estadoText = c.estado ? "Activo" : "Inactivo";

      tr.innerHTML = `
        <td>${c.nombre}</td>
        <td>${c.tipo_clase}</td>
        <td>${c.nivel_dificultad}</td>
        <td>${c.instructor_nombre || ""}</td>
        <td>${horarioText}</td>
        <td>${c.capacidad_max}</td>
        <td>${c.sala || ""}</td>
        <td>${estadoText}</td>
        <td>${c.fecha || ""}</td>
        <td>
          <button class="btn btn-sm btn-primary me-1" data-id="${c.id_clase}" onclick="editarClase(this.dataset.id)"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" data-id="${c.id_clase}" onclick="borrarClase(this.dataset.id)"><i class="bi bi-trash"></i></button>
        </td>`;
      tabla.appendChild(tr);
    });
  }

  window.editarClase = function(id) {
    const clase = window._clasesAdmin.find(x => x.id_clase === id);
    if (!clase) return;
    nombre.value = clase.nombre || "";
    descripcion.value = clase.descripcion || "";
    tipo.value = clase.tipo_clase || "";
    nivel.value = clase.nivel_dificultad || "";
    instructor.value = clase.instructor_id || "";
    capacidad.value = clase.capacidad_max || "";
    horaInicio.value = clase.horario_inicio || "";
    horaFin.value = clase.horario_fin || "";
    sala.value = clase.sala || "";
    fecha.value = clase.fecha || "";
    estado.value = clase.estado ? "true" : "false";
    editId.value = clase.id_clase;
    btnCancelar.style.display = "inline-block";
    btnGuardar.textContent = "Actualizar Clase";
  }

  window.borrarClase = async function(id) {
    const res = await fetch(`/api/admin/clases_general/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) { toast("Error al eliminar", "error"); return; }
    toast("Clase eliminada");
    cargarClases();
  }

  btnCancelar.addEventListener("click", () => {
    nombre.value=""; descripcion.value=""; tipo.value=""; nivel.value=""; instructor.value=""; capacidad.value=""; horaInicio.value=""; horaFin.value=""; sala.value=""; fecha.value=""; estado.value="true"; editId.value=""; btnCancelar.style.display="none"; btnGuardar.textContent="Guardar Clase";
  });

  btnGuardar.addEventListener("click", async () => {
    const id = editId.value;
    let payload = {
      nombre: nombre.value,
      descripcion: descripcion.value,
      tipo_clase: tipo.value,
      nivel_dificultad: nivel.value,
      instructor_id: instructor.value || null,
      capacidad_max: capacidad.value ? parseInt(capacidad.value,10) : null,
      horario_inicio: horaInicio.value,
      horario_fin: horaFin.value,
      sala: sala.value,
      fecha: fecha.value,
      estado: estado.value === "true"
    };

    if (id) {
      const claseOriginal = window._clasesAdmin.find(x => x.id_clase === id);
      if (claseOriginal) {
        payload = {
          nombre: nombre.value || claseOriginal.nombre,
          descripcion: descripcion.value !== "" ? descripcion.value : claseOriginal.descripcion,
          tipo_clase: tipo.value || claseOriginal.tipo_clase,
          nivel_dificultad: nivel.value || claseOriginal.nivel_dificultad,
          instructor_id: instructor.value || claseOriginal.instructor_id,
          capacidad_max: capacidad.value ? parseInt(capacidad.value,10) : claseOriginal.capacidad_max,
          horario_inicio: horaInicio.value || claseOriginal.horario_inicio,
          horario_fin: horaFin.value || claseOriginal.horario_fin,
          fecha: fecha.value || claseOriginal.fecha,
          sala: sala.value !== "" ? sala.value : claseOriginal.sala,
          estado: estado.value === "true"
        };
      }
      const res = await fetch(`/api/admin/clases_general/${id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) { toast("Error al actualizar", "error"); return; }
      toast("Clase actualizada");
    } else {
      const res = await fetch("/api/admin/clases_general", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) { toast("Error al crear", "error"); return; }
      toast("Clase creada");
    }
    nombre.value=""; descripcion.value=""; tipo.value=""; nivel.value=""; instructor.value=""; capacidad.value=""; horaInicio.value=""; horaFin.value=""; sala.value=""; fecha.value=""; estado.value="true"; editId.value=""; btnCancelar.style.display="none"; btnGuardar.textContent="Guardar Clase";
    cargarClases();
  });

  buscar.addEventListener("input", () => renderTabla(window._clasesAdmin || []));
  filtroTipo.addEventListener("change", () => renderTabla(window._clasesAdmin || []));
  filtroFranja.addEventListener("change", () => renderTabla(window._clasesAdmin || []));

  cargarInstructores();
  cargarClases();
});
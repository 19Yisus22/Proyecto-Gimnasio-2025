let calendarioData = []
let progresoData = []
let selectedMiembro = null
let selectedDia = null
let selectedRecordatorio = null
let chartProgreso = null
let editandoProgresoId = null
const iconPath = "{{ url_for('static', filename='uploads/icon.png') }}"
const colores = {clases:"#6a5acd", promociones:"#4caf50", membresia:"#ff9800"}
const rolUsuario = "{{ rol_usuario }}"

async function cargarMiembros(){
  const r = await fetch("/api/miembros")
  const m = await r.json()
  const s = document.getElementById("miembroSelect")
  s.innerHTML = "<option value=''>Selecciona miembro</option>"
  m.forEach(u => s.innerHTML += `<option value="${u.id_usuario}">${u.nombre} ${u.apellido}</option>`)
}
cargarMiembros()

async function cargarDatosMiembro(){
  selectedMiembro = document.getElementById("miembroSelect").value
  if(!selectedMiembro) return
  await cargarCalendario()
  await cargarProgresoGrafica(selectedMiembro)
  await cargarHistorialNotificaciones()
  await cargarReservas()
}

async function cargarCalendario(){
  const r = await fetch(`/api/entrenador/calendario/miembro/${selectedMiembro}`)
  calendarioData = await r.json()
  generarTablaCalendario()
}

function generarTablaCalendario(){
  const body = document.getElementById("calendarBody")
  body.innerHTML = ""
  const hoy = new Date()
  const año = hoy.getFullYear()
  const mes = hoy.getMonth()
  const primerDia = new Date(año, mes, 1).getDay()
  const diasMes = new Date(año, mes + 1, 0).getDate()
  let fila = document.createElement("tr")
  let inicio = primerDia === 0 ? 6 : primerDia - 1
  for(let i = 0; i < inicio; i++) fila.appendChild(document.createElement("td"))
  for(let d = 1; d <= diasMes; d++){
    if(fila.children.length === 7){ body.appendChild(fila); fila = document.createElement("tr") }
    fila.appendChild(crearCelda(d, mes, año))
  }
  while(fila.children.length < 7) fila.appendChild(document.createElement("td"))
  body.appendChild(fila)
}

function crearCelda(d, mes, año){
  const td = document.createElement("td")
  const num = document.createElement("div")
  num.className = "day-number"
  num.innerText = d
  td.appendChild(num)
  const cont = document.createElement("div")
  cont.className = "dot-container"
  const notifs = calendarioData.filter(n => {
    const f = new Date(n.fecha)
    return f.getDate() === d && f.getMonth() === mes && f.getFullYear() === año
  }).filter(n=>!n.leida)
  const notif = notifs[0]
  if(notif){
    const dot = document.createElement("div")
    dot.className = "notif-dot"
    dot.style.backgroundImage = `url('${iconPath}')`
    dot.style.backgroundColor = colores[notif.tipo_recordatorio] || "#9e9e9e"
    dot.onclick = e => { e.stopPropagation(); abrirModalEdicion(notif) }
    cont.appendChild(dot)
  }
  if(notifs.length > 1){
    const boton = document.createElement("button")
    boton.className = "btn btn-sm btn-secondary mt-1 w-100 plus-btn"
    boton.innerText = `+${notifs.length - 1}`
    boton.onclick = e => { e.stopPropagation(); abrirModalDiaMultiple(d, mes, año) }
    cont.appendChild(boton)
  }
  td.appendChild(cont)
  td.onclick = () => abrirModalCrear(d, mes, año)
  return td
}

function abrirModalCrear(d, mes, año){
  selectedDia = d
  selectedRecordatorio = null
  document.getElementById("modalCreateTitle").innerText = "Crear Recordatorio"
  document.getElementById("modalInputTitulo").value = ""
  document.getElementById("modalInputDescripcion").value = ""
  document.getElementById("modalInputTipo").value = "clases"
  document.getElementById("modalInputHora").value = ""
  document.getElementById("modalEliminarBtn").style.display = "none"
  document.getElementById("modalLeidoBtn").style.display = rolUsuario==="miembro"?"":"none"
  new bootstrap.Modal(document.getElementById("modalCreate")).show()
}

function abrirModalEdicion(notif){
  selectedRecordatorio = notif
  selectedDia = new Date(notif.fecha).getDate()
  document.getElementById("modalCreateTitle").innerText = "Editar Recordatorio"
  document.getElementById("modalInputTitulo").value = notif.titulo || ""
  document.getElementById("modalInputDescripcion").value = notif.descripcion || ""
  document.getElementById("modalInputTipo").value = notif.tipo_recordatorio || "clases"
  document.getElementById("modalInputHora").value = notif.hora ? notif.hora.slice(0,5) : ""
  document.getElementById("modalEliminarBtn").style.display = rolUsuario!=="miembro"?"":"none"
  document.getElementById("modalLeidoBtn").style.display = rolUsuario==="miembro"?"":"none"
  new bootstrap.Modal(document.getElementById("modalCreate")).show()
}

function abrirModalDiaMultiple(d, mes, año){
  const diaNotifs = calendarioData.filter(n => {
    const f = new Date(n.fecha)
    return f.getDate() === d && f.getMonth() === mes && f.getFullYear() === año
  }).filter(n=>!n.leida)
  const body = document.getElementById("modalMultipleBody")
  body.innerHTML = ""
  diaNotifs.forEach(n => {
    const div = document.createElement("div")
    div.className = "mb-2 p-2 border rounded bg-dark text-white d-flex justify-content-between align-items-center"
    div.innerHTML = `<div style="max-width:100%">
                        <div class="notif-dot" style="background-color:${colores[n.tipo_recordatorio]||'#9e9e9e'};width:50px;height:50px;border-radius:100%;background-image:url('${iconPath}');background-size:60%;background-position:center;background-repeat:no-repeat;display:inline-block;margin-right:5px"></div>
                        <strong>${n.titulo}</strong> (${n.tipo_recordatorio})<br>${n.descripcion || ""}<br><small>${n.hora||""}</small>
                     </div>
                     <div style="min-width:120px;display:flex;flex-direction:column;gap:6px">
                       <button class="btn btn-sm btn-primary" onclick="abrirModalEdicionFromList('${n.id_recordatorio}')">Abrir</button>
                       ${rolUsuario==="miembro"?`<button class="btn btn-sm btn-success" onclick="marcarLeidoDesdeList('${n.id_recordatorio}')">Marcar leído</button>`:""}
                     </div>`
    body.appendChild(div)
  })
  new bootstrap.Modal(document.getElementById("modalMultiple")).show()
}

function abrirModalEdicionFromList(id){
  const notif = calendarioData.find(x=>x.id_recordatorio===id)
  if(!notif) return
  const modalMulti = bootstrap.Modal.getInstance(document.getElementById("modalMultiple"))
  if(modalMulti) modalMulti.hide()
  abrirModalEdicion(notif)
}

async function guardarRecordatorio(){
  const titulo = document.getElementById("modalInputTitulo").value
  const descripcion = document.getElementById("modalInputDescripcion").value
  const tipo = document.getElementById("modalInputTipo").value
  const hora = document.getElementById("modalInputHora").value
  if(!titulo || !selectedMiembro) return
  const fecha = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(selectedDia).padStart(2,"0")}`
  if(selectedRecordatorio){
    await fetch(`/api/entrenador/calendario/${selectedRecordatorio.id_recordatorio}`, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({titulo, descripcion, tipo_recordatorio:tipo, hora})})
  } else {
    await fetch("/api/entrenador/calendario/crear", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id_miembro:selectedMiembro, titulo, descripcion, tipo_recordatorio:tipo, fecha, hora})})
  }
  await cargarCalendario()
  const modal = bootstrap.Modal.getInstance(document.getElementById("modalCreate"))
  if(modal) modal.hide()
}

async function eliminarRecordatorio(){
  if(!selectedRecordatorio) return
  await fetch(`/api/entrenador/calendario/${selectedRecordatorio.id_recordatorio}`, {method:"DELETE"})
  await cargarCalendario()
  const modal = bootstrap.Modal.getInstance(document.getElementById("modalCreate"))
  if(modal) modal.hide()
}

async function marcarLeido(){
  if(!selectedRecordatorio) return
  await fetch(`/api/entrenador/calendario/${selectedRecordatorio.id_recordatorio}`, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({leida:true})})
  await cargarCalendario()
  const modal = bootstrap.Modal.getInstance(document.getElementById("modalCreate"))
  if(modal) modal.hide()
}

async function marcarLeidoDesdeList(id){
  await fetch(`/api/entrenador/calendario/${id}`, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({leida:true})})
  await cargarCalendario()
  const modalMulti = bootstrap.Modal.getInstance(document.getElementById("modalMultiple"))
  if(modalMulti) modalMulti.hide()
}

async function cargarReservas(){
  const r = await fetch(`/api/reservas/miembro/${selectedMiembro}`)
  const data = await r.json()
  const tbody = document.querySelector("#listaReservas tbody")
  tbody.innerHTML = ""
  data.forEach(r => {
    const tr = document.createElement("tr")
    tr.innerHTML = `<td>${r.nombre_miembro}</td>
                    <td>${r.nombre_clase}</td>
                    <td>${r.horario_inicio || ""} - ${r.horario_fin || ""}</td>
                    <td>${r.asistencia_confirmada ? "Sí":"No"}</td>
                    <td>
                      <button class="btn btn-warning btn-sm me-1" onclick="editarReserva('${r.id_reserva}')">Editar</button>
                      <button class="btn btn-danger btn-sm" onclick="eliminarReserva('${r.id_reserva}')">Eliminar</button>
                    </td>`
    tbody.appendChild(tr)
  })
}

async function registrarProgreso(){
  const fecha = fechaProgreso.value
  const peso = parseFloat(pesoMiembro.value)
  const grasa = parseFloat(grasaCorporal.value)
  const masa = parseFloat(masaMuscular.value)
  const calor = parseFloat(caloriasQuemadas.value)
  const fuerzaVal = parseFloat(fuerza.value)
  const res = parseFloat(resistencia.value)
  const notas = notasProgreso.value
  const objetivo = document.getElementById("objetivoPersonal").value
  if(editandoProgresoId){
    await fetch(`/api/progreso/${editandoProgresoId}`, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id_miembro:selectedMiembro, fecha, peso, grasa_corporal:grasa, masa_muscular:masa, calorias_quemadas:calor, fuerza:fuerzaVal, resistencia:res, notas, objetivo_personal:objetivo})})
    editandoProgresoId = null
    document.querySelector("#registrarProgresoBtn").innerText = "Registrar Progreso"
  } else {
    await fetch("/api/progreso", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id_miembro:selectedMiembro, fecha, peso, grasa_corporal:grasa, masa_muscular:masa, calorias_quemadas:calor, fuerza:fuerzaVal, resistencia:res, notas, objetivo_personal:objetivo})})
  }
  cargarProgresoGrafica(selectedMiembro)
}

async function editarProgreso(id){
  const p = progresoData.find(x=>x.id_progreso===id)
  if(!p) return
  fechaProgreso.value = p.fecha
  pesoMiembro.value = p.peso
  grasaCorporal.value = p.grasa_corporal
  masaMuscular.value = p.masa_muscular
  caloriasQuemadas.value = p.calorias_quemadas
  fuerza.value = p.fuerza
  resistencia.value = p.resistencia
  notasProgreso.value = p.notas
  editandoProgresoId = id
  document.querySelector("#registrarProgresoBtn").innerText = "Guardar Cambios"
}

async function eliminarProgreso(id){
  await fetch(`/api/progreso/${id}`, {method:"DELETE"})
  cargarProgresoGrafica(selectedMiembro)
}

async function cargarProgresoGrafica(id){
  if(!id) return
  const r = await fetch(`/api/progreso/${id}`)
  progresoData = await r.json()
  actualizarGrafica()
  actualizarTablaProgreso()
}

function actualizarGrafica(){
  if(!progresoData || progresoData.length===0) return
  const objetivo = document.getElementById("objetivoPersonal").value
  const labels = progresoData.map(p => p.fecha)
  const datasets = []
  const metricas = []
  switch(objetivo){
    case "bajar_peso": metricas.push({key:"peso",label:"Peso",color:"#1f4e79"},{key:"grasa_corporal",label:"Grasa Corporal",color:"#a83232"},{key:"calorias_quemadas",label:"Calorías Quemadas",color:"#ff9800"}); break
    case "ganar_masa_muscular": metricas.push({key:"masa_muscular",label:"Masa Muscular",color:"#2a6f8f"},{key:"fuerza",label:"Fuerza",color:"#b23c4b"},{key:"calorias_quemadas",label:"Calorías Quemadas",color:"#ff9800"}); break
    case "tonificacion": metricas.push({key:"masa_muscular",label:"Masa Muscular",color:"#1f4e79"},{key:"grasa_corporal",label:"Grasa Corporal",color:"#a83232"},{key:"resistencia",label:"Resistencia",color:"#4caf50"}); break
    case "ganar_fuerza": metricas.push({key:"fuerza",label:"Fuerza",color:"#2196f3"},{key:"resistencia",label:"Resistencia",color:"#4caf50"}); break
  }
  metricas.forEach(m => datasets.push({label:m.label, data:progresoData.map(p=>p[m.key]), borderColor:m.color, fill:false, tension:0.3}))
  if(chartProgreso) chartProgreso.destroy()
  const ctx = document.getElementById("graficoProgreso").getContext("2d")
  chartProgreso = new Chart(ctx, {type:"line", data:{labels, datasets}, options:{responsive:true, plugins:{legend:{position:"top"}}}})
}

function actualizarTablaProgreso(){
  const tablaHeader = document.getElementById("tablaHeader")
  const tablaBody = document.getElementById("tablaBody")
  tablaHeader.innerHTML = ""
  tablaBody.innerHTML = ""
  const objetivo = document.getElementById("objetivoPersonal").value
  const columnas = ["fecha"]
  switch(objetivo){
    case "bajar_peso": columnas.push("peso","grasa_corporal","calorias_quemadas"); break
    case "ganar_masa_muscular": columnas.push("masa_muscular","fuerza","calorias_quemadas"); break
    case "tonificacion": columnas.push("masa_muscular","grasa_corporal","resistencia"); break
    case "ganar_fuerza": columnas.push("fuerza","resistencia"); break
  }
  columnas.push("acciones")
  columnas.forEach(c => tablaHeader.innerHTML += `<th>${c.replace("_"," ")}</th>`)
  progresoData.forEach(p => {
    const tr = document.createElement("tr")
    columnas.forEach(c => {
      if(c==="acciones"){
        tr.innerHTML += `<td>
          <button class="btn btn-sm btn-warning me-1" onclick="editarProgreso('${p.id_progreso}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarProgreso('${p.id_progreso}')">Eliminar</button>
        </td>`
      } else {
        tr.innerHTML += `<td>${p[c] !== undefined ? p[c] : ""}</td>`
      }
    })
    tablaBody.appendChild(tr)
  })
  if(progresoData.length>0){
    const tr = document.createElement("tr")
    tr.innerHTML = `<td><strong>Promedio</strong></td>` + columnas.slice(1,-1).map(c => {
      const sum = progresoData.reduce((a,b)=>a+(b[c]||0),0)
      const avg = (sum/progresoData.length).toFixed(2)
      return `<td>${avg}</td>`
    }).join("") + `<td></td>`
    tablaBody.appendChild(tr)
  }
}

async function cargarHistorialNotificaciones() {
  if (!selectedMiembro) return;
  const r = await fetch(`/api/notificaciones/miembro/${selectedMiembro}`);
  const data = await r.json();
  const sec = document.getElementById("historialSection");
  const cont = document.getElementById("historialNotificaciones");
  if (data.length === 0) { sec.style.display="none"; cont.innerHTML=""; return; }
  sec.style.display="block";
  cont.innerHTML="";
  data.forEach(n => {
    const item = document.createElement("div");
    item.className = "list-group-item list-group-item-dark d-flex justify-content-between align-items-center";
    const imgSrc = n.imagen_url || iconPath;
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${imgSrc}" style="width:50px; height:50px; object-fit:cover; border-radius:6px;">
        <div>
          <strong>${n.titulo}</strong> (${n.tipo_notificacion})<br>
          ${n.descripcion || ""}<br>
          <small>${n.fecha} ${n.hora || ""}</small>
        </div>
      </div>
      <div>
        <button class="btn btn-warning btn-sm me-1" onclick="editarNotifHistorial('${n.id_notificacion_miembro}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarNotif('${n.id_notificacion_miembro}')">Eliminar</button>
      </div>
    `;
    cont.appendChild(item);
  });
}

async function enviarNotificacion() {
  const titulo = document.getElementById("tituloNotificacion").value;
  const desc = document.getElementById("descNotificacion").value;
  if (!titulo || !desc || !selectedMiembro) return;
  await fetch("/api/notificaciones", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({id_miembro:selectedMiembro, titulo, descripcion:desc})
  });
  await cargarHistorialNotificaciones();
  document.getElementById("tituloNotificacion").value="";
  document.getElementById("descNotificacion").value="";
}

function editarNotifHistorial(id){
  const notif = calendarioData.find(n=>n.id_notificacion_miembro===id)
  if(!notif) return
  selectedDia = new Date(notif.fecha).getDate()
  selectedRecordatorio = notif
  document.getElementById("modalCreateTitle").innerText = "Editar Recordatorio"
  document.getElementById("modalInputTitulo").value = notif.titulo
  document.getElementById("modalInputDescripcion").value = notif.descripcion
  document.getElementById("modalInputTipo").value = notif.tipo_notificacion || "clases"
  document.getElementById("modalInputHora").value = notif.hora ? notif.hora.slice(0,5) : ""
  document.getElementById("modalEliminarBtn").style.display = rolUsuario!=="miembro"?"":"none"
  document.getElementById("modalLeidoBtn").style.display = rolUsuario==="miembro"?"":"none"
  new bootstrap.Modal(document.getElementById("modalCreate")).show()
}
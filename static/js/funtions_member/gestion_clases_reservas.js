document.addEventListener("DOMContentLoaded", ()=>{
  const tablaClases=document.getElementById("tablaClases");
  const misReservas=document.getElementById("misReservas");
  const buscar=document.getElementById("buscarClase");
  const filtroDisciplina=document.getElementById("filtroDisciplina");
  const filtroHorario=document.getElementById("filtroHorario");
  const btnActualizar=document.getElementById("actualizarCalendario");
  const barraProgreso=document.getElementById("barraProgreso");
  const toastContainer=document.getElementById("toastContainer");
  const selectMiembro=document.getElementById("feedbackEntrenadorMiembro");
  let reservasUsuario=[], calificacionClase=0, calificacionMiembro=0;
  let paginaClases=1, paginaReservas=1, filasPorPagina=5;
  let todasClases=[], todasReservas=[];

  function mostrarToast(msg,tipo="success"){
    const color=tipo==="error"?"bg-danger":"bg-success";
    const toast=document.createElement("div");
    toast.className=`toast align-items-center text-white ${color} border-0 show`;
    toast.role="alert";
    toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    toastContainer.appendChild(toast);
    setTimeout(()=>toast.remove(),3000);
  }

  async function cargarFiltros(){
    try{
      const res=await fetch("/api/miembros/reservas");
      const data=await res.json();
      if(!data.ok) return;
      const disciplinas=[...new Set(data.clases.map(c=>c.tipo_clase))];
      filtroDisciplina.innerHTML=`<option value="Todos">Todas</option>`+disciplinas.map(d=>`<option value="${d}">${d}</option>`).join('');
    }catch{}
  }

  async function cargarClases(){
    try{
      const res=await fetch("/api/miembros/reservas");
      const data=await res.json();
      if(!data.ok) throw new Error();
      todasClases=data.clases.filter(c=>!reservasUsuario.includes(c.id_clase));
      renderClases();
    }catch{mostrarToast("Error al cargar clases","error");}
  }

  function renderClases(){
    tablaClases.innerHTML="";
    const texto=buscar.value.toLowerCase(), disciplina=filtroDisciplina.value;
    const clasesFiltradas=todasClases.filter(c=>
      (c.tipo_clase?.toLowerCase().includes(texto) || c.instructor?.toLowerCase().includes(texto)) &&
      (disciplina==="Todos"||c.tipo_clase===disciplina)
    );
    const totalPaginas=Math.ceil(clasesFiltradas.length/filasPorPagina);
    if(paginaClases>totalPaginas) paginaClases=totalPaginas || 1;
    const inicio=(paginaClases-1)*filasPorPagina;
    const fragment=document.createDocumentFragment();
    clasesFiltradas.slice(inicio,inicio+filasPorPagina).forEach(c=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${c.tipo_clase}</td><td>${c.instructor||"Sin asignar"}</td><td>${c.horario}</td><td>${c.cupos_disponibles}</td>
      <td><button class="btn btn-success btn-sm" onclick="reservarClase('${c.id_clase}','${c.instructor_id}')"><i class="bi bi-calendar-plus"></i> Reservar</button></td>`;
      fragment.appendChild(tr);
    });
    if(!fragment.children.length) tablaClases.innerHTML=`<tr><td colspan="5">No hay clases disponibles</td></tr>`;
    else tablaClases.appendChild(fragment);
    renderPaginacion('paginacionClases', totalPaginas, paginaClases, (p)=>{paginaClases=p; renderClases();});
  }

  async function cargarMisReservas(){
    try{
      const res=await fetch("/api/miembros/mis_reservas");
      const data=await res.json();
      if(!data.ok) return;
      todasReservas=data.clases;
      reservasUsuario=data.clases.map(c=>c.id_clase);
      const entrenadores={};
      todasReservas.forEach(c=>{ if(c.instructor?.trim()!=="") entrenadores[c.instructor_id]=c.instructor; });
      selectMiembro.innerHTML='<option value="" disabled selected>Seleccione un entrenador</option>';
      for(const [id,nombre] of Object.entries(entrenadores)){
        const option=document.createElement("option");
        option.value=id; option.text=nombre; selectMiembro.appendChild(option);
      }
      renderReservas();
    }catch{mostrarToast("Error al cargar tus reservas","error");}
  }

  function renderReservas(){
    misReservas.innerHTML="";
    const totalPaginas=Math.ceil(todasReservas.length/filasPorPagina);
    if(paginaReservas>totalPaginas) paginaReservas=totalPaginas || 1;
    const inicio=(paginaReservas-1)*filasPorPagina;
    const fragment=document.createDocumentFragment();
    todasReservas.slice(inicio,inicio+filasPorPagina).forEach(c=>{
      const completada=c.estado==="completada" || c.estado==="cancelada";
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${c.tipo_clase}</td><td>${c.instructor}</td><td>${c.horario}</td>
        <td>
          <button class="btn btn-warning btn-sm" onclick="cancelarReserva('${c.id_reserva}')" ${completada?'disabled':''}>Cancelar</button>
          <button class="btn btn-success btn-sm" onclick="completarReserva('${c.id_reserva}')" ${completada?'disabled':''}>Completar</button>
          ${completada?`<button class="btn btn-danger btn-sm" onclick="eliminarReserva('${c.id_reserva}')">Eliminar</button>`:''}
        </td>
        <td><button class="btn btn-primary btn-sm" onclick="abrirFeedback('${c.id_clase}')">Feedback</button></td>`;
      fragment.appendChild(tr);
    });
    misReservas.appendChild(fragment);
    actualizarProgreso(todasReservas.length, todasReservas.filter(c=>c.estado==="completada").length);
    renderPaginacion('paginacionReservas', totalPaginas, paginaReservas, (p)=>{paginaReservas=p; renderReservas();});
  }

  function renderPaginacion(idContainer, totalPaginas, paginaActual, callback){
    const cont=document.getElementById(idContainer);
    cont.innerHTML="";
    for(let i=1;i<=totalPaginas;i++){
      const btn=document.createElement("button");
      btn.className=`btn ${i===paginaActual?'btn-primary':'btn-outline-primary'}`;
      btn.textContent=i;
      btn.addEventListener("click",()=>callback(i));
      cont.appendChild(btn);
    }
  }

  function actualizarProgreso(total, completadas){
    const pct=total>0?Math.round(completadas/total*100):0;
    barraProgreso.style.width=pct+"%";
    barraProgreso.textContent=pct+"%";
  }

  window.abrirFeedback=function(idClase){
    document.getElementById("feedbackClaseId").value=idClase;
    document.getElementById("feedbackMensaje").value="";
    calificacionClase=0;
    document.querySelectorAll("#modalFeedback .star-rating .bi").forEach(s=>s.className="bi bi-star");
    new bootstrap.Modal(document.getElementById("modalFeedback")).show();
  }

  document.querySelectorAll(".star-rating .bi").forEach(star=>{
    star.addEventListener("click",()=>{
      const parent=star.closest(".star-rating");
      if(parent.closest(".card")){
        calificacionMiembro=parseInt(star.dataset.value);
        parent.querySelectorAll(".bi").forEach(s=>s.className=s.dataset.value<=calificacionMiembro?"bi bi-star-fill":"bi bi-star");
      } else {
        calificacionClase=parseInt(star.dataset.value);
        parent.querySelectorAll(".bi").forEach(s=>s.className=s.dataset.value<=calificacionClase?"bi bi-star-fill":"bi bi-star");
      }
    });
  });

  document.getElementById("btnEnviarFeedbackMiembro").addEventListener("click",async ()=>{
    const mensaje=document.getElementById("feedbackMensajeMiembro").value.trim();
    const idEntrenador=selectMiembro.value;
    if(!idEntrenador){mostrarToast("Seleccione un entrenador","error"); return;}
    if(!mensaje){mostrarToast("Ingrese un mensaje","error"); return;}
    const res=await fetch("/api/miembros/feedback_entrenador",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_entrenador:idEntrenador,mensaje,calificacion:calificacionMiembro})});
    const data=await res.json();
    if(data.ok){mostrarToast("Feedback enviado"); document.getElementById("feedbackMensajeMiembro").value=""; calificacionMiembro=0; document.querySelectorAll(".card .star-rating .bi").forEach(s=>s.className="bi bi-star");}
    else mostrarToast(data.message||"Error al enviar feedback","error");
  });

  document.getElementById("btnEnviarFeedback").addEventListener("click",async ()=>{
    const mensaje=document.getElementById("feedbackMensaje").value.trim();
    if(!mensaje){mostrarToast("Ingrese un mensaje","error"); return;}
    const idClase=document.getElementById("feedbackClaseId").value;
    const res=await fetch("/api/miembros/feedback_clase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_clase:idClase,mensaje,calificacion:calificacionClase})});
    const data=await res.json();
    if(data.ok){mostrarToast("Feedback enviado"); bootstrap.Modal.getInstance(document.getElementById("modalFeedback")).hide(); }
    else mostrarToast(data.message||"Error al enviar feedback","error");
  });

  window.reservarClase=async function(idClase){
    const res=await fetch("/api/miembros/crear_reservas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_clase:idClase})});
    const data=await res.json();
    if(!data.ok){mostrarToast(data.message||"Error al reservar","error"); return;}
    mostrarToast("Reserva realizada");
    await cargarClases();
    await cargarMisReservas();
  }

  window.cancelarReserva=async function(id){
    const res=await fetch(`/api/miembros/cancelar_reservas/${id}`,{method:"PUT"});
    const data=await res.json();
    if(!data.ok){mostrarToast(data.message||"Error al cancelar","error"); return;}
    mostrarToast("Reserva cancelada");
    await cargarClases();
    await cargarMisReservas();
  }

  window.completarReserva=async function(id){
    const res=await fetch(`/api/miembros/completar_reservas/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({estado:"completada"})});
    const data=await res.json();
    if(!data.ok){mostrarToast(data.message||"Error al completar","error"); return;}
    mostrarToast("Reserva marcada como completada");
    await cargarClases();
    await cargarMisReservas();
  }

  window.eliminarReserva=async function(id){
    const res=await fetch(`/api/miembros/eliminar_reserva/${id}`,{method:"DELETE"});
    const data=await res.json();
    if(!data.ok){mostrarToast(data.message||"Error al eliminar","error"); return;}
    mostrarToast("Reserva eliminada");
    paginaReservas=1;
    await cargarClases();
    await cargarMisReservas();
  }

  buscar.addEventListener("input",renderClases);
  filtroDisciplina.addEventListener("change",renderClases);
  filtroHorario.addEventListener("change",renderClases);
  btnActualizar.addEventListener("click",()=>{cargarClases();cargarMisReservas();});

  cargarFiltros(); cargarClases(); cargarMisReservas();
});
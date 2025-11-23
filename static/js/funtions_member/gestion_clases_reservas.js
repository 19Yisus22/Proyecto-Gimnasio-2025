document.addEventListener("DOMContentLoaded",()=>{
const tablaClases=document.getElementById("tablaClases");
const misReservas=document.getElementById("misReservas");
const buscar=document.getElementById("buscarClase");
const filtroDisciplina=document.getElementById("filtroDisciplina");
const filtroHorario=document.getElementById("filtroHorario");
const btnActualizar=document.getElementById("actualizarCalendario");
const barraProgreso=document.getElementById("barraProgreso");
const toastContainer=document.getElementById("toastContainer");
const selectEntrenadorFeedback=document.getElementById("feedbackEntrenadorMiembro");
let calificacionClase=0,calificacionMiembro=0;
let paginaClases=1,paginaReservas=1,filasPorPagina=5;
let todasClases=[],todasReservas=[];
let entrenadoresDisponibles={};

function mostrarToast(msg,tipo="success"){
    const color=tipo==="error"?"bg-danger":"bg-success";
    const toast=document.createElement("div");
    toast.className=`toast align-items-center text-white ${color} border-0 show rounded-lg`;
    toast.role="alert";
    toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    toastContainer.appendChild(toast);
    setTimeout(()=>toast.remove(),3000);
}

function formatearHora(hora){
    if(!hora)return "";
    return hora.substring(0,5);
}

function formatearFecha(fecha){
    if(!fecha)return "";
    const partes=fecha.split('-');
    if(partes.length===3){
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fecha;
}

async function cargarFiltros(){
    try{
        const res=await fetch("/api/miembros/clases");
        const data=await res.json();
        if(!data.ok)return;
        const disciplinas=[...new Set(data.clases.map(c=>c.tipo_clase))];
        filtroDisciplina.innerHTML=`<option value="Todos">Todas</option>`+disciplinas.map(d=>`<option value="${d}">${d.charAt(0).toUpperCase()+d.slice(1)}</option>`).join('');
    }catch{}
}

async function cargarClases(){
    try{
        const res=await fetch("/api/miembros/clases");
        const data=await res.json();
        if(!data.ok)throw new Error();
        
        const resReservas=await fetch("/api/miembros/mis_reservas");
        const dataReservas=await resReservas.json();
        const reservasActivas=dataReservas.ok?dataReservas.clases.filter(r=>r.estado==='reservada').map(r=>r.id_clase):[];
        
        todasClases=data.clases.filter(c=>!reservasActivas.includes(c.id_clase));

        renderClases();
    }catch(e){console.error(e);mostrarToast("Error al cargar clases","error");}
}

function renderClases(){
    tablaClases.innerHTML="";
    const texto=buscar.value.toLowerCase(),disciplina=filtroDisciplina.value;
    const horarioFiltro=filtroHorario.value;
    const clasesFiltradas=todasClases.filter(c=>
        (c.tipo_clase?.toLowerCase().includes(texto)||c.instructor?.toLowerCase().includes(texto)||c.nombre?.toLowerCase().includes(texto))&&
        (disciplina==="Todos"||c.tipo_clase===disciplina)&&
        (horarioFiltro==="Todos"||(horarioFiltro==="Mañana"&&c.horario_inicio<'12:00:00')||(horarioFiltro==="Tarde"&&c.horario_inicio>='12:00:00'&&c.horario_inicio<'19:00:00')||(horarioFiltro==="Noche"&&c.horario_inicio>='19:00:00'))
    );
    const totalPaginas=Math.ceil(clasesFiltradas.length/filasPorPagina);
    if(paginaClases>totalPaginas)paginaClases=totalPaginas||1;
    const inicio=(paginaClases-1)*filasPorPagina;
    const fragment=document.createDocumentFragment();
    clasesFiltradas.slice(inicio,inicio+filasPorPagina).forEach(c=>{
        const disponibles = parseInt(c.cupos_disponibles.split('/')[0]) || 0;
        
        const deshabilitado=disponibles<=0?'disabled':'';
        const nombreEntrenador=c.instructor&&c.instructor.trim()!==""?c.instructor:"Sin asignar";
        
        const horarioInicio=formatearHora(c.horario_inicio);
        const horarioFin=formatearHora(c.horario_fin);
        const fechaFormateada=formatearFecha(c.fecha);

        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${c.nombre||c.tipo_clase}</td>
        <td>${fechaFormateada}</td> 
        <td>${nombreEntrenador}</td>
        <td>${horarioInicio} - ${horarioFin}</td>
        <td>${c.cupos_disponibles}</td>
        <td><button class="btn btn-success btn-sm" onclick="reservarClase('${c.id_clase}', '${c.fecha}')" ${deshabilitado}><i class="bi bi-calendar-plus"></i> Reservar</button></td>`;
        fragment.appendChild(tr);
    });
    if(!fragment.children.length)tablaClases.innerHTML=`<tr><td colspan="6">No hay clases disponibles</td></tr>`;
    else tablaClases.appendChild(fragment);
    renderPaginacion('paginacionClases',totalPaginas,paginaClases,(p)=>{paginaClases=p;renderClases();});
}

async function cargarMisReservas(){
    try{
        const res=await fetch("/api/miembros/mis_reservas");
        const data=await res.json();
        if(!data.ok)return;
        todasReservas=data.clases;
        
        entrenadoresDisponibles={};
        todasReservas.forEach(c=>{ 
            if(c.instructor_id&&c.instructor?.trim()!==""){
                entrenadoresDisponibles[c.instructor_id]=c.instructor; 
            }
        });
        
        selectEntrenadorFeedback.innerHTML='<option value="" disabled selected>Seleccione un entrenador</option>';
        for(const [id,nombre] of Object.entries(entrenadoresDisponibles)){
            if(nombre&&nombre.trim()!==""){
                const option=document.createElement("option");
                option.value=id;option.text=nombre;selectEntrenadorFeedback.appendChild(option);
            }
        }
        
        const reservasValidasProgreso = todasReservas.filter(r => r.estado === "completada" && r.asistencia_confirmada);
        const totalReservas = todasReservas.length;
        const progresoCalculado = totalReservas > 0 ? (reservasValidasProgreso.length / totalReservas) * 100 : 0;
        
        renderReservas(progresoCalculado);
    }catch(e){console.error(e);mostrarToast("Error al cargar tus reservas","error");}
}

function renderReservas(progreso){
    misReservas.innerHTML="";
    
    let totalCompletadas = 0;
    let totalCanceladas = 0;
    
    todasReservas.forEach(r => {
        if (r.estado === "completada") {
            totalCompletadas++;
        } else if (r.estado === "cancelada") {
            totalCanceladas++;
        }
    });

    document.getElementById("resumenReservas").textContent = `Tienes ${totalCompletadas} clases completadas y ${totalCanceladas} canceladas en total.`;

    const totalPaginas=Math.ceil(todasReservas.length/filasPorPagina);
    if(paginaReservas>totalPaginas)paginaReservas=totalPaginas||1;
    const inicio=(paginaReservas-1)*filasPorPagina;
    const fragment=document.createDocumentFragment();
    todasReservas.slice(inicio,inicio+filasPorPagina).forEach(r=>{
        const estado=r.estado;
        const esActiva=estado==="reservada";
        const esCompletadaOCancelada=estado==="completada"||estado==="cancelada";
        
        let estadoBadge;
        if(estado==="reservada"){
            estadoBadge='<span class="badge bg-primary">Reservada</span>';
        }else if(estado==="completada"){
            estadoBadge='<span class="badge bg-success">Completada</span>';
        }else if(estado==="cancelada"){
            estadoBadge='<span class="badge bg-danger">Cancelada</span>';
        }else{
            estadoBadge=`<span class="badge bg-secondary">${estado}</span>`;
        }

        const nombreEntrenador=r.instructor&&r.instructor.trim()!==""?r.instructor:"Sin asignar";
        const fechaFormateada=formatearFecha(r.fecha);
        const horarioInicio=formatearHora(r.horario_inicio);
        const horarioFin=formatearHora(r.horario_fin);

        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${r.nombre||r.tipo_clase} (${r.tipo_clase})</td>
            <td>${r.nivel_dificultad||'N/A'}</td>
            <td>${fechaFormateada}</td>
            <td>${nombreEntrenador}</td>
            <td>${horarioInicio} - ${horarioFin}</td>
            <td>${estadoBadge}</td>
            <td>
                <button class="btn btn-warning btn-sm" onclick="cancelarReserva('${r.id_reserva}')" ${!esActiva?'disabled':''}>Cancelar</button>
                <button class="btn btn-success btn-sm" onclick="completarReserva('${r.id_reserva}')" ${!esActiva?'disabled':''}>Completar</button>
                ${esCompletadaOCancelada?`<button class="btn btn-danger btn-sm" onclick="eliminarReserva('${r.id_reserva}')"><i class="bi bi-trash"></i> Eliminar</button>`:''}
            </td>
            <td><button class="btn btn-primary btn-sm" onclick="abrirFeedback('${r.id_clase}')" ${!esCompletadaOCancelada?'disabled':''}>Feedback</button></td>`;
        fragment.appendChild(tr);
    });
    misReservas.appendChild(fragment);
    actualizarProgreso(progreso);
    renderPaginacion('paginacionReservas',totalPaginas,paginaReservas,(p)=>{paginaReservas=p;renderReservas(progreso);});
}

function renderPaginacion(idContainer,totalPaginas,paginaActual,callback){
    const cont=document.getElementById(idContainer);
    cont.innerHTML="";
    if(totalPaginas<=1)return;
    for(let i=1;i<=totalPaginas;i++){
        const btn=document.createElement("button");
        btn.className=`btn ${i===paginaActual?'btn-primary':'btn-outline-primary'}`;
        btn.textContent=i;
        btn.addEventListener("click",()=>callback(i));
        cont.appendChild(btn);
    }
}

function actualizarProgreso(progreso){
    const pct=Math.round(progreso);
    barraProgreso.style.width=pct+"%";
    barraProgreso.textContent=pct+"%";
}

window.abrirFeedback=function(idClase){
    document.getElementById("feedbackClaseId").value=idClase;
    document.getElementById("feedbackMensaje").value="";
    calificacionClase=0;
    document.querySelectorAll("#ratingClase .bi").forEach(s=>s.className="bi bi-star");
    new bootstrap.Modal(document.getElementById("modalFeedback")).show();
}

document.querySelectorAll(".star-rating .bi").forEach(star=>{
    star.addEventListener("click",()=>{
        const parent=star.closest(".star-rating");
        const ratingValue = parseInt(star.dataset.value);
        if(parent.id==="ratingMiembro"){
            calificacionMiembro=ratingValue;
        }else{
            calificacionClase=ratingValue;
        }
        parent.querySelectorAll(".bi").forEach(s=>{
            s.className=s.dataset.value<=ratingValue?"bi bi-star-fill":"bi bi-star";
        });
    });
});

document.getElementById("btnEnviarFeedbackMiembro").addEventListener("click",async()=>{
    const mensaje=document.getElementById("feedbackMensajeMiembro").value.trim();
    const idEntrenador=selectEntrenadorFeedback.value;
    if(!idEntrenador){mostrarToast("Seleccione un entrenador","error");return;}
    if(!mensaje){mostrarToast("Ingrese un mensaje","error");return;}
    if(calificacionMiembro===0){mostrarToast("Asigne una calificación","error");return;}

    const res=await fetch("/api/miembros/feedback/entrenador",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_entrenador:idEntrenador,mensaje,calificacion:calificacionMiembro})});
    const data=await res.json();
    if(data.ok){
        mostrarToast("Feedback enviado"); 
        document.getElementById("feedbackMensajeMiembro").value=""; 
        calificacionMiembro=0; 
        selectEntrenadorFeedback.value=""; 
        document.querySelectorAll("#ratingMiembro .bi").forEach(s=>s.className="bi bi-star");
    }
    else mostrarToast(data.message||"Error al enviar feedback","error");
});

document.getElementById("btnEnviarFeedback").addEventListener("click",async()=>{
    const mensaje=document.getElementById("feedbackMensaje").value.trim();
    if(!mensaje){mostrarToast("Ingrese un mensaje","error");return;}
    if(calificacionClase===0){mostrarToast("Asigne una calificación","error");return;}
    const idClase=document.getElementById("feedbackClaseId").value;
    
    const res=await fetch("/api/miembros/feedback/clase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_clase:idClase,mensaje,calificacion:calificacionClase})});
    const data=await res.json();
    if(data.ok){
        mostrarToast("Feedback enviado"); 
        bootstrap.Modal.getInstance(document.getElementById("modalFeedback")).hide();
        document.getElementById("feedbackMensaje").value="";
        calificacionClase=0;
        document.querySelectorAll("#ratingClase .bi").forEach(s=>s.className="bi bi-star");
    }
    else mostrarToast(data.message||"Error al enviar feedback","error");
});

window.reservarClase=async function(idClase, fechaClase){
    const res=await fetch("/api/miembros/crear_reservas",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id_clase:idClase, fecha: fechaClase})
    });
    const data=await res.json();
    if(!data.ok){mostrarToast(data.message||"Error al reservar","error");return;}
    mostrarToast("Reserva realizada");
    await cargarClases();
    await cargarMisReservas();
}

window.cancelarReserva=async function(id){
    const res=await fetch(`/api/miembros/cancelar_reservas/${id}`,{method:"PUT"});
    const data=await res.json();
    if(!data.ok){mostrarToast(data.message||"Error al cancelar","error");return;}
    mostrarToast("Reserva cancelada");
    await cargarClases();
    await cargarMisReservas();
}

window.completarReserva=async function(id){
    const res=await fetch(`/api/miembros/completar_reservas/${id}`,{method:"PUT"});
    const data=await res.json();
    if(!data.ok){mostrarToast(data.message||"Error al completar","error");return;}
    mostrarToast("Reserva marcada como completada");
    await cargarClases();
    await cargarMisReservas();
}

window.eliminarReserva=async function(id){
    const res=await fetch(`/api/miembros/reservas/${id}`,{method:"DELETE"});
    const data=await res.json();
    if(!data.ok){
        mostrarToast(data.message||"Error al eliminar","error");
        return;
    }
    mostrarToast("Reserva eliminada");
    paginaReservas=1;
    await cargarClases();
    await cargarMisReservas();
}

buscar.addEventListener("input",renderClases);
filtroDisciplina.addEventListener("change",renderClases);
filtroHorario.addEventListener("change",renderClases);
btnActualizar.addEventListener("click",()=>{cargarClases();cargarMisReservas();});

cargarFiltros();cargarClases();cargarMisReservas();
});
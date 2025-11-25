const apiMiembros="/api/miembros";
const apiMiembro="/api/miembro/";
const apiPlanes="/api/planes";
const apiListarPlanes="/api/planes/";
const apiProgreso="/api/progreso";
const apiListarProgreso="/api/progreso/";
const apiRiesgos="/api/estado_salud";
const apiRiesgosListar="/api/estado_salud/";
const apiFeedback="/api/feedback";
const apiCalificacionesClases="/api/calificaciones_clases";
const rolActual="{{ session['rol'] }}";
const idUsuarioActual="{{ session['id_usuario'] }}";
let paginaPlanes=0,paginaSeguimiento=0,paginaSalud=0,registroMax=10;
let planesData=[],planesDataOriginal=[],seguimientoData=[],seguimientoDataOriginal=[],saludData=[],saludDataOriginal=[];
let editPlanId=null,editSeguimientoId=null,editFeedbackId=null;
let graficoProgreso=null;
let ID_MIEMBRO_GLOBAL=null;
let estrellaSeleccionada=0;
let estrellaModalSeleccionada=0;
document.addEventListener("DOMContentLoaded",()=>{
document.getElementById("btnCargarDatos").onclick=cargarDatosMiembro;
document.getElementById("btnCrearPlan").onclick=crearPlan;
document.getElementById("btnRegistrarSeguimiento").onclick=registrarSeguimiento;
document.getElementById("btnGuardarRiesgos").onclick=guardarRiesgos;
document.getElementById("btnCrearFeedback").onclick=crearFeedback;
document.getElementById("btnGuardarModal").onclick=guardarEdicionFeedback;
cargarMiembros();
document.querySelectorAll("#feedbackStars .star").forEach(s=>s.addEventListener("click",()=>{estrellaSeleccionada=parseInt(s.dataset.value);actualizarEstrellas("#feedbackStars",estrellaSeleccionada)}));
document.querySelectorAll("#modalStars .star").forEach(s=>s.addEventListener("click",()=>{estrellaModalSeleccionada=parseInt(s.dataset.value);actualizarEstrellas("#modalStars",estrellaModalSeleccionada)}));
});
async function cargarMiembros(){
const r=await fetch(apiMiembros);
const d=await r.json();
const s=document.getElementById("selectMiembro");
s.innerHTML="<option value=''>Selecciona un miembro...</option>";
d.forEach(x=>{
const o=document.createElement("option");
o.value=x.id_usuario;
o.textContent=x.nombre+" "+x.apellido;
s.appendChild(o);
});
}
async function cargarDatosMiembro(){
const id=document.getElementById("selectMiembro").value;
if(!id) return;
ID_MIEMBRO_GLOBAL=id;
const r=await fetch(apiMiembro+id);
const d=await r.json();
document.getElementById("infoMiembro").innerHTML=`Nombre: ${d.nombre} ${d.apellido}<br>Género: ${d.genero}<br>Correo: ${d.correo}<br>Teléfono: ${d.telefono}<br>Dirección: ${d.direccion}<br>Cédula: ${d.cedula}<br>Fecha de nacimiento: ${d.fecha_nacimiento}`;
await cargarPlanes(id);
await cargarSeguimiento(id);
await cargarRiesgos(id);
await cargarFeedback(id);
await cargarCalificaciones(id);
}
async function cargarCalificaciones(id){
const r=await fetch(apiFeedback+"/"+id);
const d=await r.json();
let total=d.length;
let suma=d.reduce((acc,it)=>acc+(it.calificacion||0),0);
let promedio= total? (suma/total):0;
let porcentaje=Math.round((promedio/5)*100);
document.getElementById("barraSatisfaccion").style.width=porcentaje+"%";
document.getElementById("barraSatisfaccion").textContent=porcentaje+"%";
document.getElementById("barraSatisfaccion").setAttribute('aria-valuenow', porcentaje);
document.getElementById("calificacionesTexto").textContent=`Promedio: ${promedio.toFixed(2)} / Total: ${total}`;
}
async function crearPlan(){
const id=document.getElementById("selectMiembro").value;
const descripcion=document.getElementById("planObjetivo").value.trim();
const semanas=document.getElementById("planSemanas").value;
const frecuencia=document.getElementById("planFrecuencia").value;
if (!id) {
    alert("🚨 Por favor, selecciona un miembro.");
    return;
}
if (!descripcion) {
    alert("📝 El objetivo del plan es obligatorio.");
    return;
}
if (!semanas || isNaN(Number(semanas)) || Number(semanas) <= 0 || !Number.isInteger(Number(semanas))) {
    alert("⏳ La duración en semanas debe ser un número entero positivo.");
    return;
}
if (!frecuencia || isNaN(Number(frecuencia)) || Number(frecuencia) <= 0 || !Number.isInteger(Number(frecuencia))) {
    alert("🗓️ La frecuencia de sesiones debe ser un número entero positivo.");
    return;
}
let idEntrenador=rolActual==='entrenador'?idUsuarioActual:null;
const body={
id_miembro:id,
id_entrenador:idEntrenador,
descripcion:descripcion,
duracion_semanas: Number(semanas),
sesiones_semana: Number(frecuencia),
nivel: document.getElementById("planCategoria").value
};
if(editPlanId){
await fetch(`${apiPlanes}/${editPlanId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
editPlanId=null;
document.getElementById("btnCrearPlan").textContent="Crear Plan";
}else{
await fetch(apiPlanes,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
await cargarPlanes(id);
document.getElementById("planObjetivo").value="";document.getElementById("planSemanas").value="";document.getElementById("planFrecuencia").value="";document.getElementById("planCategoria").value="principiante";
}
async function cargarPlanes(id){
const r=await fetch(apiListarPlanes+id);
planesDataOriginal=await r.json();
planesData=[...planesDataOriginal];
paginaPlanes=0;
renderPlanes();
renderPaginacionPlanes();
}
function renderPlanes(){
const c=document.getElementById("listaPlanes");
c.innerHTML="";
let start=paginaPlanes*registroMax;
let end=start+registroMax;
planesData.slice(start,end).forEach(x=>{
const e=document.createElement("div");
e.className="border p-2 rounded d-flex justify-content-between align-items-center";
e.innerHTML=`<span style="color: black;"><b>${x.descripcion || "-"}</b> — Semanas: ${x.duracion_semanas||0}, Sesiones/sem: ${x.sesiones_semana||0}, Nivel: ${x.nivel||"-"} — ${x.fecha_creacion||""}</span>`;
c.appendChild(e);
});
}
function renderPaginacionPlanes(){
const cont=document.getElementById("paginacionPlanes");
cont.innerHTML="";
const totalPaginas=Math.ceil(planesData.length/registroMax)||1;
for(let i=0;i<totalPaginas;i++){
const btn=document.createElement("button");
btn.className=`btn btn-sm mx-1 ${i===paginaPlanes?"btn-primary":"btn-outline-primary"}`;
btn.textContent=(i+1);
btn.addEventListener("click",()=>{paginaPlanes=i;renderPlanes();renderPaginacionPlanes();});
cont.appendChild(btn);
}
}
async function eliminarPlan(id){
await fetch(`${apiPlanes}/${id}`,{method:'DELETE'});
await cargarPlanes(document.getElementById("selectMiembro").value);
}
async function editarPlan(id){
let p=planesData.find(x=>x.id_entrenamiento===id);
document.getElementById("planObjetivo").value=p.descripcion||"";
document.getElementById("planSemanas").value=p.duracion_semanas||"";
document.getElementById("planFrecuencia").value=p.sesiones_semana||"";
document.getElementById("planCategoria").value=p.nivel||"principiante";
editPlanId=id;
document.getElementById("btnCrearPlan").textContent="Guardar Cambios";
}
async function registrarSeguimiento(){
const id=document.getElementById("selectMiembro").value;
const peso=document.getElementById("peso").value;
const grasa=document.getElementById("grasa").value;
const musculo=document.getElementById("musculo").value;
const notas=document.getElementById("notasPrivadas").value.trim();
if (!id) {
    alert("🚨 Por favor, selecciona un miembro.");
    return;
}
const validarMetrica = (valor, nombre, minimo = 0.1) => {
    if (!valor || isNaN(Number(valor)) || Number(valor) < minimo) {
        alert(`🔢 El valor de ${nombre} es obligatorio y debe ser un número positivo (mínimo ${minimo}).`);
        return false;
    }
    return true;
};
if (!validarMetrica(peso, "Peso", 0.1) || 
    !validarMetrica(grasa, "Grasa Corporal", 0) ||
    !validarMetrica(musculo, "Masa Muscular", 0)) {
    return;
}
let idEntrenador=rolActual==='entrenador'?idUsuarioActual:null;
const body={id_miembro:id,id_entrenador:idEntrenador,peso:Number(peso),grasa_corporal:Number(grasa),masa_muscular:Number(musculo),notas:notas};
let actualizarGrafica=false;
if(editSeguimientoId){
const registro=seguimientoData.find(x=>x.id_progreso===editSeguimientoId);
if(registro.peso!==body.peso || registro.grasa_corporal!==body.grasa_corporal || registro.masa_muscular!==body.masa_muscular){
actualizarGrafica=true;
}
await fetch(`${apiProgreso}/${editSeguimientoId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
editSeguimientoId=null;
document.getElementById("btnRegistrarSeguimiento").textContent="Registrar Seguimiento";
}else{
actualizarGrafica=true;
await fetch(apiProgreso,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
await cargarSeguimiento(id,actualizarGrafica);
document.getElementById("peso").value="";document.getElementById("grasa").value="";document.getElementById("musculo").value="";document.getElementById("notasPrivadas").value="";
}
async function cargarSeguimiento(id,actualizarGrafica=true){
const r=await fetch(apiListarProgreso+id);
seguimientoDataOriginal=await r.json();
seguimientoData=[...seguimientoDataOriginal];
paginaSeguimiento=0;
renderSeguimiento(actualizarGrafica);
renderPaginacionSeguimiento();
}
function renderSeguimiento(actualizarGrafica=true){
const c=document.getElementById("historialSeguimiento");
c.innerHTML="";
let start=paginaSeguimiento*registroMax;
let end=start+registroMax;
let labels=[],datosPeso=[],datosGrasa=[],datosMusculo=[];
seguimientoData.slice(start,end).forEach(x=>{
const e=document.createElement("div");
e.className="border p-2 rounded d-flex justify-content-between align-items-center";
e.innerHTML=`<span style="color: black;">${x.fecha} — Peso: ${x.peso}kg, Grasa: ${x.grasa_corporal}%, Músculo: ${x.masa_muscular}kg — Notas: ${x.notas||""}</span>`;
c.appendChild(e);
labels.push(x.fecha);
datosPeso.push(x.peso||0);
datosGrasa.push(x.grasa_corporal||0);
datosMusculo.push(x.masa_muscular||0);
});
if(actualizarGrafica) actualizarGraficoCombinado(labels,datosPeso,datosGrasa,datosMusculo);
}
function renderPaginacionSeguimiento(){
const cont=document.getElementById("paginacionSeguimiento");
cont.innerHTML="";
const total=Math.ceil(seguimientoData.length/registroMax)||1;
for(let i=0;i<total;i++){
const btn=document.createElement("button");
btn.className=`btn btn-sm mx-1 ${i===paginaSeguimiento?"btn-primary":"btn-outline-primary"}`;
btn.textContent=(i+1);
btn.addEventListener("click",()=>{paginaSeguimiento=i;renderSeguimiento();renderPaginacionSeguimiento();});
cont.appendChild(btn);
}
}
function actualizarGraficoCombinado(labels,peso,grasa,musculo){
const ctx=document.getElementById("graficoProgreso");
if(graficoProgreso) graficoProgreso.destroy();
graficoProgreso=new Chart(ctx,{
type:"line",
data:{
labels:labels,
datasets:[
{label:"Peso (kg)", data:peso, borderColor:"blue", backgroundColor:"rgba(0,0,255,0.1)"},
{label:"Grasa (%)", data:grasa, borderColor:"red", backgroundColor:"rgba(255,0,0,0.1)"},
{label:"Músculo (kg)", data:musculo, borderColor:"green", backgroundColor:"rgba(0,255,0,0.1)"}
]
},
options:{responsive:true,plugins:{legend:{display:true}},interaction:{mode:"index",intersect:false},scales:{y:{beginAtZero:true}}}
});
}
async function editarSeguimiento(id){
let p=seguimientoData.find(x=>x.id_progreso===id);
document.getElementById("peso").value=p.peso;
document.getElementById("grasa").value=p.grasa_corporal;
document.getElementById("musculo").value=p.masa_muscular;
document.getElementById("notasPrivadas").value=p.notas||"";
editSeguimientoId=id;
document.getElementById("btnRegistrarSeguimiento").textContent="Guardar Cambios";
}
async function eliminarSeguimiento(id){
await fetch(`${apiProgreso}/${id}`,{method:'DELETE'});
await cargarSeguimiento(document.getElementById("selectMiembro").value,true);
}
async function guardarRiesgos(){
const id=document.getElementById("selectMiembro").value;
const nota=document.getElementById("riesgosSalud").value.trim();
if (!id) {
    alert("🚨 Por favor, selecciona un miembro.");
    return;
}
if (!nota) {
    alert("⚠️ Por favor, ingresa una nota de riesgo de salud.");
    return;
}
await fetch(apiRiesgos,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_miembro:id,nota:nota})});
await cargarRiesgos(id);
document.getElementById("riesgosSalud").value="";
}
async function cargarRiesgos(id){
const r=await fetch(apiRiesgosListar+id);
saludDataOriginal=await r.json();
saludData=[...saludDataOriginal];
paginaSalud=0;
renderSalud();
renderPaginacionSalud();
}
function renderSalud(){
const c=document.getElementById("alertasRiesgo");
c.innerHTML="";
let start=paginaSalud*registroMax;
let end=start+registroMax;
saludData.slice(start,end).forEach(x=>{
if(!x.id_estado) return;
const e=document.createElement("div");
e.className="alert alert-danger d-flex justify-content-between align-items-center";
e.innerHTML=`<span style="color: black;">${x.nota}</span>`;
c.appendChild(e);
});
}
function renderPaginacionSalud(){
const cont=document.getElementById("paginacionSalud");
cont.innerHTML="";
const total=Math.ceil(saludData.length/registroMax)||1;
for(let i=0;i<total;i++){
const btn=document.createElement("button");
btn.className=`btn btn-sm mx-1 ${i===paginaSalud?"btn-primary":"btn-outline-primary"}`;
btn.textContent=(i+1);
btn.addEventListener("click",()=>{paginaSalud=i;renderSalud();renderPaginacionSalud();});
cont.appendChild(btn);
}
}
async function eliminarRiesgo(id){
if(!id) return;
await fetch(`${apiRiesgos}/${id}`,{method:'DELETE'});
await cargarRiesgos(document.getElementById("selectMiembro").value);
}
async function crearFeedback(){
const id=document.getElementById("selectMiembro").value;
let idEntrenador=rolActual==='entrenador'?idUsuarioActual:null;
const mensaje=document.getElementById("feedbackMensaje").value.trim();
if(!id) {
    alert("🚨 Por favor, selecciona un miembro.");
    return;
}
if(!mensaje) {
    alert("💬 El mensaje de feedback es obligatorio.");
    return;
}
if(estrellaSeleccionada<1) {
    alert("⭐ Por favor, asigna una calificación de 1 a 5 estrellas.");
    return;
}
const payload={id_miembro:id,id_entrenador:idEntrenador,mensaje:mensaje,calificacion:estrellaSeleccionada};
await fetch(apiFeedback,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
document.getElementById("feedbackMensaje").value="";estrellaSeleccionada=0;actualizarEstrellas("#feedbackStars",0);
await cargarFeedback(id);
await cargarCalificaciones(id);
}
async function cargarFeedback(id){
const r=await fetch(apiFeedback+"/"+id);
const d=await r.json();
const tbody=document.getElementById("tablaFeedback");
tbody.innerHTML="";
d.forEach(x=>{
const calificacion=Math.max(0,Math.min(5,x.calificacion || 0));
const tr=document.createElement("tr");
const stars="★".repeat(calificacion)+ "☆".repeat(5-calificacion);
tr.innerHTML=`<td class="text-warning fs-5">${stars}</td><td>${x.mensaje}</td><td>${x.fecha_creacion || x.fecha || ""}</td><td></td>`;
tbody.appendChild(tr);
});
}
function actualizarEstrellas(selector,valor){
document.querySelectorAll(selector+" .star").forEach(s=>{s.classList.toggle("selected", parseInt(s.dataset.value) <= valor);});
}
function abrirModalEdicion(feedback){
editFeedbackId=feedback.id_feedback;
document.getElementById("modalFeedbackMensaje").value=feedback.mensaje||"";
estrellaModalSeleccionada=feedback.calificacion||0;
actualizarEstrellas("#modalStars",estrellaModalSeleccionada);
new bootstrap.Modal(document.getElementById("modalFeedback")).show();
}
async function guardarEdicionFeedback(){
if(!editFeedbackId) return;
const nuevoMensaje=document.getElementById("modalFeedbackMensaje").value.trim();
if(!nuevoMensaje) {
    alert("💬 El mensaje de feedback no puede estar vacío.");
    return;
}
if(estrellaModalSeleccionada<1) {
    alert("⭐ Por favor, asigna una calificación de 1 a 5 estrellas.");
    return;
}
const payload={mensaje:nuevoMensaje,calificacion:estrellaModalSeleccionada};
await fetch(`${apiFeedback}/${editFeedbackId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
editFeedbackId=null;
bootstrap.Modal.getInstance(document.getElementById("modalFeedback")).hide();
await cargarFeedback(ID_MIEMBRO_GLOBAL);
await cargarCalificaciones(ID_MIEMBRO_GLOBAL);
}
function filtrarPlanes(filtro){
planesData=[...planesDataOriginal];
const hoy=new Date();
let fd;
switch(filtro){
case"recientes": fd=new Date(hoy.getTime()-7*24*60*60*1000); break;
case"estaSemana": fd=new Date(hoy.setDate(hoy.getDate()-hoy.getDay())); break;
case"mes": fd=new Date(hoy.getFullYear(),hoy.getMonth(),1); break;
case"ultimos6Meses": fd=new Date(hoy.setMonth(hoy.getMonth()-6)); break;
}
planesData=planesData.filter(p=>p.fecha_creacion && new Date(p.fecha_creacion) >= fd);
paginaPlanes=0;
renderPlanes();
renderPaginacionPlanes();
}
function filtrarSeguimiento(filtro){
seguimientoData=[...seguimientoDataOriginal];
const hoy=new Date();
let fd;
switch(filtro){
case"recientes": fd=new Date(hoy.getTime()-7*24*60*60*1000); break;
case"estaSemana": fd=new Date(hoy.setDate(hoy.getDate()-hoy.getDay())); break;
case"mes": fd=new Date(hoy.getFullYear(),hoy.getMonth(),1); break;
case"ultimos6Meses": fd=new Date(hoy.setMonth(hoy.getMonth()-6)); break;
}
seguimientoData=seguimientoData.filter(s=>s.fecha && new Date(s.fecha)>=fd);
paginaSeguimiento=0;
renderSeguimiento();
renderPaginacionSeguimiento();
}
function filtrarSalud(filtro){
saludData=[...saludDataOriginal];
const hoy=new Date();
let fd;
switch(filtro){
case"recientes": fd=new Date(hoy.getTime()-7*24*60*60*1000); break;
case"estaSemana": fd=new Date(hoy.setDate(hoy.getDate()-hoy.getDay())); break;
case"mes": fd=new Date(hoy.getFullYear(),hoy.getMonth(),1); break;
case"ultimos6Meses": fd=new Date(hoy.setMonth(hoy.getMonth()-6)); break;
}
saludData=saludData.filter(s=>s.fecha && new Date(s.fecha)>=fd);
paginaSalud=0;
renderSalud();
renderPaginacionSalud();
}
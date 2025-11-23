let currentMemberId=null;
let progressChart=null;
document.getElementById('searchMemberBtn').addEventListener('click',()=>searchMember());
document.getElementById('saveMetricsBtn').addEventListener('click',()=>updateMetrics());
document.getElementById('saveSessionBtn').addEventListener('click',()=>saveSession());

function searchMember(){
const q=document.getElementById('searchMemberInput').value.trim();
if(!q) return;
fetch('/api/nutricionista/perfil/buscar?q='+encodeURIComponent(q)).then(r=>r.json()).then(data=>{
if(Array.isArray(data.items)&&data.items.length>0) nutricionista_getProfile(data.items[0].id);
else alert('No se encontraron miembros');
});
}

function nutricionista_getProfile(id){
currentMemberId=id;
fetch('/api/nutricionista/perfil/get/'+id).then(r=>r.json()).then(data=>{
const u=data.usuario||{};
document.getElementById('memberAvatar').src=u.avatar||'https://via.placeholder.com/90';
document.getElementById('memberName').textContent=u.nombre||'Nombre Miembro';
document.getElementById('memberEmail').textContent=u.correo||'-';
document.getElementById('personalInfo').innerHTML=`Edad: ${u.edad||'-'}<br>Teléfono: ${u.telefono||'-'}<br>Dirección: ${u.direccion||'-'}`;
document.getElementById('memberInfoContainer').classList.remove('member-info-hidden');

renderGoals(data.objetivos||[]);
renderHealth(data.estado_salud||[]);
renderSessions(data.sesiones||[]);
renderMetrics(data.historial||{},data.last_update);

document.getElementById('weightInput').value = '';
document.getElementById('fatInput').value = '';
document.getElementById('muscleInput').value = '';
document.getElementById('notesMetrics').value = '';
});
}

function renderGoals(goals){
const el=document.getElementById('memberGoals'); 
el.innerHTML='';
if(goals.length === 0) {
    el.innerHTML = '<span class="small-muted">Sin objetivos registrados</span>';
    return;
}
const recentGoals = goals.slice(-5).reverse();
recentGoals.forEach(g=>{
    const d=document.createElement('div');
    d.className='tag';
    d.textContent=g.descripcion;
    el.appendChild(d)
});
}

function renderHealth(health){
const el=document.getElementById('memberHealth'); 
el.innerHTML='';
if(health.length === 0) {
    el.innerHTML = '<span class="small-muted">Sin estado de salud registrado</span>';
    return;
}
const recentHealth = health.slice(-5).reverse();
recentHealth.forEach(h=>{
    const d=document.createElement('div');
    d.className='tag';
    const fechaHora = h.hora ? `${h.fecha} ${h.hora.substring(0, 5)}` : h.fecha;
    d.textContent=`${fechaHora}: ${h.nota}`; 
    el.appendChild(d)
});
}

function renderMetrics(metrics,last_update){
document.getElementById('lastUpdated').textContent=last_update||'-';
if(progressChart){progressChart.destroy();progressChart=null}
const ctx=document.getElementById('progressChart').getContext('2d');
progressChart=new Chart(ctx,{type:'line',data:{labels:metrics.fechas||[],datasets:[{label:'Peso',data:metrics.peso||[],tension:0.3,borderColor: '#8ec5fc', backgroundColor: 'rgba(142, 197, 252, 0.2)'},{label:'% Grasa',data:metrics.grasa||[],tension:0.3,borderColor: '#20c997', backgroundColor: 'rgba(32, 201, 151, 0.2)'},{label:'Masa Muscular',data:metrics.masa_muscular||[],tension:0.3,borderColor: '#f0ad4e', backgroundColor: 'rgba(240, 173, 78, 0.2)'}]},options:{responsive:true,plugins:{legend:{position:'bottom', labels: {color: '#000'}}}, scales: {x: {grid: {color: 'rgba(255,255,255,0.1)'}, ticks: {color: '#000'}}, y: {grid: {color: 'rgba(255,255,255,0.1)'}, ticks: {color: '#000'}}}}});
}

function renderSessions(sessions){
const el=document.getElementById('sessionList'); el.innerHTML='';
sessions.forEach(s=>{
const div=document.createElement('div'); div.className='p-2 border rounded mb-1';
div.innerHTML=`<div class="d-flex justify-content-between"><div><div class="fw-semibold">${s.fecha} ${s.hora}</div><div class="small-muted">${s.notas}</div></div><div><button class="btn btn-sm btn-outline-danger">Eliminar</button></div></div>`;
div.querySelector('button').addEventListener('click',()=>deleteSession(currentMemberId,s.id));
el.appendChild(div);
});
}

function updateMetrics(){
if(!currentMemberId) return alert('Abrir un miembro primero');
const weight=parseFloat(document.getElementById('weightInput').value)||null;
const fat=parseFloat(document.getElementById('fatInput').value)||null;
const muscle=parseFloat(document.getElementById('muscleInput').value)||null;
const notes=document.getElementById('notesMetrics').value||'';
fetch('/api/nutricionista/progreso/registrar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_miembro:currentMemberId,peso:weight,grasa_corporal:fat,masa_muscular:muscle,observaciones:notes})}).then(()=>nutricionista_getProfile(currentMemberId));
}

function saveSession(){
if(!currentMemberId) return alert('Abrir un miembro primero');
const date=document.getElementById('sessionDate').value;
const time=document.getElementById('sessionTime').value;
const notes=document.getElementById('sessionNotes').value;
if(!date||!time) return alert('Fecha y hora requeridas');
fetch('/api/nutricionista/sesiones/crear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_miembro:currentMemberId,fecha:date,hora:time,notas:notes})}).then(()=>{
nutricionista_getProfile(currentMemberId);
document.getElementById('sessionDate').value = '';
document.getElementById('sessionTime').value = '';
document.getElementById('sessionNotes').value = '';
});
}

function deleteSession(memberId,sessionId){
fetch('/api/nutricionista/sesiones/eliminar/'+sessionId,{method:'DELETE'}).then(()=>nutricionista_getProfile(memberId));
}
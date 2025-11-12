async function mostrarModulo(modulo){
  document.querySelectorAll('.modulo').forEach(m=>m.classList.add('d-none'));
  const container=document.getElementById(modulo);
  container.classList.remove('d-none');
  if(container.innerHTML.trim()!=='') return;
  let url='';
  if(modulo==='clases_reservas') url='/clases_reservas';
  if(modulo==='progreso_entrenamiento') url='/progreso';
  if(modulo==='plan_nutricional') url='/plan_nutricional';
  if(modulo==='soporte_comunidad') url='/soporte';
  const res=await fetch(url);
  const html=await res.text();
  container.innerHTML=html;
  if(modulo==='clases_reservas') inicializarClases();
  if(modulo==='progreso_entrenamiento') inicializarProgreso();
  if(modulo==='plan_nutricional') inicializarPlanNutricional();
  if(modulo==='soporte_comunidad') inicializarSoporte();
}

function mostrarToast(msg,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

async function inicializarClases(){
  document.querySelectorAll('.btn-reservar').forEach(btn=>{
    btn.addEventListener('click', async()=>{
      const id_clase=btn.dataset.id;
      const res=await fetch('/api/reservas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_clase:id_clase,id_miembro:'miembro_id_actual'})});
      const data=await res.json();
      mostrarToast(data.ok?'Reserva realizada':'Error al reservar',data.ok?'success':'danger');
      mostrarModulo('clases_reservas');
    });
  });
}

async function inicializarProgreso(){
  const ctx=document.getElementById('graficaProgreso');
  if(!ctx) return;
  const res=await fetch('/api/progreso?miembro=miembro_id_actual');
  const data=await res.json();
  const fechas=data.data.map(p=>p.fecha);
  const pesos=data.data.map(p=>p.peso||0);
  new Chart(ctx,{type:'line',data:{labels:fechas,datasets:[{label:'Peso',data:pesos,borderColor:'blue',fill:false}]},options:{responsive:true}});
  const form=document.getElementById('formProgreso');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const payload={peso:form.peso.value,grasa_corporal:form.grasa.value,imc:form.imc.value,rendimiento:form.rendimiento.value,notas:form.notas.value};
    const res=await fetch('/api/progreso',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();
    mostrarToast(data.ok?'Progreso registrado':'Error al registrar',data.ok?'success':'danger');
    mostrarModulo('progreso_entrenamiento');
  });
}

async function inicializarPlanNutricional(){
  const res=await fetch('/api/plan_nutricional');
  const data=await res.json();
  document.getElementById('planNutricionalContainer').innerHTML='';
  data.data.forEach(plan=>{
    const div=document.createElement('div');
    div.className='card mb-2';
    div.innerHTML=`<div class="card-body">
      <h5 class="card-title">${plan.nombre}</h5>
      <p>${plan.descripcion}</p>
      <button class="btn btn-primary btn-sm" onclick="descargarPlanNutricional('${plan.id_plan}')">Descargar Dieta</button>
      <textarea placeholder="Comentarios al nutricionista"></textarea>
    </div>`;
    document.getElementById('planNutricionalContainer').appendChild(div);
  });
}

async function descargarPlanNutricional(id){
  const res=await fetch(`/api/plan_nutricional/download?id=${id}`);
  const blob=await res.blob();
  const url=window.URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`plan_${id}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
}

async function inicializarSoporte(){
  const chatForm=document.getElementById('formChat');
  chatForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const payload={mensaje:chatForm.mensaje.value};
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();
    mostrarToast(data.ok?'Mensaje enviado':'Error',data.ok?'success':'danger');
    chatForm.mensaje.value='';
  });
  const res=await fetch('/api/chat');
  const data=await res.json();
  const container=document.getElementById('chatContainer');
  container.innerHTML='';
  data.data.forEach(msg=>{
    const div=document.createElement('div');
    div.innerHTML=`<strong>${msg.remitente}</strong>: ${msg.mensaje} <small>${msg.fecha}</small>`;
    container.appendChild(div);
  });
  const noticiasRes=await fetch('/api/noticias');
  const noticiasData=await noticiasRes.json();
  const noticiasContainer=document.getElementById('noticiasContainer');
  noticiasContainer.innerHTML='';
  noticiasData.data.forEach(n=>{
    const div=document.createElement('div');
    div.innerHTML=`<p>${n.titulo}: ${n.contenido}</p>`;
    noticiasContainer.appendChild(div);
  });
  const tiendaRes=await fetch('/api/tienda');
  const tiendaData=await tiendaRes.json();
  const tiendaContainer=document.getElementById('tiendaContainer');
  tiendaContainer.innerHTML='';
  tiendaData.data.forEach(p=>{
    const div=document.createElement('div');
    div.innerHTML=`<p>${p.nombre} - $${p.precio}</p>`;
    tiendaContainer.appendChild(div);
  });
}
S
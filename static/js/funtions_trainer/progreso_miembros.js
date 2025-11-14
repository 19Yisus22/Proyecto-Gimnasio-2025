document.addEventListener("DOMContentLoaded", function(){
  cargarDatos();
  document.getElementById("formObjetivo").addEventListener("submit", guardarMeta);
  document.getElementById("btnCompletarRutina").addEventListener("click", completarRutina);
  document.getElementById("sendBtn").addEventListener("click", enviarMensaje);
});

async function cargarDatos(){
  await cargarHistorial();
  await cargarGrafico();
  await cargarMetas();
  await cargarProgreso();
  await cargarChat();
}

async function cargarHistorial(){
  const tabla=document.getElementById("tablaHistorial");
  tabla.innerHTML="";
  const res=await fetch(`/api/progreso/${ID_USUARIO}/historial`);
  const datos=await res.json();
  if(datos.length===0){tabla.innerHTML='<tr><td colspan="5" class="text-muted">No hay registros</td></tr>'; return;}
  datos.forEach(d=>{
    tabla.innerHTML+=`<tr><td>${d.fecha}</td><td>${d.peso}</td><td>${d.grasa}</td><td>${d.musculo}</td><td>${d.responsable}</td></tr>`;
  });
}

async function cargarGrafico(){
  const res=await fetch(`/api/progreso/${ID_USUARIO}/grafico`);
  const datos=await res.json();
  const ctx=document.getElementById("graficoProgreso").getContext("2d");
  new Chart(ctx,{type:'line',data:{labels:datos.fechas,datasets:[{label:'Peso',data:datos.peso,borderColor:'#9f7cf0',backgroundColor:'rgba(159,124,240,0.2)'},{label:'Grasa',data:datos.grasa,borderColor:'#e29ff0',backgroundColor:'rgba(226,159,240,0.2)'}]},options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top'}}}});
}

async function cargarMetas(){
  const lista=document.getElementById("listaMetas");
  lista.innerHTML="";
  const res=await fetch(`/api/progreso/${ID_USUARIO}/metas`);
  const metas=await res.json();
  metas.forEach(m=>{
    lista.innerHTML+=`<div class="alert alert-info p-2" style="background: rgba(159,124,240,0.2); border:none;">${m.descripcion} - <strong>${m.fecha}</strong></div>`;
  });
}

function guardarMeta(e){
  e.preventDefault();
  const descripcion=document.getElementById("metaDescripcion").value;
  const fecha=document.getElementById("metaFecha").value;
  fetch(`/api/progreso/${ID_USUARIO}/metas`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({descripcion,fecha})}).then(()=>{cargarMetas();document.getElementById("formObjetivo").reset();});
}

async function cargarProgreso(){
  const res=await fetch(`/api/progreso/${ID_USUARIO}/progreso`);
  const prog=await res.json();
  const barra=document.getElementById("barraProgreso");
  barra.style.width=prog.porcentaje+'%';
  barra.textContent=prog.porcentaje+'%';
}

function completarRutina(){
  fetch(`/api/progreso/${ID_USUARIO}/rutina-completada`,{method:'POST'}).then(()=>{cargarProgreso();});
}

async function cargarChat(){
  const box=document.getElementById("chatBox");
  box.innerHTML="";
  const res=await fetch(`/api/progreso/${ID_USUARIO}/chat`);
  const chat=await res.json();
  chat.forEach(m=>{
    const div=document.createElement("div");
    div.className="chat-message "+(m.rol==="admin"?"admin":"user");
    div.innerHTML=`<div class="bubble ${m.rol==="admin"?"admin":"user"}">${m.mensaje}</div>`;
    box.appendChild(div);
  });
  box.scrollTop=box.scrollHeight;
}

function enviarMensaje(){
  const input=document.getElementById("mensajeInput");
  const msg=input.value.trim();
  if(!msg) return;
  fetch(`/api/progreso/${ID_USUARIO}/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mensaje:msg})}).then(()=>{input.value=""; cargarChat();});
}

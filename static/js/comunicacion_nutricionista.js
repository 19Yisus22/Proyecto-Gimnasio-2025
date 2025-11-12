document.addEventListener('DOMContentLoaded', ()=>{
  cargarMiembros();
});

async function cargarMiembros(){
  const res=await fetch('/api/nutricionista/miembros');
  const data=await res.json();
  const lista=document.getElementById('listaMiembros');
  lista.innerHTML='';
  data.data.forEach(m=>{
    const li=document.createElement('li');
    li.className='list-group-item';
    li.innerText=m.nombre+' '+m.apellido;
    li.onclick=()=>cargarChat(m.id_usuario);
    lista.appendChild(li);
  });
}

async function cargarChat(miembroId){
  const res=await fetch(`/api/nutricionista/mensajes/${miembroId}`);
  const data=await res.json();
  const container=document.getElementById('chatContainer');
  container.innerHTML='';
  data.data.forEach(msg=>{
    const div=document.createElement('div');
    div.className='mb-2';
    div.innerHTML=`<strong>${msg.remitente}:</strong> ${msg.mensaje} <small class="text-muted">${new Date(msg.fecha).toLocaleString()}</small>`;
    container.appendChild(div);
  });
}

async function enviarMensaje(){
  const mensaje=document.getElementById('mensajeInput').value;
  const miembroSeleccionado=document.querySelector('#listaMiembros .active');
  if(!mensaje||!miembroSeleccionado) return;
  const miembroId=miembroSeleccionado.dataset.id;
  const payload={id_miembro:miembroId,mensaje};
  const res=await fetch('/api/nutricionista/mensajes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res.ok){document.getElementById('mensajeInput').value='';cargarChat(miembroId);mostrarToast('Mensaje enviado','success')}else mostrarToast('Error al enviar','danger');
}

function mostrarToast(msg,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

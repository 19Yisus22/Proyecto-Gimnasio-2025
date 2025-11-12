document.addEventListener('DOMContentLoaded', () => {
  cargarSugerencias();
  cargarChat();
  cargarNoticias();
  cargarTienda();

  document.getElementById('formSugerencia').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      mensaje: document.getElementById('mensaje').value,
      tipo: document.getElementById('tipo').value,
      calificacion: parseInt(document.getElementById('calificacion').value)
    };
    try{
      const res = await fetch('/api/sugerencias',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const data = await res.json();
      if(res.ok){
        mostrarToast('Sugerencia enviada','success');
        document.getElementById('formSugerencia').reset();
        cargarSugerencias();
      } else mostrarToast(data.error||'Error al enviar','danger');
    }catch(e){mostrarToast('Error al enviar sugerencia','danger');}
  });
});

async function cargarSugerencias(){
  try{
    const res = await fetch('/api/sugerencias');
    const data = await res.json();
    const container = document.getElementById('sugerenciasContainer');
    container.innerHTML='';
    if(data.ok){
      data.data.forEach(s=>{
        const li=document.createElement('li');
        li.className='list-group-item';
        li.innerText=`[${s.tipo}] ${s.mensaje} - Calificación: ${s.calificacion||'-'}`;
        container.appendChild(li);
      });
    }
  }catch(e){}
}

async function cargarChat(){
  try{
    const res = await fetch('/api/chat');
    const data = await res.json();
    const container=document.getElementById('chatContainer');
    container.innerHTML='';
    if(data.ok){
      data.data.forEach(m=>{
        const p=document.createElement('p');
        p.innerHTML=`<strong>${m.remitente}:</strong> ${m.mensaje}`;
        container.appendChild(p);
      });
      container.scrollTop = container.scrollHeight;
    }
  }catch(e){}
}

async function enviarMensaje(){
  const mensaje=document.getElementById('mensajeChat').value;
  if(!mensaje) return;
  try{
    const res = await fetch('/api/chat',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({mensaje})});
    if(res.ok){
      document.getElementById('mensajeChat').value='';
      cargarChat();
      mostrarToast('Mensaje enviado','success');
    }
  }catch(e){mostrarToast('Error al enviar mensaje','danger');}
}

async function cargarNoticias(){
  try{
    const res = await fetch('/api/noticias');
    const data = await res.json();
    const container = document.getElementById('noticiasContainer');
    container.innerHTML='';
    if(data.ok){
      data.data.forEach(n=>{
        const li=document.createElement('li');
        li.className='list-group-item';
        li.innerText=n.titulo;
        container.appendChild(li);
      });
    }
  }catch(e){}
}

async function cargarTienda(){
  try{
    const res = await fetch('/api/tienda');
    const data = await res.json();
    const container = document.getElementById('tiendaContainer');
    container.innerHTML='';
    if(data.ok){
      data.data.forEach(p=>{
        const li=document.createElement('li');
        li.className='list-group-item';
        li.innerText=`${p.nombre} - $${p.precio}`;
        container.appendChild(li);
      });
    }
  }catch(e){}
}

function mostrarToast(mensaje,tipo='info'){
  const container=document.getElementById('toastContainer') || document.body;
  const toastId=`toast-${Date.now()}`;
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.id=toastId;
  toast.setAttribute('role','alert');
  toast.setAttribute('aria-live','assertive');
  toast.setAttribute('aria-atomic','true');
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${mensaje}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

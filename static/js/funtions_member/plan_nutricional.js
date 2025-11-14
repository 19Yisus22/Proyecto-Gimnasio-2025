document.addEventListener('DOMContentLoaded', () => {
  cargarPlan();
  cargarComentarios();
  document.getElementById('formMedidas').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      peso: parseFloat(document.getElementById('peso').value),
      grasa_corporal: parseFloat(document.getElementById('grasa').value),
      notas: document.getElementById('notas').value
    };
    try{
      const res = await fetch('/api/progreso', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(res.ok){
        mostrarToast('Medidas registradas','success');
        document.getElementById('formMedidas').reset();
      } else mostrarToast(data.error||'Error al registrar','danger');
    }catch(e){mostrarToast('Error al registrar','danger');}
  });

  document.getElementById('formComentarios').addEventListener('submit', async e=>{
    e.preventDefault();
    const payload={mensaje: document.getElementById('comentario').value};
    try{
      const res = await fetch('/api/comentarios', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(res.ok){
        mostrarToast('Comentario enviado','success');
        document.getElementById('formComentarios').reset();
        cargarComentarios();
      } else mostrarToast(data.error||'Error al enviar','danger');
    }catch(e){mostrarToast('Error al enviar comentario','danger');}
  });
});

async function cargarPlan(){
  try{
    const res = await fetch('/api/plan_nutricional');
    const data = await res.json();
    if(data.ok && data.data.length>0){
      const plan = data.data[0];
      document.getElementById('planDescripcion').innerText = plan.descripcion;
      document.getElementById('planCalorias').innerText = plan.calorias;
      document.getElementById('planFechas').innerText = `${plan.fecha_inicio.split('T')[0]} - ${plan.fecha_fin.split('T')[0]}`;
    }
  }catch(e){}
}

async function descargarDieta(){
  window.open('/api/plan_nutricional/download','_blank');
}

async function cargarComentarios(){
  try{
    const res = await fetch('/api/comentarios');
    const data = await res.json();
    const container = document.getElementById('comentariosContainer');
    container.innerHTML='';
    if(data.ok){
      data.data.forEach(c=>{
        const li=document.createElement('li');
        li.className='list-group-item';
        li.innerText=c.mensaje;
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

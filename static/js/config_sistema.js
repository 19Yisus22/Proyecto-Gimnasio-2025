async function guardarConfiguracion(){
  const payload={
    hora_apertura: document.getElementById('horaApertura').value,
    hora_cierre: document.getElementById('horaCierre').value,
    precio_membresia: document.getElementById('precioMembresia').value,
    idioma: document.getElementById('idiomaSistema').value
  };
  const res=await fetch('/api/admin/configuracion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res.ok) mostrarToast('Configuración guardada','success'); else mostrarToast('Error al guardar','danger');
}

function mostrarToast(msg,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

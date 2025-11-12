document.addEventListener('DOMContentLoaded', ()=>{cargarMiembros()});

async function cargarMiembros(){
  const res=await fetch('/api/recepcionista/miembros');
  const data=await res.json();
  const tabla=document.getElementById('tablaMiembros');
  tabla.innerHTML='';
  data.data.forEach(m=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${m.nombre}</td><td>${m.apellido}</td><td>${m.cedula}</td><td>${m.telefono}</td><td>${m.correo}</td><td>${m.membresia_activa?'Activo':'Inactivo'}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editarMiembro('${m.id_usuario}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarMiembro('${m.id_usuario}')">Eliminar</button>
      </td>`;
    tabla.appendChild(tr);
  });
}

async function registrarMiembro(){
  const nombre=document.getElementById('nombreMiembro').value;
  const apellido=document.getElementById('apellidoMiembro').value;
  const cedula=document.getElementById('cedulaMiembro').value;
  const telefono=document.getElementById('telefonoMiembro').value;
  const correo=document.getElementById('correoMiembro').value;
  if(!nombre||!apellido||!cedula||!correo) return;
  const payload={nombre,apellido,cedula,telefono,correo};
  const res=await fetch('/api/recepcionista/miembros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res.ok){mostrarToast('Miembro registrado','success');cargarMiembros()}else mostrarToast('Error al registrar miembro','danger');
}

function mostrarToast(msg,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

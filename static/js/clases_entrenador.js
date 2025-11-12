document.addEventListener('DOMContentLoaded', cargarClases);

async function cargarClases(){
  const tabla=document.getElementById('tablaClases');
  tabla.innerHTML='';
  try{
    const res=await fetch('/api/entrenador/clases');
    const clases=await res.json();
    clases.data.forEach(c=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${c.nombre}</td>
        <td>${new Date(c.horario_inicio).toLocaleString()}</td>
        <td>${new Date(c.horario_fin).toLocaleString()}</td>
        <td>${c.capacidad_max}</td>
        <td><button class="btn btn-info btn-sm" onclick="verAsistentes('${c.id_clase}')">Ver</button></td>
        <td>
          <button class="btn btn-warning btn-sm" onclick="editarClase('${c.id_clase}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarClase('${c.id_clase}')">Eliminar</button>
        </td>`;
      tabla.appendChild(tr);
    });
  }catch(e){console.error(e);}
}

async function guardarClase(){
  const id=document.getElementById('claseId').value;
  const payload={
    nombre: document.getElementById('nombreClase').value,
    horario_inicio: document.getElementById('inicioClase').value,
    horario_fin: document.getElementById('finClase').value,
    capacidad_max: parseInt(document.getElementById('capacidadClase').value)
  };
  const url=id? `/api/entrenador/clases/${id}` : '/api/entrenador/clases';
  const method=id? 'PUT':'POST';
  try{
    const res=await fetch(url,{method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    if(res.ok){
      mostrarToast('Clase guardada','success');
      cargarClases();
      new bootstrap.Modal(document.getElementById('modalClase')).hide();
    }
  }catch(e){mostrarToast('Error al guardar clase','danger');}
}

async function editarClase(id){
  const res=await fetch(`/api/entrenador/clases/${id}`);
  const data=await res.json();
  if(data.ok){
    document.getElementById('claseId').value=data.data.id_clase;
    document.getElementById('nombreClase').value=data.data.nombre;
    document.getElementById('inicioClase').value=data.data.horario_inicio.split('T')[0]+'T'+data.data.horario_inicio.split('T')[1].slice(0,5);
    document.getElementById('finClase').value=data.data.horario_fin.split('T')[0]+'T'+data.data.horario_fin.split('T')[1].slice(0,5);
    document.getElementById('capacidadClase').value=data.data.capacidad_max;
    new bootstrap.Modal(document.getElementById('modalClase')).show();
  }
}

async function eliminarClase(id){
  try{
    const res=await fetch(`/api/entrenador/clases/${id}`,{method:'DELETE'});
    if(res.ok){
      mostrarToast('Clase eliminada','success');
      cargarClases();
    }
  }catch(e){mostrarToast('Error al eliminar clase','danger');}
}

function verAsistentes(id){
  window.location.href=`/entrenador/asistentes/${id}`;
}

function mostrarToast(mensaje,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${mensaje}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

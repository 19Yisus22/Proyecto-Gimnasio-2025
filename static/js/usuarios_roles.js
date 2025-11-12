document.addEventListener('DOMContentLoaded', ()=>{
  cargarRoles();
  cargarUsuarios();
});

async function cargarRoles(){
  const res=await fetch('/api/admin/roles');
  const data=await res.json();
  const select=document.getElementById('rolUsuario');
  select.innerHTML='<option value="">Seleccionar Rol</option>';
  data.data.forEach(r=>{
    const opt=document.createElement('option');
    opt.value=r.id_rol;
    opt.text=r.nombre_rol;
    select.appendChild(opt);
  });
}

async function cargarUsuarios(){
  const res=await fetch('/api/admin/usuarios');
  const data=await res.json();
  const tabla=document.getElementById('tablaUsuarios');
  tabla.innerHTML='';
  data.data.forEach(u=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${u.nombre}</td><td>${u.apellido}</td><td>${u.cedula}</td><td>${u.correo}</td><td>${u.nombre_rol}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editarUsuario('${u.id_usuario}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarUsuario('${u.id_usuario}')">Eliminar</button>
      </td>`;
    tabla.appendChild(tr);
  });
}

async function crearUsuario(){
  const nombre=document.getElementById('nombreUsuario').value;
  const apellido=document.getElementById('apellidoUsuario').value;
  const cedula=document.getElementById('cedulaUsuario').value;
  const correo=document.getElementById('correoUsuario').value;
  const rol=document.getElementById('rolUsuario').value;
  if(!nombre||!apellido||!cedula||!correo||!rol) return;
  const payload={nombre,apellido,cedula,correo,id_rol:rol};
  const res=await fetch('/api/admin/usuarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res.ok){mostrarToast('Usuario creado','success');cargarUsuarios()}else mostrarToast('Error al crear','danger');
}

function mostrarToast(msg,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

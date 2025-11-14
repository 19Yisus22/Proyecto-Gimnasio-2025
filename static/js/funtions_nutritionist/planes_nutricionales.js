document.addEventListener('DOMContentLoaded', ()=>{
  cargarMiembros();
  cargarPlanes();
});

async function cargarMiembros(){
  const res=await fetch('/api/nutricionista/miembros');
  const data=await res.json();
  const select=document.getElementById('selectMiembroPlan');
  select.innerHTML='<option value="">Seleccionar miembro</option>';
  data.data.forEach(m=>{
    const opt=document.createElement('option');
    opt.value=m.id_usuario;
    opt.text=m.nombre+' '+m.apellido;
    select.appendChild(opt);
  });
}

async function cargarPlanes(){
  const res=await fetch('/api/nutricionista/planes');
  const data=await res.json();
  const tabla=document.getElementById('tablaPlanes');
  tabla.innerHTML='';
  data.data.forEach(p=>{
    const tr=document.createElement('tr');
    const inicio=new Date(p.fecha_inicio).toLocaleDateString();
    const fin=new Date(p.fecha_fin).toLocaleDateString();
    tr.innerHTML=`<td>${p.nombre_miembro}</td><td>${p.descripcion}</td><td>${p.calorias}</td><td>${inicio}</td><td>${fin}</td><td>${p.estado?'Activo':'Inactivo'}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editarPlan('${p.id_plan}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarPlan('${p.id_plan}')">Eliminar</button>
        <button class="btn btn-info btn-sm" onclick="exportarPlan('${p.id_plan}')">Exportar</button>
      </td>`;
    tabla.appendChild(tr);
  });
}

async function crearPlan(){
  const miembro=document.getElementById('selectMiembroPlan').value;
  const descripcion=document.getElementById('descripcionPlan').value;
  const calorias=document.getElementById('caloriasPlan').value;
  const inicio=document.getElementById('fechaInicioPlan').value;
  const fin=document.getElementById('fechaFinPlan').value;
  if(!miembro||!descripcion||!calorias||!inicio||!fin) return;
  const payload={id_miembro:miembro,descripcion,calorias:parseInt(calorias),fecha_inicio:inicio,fecha_fin:fin,estado:true};
  const res=await fetch('/api/nutricionista/planes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res.ok){mostrarToast('Plan creado','success');cargarPlanes()}else mostrarToast('Error al crear plan','danger');
}

function mostrarToast(msg,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

document.addEventListener('DOMContentLoaded', ()=>{
  cargarMiembros();
  cargarClases();
  cargarReservas();
});

async function cargarMiembros(){
  const res=await fetch('/api/recepcionista/miembros');
  const data=await res.json();
  const select=document.getElementById('selectMiembroReserva');
  select.innerHTML='<option value="">Seleccionar miembro</option>';
  data.data.forEach(m=>{
    const opt=document.createElement('option');
    opt.value=m.id_usuario;
    opt.text=m.nombre+' '+m.apellido;
    select.appendChild(opt);
  });
}

async function cargarClases(){
  const res=await fetch('/api/recepcionista/clases');
  const data=await res.json();
  const select=document.getElementById('selectClaseReserva');
  select.innerHTML='<option value="">Seleccionar clase</option>';
  data.data.forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.id_clase;
    opt.text=c.nombre;
    select.appendChild(opt);
  });
}

async function cargarReservas(){
  const res=await fetch('/api/recepcionista/reservas');
  const data=await res.json();
  const tabla=document.getElementById('tablaReservas');
  tabla.innerHTML='';
  data.data.forEach(r=>{
    const tr=document.createElement('tr');
    const fecha=new Date(r.fecha_reserva).toLocaleString();
    tr.innerHTML=`<td>${r.nombre_miembro}</td><td>${r.nombre_clase}</td><td>${fecha}</td><td>${r.estado}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="cancelarReserva('${r.id_reserva}')">Cancelar</button>
      </td>`;
    tabla.appendChild(tr);
  });
}

async function crearReserva(){
  const miembroId=document.getElementById('selectMiembroReserva').value;
  const claseId=document.getElementById('selectClaseReserva').value;
  const fecha=document.getElementById('fechaReserva').value;
  if(!miembroId || !claseId || !fecha) return;
  const payload={id_miembro:miembroId,id_clase:claseId,fecha_reserva:fecha};
  const res=await fetch('/api/recepcionista/reservas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res.ok){mostrarToast('Reserva creada','success');cargarReservas()}else mostrarToast('Error al crear reserva','danger');
}

async function cancelarReserva(id){
  const res=await fetch(`/api/recepcionista/reservas/${id}`,{method:'DELETE'});
  if(res.ok){mostrarToast('Reserva cancelada','success');cargarReservas()}else mostrarToast('Error al cancelar','danger');
}

function mostrarToast(msg,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

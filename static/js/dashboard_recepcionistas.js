document.addEventListener('DOMContentLoaded', ()=>{
  cargarMiembros();
  cargarClases();
  cargarPagos();
  cargarReservas();
});

function mostrarModulo(modulo){
  document.querySelectorAll('.modulo').forEach(m=>m.classList.add('d-none'));
  if(modulo==='reservas') document.getElementById('moduloReservas').classList.remove('d-none');
  if(modulo==='pagos') document.getElementById('moduloPagos').classList.remove('d-none');
  if(modulo==='miembros') document.getElementById('moduloMiembros').classList.remove('d-none');
}

async function cargarMiembros(){
  const res=await fetch('/api/recepcionista/miembros');
  const data=await res.json();
  const selectReserva=document.getElementById('selectMiembroReserva');
  const selectPago=document.getElementById('selectMiembroPago');
  selectReserva.innerHTML='<option value="">Seleccionar miembro</option>';
  selectPago.innerHTML='<option value="">Seleccionar miembro</option>';
  const tabla=document.getElementById('tablaMiembros');
  tabla.innerHTML='';
  data.data.forEach(m=>{
    const option1=document.createElement('option');
    option1.value=m.id_usuario;
    option1.innerText=m.nombre+' '+m.apellido;
    selectReserva.appendChild(option1);
    const option2=document.createElement('option');
    option2.value=m.id_usuario;
    option2.innerText=m.nombre+' '+m.apellido;
    selectPago.appendChild(option2);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${m.nombre}</td><td>${m.apellido}</td><td>${m.cedula}</td><td>${m.telefono}</td><td>${m.correo}</td><td>${m.membresia_activa?'Activo':'Inactivo'}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editarMiembro('${m.id_usuario}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarMiembro('${m.id_usuario}')">Eliminar</button>
      </td>`;
    tabla.appendChild(tr);
  });
}

async function cargarClases(){
  const res=await fetch('/api/recepcionista/clases');
  const data=await res.json();
  const selectClase=document.getElementById('selectClaseReserva');
  selectClase.innerHTML='<option value="">Seleccionar clase</option>';
  data.data.forEach(c=>{
    const option=document.createElement('option');
    option.value=c.id_clase;
    option.innerText=c.nombre;
    selectClase.appendChild(option);
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

async function cargarPagos(){
  const res=await fetch('/api/recepcionista/pagos');
  const data=await res.json();
  const tabla=document.getElementById('tablaPagos');
  tabla.innerHTML='';
  data.data.forEach(p=>{
    const fecha=new Date(p.fecha).toLocaleString();
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${p.nombre_miembro}</td><td>${p.monto}</td><td>${fecha}</td><td>${p.metodo_pago}</td>
      <td><button class="btn btn-primary btn-sm" onclick="generarFactura('${p.id_pago}')">Factura</button></td>`;
    tabla.appendChild(tr);
  });
}

async function registrarPago(){
  const miembroId=document.getElementById('selectMiembroPago').value;
  const monto=document.getElementById('montoPago').value;
  const tipo=document.getElementById('tipoPago').value;
  if(!miembroId || !monto || !tipo) return;
  const payload={id_miembro:miembroId,precio:monto,metodo_pago:tipo,fecha_inicio:new Date().toISOString()};
  const res=await fetch('/api/recepcionista/pagos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res.ok){mostrarToast('Pago registrado','success');cargarPagos()}else mostrarToast('Error al registrar pago','danger');
}

async function registrarMiembro(){
  const nombre=document.getElementById('nombreMiembro').value;
  const apellido=document.getElementById('apellidoMiembro').value;
  const cedula=document.getElementById('cedulaMiembro').value;
  const telefono=document.getElementById('telefonoMiembro').value;
  const correo=document.getElementById('correoMiembro').value;
  if(!nombre || !apellido || !cedula || !correo) return;
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

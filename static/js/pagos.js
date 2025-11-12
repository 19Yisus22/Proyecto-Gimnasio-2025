document.addEventListener('DOMContentLoaded', ()=>{
  cargarMiembros();
  cargarPagos();
});

async function cargarMiembros(){
  const res=await fetch('/api/recepcionista/miembros');
  const data=await res.json();
  const select=document.getElementById('selectMiembroPago');
  select.innerHTML='<option value="">Seleccionar miembro</option>';
  data.data.forEach(m=>{
    const opt=document.createElement('option');
    opt.value=m.id_usuario;
    opt.text=m.nombre+' '+m.apellido;
    select.appendChild(opt);
  });
}

async function cargarPagos(){
  const res=await fetch('/api/recepcionista/pagos');
  const data=await res.json();
  const tabla=document.getElementById('tablaPagos');
  tabla.innerHTML='';
  data.data.forEach(p=>{
    const fecha=new Date(p.fecha_inicio).toLocaleString();
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${p.nombre_miembro}</td><td>${p.precio}</td><td>${fecha}</td><td>${p.metodo_pago}</td>
      <td><button class="btn btn-primary btn-sm" onclick="generarFactura('${p.id_membresia}')">Factura</button></td>`;
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

function mostrarToast(msg,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

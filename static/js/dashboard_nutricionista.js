document.addEventListener('DOMContentLoaded', () => {
  cargarMiembros();
  cargarPlanes();
});

function mostrarModulo(mod) {
  document.getElementById('moduloPlanes').style.display = mod === 'planes' ? 'block' : 'none';
  document.getElementById('moduloComunicacion').style.display = mod === 'comunicacion' ? 'block' : 'none';
  document.querySelectorAll('#sidebar .nav-link').forEach(link => link.classList.remove('active'));
  event.target.classList.add('active');
}

async function cargarMiembros() {
  const res = await fetch('/api/nutricionista/miembros');
  const data = await res.json();
  const lista = document.getElementById('listaMiembros');
  const select = document.getElementById('selectMiembroPlan');
  lista.innerHTML = '';
  select.innerHTML = '<option value="">Seleccionar miembro</option>';
  data.data.forEach(m => {
    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.innerText = m.nombre + ' ' + m.apellido;
    li.dataset.id = m.id_usuario;
    li.onclick = () => cargarChat(m.id_usuario);
    lista.appendChild(li);
    const opt = document.createElement('option');
    opt.value = m.id_usuario;
    opt.text = m.nombre + ' ' + m.apellido;
    select.appendChild(opt);
  });
}

async function cargarPlanes() {
  const res = await fetch('/api/nutricionista/planes');
  const data = await res.json();
  const tabla = document.getElementById('tablaPlanes');
  tabla.innerHTML = '';
  data.data.forEach(p => {
    const tr = document.createElement('tr');
    const inicio = new Date(p.fecha_inicio).toLocaleDateString();
    const fin = new Date(p.fecha_fin).toLocaleDateString();
    tr.innerHTML = `
      <td>${p.nombre_miembro}</td>
      <td>${p.descripcion}</td>
      <td>${p.calorias}</td>
      <td>${inicio}</td>
      <td>${fin}</td>
      <td>${p.estado ? 'Activo' : 'Inactivo'}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editarPlan('${p.id_plan}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarPlan('${p.id_plan}')">Eliminar</button>
        <button class="btn btn-info btn-sm" onclick="exportarPlan('${p.id_plan}')">Exportar</button>
      </td>`;
    tabla.appendChild(tr);
  });
}

async function crearPlan() {
  const miembro = document.getElementById('selectMiembroPlan').value;
  const descripcion = document.getElementById('descripcionPlan').value;
  const calorias = document.getElementById('caloriasPlan').value;
  const inicio = document.getElementById('fechaInicioPlan').value;
  const fin = document.getElementById('fechaFinPlan').value;
  if (!miembro || !descripcion || !calorias || !inicio || !fin) return;
  const payload = { id_miembro: miembro, descripcion, calorias: parseInt(calorias), fecha_inicio: inicio, fecha_fin: fin, estado: true };
  const res = await fetch('/api/nutricionista/planes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (res.ok) { mostrarToast('Plan creado', 'success'); cargarPlanes() } else mostrarToast('Error al crear plan', 'danger');
}

async function editarPlan(idPlan) {
  const descripcion = prompt('Nueva descripción:');
  if (!descripcion) return;
  const res = await fetch(`/api/nutricionista/planes/${idPlan}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descripcion }) });
  if (res.ok) { mostrarToast('Plan actualizado', 'success'); cargarPlanes() } else mostrarToast('Error al actualizar', 'danger');
}

async function eliminarPlan(idPlan) {
  const res = await fetch(`/api/nutricionista/planes/${idPlan}`, { method: 'DELETE' });
  if (res.ok) { mostrarToast('Plan eliminado', 'success'); cargarPlanes() } else mostrarToast('Error al eliminar', 'danger');
}

async function exportarPlan(idPlan) {
  window.open(`/api/nutricionista/planes/export/${idPlan}`, '_blank');
}

async function cargarChat(miembroId) {
  const res = await fetch(`/api/nutricionista/mensajes/${miembroId}`);
  const data = await res.json();
  const container = document.getElementById('chatContainer');
  container.innerHTML = '';
  data.data.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'mb-2';
    div.innerHTML = `<strong>${msg.remitente}:</strong> ${msg.mensaje} <small class="text-muted">${new Date(msg.fecha).toLocaleString()}</small>`;
    container.appendChild(div);
  });
}

async function enviarMensaje() {
  const mensaje = document.getElementById('mensajeInput').value;
  const miembroSeleccionado = document.querySelector('#listaMiembros .active');
  if (!mensaje || !miembroSeleccionado) return;
  const miembroId = miembroSeleccionado.dataset.id;
  const payload = { id_miembro: miembroId, mensaje };
  const res = await fetch('/api/nutricionista/mensajes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (res.ok) { document.getElementById('mensajeInput').value = ''; cargarChat(miembroId); mostrarToast('Mensaje enviado', 'success') } else mostrarToast('Error al enviar', 'danger');
}

function mostrarToast(msg, tipo = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

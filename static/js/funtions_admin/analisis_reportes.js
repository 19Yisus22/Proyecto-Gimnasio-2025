let chart;
let usuariosSeleccionados = [];
let todosUsuarios = [];

function cargarUsuarios() {
  fetch(`/usuarios/listar?roles=miembro,entrenador`)
    .then(res => res.json())
    .then(data => {
      todosUsuarios = data;
      mostrarUsuarios(data);
    });
}

function mostrarUsuarios(usuarios) {
  const cont = document.getElementById('usuariosList');
  cont.innerHTML = '';
  usuarios.forEach(u => {
    const card = document.createElement('div');
    card.className = 'usuario-card';
    card.innerHTML = `<img src="${u.imagen_url || '/static/default.png'}"><span>${u.nombre} ${u.apellido}</span>`;
    card.onclick = () => seleccionarUsuario(u, card);
    cont.appendChild(card);
  });
}

function seleccionarUsuario(u, cardEl) {
  usuariosSeleccionados = [u];
  document.querySelectorAll('.usuario-card').forEach(el => el.classList.remove('selected'));
  cardEl.classList.add('selected');
  mostrarDetalle(u);
  document.getElementById('exportPDF').disabled = false;
  document.getElementById('exportExcel').disabled = false;
}

function mostrarDetalle(u) {
  document.getElementById('usuarioDetalle').style.display = 'block';
  document.getElementById('fotoDetalle').src = u.imagen_url || '/static/default.png';
  document.getElementById('nombreDetalle').innerText = u.nombre + ' ' + u.apellido;
  document.getElementById('telefonoDetalle').innerText = 'Tel: ' + (u.telefono || '-');
  document.getElementById('correoDetalle').innerText = 'Correo: ' + (u.correo || '-');
  document.getElementById('direccionDetalle').innerText = 'Dirección: ' + (u.direccion || '-');
}

function filtrarPorCedula() {
  const cedula = document.getElementById('buscarCedula').value.trim();
  if(cedula === '') {
    mostrarUsuarios(todosUsuarios);
    return;
  }
  const filtrados = todosUsuarios.filter(u => u.cedula.includes(cedula));
  mostrarUsuarios(filtrados);
}

function generarReporte() {
  if (usuariosSeleccionados.length === 0) return;
  const tipo = document.getElementById('filtroReporte').value;
  const ids = usuariosSeleccionados.map(u => u.id_usuario).join(',');
  fetch(`/reportes/data?tipo=${tipo}&usuarios=${ids}`)
    .then(res => res.json())
    .then(data => {
      const labels = data.labels;
      const valores = data.valores;
      if(chart) chart.destroy();
      const ctx = document.getElementById('chartReporte').getContext('2d');
      chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: tipo.charAt(0).toUpperCase() + tipo.slice(1),
            data: valores,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });

      const tbody = document.querySelector('#tablaReporte tbody');
      tbody.innerHTML = '';
      data.detalles.forEach(d => {
        const row = `<tr>
          <td>${d.nombre}</td>
          <td>${d.asistencia}</td>
          <td>${d.pagos_totales}</td>
          <td>${d.retencion}</td>
          <td>${d.satisfaccion}</td>
          <td>${d.progreso}</td>
          <td>${d.nutricion}</td>
        </tr>`;
        tbody.innerHTML += row;
      });
    });
}

function exportarPDF() {}
function exportarExcel() {}
function agregarComentario() {}

window.onload = cargarUsuarios;
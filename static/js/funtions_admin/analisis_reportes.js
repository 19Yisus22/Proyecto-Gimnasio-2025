let chart;
let usuario = null;
let usuarios = [];

function cargarKpis() {
  fetch('/reportes/kpis')
    .then(r => r.json())
    .then(d => {
      document.getElementById('kpi_membresias').innerText = d.membresias;
      document.getElementById('kpi_asistencia').innerText = d.asistencia + '%';
      document.getElementById('kpi_ingresos').innerText = '$' + d.ingresos;
    });
}

function cargarUsuarios() {
  fetch('/usuarios/listar?roles=miembro')
    .then(r => r.json())
    .then(d => {
      usuarios = d;
      mostrarUsuarios(d);
      actualizarGraficaGeneral();
    });
}

function mostrarUsuarios(lista) {
  const cont = document.getElementById('usuariosList');
  cont.innerHTML = '';
  lista.forEach(u => {
    const card = document.createElement('div');
    card.className = 'usuario-card';
    card.innerHTML = `<img src="${u.imagen_url || '/static/default.png'}"><span>${u.nombre} ${u.apellido}</span>`;
    card.onclick = () => seleccionarUsuario(u, card);
    cont.appendChild(card);
  });
}

function seleccionarUsuario(u, card) {
  usuario = u;
  document.querySelectorAll('.usuario-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  mostrarDetalle(u);
  actualizarGrafica();
}

function mostrarDetalle(u) {
  document.getElementById('usuarioDetalle').style.display = 'block';
  document.getElementById('fotoDetalle').src = u.imagen_url || '/static/default.png';
  document.getElementById('nombreDetalle').innerText = u.nombre + ' ' + u.apellido;
  document.getElementById('telefonoDetalle').innerText = 'Tel: ' + (u.telefono || '-');
  document.getElementById('correoDetalle').innerText = 'Correo: ' + (u.correo || '-');
  document.getElementById('direccionDetalle').innerText = 'Dirección: ' + (u.direccion || '-');
}

document.getElementById('filtroReporte').addEventListener('change', () => {
  if (usuario) actualizarGrafica();
  else actualizarGraficaGeneral();
});

function filtrarPorCedula() {
  const cedula = document.getElementById('buscarCedula').value.trim();
  if (cedula === '') return mostrarUsuarios(usuarios);
  const filtrados = usuarios.filter(u => u.cedula.includes(cedula));
  mostrarUsuarios(filtrados);
}

function actualizarGraficaGeneral() {
  const tipo = document.getElementById('filtroReporte').value;
  fetch(`/api/admin/reportes_data?tipo=${tipo}`)
    .then(r => r.json())
    .then(data => renderizarGrafica(data));
}

function actualizarGrafica() {
  const tipo = document.getElementById('filtroReporte').value;
  fetch(`/api/admin/reportes_data?tipo=${tipo}&cedula=${usuario.cedula}`)
    .then(r => r.json())
    .then(data => renderizarGrafica(data));
}

function renderizarGrafica(data) {
  const ctx = document.getElementById('chartReporte').getContext('2d');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: '',
        data: data.valores,
        fill: false,
        borderColor: 'rgba(54, 162, 235, 0.8)',
        tension: 0.3
      }]
    },
    options: { responsive: true }
  });

  const tbody = document.querySelector('#tablaReporte tbody');
  tbody.innerHTML = '';

  Object.entries(data.detalles[0]).forEach(([k, v]) => {
    tbody.innerHTML += `
      <tr>
        <td style="color: black;">${k}</td>
        <td style="color: black;">${v}</td>
      </tr>
    `;
  });
}

window.onload = () => {
  cargarKpis();
  cargarUsuarios();
};
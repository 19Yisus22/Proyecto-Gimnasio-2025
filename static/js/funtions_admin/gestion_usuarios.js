let editandoId = null;
let usuariosGlobal = [];
let usuariosFiltrados = [];
let paginaActual = 1;
const filasPorPagina = 15;

function mostrarToast(mensaje, tipo='success') {
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${tipo} border-0`;
  toastEl.setAttribute('role','alert');
  toastEl.innerHTML = `<div class="d-flex">
    <div class="toast-body">${mensaje}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
  </div>`;
  document.getElementById('toastContainer').appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', ()=> toastEl.remove());
}

async function listarUsuarios() {
  const response = await fetch(`/usuarios/listar`);
  usuariosGlobal = await response.json();
  filtrarTabla();
}

async function guardarUsuario() {
  const nombre = document.getElementById('nombreUsuario').value.trim();
  const apellido = document.getElementById('apellidoUsuario').value.trim();
  const cedula = document.getElementById('cedulaUsuario').value.trim();
  const correo = document.getElementById('correoUsuario').value.trim();
  const contrasena = document.getElementById('contrasenaUsuario').value.trim();
  const rol = document.getElementById('rolUsuario').value;
  const telefono = document.getElementById('telefonoUsuario').value.trim();
  const direccion = document.getElementById('direccionUsuario').value.trim();
  const genero = document.getElementById('generoUsuario').value.trim();
  const fechaNacimiento = document.getElementById('fechaNacimientoUsuario').value;
  const metodoPago = document.getElementById('metodoPagoUsuario').value;
  const membresiaActiva = document.getElementById('membresiaUsuario').value === 'true';

  if(!nombre || !apellido || !cedula || !correo || !rol || !contrasena) {
    mostrarToast('Todos los campos obligatorios', 'danger');
    return;
  }

  const usuario = { nombre, apellido, cedula, correo, contrasena, rol, telefono, direccion, genero, fecha_nacimiento: fechaNacimiento, metodo_pago: metodoPago, membresia_activa: membresiaActiva, imagen_url: '/static/uploads/default_icon_profile.png' };

  if(editandoId) {
    await fetch(`/usuarios/editar/${editandoId}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(usuario)
    });
    editandoId = null;
    document.getElementById('btnCancelar').style.display = 'none';
  } else {
    await fetch('/usuarios/crear', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(usuario)
    });
  }

  limpiarFormulario();
  mostrarToast('Usuario guardado correctamente');
  listarUsuarios();
}

function limpiarFormulario() {
  document.getElementById('nombreUsuario').value = '';
  document.getElementById('apellidoUsuario').value = '';
  document.getElementById('cedulaUsuario').value = '';
  document.getElementById('correoUsuario').value = '';
  document.getElementById('contrasenaUsuario').value = '';
  document.getElementById('telefonoUsuario').value = '';
  document.getElementById('direccionUsuario').value = '';
  document.getElementById('generoUsuario').value = '';
  document.getElementById('fechaNacimientoUsuario').value = '';
  document.getElementById('metodoPagoUsuario').value = 'Efectivo';
  document.getElementById('rolUsuario').value = '';
  document.getElementById('membresiaUsuario').value = '';
}

function cancelarEdicion() {
  limpiarFormulario();
  editandoId = null;
  document.getElementById('btnCancelar').style.display = 'none';
}

function formatearFecha(fechaISO) {
  if(!fechaISO) return '-';
  const d = new Date(fechaISO);
  const dia = String(d.getDate()).padStart(2,'0');
  const mes = String(d.getMonth()+1).padStart(2,'0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function verPerfil(id_usuario) {
  fetch(`/usuarios/obtener/${id_usuario}`)
    .then(res => res.json())
    .then(u => {
      const nombreRol = u.roles ? u.roles.nombre_rol : 'N/A';
      let contenido = `<ul class="list-group">
        <li class="list-group-item"><b>Nombre:</b> ${u.nombre}</li>
        <li class="list-group-item"><b>Apellido:</b> ${u.apellido}</li>
        <li class="list-group-item"><b>Cédula:</b> ${u.cedula}</li>
        <li class="list-group-item"><b>Correo:</b> ${u.correo}</li>
        <li class="list-group-item"><b>Rol:</b> ${nombreRol}</li>
        <li class="list-group-item"><b>Teléfono:</b> ${u.telefono || '-'}</li>
        <li class="list-group-item"><b>Dirección:</b> ${u.direccion || '-'}</li>
        <li class="list-group-item"><b>Género:</b> ${u.genero || '-'}</li>
        <li class="list-group-item"><b>Método de Pago:</b> ${u.metodo_pago || '-'}</li>
        ${['miembro','entrenador'].includes(nombreRol) ? `<li class="list-group-item"><b>Membresía Activa:</b> ${u.membresia_activa ? 'Sí' : 'No'}</li>` : ''}
        <li class="list-group-item"><b>Fecha Nacimiento:</b> ${u.fecha_nacimiento || '-'}</li>
        <li class="list-group-item"><b>Fecha Creación:</b> ${formatearFecha(u.fecha_creacion)}</li>
      </ul>`;
      document.getElementById('perfilContenido').innerHTML = contenido;
      const modal = new bootstrap.Modal(document.getElementById('perfilModal'));
      modal.show();
    });
}

function editarUsuario(id_usuario) {
  fetch(`/usuarios/obtener/${id_usuario}`)
    .then(res => res.json())
    .then(u => {
      document.getElementById('nombreUsuario').value = u.nombre;
      document.getElementById('apellidoUsuario').value = u.apellido;
      document.getElementById('cedulaUsuario').value = u.cedula;
      document.getElementById('correoUsuario').value = u.correo;
      document.getElementById('contrasenaUsuario').value = '';
      document.getElementById('telefonoUsuario').value = u.telefono || '';
      document.getElementById('direccionUsuario').value = u.direccion || '';
      document.getElementById('generoUsuario').value = u.genero || '';
      document.getElementById('fechaNacimientoUsuario').value = u.fecha_nacimiento || '';
      document.getElementById('metodoPagoUsuario').value = u.metodo_pago || 'Efectivo';
      document.getElementById('rolUsuario').value = u.rol;
      document.getElementById('membresiaUsuario').value = u.membresia_activa ? 'true' : 'false';
      editandoId = id_usuario;
      document.getElementById('btnCancelar').style.display = 'inline-block';
    });
}

function eliminarUsuario(correo) {
  if(confirm(`Eliminar usuario con correo: ${correo}?`)) {
    fetch('/usuarios/eliminar', {
      method:'DELETE',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({correo})
    }).then(()=> {
      mostrarToast('Usuario eliminado', 'warning');
      listarUsuarios();
    });
  }
}

function filtrarTabla() {
  const cedulaFiltro = document.getElementById('buscarCedula').value.toLowerCase();
  const membresiaFiltro = document.getElementById('filtroMembresia').value;
  const rolFiltro = document.getElementById('filtroRol').value;
  usuariosFiltrados = usuariosGlobal.filter(u => {
    const rolNombre = u.roles ? u.roles.nombre_rol : '';
    const coincideCedula = u.cedula.toLowerCase().includes(cedulaFiltro);
    const mostrarMembresia = ['miembro','entrenador'].includes(rolNombre);
    const coincideMembresia = membresiaFiltro === '' || !mostrarMembresia || String(u.membresia_activa) === membresiaFiltro;
    const coincideRol = rolFiltro === '' || rolNombre === rolFiltro;
    return coincideCedula && coincideMembresia && coincideRol;
  });
  paginaActual = 1;
  renderizarTabla(usuariosFiltrados);
  renderizarPaginacion();
}

function renderizarTabla(usuarios) {
  const tbody = document.getElementById('tablaUsuarios');
  tbody.innerHTML = '';
  const inicio = (paginaActual-1)*filasPorPagina;
  const fin = inicio + filasPorPagina;
  const paginaUsuarios = usuarios.slice(inicio, fin);
  paginaUsuarios.forEach(u => {
    const nombreRol = u.roles ? u.roles.nombre_rol : 'N/A';
    const mostrarMembresia = ['miembro','entrenador'].includes(nombreRol);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.nombre}</td>
      <td>${u.apellido}</td>
      <td>${u.cedula}</td>
      <td>${u.correo}</td>
      <td>${nombreRol}</td>
      <td>${u.telefono || '-'}</td>
      <td>${u.direccion || '-'}</td>
      <td>${u.genero || '-'}</td>
      <td>${u.metodo_pago || '-'}</td>
      <td>${mostrarMembresia ? (u.membresia_activa ? 'Sí' : 'No') : '-'}</td>
      <td>${u.fecha_nacimiento || '-'}</td>
      <td>${formatearFecha(u.fecha_creacion)}</td>
      <td>
        <button class="btn btn-sm btn-info me-1" onclick="verPerfil('${u.id_usuario}')"><i class="bi bi-eye-fill"></i></button>
        <button class="btn btn-sm btn-primary me-1" onclick="editarUsuario('${u.id_usuario}')"><i class="bi bi-pencil-fill"></i></button>
        <button class="btn btn-sm btn-danger" onclick="eliminarUsuario('${u.correo}')"><i class="bi bi-trash-fill"></i></button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderizarPaginacion() {
  const totalPaginas = Math.ceil(usuariosFiltrados.length / filasPorPagina);
  const pagContainer = document.getElementById('paginacion');
  pagContainer.innerHTML = '';
  for(let i=1;i<=totalPaginas;i++){
    const li = document.createElement('li');
    li.className = `page-item ${i===paginaActual?'active':''}`;
    li.innerHTML = `<a class="page-link" href="#" onclick="cambiarPagina(${i})">${i}</a>`;
    pagContainer.appendChild(li);
  }
}

function cambiarPagina(num) {
  paginaActual = num;
  renderizarTabla(usuariosFiltrados);
  renderizarPaginacion();
}

document.addEventListener('DOMContentLoaded', listarUsuarios);
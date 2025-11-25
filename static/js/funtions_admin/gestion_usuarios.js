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

function validarCedula(cedula) {
  return /^\d{6,15}$/.test(cedula);
}

function validarCorreo(correo) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(correo);
}

function validarTelefono(telefono) {
  if (!telefono) return true;
  return /^\d{7,15}$/.test(telefono);
}

function validarFechaNacimiento(fecha) {
  if (!fecha) return true;
  const fechaNac = new Date(fecha);
  const hoy = new Date();
  const edad = (hoy - fechaNac) / (1000 * 60 * 60 * 24 * 365);
  return edad >= 10 && edad <= 120;
}

function validarTexto(texto, minLength = 2, maxLength = 100) {
  if (!texto) return false;
  return texto.length >= minLength && texto.length <= maxLength;
}

async function listarUsuarios() {
  try {
    const response = await fetch(`/usuarios/listar`);
    if (!response.ok) {
        throw new Error(`Respuesta no exitosa: ${response.statusText}`);
    }
    usuariosGlobal = await response.json();
    filtrarTabla();
  } catch (error) {
    console.error('Error al obtener la lista de usuarios:', error);
    mostrarToast('Error al cargar usuarios', 'danger');
  }
}

async function guardarUsuario() {
  const nombre = document.getElementById('nombreUsuario').value.trim();
  const apellido = document.getElementById('apellidoUsuario').value.trim();
  const cedula = document.getElementById('cedulaUsuario').value.trim();
  const correo = document.getElementById('correoUsuario').value.trim();
  const contrasenaInput = document.getElementById('contrasenaUsuario');
  const contrasena = contrasenaInput.value.trim();
  const rol = document.getElementById('rolUsuario').value;
  const telefono = document.getElementById('telefonoUsuario').value.trim();
  const direccion = document.getElementById('direccionUsuario').value.trim();
  const genero = document.getElementById('generoUsuario').value.trim();
  const fechaNacimiento = document.getElementById('fechaNacimientoUsuario').value;
  const metodoPago = document.getElementById('metodoPagoUsuario').value;
  const membresiaActiva = document.getElementById('membresiaUsuario').value === 'true';

  if(!nombre || !apellido || !cedula || !correo || !rol) {
    mostrarToast('Todos los campos obligatorios deben estar llenos', 'danger');
    return;
  }

  if (!editandoId && !contrasena) {
    mostrarToast('La contraseña es obligatoria para nuevos usuarios', 'danger');
    return;
  }

  if (!validarTexto(nombre)) {
    mostrarToast('El nombre debe tener entre 2 y 100 caracteres', 'danger');
    return;
  }

  if (!validarTexto(apellido)) {
    mostrarToast('El apellido debe tener entre 2 y 100 caracteres', 'danger');
    return;
  }

  if (!validarCedula(cedula)) {
    mostrarToast('La cédula debe contener solo números (6-15 dígitos)', 'danger');
    return;
  }

  if (!validarCorreo(correo)) {
    mostrarToast('El correo electrónico no es válido', 'danger');
    return;
  }

  if (!validarTelefono(telefono)) {
    mostrarToast('El teléfono debe contener solo números (7-15 dígitos)', 'danger');
    return;
  }

  if (direccion && direccion.length > 200) {
    mostrarToast('La dirección no puede exceder 200 caracteres', 'danger');
    return;
  }

  if (!validarFechaNacimiento(fechaNacimiento)) {
    mostrarToast('La fecha de nacimiento no es válida (edad entre 10 y 120 años)', 'danger');
    return;
  }

  if (!editandoId && contrasena.length < 6) {
    mostrarToast('La contraseña debe tener al menos 6 caracteres', 'danger');
    return;
  }

  const usuario = {
    nombre, apellido, cedula, correo, rol,
    telefono, direccion, genero,
    fecha_nacimiento: fechaNacimiento,
    metodo_pago: metodoPago,
    membresia_activa: membresiaActiva,
    imagen_url: '/static/uploads/default_icon_profile.png'
  };

  if (!editandoId) {
    usuario.contrasena = contrasena;
  }
  
  try {
    let url = '';
    let method = '';
    let mensaje = '';

    if(editandoId) {
      url = `/usuarios/editar/${editandoId}`;
      method = 'PUT';
      mensaje = 'Usuario actualizado correctamente';
    } else {
      url = '/usuarios/crear';
      method = 'POST';
      mensaje = 'Usuario creado correctamente';
    }

    const response = await fetch(url, {
      method: method,
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(usuario)
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido en el servidor.' }));
        throw new Error(`Error en la solicitud: ${errorData.message || response.statusText}`);
    }

    limpiarFormulario();
    mostrarToast(mensaje);
    listarUsuarios();

  } catch (error) {
    console.error('Error al guardar usuario:', error);
    mostrarToast(`Error al guardar usuario: ${error.message}`, 'danger');
  } finally {
    editandoId = null;
    document.getElementById('btnCancelar').style.display = 'none';
  }
}

function limpiarFormulario() {
  document.getElementById('nombreUsuario').value = '';
  document.getElementById('apellidoUsuario').value = '';
  document.getElementById('cedulaUsuario').value = '';
  document.getElementById('correoUsuario').value = '';
  document.getElementById('contrasenaUsuario').value = '';
  document.getElementById('contrasenaUsuario').disabled = false;
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

function editarUsuario(id_usuario) {
  if (!id_usuario) {
    mostrarToast('ID de usuario no válido', 'danger');
    return;
  }

  fetch(`/usuarios/obtener/${id_usuario}`)
    .then(res => {
        if (!res.ok) throw new Error('Error al obtener usuario');
        return res.json();
    })
    .then(u => {
      if (!u || !u.id_usuario) {
        throw new Error('Datos de usuario incompletos');
      }

      document.getElementById('nombreUsuario').value = u.nombre;
      document.getElementById('apellidoUsuario').value = u.apellido;
      document.getElementById('cedulaUsuario').value = u.cedula;
      document.getElementById('correoUsuario').value = u.correo;
      
      document.getElementById('contrasenaUsuario').value = '';
      document.getElementById('contrasenaUsuario').disabled = true;
      
      document.getElementById('telefonoUsuario').value = u.telefono || '';
      document.getElementById('direccionUsuario').value = u.direccion || '';
      document.getElementById('generoUsuario').value = u.genero || '';
      document.getElementById('fechaNacimientoUsuario').value = u.fecha_nacimiento ? u.fecha_nacimiento.substring(0, 10) : ''; 
      document.getElementById('metodoPagoUsuario').value = u.metodo_pago || 'Efectivo';
      document.getElementById('rolUsuario').value = u.rol || '';
      
      document.getElementById('membresiaUsuario').value = u.membresia_activa ? 'true' : 'false';
      editandoId = id_usuario;
      document.getElementById('btnCancelar').style.display = 'inline-block';
    })
    .catch(error => {
        console.error('Error al cargar datos para edición:', error);
        mostrarToast('Error al cargar datos del usuario para editar', 'danger');
    });
}

function eliminarUsuario(correo) {
  if (!correo || !validarCorreo(correo)) {
    mostrarToast('Correo no válido para eliminar', 'danger');
    return;
  }

  if(confirm(`¿Está seguro de eliminar el usuario con correo: ${correo}?`)) {
    fetch('/usuarios/eliminar', {
      method:'DELETE',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({correo})
    }).then(res => {
        if (!res.ok) throw new Error('Error al eliminar');
        return res;
    }).then(()=> {
      mostrarToast('Usuario eliminado', 'warning');
      listarUsuarios();
    }).catch(error => {
        console.error('Error al eliminar usuario:', error);
        mostrarToast('Error al eliminar usuario', 'danger');
    });
  }
}

function filtrarTabla() {
  const cedulaFiltro = document.getElementById('buscarCedula').value.toLowerCase();
  const membresiaFiltro = document.getElementById('filtroMembresia').value;
  const rolFiltro = document.getElementById('filtroRol').value;
  usuariosFiltrados = usuariosGlobal.filter(u => {
    const rolEnPropiedad = u.rol || '';
    const rolEnRelacion = u.roles ? u.roles.nombre_rol : rolEnPropiedad;
    const rolNombre = rolEnRelacion; 
    
    const coincideCedula = u.cedula.toLowerCase().includes(cedulaFiltro);
    const mostrarMembresia = ['miembro','entrenador'].includes(rolNombre.toLowerCase());
    const coincideMembresia = membresiaFiltro === '' || !mostrarMembresia || String(u.membresia_activa) === membresiaFiltro;
    const coincideRol = rolFiltro === '' || rolNombre.toLowerCase() === rolFiltro.toLowerCase();
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
    const rolEnPropiedad = u.rol || 'N/A';
    const rolEnRelacion = u.roles ? u.roles.nombre_rol : rolEnPropiedad;
    const nombreRol = rolEnRelacion; 
    
    const mostrarMembresia = ['miembro','entrenador'].includes(nombreRol.toLowerCase());

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
      <td>${formatearFecha(u.fecha_nacimiento)}</td>
      <td>${formatearFecha(u.fecha_creacion)}</td>
      <td>
        <div class="d-flex justify-content-start">
            <button class="btn btn-sm btn-primary me-1" onclick="editarUsuario('${u.id_usuario}')"><i class="bi bi-pencil-fill"></i></button>
            <button class="btn btn-sm btn-danger" onclick="eliminarUsuario('${u.correo}')"><i class="bi bi-trash-fill"></i></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderizarPaginacion() {
  const totalPaginas = Math.ceil(usuariosFiltrados.length / filasPorPagina);
  const pagContainer = document.getElementById('paginacion');
  pagContainer.innerHTML = '';
  if (totalPaginas <= 1 && usuariosFiltrados.length <= filasPorPagina) return;
  
  for(let i=1;i<=totalPaginas;i++){
    const li = document.createElement('li');
    li.className = `page-item ${i===paginaActual?'active':''}`;
    li.innerHTML = `<a class="page-link" href="#" onclick="cambiarPagina(${i})">${i}</a>`;
    pagContainer.appendChild(li);
  }
}

function cambiarPagina(num) {
  if (num < 1 || num > Math.ceil(usuariosFiltrados.length / filasPorPagina)) return;
  paginaActual = num;
  renderizarTabla(usuariosFiltrados);
  renderizarPaginacion();
}

document.addEventListener('DOMContentLoaded', listarUsuarios);
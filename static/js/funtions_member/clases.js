document.addEventListener('DOMContentLoaded', () => {
  cargarClases();
  document.getElementById('actualizarCalendario').addEventListener('click', cargarClases);
  document.getElementById('buscarClase').addEventListener('input', cargarClases);
  document.getElementById('filtroDisciplina').addEventListener('change', cargarClases);
  document.getElementById('filtroHorario').addEventListener('change', cargarClases);
});

async function cargarClases() {
  try {
    const response = await fetch('/api/clases');
    const clases = await response.json();
    const buscador = document.getElementById('buscarClase').value.toLowerCase();
    const filtroDisciplina = document.getElementById('filtroDisciplina').value;
    const filtroHorario = document.getElementById('filtroHorario').value;
    const tabla = document.getElementById('tablaClases');
    tabla.innerHTML = '';
    clases.filter(clase => {
      const nombre = clase.nombre.toLowerCase();
      const instructor = clase.instructor_nombre.toLowerCase();
      const matchBuscar = nombre.includes(buscador) || instructor.includes(buscador);
      const matchDisciplina = filtroDisciplina === 'Todos' || clase.nombre === filtroDisciplina;
      let matchHorario = true;
      if(filtroHorario !== 'Todos'){
        const hora = new Date(clase.horario_inicio).getHours();
        matchHorario = (filtroHorario==='Mañana' && hora>=6 && hora<12) || (filtroHorario==='Tarde' && hora>=12 && hora<18) || (filtroHorario==='Noche' && hora>=18 && hora<24);
      }
      return matchBuscar && matchDisciplina && matchHorario;
    }).forEach(clase => {
      const tr = document.createElement('tr');
      const horarioInicio = new Date(clase.horario_inicio).toLocaleString();
      const horarioFin = new Date(clase.horario_fin).toLocaleTimeString();
      tr.innerHTML = `<td>${clase.nombre}</td><td>${clase.instructor_nombre}</td><td>${horarioInicio} - ${horarioFin}</td><td>${clase.cupos_disponibles}</td><td><button class="btn btn-success btn-sm" onclick="reservarClase('${clase.id_clase}')">Reservar</button></td>`;
      tabla.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
    mostrarToast('Error al cargar clases', 'danger');
  }
}

async function reservarClase(idClase){
  if(!ID_USUARIO) return mostrarToast('No has iniciado sesión','danger');
  try{
    const response = await fetch('/api/reservas',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id_clase:idClase,id_miembro:ID_USUARIO})
    });
    const data = await response.json();
    if(response.ok){mostrarToast('Reserva realizada correctamente','success');cargarClases()}
    else{mostrarToast(data.error||'Error al reservar','danger')}
  }catch(error){
    console.error(error);
    mostrarToast('Error al reservar','danger');
  }
}

async function cancelarReserva(idReserva){
  try{
    const response = await fetch(`/api/reservas/${idReserva}`,{method:'DELETE'});
    if(response.ok){document.getElementById('alertaCancelado').classList.remove('d-none');cargarClases()}
    else{mostrarToast('Error al cancelar reserva','danger')}
  }catch(error){
    console.error(error);
    mostrarToast('Error al cancelar reserva','danger');
  }
}

function mostrarToast(mensaje,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toastId=`toast-${Date.now()}`;
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2`;
  toast.id=toastId;
  toast.setAttribute('role','alert');
  toast.setAttribute('aria-live','assertive');
  toast.setAttribute('aria-atomic','true');
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${mensaje}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

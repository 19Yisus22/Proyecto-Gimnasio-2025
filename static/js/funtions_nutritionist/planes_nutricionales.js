document.addEventListener('DOMContentLoaded', ()=>{
  cargarPlanes();
  
  const searchInput = document.getElementById('searchMiembroInput');
  const btnSearch = document.getElementById('btnSearchMiembro');
  const searchResults = document.getElementById('searchResultsMiembro');
  
  if (btnSearch && searchInput && searchResults) {
    btnSearch.addEventListener('click', searchMiembros);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchMiembros(); });
  }
});

async function searchMiembros() {
  const searchInput = document.getElementById('searchMiembroInput');
  const searchResults = document.getElementById('searchResultsMiembro');
  const query = searchInput.value.trim();
  
  if (!query) return;
  
  try {
    const res = await fetch(`/api/nutricionista/perfil/buscar?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    searchResults.innerHTML = '';
    searchResults.classList.remove('d-none');
    
    if (data.items && data.items.length > 0) {
      data.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'list-group-item list-group-item-action';
        div.style.cursor = 'pointer';
        div.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong>${item.name}</strong>
              <br>
              <small class="text-muted">${item.email}</small>
            </div>
            <i class="bi bi-chevron-right"></i>
          </div>
        `;
        div.onclick = () => seleccionarMiembro(item);
        searchResults.appendChild(div);
      });
    } else {
      searchResults.innerHTML = '<div class="list-group-item">No se encontraron miembros</div>';
    }
  } catch (error) {
    console.error('Error al buscar miembros:', error);
    searchResults.innerHTML = '<div class="list-group-item text-danger">Error al buscar</div>';
  }
}

async function seleccionarMiembro(miembro) {
  const searchResults = document.getElementById('searchResultsMiembro');
  const searchInput = document.getElementById('searchMiembroInput');
  const hiddenInput = document.getElementById('selectedMiembroId');
  const selectedDisplay = document.getElementById('selectedMiembroDisplay');
  
  hiddenInput.value = miembro.id;
  selectedDisplay.innerHTML = `
    <div class="d-flex justify-content-between align-items-center">
      <div>
        <strong>${miembro.name}</strong>
        <br>
        <small class="text-muted">${miembro.email}</small>
      </div>
      <button type="button" class="btn btn-sm btn-danger" onclick="limpiarSeleccion()">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>
  `;
  selectedDisplay.classList.remove('d-none');
  
  searchResults.innerHTML = '';
  searchResults.classList.add('d-none');
  searchInput.value = '';
  
  await cargarInfoMiembro(miembro.id);
}

function limpiarSeleccion() {
  const hiddenInput = document.getElementById('selectedMiembroId');
  const selectedDisplay = document.getElementById('selectedMiembroDisplay');
  const infoMiembro = document.getElementById('infoMiembroSeleccionado');
  
  hiddenInput.value = '';
  selectedDisplay.classList.add('d-none');
  
  if (infoMiembro) {
    infoMiembro.innerHTML = '';
    infoMiembro.classList.add('d-none');
  }
}

async function cargarInfoMiembro(memberId) {
  const infoContainer = document.getElementById('infoMiembroSeleccionado');
  
  if (!infoContainer) return;
  
  try {
    const res = await fetch(`/api/nutricionista/perfil/get/${memberId}`);
    const data = await res.json();
    
    if (res.ok && data.usuario) {
      infoContainer.innerHTML = `
        <div class="card">
          <div class="card-body">
            <h6 class="card-title mb-3">Información del Miembro</h6>
            <div class="row g-3">
              <div class="col-md-6">
                <small class="text-muted">Nombre</small>
                <p class="mb-0"><strong>${data.usuario.nombre}</strong></p>
              </div>
              <div class="col-md-6">
                <small class="text-muted">Correo</small>
                <p class="mb-0">${data.usuario.correo}</p>
              </div>
              ${data.usuario.edad ? `
              <div class="col-md-6">
                <small class="text-muted">Edad</small>
                <p class="mb-0">${data.usuario.edad} años</p>
              </div>` : ''}
              ${data.usuario.telefono ? `
              <div class="col-md-6">
                <small class="text-muted">Teléfono</small>
                <p class="mb-0">${data.usuario.telefono}</p>
              </div>` : ''}
              ${data.historial.peso && data.historial.peso.length > 0 ? `
              <div class="col-md-6">
                <small class="text-muted">Último Peso</small>
                <p class="mb-0"><strong>${data.historial.peso[0]} kg</strong></p>
              </div>` : ''}
              ${data.last_update ? `
              <div class="col-md-6">
                <small class="text-muted">Última Actualización</small>
                <p class="mb-0">${data.last_update}</p>
              </div>` : ''}
            </div>
          </div>
        </div>
      `;
      infoContainer.classList.remove('d-none');
    } else {
      infoContainer.innerHTML = '<div class="alert alert-warning">No se pudo cargar la información del miembro</div>';
      infoContainer.classList.remove('d-none');
    }
  } catch (error) {
    console.error('Error al cargar información del miembro:', error);
    infoContainer.innerHTML = '<div class="alert alert-danger">Error al cargar la información</div>';
    infoContainer.classList.remove('d-none');
  }
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
  const miembro = document.getElementById('selectedMiembroId').value;
  const descripcion=document.getElementById('descripcionPlan').value;
  const calorias=document.getElementById('caloriasPlan').value;
  const inicio=document.getElementById('fechaInicioPlan').value;
  const fin=document.getElementById('fechaFinPlan').value;
  if(!miembro||!descripcion||!calorias||!inicio||!fin) {
    mostrarToast('Por favor complete todos los campos','warning');
    return;
  }
  const payload={id_miembro:miembro,descripcion,calorias:parseInt(calorias),fecha_inicio:inicio,fecha_fin:fin,estado:true};
  const res=await fetch('/api/nutricionista/planes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res.ok){
    mostrarToast('Plan creado','success');
    cargarPlanes();
    limpiarFormularioPlan();
  }else mostrarToast('Error al crear plan','danger');
}

function limpiarFormularioPlan() {
  document.getElementById('descripcionPlan').value = '';
  document.getElementById('caloriasPlan').value = '';
  document.getElementById('fechaInicioPlan').value = '';
  document.getElementById('fechaFinPlan').value = '';
  limpiarSeleccion();
}

function mostrarToast(msg,tipo='info'){
  const container=document.getElementById('toastContainer');
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}
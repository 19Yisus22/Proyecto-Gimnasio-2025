const API_BASE = "/api/recepcionista"; 
const toastContainer = document.getElementById('toastContainer');
let currentMemberId = null;

function showToast(msg, type='success'){ 
    const html = `<div class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true"><div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div></div>`; 
    toastContainer.insertAdjacentHTML('beforeend', html); 
    new bootstrap.Toast(toastContainer.lastElementChild, { delay: 3000 }).show(); 
}

function calcularFechaFin(fi, tipo){
    if (!fi) return '';
    
    const parts = fi.split('-');
    const startDate = new Date(parts[0], parts[1] - 1, parts[2]); 
    const endDate = new Date(startDate);

    if(tipo==='Mensual') endDate.setMonth(endDate.getMonth()+1);
    else if(tipo==='Trimestral') endDate.setMonth(endDate.getMonth()+3);
    else if(tipo==='Anual') endDate.setFullYear(endDate.getFullYear()+1);

    const month = (endDate.getMonth() + 1).toString().padStart(2, '0');
    const day = endDate.getDate().toString().padStart(2, '0');
    return `${endDate.getFullYear()}-${month}-${day}`;
}

function updateFechaFin() {
    const fiInput = document.getElementById('regFechaInicio');
    const tipoInput = document.getElementById('regTipoMembresia');
    const ffInput = document.getElementById('regFechaFin');

    const fi = fiInput.value;
    const tipo = tipoInput.value;

    if (fi && tipo) {
        ffInput.value = calcularFechaFin(fi, tipo);
    } else {
        ffInput.value = '';
    }
}


async function cargarMetricasDashboard(){
    try{
        const r = await fetch(`${API_BASE}/dashboard_stats`);
        const d = await r.json();
        if(r.ok && d.success){
            document.getElementById('totalActivos').textContent = d.total_activos || 0;
            document.getElementById('vencimientosProximos').textContent = d.vencimientos_proximos || 0;
            document.getElementById('pagosVencidos').textContent = d.pagos_pendientes || 0;
            document.getElementById('badgeVencimientos').textContent = d.vencimientos_proximos || 0;
            document.getElementById('badgePagosVencidos').textContent = d.pagos_pendientes || 0;
        } else {
            showToast(d.message || 'Error al cargar métricas del dashboard.', 'warning');
        }
    }catch(e){
        showToast('Error de conexión con el servidor al cargar estadísticas.', 'danger');
    }
}


async function buscarMiembro(identificador) {
    if(!identificador) return;
    try {
        const r = await fetch(`${API_BASE}/obtener_estado_miembro`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ identificador: identificador })
        });
        const d = await r.json();
        
        if (d.success) {
            currentMemberId = d.id_miembro;
            return {
                encontrado: true,
                nombre: d.nombre,
                status: d.status, 
                id_miembro: d.id_miembro,
                monto_pendiente: d.monto_pendiente || 0
            };
        } else {
            currentMemberId = null;
            return { encontrado: false, nombre: d.nombre, status: d.status };
        }
    } catch (e) {
        showToast(`Error de red al buscar miembro: ${e.message}`, 'danger');
        return { encontrado: false, nombre: "Error de Conexión", status: "Error" };
    }
}

document.getElementById('formCheckin').addEventListener('submit', async function(e){
    e.preventDefault();
    const identificador = document.getElementById('inputBusqueda').value.trim();
    if(!identificador) {
        showToast('Ingrese una Cédula o ID para consultar.', 'info');
        return;
    }

    const u = await buscarMiembro(identificador);
    
    const resultado = document.getElementById('resultadoCheckin');
    const nombre = document.getElementById('nombreMiembroCheckin');
    const idMiembro = document.getElementById('idMiembroCheckin');
    const estado = document.getElementById('estadoMembresia');

    resultado.classList.remove('d-none');

    if(!u.encontrado || u.status === 'No Miembro'){
        nombre.textContent = u.nombre; 
        idMiembro.textContent = 'N/A';
        estado.textContent = 'NO ENCONTRADO';
        estado.className = 'badge badge-estado bg-secondary';
        showToast(`Miembro ${identificador} no encontrado.`, 'warning');
    } else {
        nombre.textContent = u.nombre;
        idMiembro.textContent = u.id_miembro;
        
        if(u.status === 'Activo'){
            estado.textContent = 'ACTIVO';
            estado.className = 'badge badge-estado bg-success';
            showToast(`Miembro ${u.nombre} - Estatus: ACTIVO.`, 'success');
        } else if (u.status.startsWith('Vencido')) {
            estado.textContent = `VENCIDO (0-7 días) - Deuda: $${u.monto_pendiente.toFixed(2)}`;
            estado.className = 'badge badge-estado bg-warning';
            showToast(`Miembro ${u.nombre} - Período de Gracia. Pendiente de pago de $${u.monto_pendiente.toFixed(2)}.`, 'warning');
        } else if (u.status.startsWith('Pago Pendiente')) {
            estado.textContent = `PAGO PENDIENTE (> 7 días) - Deuda: $${u.monto_pendiente.toFixed(2)}`;
            estado.className = 'badge badge-estado bg-danger';
            showToast(`Miembro ${u.nombre} - ¡PAGO PENDIENTE! Deuda de $${u.monto_pendiente.toFixed(2)}.`, 'danger');
        } else {
            estado.textContent = u.status;
            estado.className = 'badge badge-estado bg-secondary';
            showToast(`Miembro ${u.nombre} - Estatus: ${u.status}.`, 'info');
        }
    }
});


function toggleModalInputs(enabled, nombre = '') {
    const fields = ['regTipoMembresia', 'regMonto', 'regMetodoPago', 'regFechaInicio'];
    fields.forEach(id => document.getElementById(id).disabled = !enabled);
    document.getElementById('btnRegistrarMembresia').disabled = !enabled;
    document.getElementById('labelNombreCompleto').textContent = nombre;
}

document.getElementById('btnCobroRapido').addEventListener('click', function() {
    document.getElementById('regCedula').value = '';
    document.getElementById('regMonto').value = '0.00';
    toggleModalInputs(false, 'Ingrese ID/Cédula del miembro a renovar y pulse VERIFICAR.');
});

document.getElementById('btnIniciarRegistro').addEventListener('click', function() {
    document.getElementById('regCedula').value = '';
    document.getElementById('regMonto').value = '0.00';
    toggleModalInputs(false, 'Ingrese ID/Cédula del nuevo miembro para verificar si existe.');
});


document.getElementById('btnBuscarModal').addEventListener('click', async function(){
    const identificador = document.getElementById('regCedula').value.trim();
    if(!identificador) {
        toggleModalInputs(false, 'Ingrese un identificador');
        showToast('Debe ingresar una Cédula o ID para verificar.', 'info');
        return;
    }

    const u = await buscarMiembro(identificador);
    
    if(u.encontrado){
        toggleModalInputs(true, `${u.nombre} (ID: ${u.id_miembro})`);
        showToast(`Miembro ${u.nombre} verificado. Puede registrar la membresía.`, 'success');
        
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('regFechaInicio').value = hoy;
        
        if ((u.status.startsWith('Vencido') || u.status.startsWith('Pago Pendiente')) && u.monto_pendiente > 0) {
            document.getElementById('regMonto').value = u.monto_pendiente.toFixed(2);
        } else {
            document.getElementById('regMonto').value = '0.00';
        }

        updateFechaFin();
    } else {
        toggleModalInputs(false, `Miembro no encontrado: ${u.nombre}`);
        showToast('Miembro no encontrado. Verifique la Cédula/ID.', 'warning');
    }
});

document.getElementById('regTipoMembresia').addEventListener('change', updateFechaFin);
document.getElementById('regFechaInicio').addEventListener('change', updateFechaFin);


document.getElementById('btnRegistrarMembresia').addEventListener('click', async function(){
    const identificador = document.getElementById('regCedula').value.trim();
    const montoValue = document.getElementById('regMonto').value;

    if(!identificador || !currentMemberId || !montoValue) {
        showToast('Faltan datos o el miembro no ha sido verificado.', 'danger');
        return;
    }
    if (parseFloat(montoValue) <= 0) {
        showToast('El monto debe ser mayor a cero para registrar la membresía.', 'warning');
        return;
    }

    const payload = {
        identificador: identificador,
        tipo_membresia: document.getElementById('regTipoMembresia').value,
        fecha_inicio: document.getElementById('regFechaInicio').value,
        fecha_fin: document.getElementById('regFechaFin').value,
        monto: parseFloat(montoValue),
        metodo_pago: document.getElementById('regMetodoPago').value,
        tipo_pago: "Renovacion", 
        referencia_pago: "Cobro Recepción"
    };
    
    try{
        const r = await fetch(`${API_BASE}/registrar_pago_y_membresia`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        const d = await r.json();
        if(r.ok && d.success){
            showToast('✅ ¡Transacción Exitosa! Membresía registrada y pago creado.', 'success');
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalRegistro'));
            if (modalInstance) modalInstance.hide();

            document.getElementById('regCedula').value = '';
            toggleModalInputs(false, '');
            document.getElementById('regTipoMembresia').value = 'Mensual';
            document.getElementById('regMonto').value = '0.00';
            currentMemberId = null;

            cargarMetricasDashboard();
            document.getElementById('resultadoCheckin').classList.add('d-none');
        } else {
            showToast(d.message || 'Error al registrar la transacción. Consulte el sistema.', 'danger');
        }
    }catch(e){
        showToast('❌ Error de red al procesar pago/membresía.', 'danger');
    }
});


async function cargarTareasVencidas() {
    const listContainer = document.getElementById('listaPagosVencidos');
    listContainer.innerHTML = '<p class="text-center text-info"><i class="bi bi-arrow-clockwise"></i> Cargando lista...</p>';

    try {
        const r = await fetch(`${API_BASE}/obtener_pagos_pendientes_vencidos`);
        const d = await r.json();

        if (r.ok && d.success && d.miembros_pendientes && d.miembros_pendientes.length > 0) {
            let html = '<ul class="list-group">';
            d.miembros_pendientes.forEach(m => {
                const fechaVenc = m.fecha_vencimiento ? new Date(m.fecha_vencimiento).toLocaleDateString('es-ES') : 'N/A';
                const montoPendiente = m.monto_pendiente ? m.monto_pendiente.toFixed(2) : '0.00';

                html += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <span class="fw-bold">${m.nombre} (ID: ${m.identificador})</span>
                            <small class="text-muted d-block">Venció el: ${fechaVenc} - Deuda Estimada: $${montoPendiente}</small>
                        </div>
                        <button class="btn btn-sm btn-danger btn-renovar-directo" data-identificador="${m.identificador}" data-monto="${montoPendiente}">
                            <i class="bi bi-currency-dollar"></i> Cobrar
                        </button>
                    </li>
                `;
            });
            html += '</ul>';
            listContainer.innerHTML = html;

            document.querySelectorAll('.btn-renovar-directo').forEach(button => {
                button.addEventListener('click', function() {
                    const id = this.getAttribute('data-identificador');
                    const monto = this.getAttribute('data-monto');
                    
                    const modalTareasInstance = bootstrap.Modal.getInstance(document.getElementById('modalTareasVencidas'));
                    if (modalTareasInstance) modalTareasInstance.hide();
                    
                    document.getElementById('regCedula').value = id;
                    document.getElementById('regMonto').value = monto;
                    
                    const modalRegistroInstance = new bootstrap.Modal(document.getElementById('modalRegistro'));
                    modalRegistroInstance.show();
                    showToast(`Iniciando cobro para miembro ID ${id}. Verificando...`, 'info');

                    document.getElementById('btnBuscarModal').click(); 
                });
            });

        } else if (d.success && d.miembros_pendientes.length === 0) {
            listContainer.innerHTML = '<p class="alert alert-success text-center">¡No hay pagos pendientes vencidos (más de 7 días)!</p>';
            showToast('No hay miembros con pagos pendientes de cobro (> 7 días).', 'success');
        } else {
            listContainer.innerHTML = `<p class="alert alert-danger text-center">Error al cargar la lista: ${d.message || 'Error desconocido'}</p>`;
            showToast('Error al obtener la lista de tareas pendientes.', 'danger');
        }
    } catch (e) {
        listContainer.innerHTML = '<p class="alert alert-danger text-center">Error de red al obtener tareas pendientes.</p>';
        showToast('Error de red al obtener la lista de pagos pendientes.', 'danger');
    }
}

document.getElementById('modalTareasVencidas').addEventListener('show.bs.modal', cargarTareasVencidas);


document.addEventListener('DOMContentLoaded', function(){
    toggleModalInputs(false, 'Busque un miembro para habilitar la registración.');
    
    const modalEl = document.getElementById('modalRegistro');
    if(modalEl) new bootstrap.Modal(modalEl, {backdrop: 'static', keyboard: false});

    const modalTareas = document.getElementById('modalTareasVencidas');
    if(modalTareas) new bootstrap.Modal(modalTareas, {});
    
    cargarMetricasDashboard();
});
// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
let miembros = [];
let chartPesoInstance = null;
let chartCaloriasInstance = null;
let chartComposicionInstance = null;
let chartRendimientoInstance = null;
let miembroActualId = null;

// Constante para la altura (nota: este valor está fijo; idealmente debería venir del perfil del miembro)
const ALTURA_FIJA_METROS = 1.70; 

document.addEventListener("DOMContentLoaded", function(){
    // Carga inicial de datos
    entrenador_cargarMiembros(); 
    
    // Event listeners principales
    document.getElementById("formMetricas").addEventListener("submit", entrenador_registrarMetricas);
    document.getElementById("actualizarProgreso").addEventListener("click", entrenador_cargarMiembros);
    
    // Event listeners para filtros de tabla
    document.getElementById("buscarMiembro").addEventListener("input", entrenador_filtrarTabla);
    document.getElementById("filtroDisciplina").addEventListener("change", entrenador_filtrarTabla);
    document.getElementById("filtroEntrenador").addEventListener("change", entrenador_filtrarTabla);
    
    // Event listener para cálculo automático de IMC
    document.getElementById("peso").addEventListener("input", entrenador_calcularIMC);
    
    // Event listener para exportar PDF
    document.getElementById("btnExportarPDF").addEventListener("click", entrenador_exportarPDF);
});

// --- UTILERÍAS ---

/**
 * Muestra un mensaje temporal tipo Toast en la interfaz.
 * @param {string} mensaje - El texto a mostrar.
 * @param {('success'|'danger'|'info'|'warning')} [tipo='success'] - Tipo de alerta.
 */
function mostrarToast(mensaje, tipo = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${tipo} border-0 rounded-lg shadow-xl`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    const icon = tipo === 'success' ? 'check-circle' : (tipo === 'info' ? 'info-circle' : 'exclamation-triangle');
    
    toast.innerHTML = `
        <div class="d-flex p-2">
            <div class="toast-body d-flex align-items-center">
                <i class="bi bi-${icon}-fill me-2 fs-5"></i>
                ${mensaje}
            </div>
            <button type="button" class="btn-close btn-close-white ms-auto me-2" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
    bsToast.show();
    
    // Limpieza de toasts antiguos
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

/**
 * Calcula el Índice de Masa Corporal (IMC) basado en el peso ingresado.
 * Utiliza la ALTURA_FIJA_METROS.
 */
function entrenador_calcularIMC() {
    const peso = parseFloat(document.getElementById("peso").value);
    const altura = ALTURA_FIJA_METROS; 
    const imcInput = document.getElementById("imc");
    
    if (peso > 0 && altura > 0) {
        const imc = (peso / (altura * altura)).toFixed(1);
        imcInput.value = imc;
    } else {
        imcInput.value = '';
    }
}

// --- GESTIÓN DE MIEMBROS Y ESTADO GENERAL ---

/**
 * Carga la lista de miembros desde el API y actualiza la tabla y las estadísticas.
 */
async function entrenador_cargarMiembros(){
    try {
        const res = await fetch("/api/entrenador/cargarMiembros");
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();

        if(data.ok){
            miembros = data.miembros;
            entrenador_renderTabla(miembros);
            entrenador_cargarEntrenadores(); // Cargar opciones de filtro de entrenadores
            entrenador_actualizarEstadisticas(); // Actualizar las tarjetas de resumen
        } else {
            // Manejo de errores de negocio desde el API
            mostrarToast("Error al cargar miembros: " + (data.mensaje || "Mensaje de error no disponible"), 'danger');
        }
    } catch (error) {
        console.error("Error al cargar miembros:", error);
        mostrarToast("Error de conexión al cargar miembros. Consulte la consola.", 'danger');
    }
}

/**
 * Actualiza las tarjetas de estadísticas en la parte superior de la interfaz.
 */
function entrenador_actualizarEstadisticas() {
    document.getElementById("totalMiembros").textContent = miembros.length;
    
    const metasAlcanzadas = miembros.filter(m => m.objetivo_personal && m.objetivo_personal.toLowerCase() === 'cumplido').length;
    document.getElementById("metasAlcanzadas").textContent = metasAlcanzadas;
    
    // Cálculos estimados
    const sesionesEstimadas = miembros.length * 12; // Ejemplo de estimación
    document.getElementById("sesionesDelMes").textContent = sesionesEstimadas.toLocaleString();
    
    // Suma de todas las calorías quemadas reportadas por todos los miembros
    const caloriasTotales = miembros.reduce((sum, m) => sum + (parseInt(m.calorias_quemadas) || 0), 0);
    document.getElementById("caloriasTotales").textContent = (caloriasTotales).toLocaleString();
}

/**
 * Filtra la lista global de miembros según los criterios de búsqueda y renderiza la tabla.
 */
function entrenador_filtrarTabla(){
    const filtroNombre = document.getElementById("buscarMiembro").value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const filtroDisc = document.getElementById("filtroDisciplina").value;
    const filtroEntr = document.getElementById("filtroEntrenador").value;
    
    const filtrados = miembros.filter(m => {
        const nombreCompleto = (m.nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
        
        // Verifica si el nombre incluye el filtro
        const cumpleNombre = nombreCompleto.includes(filtroNombre);
        
        // Verifica si la disciplina coincide (asume que `m.disciplina` es una cadena o array de disciplinas)
        const cumpleDisciplina = filtroDisc === "Todos" || (m.disciplina && m.disciplina.includes(filtroDisc));
        
        // Verifica si el entrenador coincide
        const cumpleEntrenador = filtroEntr === "Todos" || m.entrenador === filtroEntr;
        
        return cumpleNombre && cumpleDisciplina && cumpleEntrenador;
    });
    entrenador_renderTabla(filtrados);
}

/**
 * Carga la lista de entrenadores/staff disponibles para el filtro.
 */
async function entrenador_cargarEntrenadores(){
    try {
        const res = await fetch("/api/entrenador/cargarEntrenadores"); 
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        const select = document.getElementById("filtroEntrenador");
        
        // Mantener la opción predeterminada
        select.innerHTML = '<option value="Todos">Todos los Entrenadores/Staff</option>';
        
        if(data.ok && Array.isArray(data.entrenadores)){
            data.entrenadores.forEach(e=>{
                // Asegurarse de que el nombre sea seguro para usar como valor
                if (e.nombre) {
                    select.innerHTML += `<option value="${e.nombre}">${e.nombre}</option>`;
                }
            });
        }
    } catch (error) {
        console.error("Error al cargar entrenadores:", error);
        mostrarToast("No se pudo cargar la lista de entrenadores.", 'warning');
    }
}

// --- MANIPULACIÓN DE LA TABLA Y DETALLES ---

/**
 * Renderiza la tabla de progreso con la lista de miembros proporcionada.
 * Asigna listeners a los botones de registrar y detalle.
 * @param {Array<Object>} lista - Lista de objetos de miembros.
 */
function entrenador_renderTabla(lista){
    const tabla = document.getElementById("tablaProgreso");
    tabla.innerHTML = "";
    
    if (lista.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-5">
                    <i class="bi bi-inbox fs-1 text-muted"></i>
                    <p class="mt-2 text-muted">No se encontraron miembros con los filtros seleccionados</p>
                </td>
            </tr>
        `;
        return;
    }
    
    lista.forEach((m, index) => {
        // Lógica para determinar el estado visual de la membresía
        let badgeClass = 'bg-secondary border border-secondary';
        let badgeText = m.estado_membresia || 'SIN REGISTRO';
        let nextPaymentDate = m.fecha_fin ? new Date(m.fecha_fin).toLocaleDateString() : 'N/A';
        
        switch(m.estado_membresia) {
            case 'activa':
                badgeClass = 'bg-success border border-success';
                badgeText = 'ACTIVA';
                break;
            case 'vencida':
                badgeClass = 'bg-danger border border-danger';
                badgeText = 'VENCIDA';
                break;
            case 'cancelada':
                badgeClass = 'bg-warning border border-warning';
                badgeText = 'CANCELADA';
                break;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="text-center">${index + 1}</td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" 
                        style="width: 40px; height: 40px; font-weight: bold;">
                        ${m.nombre ? m.nombre.charAt(0).toUpperCase() : '?'}
                    </div>
                    <strong>${m.nombre || 'Miembro Desconocido'}</strong>
                </div>
            </td>
            <td>
                <i class="bi bi-person-badge"></i> ${m.entrenador || '<span class="text-muted">Sin asignar</span>'}
            </td>
            <!-- ESTADO MEMBRESÍA -->
            <td class="text-center">
                <span class="badge ${badgeClass} text-white shadow-sm">${badgeText}</span>
            </td>
            <!-- PRÓXIMO PAGO -->
            <td class="text-center">
                <strong>${nextPaymentDate}</strong>
            </td>
            <td class="text-center">
                <span class="badge bg-secondary">${m.ultima_sesion || 'Nunca'}</span>
            </td>
            <td class="text-center">
                <strong class="text-primary">${m.peso || '--'}</strong> kg
            </td>
            <td class="text-center">
                <span class="badge bg-danger">${m.calorias_quemadas || '--'}</span>
            </td>
            <td>
                <small class="text-truncate d-block" style="max-width: 200px;" title="${m.objetivo_personal || 'Sin objetivo'}">
                    ${m.objetivo_personal || '<em class="text-muted">Sin objetivo establecido</em>'}
                </small>
            </td>
            <td class="text-center">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-success btn-registrar" data-id="${m.id}" title="Registrar métricas">
                        <i class="bi bi-plus-circle"></i>
                    </button>
                    <button class="btn btn-primary btn-detalle" data-id="${m.id}" data-nombre="${m.nombre}" title="Ver detalle">
                        <i class="bi bi-bar-chart-line"></i>
                    </button>
                </div>
            </td>
        `;
        tabla.appendChild(tr);
    });

    // Asignar Event Listeners a los botones dinámicos
    document.querySelectorAll(".btn-registrar").forEach(btn => {
        btn.addEventListener("click", (e) => {
            miembroActualId = e.currentTarget.dataset.id;
            document.getElementById("miembroId").value = miembroActualId;
            document.getElementById("formMetricas").reset();
            document.getElementById("imc").value = ''; // Limpiar el IMC calculado
            new bootstrap.Modal(document.getElementById("modalMetricas")).show();
        });
    });

    document.querySelectorAll(".btn-detalle").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const nombre = e.currentTarget.dataset.nombre;
            miembroActualId = e.currentTarget.dataset.id;
            document.getElementById("detalleMiembroNombre").textContent = `Historial de ${nombre}`;
            entrenador_cargarDetalle(miembroActualId);
        });
    });
}

/**
 * Carga el historial de progreso de un miembro específico desde el API y renderiza los gráficos.
 * @param {string} id - ID del miembro.
 */
async function entrenador_cargarDetalle(id){
    try {
        const res = await fetch(`/api/entrenador/cargarDetalle/${id}`);
        if (!res.ok) {
             throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();

        if(data.ok){
            // Ordenar historial por fecha ascendente para los gráficos
            const historial = data.historial.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            // --- Actualizar tarjetas de resumen en el modal ---
            if (historial.length > 0) {
                const ultimo = historial[historial.length - 1];
                const primero = historial[0];
                
                document.getElementById("pesoActual").textContent = `${ultimo.peso || '--'} kg`;
                
                // Cálculo de variación de peso
                const variacion = (ultimo.peso && primero.peso) ? (ultimo.peso - primero.peso).toFixed(1) : '--';
                const variacionTexto = (variacion !== '--') ? `${variacion > 0 ? '+' : ''}${variacion} kg` : '--';
                document.getElementById("variacionPeso").innerHTML = `<span class="text-${variacion > 0 ? 'danger' : 'success'}">${variacionTexto}</span> desde inicio`;
                
                // Cálculo de calorías promedio
                const caloriasValidas = historial.map(h => parseFloat(h.calorias_quemadas)).filter(c => !isNaN(c) && c > 0);
                const calPromedio = caloriasValidas.length > 0 ? (caloriasValidas.reduce((sum, c) => sum + c, 0) / caloriasValidas.length).toFixed(0) : '--';
                document.getElementById("caloriasPromedio").textContent = calPromedio;
                
                document.getElementById("totalSesiones").textContent = historial.length;
                document.getElementById("rachaActual").textContent = Math.min(historial.length, 15); // La racha es solo un ejemplo
            } else {
                document.getElementById("pesoActual").textContent = '-- kg';
                document.getElementById("variacionPeso").textContent = '--';
                document.getElementById("caloriasPromedio").textContent = '--';
                document.getElementById("totalSesiones").textContent = '0';
                document.getElementById("rachaActual").textContent = '0';
            }

            // --- Destruir instancias de gráficos anteriores ---
            if (chartPesoInstance) chartPesoInstance.destroy();
            if (chartCaloriasInstance) chartCaloriasInstance.destroy();
            if (chartComposicionInstance) chartComposicionInstance.destroy();
            if (chartRendimientoInstance) chartRendimientoInstance.destroy();

            // --- Configuración y renderizado de gráficos (Chart.js) ---
            
            // 1. Gráfico de Peso
            const ctxPeso = document.getElementById("chartProgresoPeso").getContext("2d");
            chartPesoInstance = new Chart(ctxPeso, {
                type: 'line',
                data: {
                    labels: historial.map(h => h.fecha),
                    datasets: [{
                        label: 'Peso (kg)',
                        data: historial.map(h => h.peso),
                        borderColor: 'rgb(25, 135, 84)',
                        backgroundColor: 'rgba(25, 135, 84, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true, position: 'top' } },
                    scales: { y: { beginAtZero: false, title: { display: true, text: 'Peso (kg)' } } }
                }
            });

            // 2. Gráfico de Calorías
            const ctxCal = document.getElementById("chartProgresoCalorias").getContext("2d");
            chartCaloriasInstance = new Chart(ctxCal, {
                type: 'bar',
                data: {
                    labels: historial.map(h => h.fecha),
                    datasets: [{
                        label: 'Calorías Quemadas',
                        data: historial.map(h => h.calorias_quemadas),
                        backgroundColor: 'rgba(13, 110, 253, 0.6)',
                        borderColor: 'rgb(13, 110, 253)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true, position: 'top' } },
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Calorías' } } }
                }
            });

            // 3. Gráfico de Composición Corporal
            const ctxComp = document.getElementById("chartComposicion").getContext("2d");
            chartComposicionInstance = new Chart(ctxComp, {
                type: 'line',
                data: {
                    labels: historial.map(h => h.fecha),
                    datasets: [
                        {
                            label: 'Grasa Corporal (%)',
                            data: historial.map(h => h.grasa_corporal),
                            borderColor: 'rgb(255, 99, 132)',
                            tension: 0.2,
                            hidden: false 
                        },
                        {
                            label: 'Masa Muscular (%)',
                            data: historial.map(h => h.masa_muscular),
                            borderColor: 'rgb(54, 162, 235)',
                            tension: 0.2,
                            hidden: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true, position: 'top' } },
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Porcentaje (%)' } } }
                }
            });

            // 4. Gráfico de Rendimiento
            const ctxRend = document.getElementById("chartRendimiento").getContext("2d");
            chartRendimientoInstance = new Chart(ctxRend, {
                type: 'line',
                data: {
                    labels: historial.map(h => h.fecha),
                    datasets: [
                        {
                            label: 'Fuerza (Índice)',
                            data: historial.map(h => h.fuerza),
                            borderColor: 'rgb(255, 159, 64)',
                            tension: 0.2
                        },
                        {
                            label: 'Resistencia (Índice)',
                            data: historial.map(h => h.resistencia),
                            borderColor: 'rgb(75, 192, 192)',
                            tension: 0.2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true, position: 'top' } },
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Índice de Rendimiento' } } }
                }
            });

            // --- Renderizar lista de metas y notas (últimos registros primero) ---
            const listaMetas = document.getElementById("listaMetas");
            listaMetas.innerHTML = historial.map(h => 
                `<li class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold">${h.fecha}</span>
                        <span class="badge bg-primary">${h.objetivo_personal || 'Sin objetivo'}</span>
                    </div>
                    <div>
                        Peso: <span class="fw-bold text-primary">${h.peso || '--'}kg</span>, 
                        Calorías: <span class="fw-bold text-danger">${h.calorias_quemadas || '--'}</span>.
                    </div>
                    <small class="text-muted d-block">
                        Fuerza: ${h.fuerza || '--'}, Resistencia: ${h.resistencia || '--'}, M. Muscular: ${h.masa_muscular || '--'}%, G. Corporal: ${h.grasa_corporal || '--'}%
                    </small>
                    <p class="mt-1 mb-0 small fst-italic">
                        Observaciones: ${h.notas || 'Sin notas del staff.'}
                    </p>
                </li>`
            ).reverse().join(''); // Invertir para mostrar el más reciente primero

            new bootstrap.Modal(document.getElementById("modalDetalle")).show();

        } else {
            mostrarToast("No se pudo cargar el historial de progreso: " + (data.mensaje || "Error desconocido"), 'warning');
        }
    } catch (error) {
        console.error("Error al cargar detalle:", error);
        mostrarToast("Error de conexión al cargar el historial del miembro.", 'danger');
    }
}

// --- REGISTRO DE MÉTRICAS ---

/**
 * Registra nuevas métricas de un miembro a través de una llamada POST al API.
 * @param {Event} e - Evento de submit del formulario.
 */
async function entrenador_registrarMetricas(e){
    e.preventDefault();
    
    // Obtener peso y calcular IMC usando la altura fija
    const pesoValue = document.getElementById("peso").value;
    const altura = ALTURA_FIJA_METROS; 
    const imc = (pesoValue && altura > 0) ? (parseFloat(pesoValue) / (altura * altura)).toFixed(1) : null;

    const payload = {
        id_miembro: document.getElementById("miembroId").value,
        peso: parseFloat(pesoValue), // Asegurar que es un número
        imc: parseFloat(imc), 
        calorias_quemadas: parseInt(document.getElementById("calorias_quemadas").value) || 0, // Asegurar que es un número entero
        fuerza: document.getElementById("fuerza").value,
        resistencia: document.getElementById("resistencia").value,
        masa_muscular: document.getElementById("masa_muscular").value,
        grasa_corporal: document.getElementById("grasa_corporal").value,
        notas: document.getElementById("notas").value,
        objetivo_personal: document.getElementById("objetivo_personal").value
    };
    
    try {
        const res = await fetch("/api/entrenador/registrarMetricas",{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(payload)
        });
        
        if (!res.ok) {
             throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        
        if(data.ok){
            mostrarToast("Métricas guardadas exitosamente."); 
            document.getElementById("formMetricas").reset();
            entrenador_cargarMiembros(); // Recargar la lista para reflejar el cambio
            bootstrap.Modal.getInstance(document.getElementById("modalMetricas")).hide();
        } else {
            mostrarToast("Error al guardar métricas: " + (data.mensaje || "Error desconocido"), 'danger');
        }
    } catch (error) {
        console.error("Error al registrar:", error);
        mostrarToast("Error de conexión al registrar métricas. Revise el API.", 'danger');
    }
}

// --- EXPORTACIÓN PDF ---

/**
 * Exporta el historial de progreso visible en el modal de detalle a un archivo PDF.
 */
function entrenador_exportarPDF() {
    // Se asume que las librerías jspdf y html2canvas ya están cargadas en el entorno HTML.
    const { jsPDF } = window.jspdf;
    
    const btnExport = document.getElementById('btnExportarPDF');
    const originalDisplay = btnExport.style.display;
    btnExport.style.display = 'none'; // Ocultar el botón durante la captura

    const detalleContainer = document.getElementById('detalle-container');
    const miembroNombre = document.getElementById('detalleMiembroNombre').textContent.replace('Historial de ', '');

    // Convertir el contenido del contenedor a una imagen canvas
    html2canvas(detalleContainer, { 
        scale: 2, // Mayor escala para mejor calidad de imagen
        useCORS: true,
        // Ignorar el botón de exportación durante la captura
        ignoreElements: (element) => element === btnExport 
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210; // Ancho A4 en mm
        const pageHeight = 297; // Alto A4 en mm
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // Agregar la primera página
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Si el contenido es más largo que una página, añadir más páginas
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(`Progreso_${miembroNombre.replace(/\s/g, '_')}_${new Date().toLocaleDateString('es-ES')}.pdf`);
        
        mostrarToast('Reporte PDF generado exitosamente', 'info');
    }).catch(error => {
        console.error("Error al generar PDF:", error);
        mostrarToast('Error al generar el PDF. Intente de nuevo.', 'danger');
    }).finally(() => {
        // Asegurar que el botón se muestre de nuevo
        btnExport.style.display = originalDisplay; 
    });
}
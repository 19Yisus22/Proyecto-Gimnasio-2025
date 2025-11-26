document.addEventListener("DOMContentLoaded", function(){
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById("fechaEvaluacion").value = hoy;
    
    const API_BASE = '/api/entrenador';
    const itemsPerPage = 10;
    
    let allClients = [];
    let allEvaluaciones = [];
    let currentPage = 1;
    let progresoChart;
    const ALTURA_FIJA_METROS = 1.70;
    
    const nombreClienteSelect = document.getElementById('nombreCliente');
    const clienteGraficoSelect = document.getElementById('clienteGrafico');
    const tablaEvaluacionesBody = document.getElementById('tablaEvaluaciones');
    const paginacionEvaluaciones = document.getElementById('paginacionEvaluaciones');
    const formEvaluacion = document.getElementById('formEvaluacion');
    const buscarClienteInput = document.getElementById('buscarCliente');
    const filtroMesSelect = document.getElementById('filtroMes');
    const pesoActualInput = document.getElementById('pesoActual');
    const imcInput = document.getElementById('imc');
    const grasaCorporalInput = document.getElementById('grasaCorporal');
    const masaMuscularInput = document.getElementById('masaMuscular');
    const caloriasQuemadasInput = document.getElementById('caloriasQuemadas');
    const fuerzaInput = document.getElementById('fuerza');
    const resistenciaInput = document.getElementById('resistencia');
    const objetivoPersonalInput = document.getElementById('objetivoPersonal');
    const observacionesInput = document.getElementById('observaciones');

    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        
        const icon = type === 'success' ? 'check-circle' : (type === 'info' ? 'info-circle' : 'exclamation-triangle');
        
        toastEl.innerHTML = `
            <div class="d-flex p-2">
                <div class="toast-body d-flex align-items-center">
                    <i class="bi bi-${icon}-fill me-2 fs-5"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white ms-auto me-2" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toastEl);
        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }

    function normalizeText(text) {
        if (!text) return '';
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    }

    function calcularIMC() {
        const peso = parseFloat(pesoActualInput.value);
        const altura = ALTURA_FIJA_METROS;
        
        if (peso > 0 && altura > 0) {
            const imc = (peso / (altura * altura)).toFixed(2);
            imcInput.value = imc;
        } else {
            imcInput.value = '';
        }
    }

    async function loadClients() {
        try {
            const response = await fetch(`${API_BASE}/cargarMiembros`); 
            const data = await response.json();
            allClients = data.miembros || [];
            
            [nombreClienteSelect, clienteGraficoSelect].forEach(select => {
                select.innerHTML = '<option value="">Seleccionar Cliente</option>';
                allClients.forEach(client => {
                    const option = document.createElement('option');
                    option.value = client.id_miembro; 
                    option.textContent = client.nombre;
                    select.appendChild(option);
                });
            });

        } catch (error) {
            showToast('No se pudieron cargar los clientes.', 'danger');
        }
    }
    
    async function loadAllEvaluaciones() {
        try {
            const response = await fetch(`${API_BASE}/cargarEvaluaciones`);
            const data = await response.json();
            allEvaluaciones = data.evaluaciones || [];
            populateMonthFilter(allEvaluaciones);
            renderTable(allEvaluaciones);
        } catch (error) {
            showToast('No se pudieron cargar las evaluaciones.', 'danger');
            allEvaluaciones = [];
            renderTable([]);
        }
    }
    
    formEvaluacion.addEventListener('submit', guardarEvaluacion);

    async function guardarEvaluacion(e) {
        e.preventDefault();

        const id_miembro = nombreClienteSelect.value;
        const peso = parseFloat(pesoActualInput.value);
        const imcCalculado = parseFloat(imcInput.value);
        const grasaCorporal = parseFloat(grasaCorporalInput.value);
        const masaMuscular = parseFloat(masaMuscularInput.value);
        
        if (!id_miembro || !document.getElementById('fechaEvaluacion').value) {
            showToast('Debe seleccionar un cliente y una fecha válidas.', 'warning');
            return;
        }

        if (isNaN(peso) || isNaN(imcCalculado) || peso <= 0 || imcCalculado <= 0) {
            showToast('Debe ingresar un peso válido para calcular el IMC.', 'warning');
            return;
        }

        if (imcCalculado >= 100 || peso >= 1000) {
             showToast('El peso o IMC es excesivamente alto. Revise los valores.', 'warning');
             return;
        }

        const payload = {
            id_miembro,
            fecha: document.getElementById('fechaEvaluacion').value,
            peso: peso.toFixed(2), 
            imc: imcCalculado.toFixed(2),
            grasa_corporal: grasaCorporalInput.value ? grasaCorporal.toFixed(2) : null,
            masa_muscular: masaMuscularInput.value ? masaMuscular.toFixed(2) : null,
            calorias_quemadas: caloriasQuemadasInput.value ? parseInt(caloriasQuemadasInput.value) : 0,
            fuerza: fuerzaInput.value ? parseInt(fuerzaInput.value) : null,
            resistencia: resistenciaInput.value ? parseInt(resistenciaInput.value) : null,
            objetivo_personal: objetivoPersonalInput.value || null,
            notas: observacionesInput.value || null
        };

        try {
            const response = await fetch(`${API_BASE}/registrarMetricas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.mensaje || 'Error al guardar la evaluación.');
            }

            formEvaluacion.reset();
            imcInput.value = '';
            document.getElementById("fechaEvaluacion").value = hoy;
            showToast('Evaluación guardada exitosamente.', 'success');
            
            await loadAllEvaluaciones();
            await updateDashboardMetrics();
            updateChart(id_miembro, document.getElementById('filtroGrafico').value);

        } catch (error) {
            showToast(error.message || 'Ocurrió un error al guardar la evaluación.', 'danger');
        }
    }
    
    function renderTable(data) {
        let filteredData = data;
        const searchValue = normalizeText(buscarClienteInput.value);
        const selectedMonth = filtroMesSelect.value;
        
        if (searchValue) {
            filteredData = filteredData.filter(evaluacion => {
                const nombreCompleto = normalizeText(evaluacion.nombre_cliente);
                return nombreCompleto.includes(searchValue);
            });
        }

        if (selectedMonth) {
            filteredData = filteredData.filter(evaluacion => evaluacion.fecha.startsWith(selectedMonth));
        }
        
        filteredData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        currentPage = Math.min(currentPage, totalPages > 0 ? totalPages : 1);
        
        const start = (currentPage - 1) * itemsPerPage;
        const pageData = filteredData.slice(start, start + itemsPerPage);

        tablaEvaluacionesBody.innerHTML = '';
        if (pageData.length === 0) {
            tablaEvaluacionesBody.innerHTML = '<tr><td colspan="8" class="py-4 text-muted">No hay evaluaciones registradas.</td></tr>';
        }

        pageData.forEach(evaluacion => {
            const row = `
                <tr>
                    <td><strong>${evaluacion.nombre_cliente}</strong></td>
                    <td>${evaluacion.fecha}</td>
                    <td>${evaluacion.peso ? parseFloat(evaluacion.peso).toFixed(2) : '--'}</td>
                    <td>${evaluacion.grasa_corporal ? parseFloat(evaluacion.grasa_corporal).toFixed(2) : '--'}</td>
                    <td>${evaluacion.masa_muscular ? parseFloat(evaluacion.masa_muscular).toFixed(2) : '--'}</td>
                    <td>${evaluacion.imc ? parseFloat(evaluacion.imc).toFixed(2) : '--'}</td>
                    <td class="text-start"><small>${evaluacion.notas || 'N/A'}</small></td>
                </tr>
            `;
            tablaEvaluacionesBody.insertAdjacentHTML('beforeend', row);
        });

        renderPaginationControls(totalPages);
    }
    
    function renderPaginationControls(totalPages) {
        paginacionEvaluaciones.innerHTML = '';
        if (totalPages <= 1) return;

        const createPaginationItem = (page, text, disabled = false, active = false) => {
            const li = document.createElement('li');
            li.classList.add('page-item');
            if (disabled) li.classList.add('disabled');
            if (active) li.classList.add('active');
            
            const a = document.createElement('a');
            a.classList.add('page-link');
            a.href = '#';
            a.textContent = text;
            a.dataset.page = page;
            
            li.appendChild(a);
            paginacionEvaluaciones.appendChild(li);
        };

        createPaginationItem(currentPage - 1, 'Anterior', currentPage === 1);

        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            createPaginationItem(i, i, false, i === currentPage);
        }

        createPaginationItem(currentPage + 1, 'Siguiente', currentPage === totalPages);

        paginacionEvaluaciones.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const newPage = parseInt(e.target.dataset.page);
                if (newPage > 0 && newPage <= totalPages) {
                    currentPage = newPage;
                    renderTable(allEvaluaciones);
                }
            });
        });
    }

    function populateMonthFilter(evaluaciones) {
        const select = document.getElementById("filtroMes");
        const uniqueMonths = new Set();
        
        evaluaciones.forEach(e => {
            if (e.fecha) {
                const monthYear = e.fecha.substring(0, 7);
                uniqueMonths.add(monthYear);
            }
        });

        select.innerHTML = '<option value="">Todos los meses</option>';
        [...uniqueMonths].sort((a, b) => new Date(b + '-01') - new Date(a + '-01')).forEach(monthYear => {
            const [year, month] = monthYear.split('-');
            const date = new Date(year, month - 1);
            const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            const option = document.createElement('option');
            option.value = monthYear;
            option.textContent = monthName[0].toUpperCase() + monthName.slice(1);
            select.appendChild(option);
        });
    }
    
    buscarClienteInput.addEventListener('input', () => {
        currentPage = 1;
        renderTable(allEvaluaciones);
    });

    filtroMesSelect.addEventListener('change', () => {
        currentPage = 1;
        renderTable(allEvaluaciones);
    });
    
    window.eliminarEvaluacion = async function(id) {
        if (!confirm('¿Estás seguro de eliminar esta evaluación?')) return;
        try {
            const res = await fetch(`${API_BASE}/eliminarEvaluacion/${id}`, { method: 'DELETE' });
            const data = await res.json();
            
            if(res.ok && data.ok){
                showToast("Evaluación eliminada");
                await loadAllEvaluaciones();
                await updateDashboardMetrics();
            } else {
                throw new Error(data.mensaje || 'Error al eliminar la evaluación.');
            }
        } catch (error) {
            showToast(error.message || "Error de conexión", 'danger');
        }
    }
    
    async function updateDashboardMetrics() {
        try {
            const response = await fetch(`${API_BASE}/cargarEstadisticas`);
            const data = await response.json();

            document.getElementById('totalMiembros').textContent = data.total_miembros || 0;
            document.getElementById('evaluacionesDelMes').textContent = data.evaluaciones_mes || 0;
            document.getElementById('metasAlcanzadas').textContent = data.objetivos_cumplidos || 0;
        } catch (error) {
            showToast('No se pudieron cargar las estadísticas del dashboard.', 'warning');
        }
    }
    
    function calculateAverage(dataArray) {
        const validData = dataArray.filter(v => v !== null && v !== undefined && !isNaN(v));
        if (validData.length === 0) return null;
        const sum = validData.reduce((a, b) => a + b, 0);
        return sum / validData.length;
    }

    async function updateChart(idMiembro, filtro = 'todos') {
        if (!idMiembro) {
            if (progresoChart) progresoChart.destroy();
            return;
        }

        const evalCliente = allEvaluaciones
            .filter(e => e.id_miembro === idMiembro)
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        let datos = evalCliente;
        
        if (filtro !== 'todos') {
            const meses = parseInt(filtro.replace('meses', ''));
            const fechaLimite = new Date();
            fechaLimite.setMonth(fechaLimite.getMonth() - meses);
            datos = evalCliente.filter(e => new Date(e.fecha) >= fechaLimite);
        }

        if (progresoChart) progresoChart.destroy();
        
        if (datos.length === 0) {
            const ctx = document.getElementById('graficoEvaluacion').getContext('2d');
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); 
            return;
        }

        const ctx = document.getElementById('graficoEvaluacion').getContext('2d');
        const labels = datos.map(e => e.fecha);
        
        const pesos = datos.map(e => parseFloat(e.peso));
        const imcs = datos.map(e => parseFloat(e.imc));
        const grasas = datos.map(e => parseFloat(e.grasa_corporal));
        const musculos = datos.map(e => parseFloat(e.masa_muscular));
        const fuerzas = datos.map(e => parseInt(e.fuerza));
        const resistencias = datos.map(e => parseInt(e.resistencia));

        const avgPeso = calculateAverage(pesos);
        const avgGrasa = calculateAverage(grasas);
        const avgMusculo = calculateAverage(musculos);

        const dataSets = [
            { label: 'Peso (kg)', data: pesos, borderColor: 'rgba(75, 192, 192, 1)', tension: 0.1, yAxisID: 'y_kg' },
            { label: 'IMC', data: imcs, borderColor: 'rgba(255, 159, 64, 1)', tension: 0.1, yAxisID: 'y_kg' },
            { label: 'Grasa Corporal (%)', data: grasas, borderColor: 'rgba(255, 99, 132, 1)', tension: 0.1, hidden: true, yAxisID: 'y_pct' },
            { label: 'Masa Muscular (%)', data: musculos, borderColor: 'rgba(54, 162, 235, 1)', tension: 0.1, hidden: true, yAxisID: 'y_pct' },
            { label: 'Fuerza (1-10)', data: fuerzas, borderColor: 'rgba(153, 102, 255, 1)', tension: 0.1, hidden: true, yAxisID: 'y_score' },
            { label: 'Resistencia (1-10)', data: resistencias, borderColor: 'rgba(201, 203, 207, 1)', tension: 0.1, hidden: true, yAxisID: 'y_score' }
        ];

        if (avgPeso !== null) {
            dataSets.push({ 
                label: `Promedio Peso (${avgPeso.toFixed(2)}kg)`, 
                data: Array(labels.length).fill(avgPeso), 
                borderColor: 'rgba(75, 192, 192, 0.5)', 
                borderDash: [5, 5], 
                pointRadius: 0, 
                tension: 0, 
                yAxisID: 'y_kg',
                hidden: false
            });
        }
        if (avgGrasa !== null) {
            dataSets.push({ 
                label: `Promedio Grasa (${avgGrasa.toFixed(2)}%)`, 
                data: Array(labels.length).fill(avgGrasa), 
                borderColor: 'rgba(255, 99, 132, 0.5)', 
                borderDash: [5, 5], 
                pointRadius: 0, 
                tension: 0, 
                yAxisID: 'y_pct',
                hidden: true
            });
        }
        if (avgMusculo !== null) {
             dataSets.push({ 
                label: `Promedio Músculo (${avgMusculo.toFixed(2)}%)`, 
                data: Array(labels.length).fill(avgMusculo), 
                borderColor: 'rgba(54, 162, 235, 0.5)', 
                borderDash: [5, 5], 
                pointRadius: 0, 
                tension: 0, 
                yAxisID: 'y_pct',
                hidden: true
            });
        }

        progresoChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: dataSets },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                stacked: false,
                scales: {
                    y_kg: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Peso/IMC' } },
                    y_pct: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Composición (%)' } },
                    y_score: { type: 'linear', display: false, position: 'right', min: 0, max: 10, grid: { drawOnChartArea: false }, title: { display: true, text: 'Rendimiento (1-10)' } }
                }
            }
        });
    }

    clienteGraficoSelect.addEventListener('change', (e) => {
        const id = e.target.value;
        const filtro = document.getElementById('filtroGrafico').value;
        updateChart(id, filtro);
    });

    document.getElementById('filtroGrafico').addEventListener('change', (e) => {
        const id = clienteGraficoSelect.value;
        updateChart(id, e.target.value);
    });
    
    (async function init() {
        await loadClients();
        await updateDashboardMetrics();
        await loadAllEvaluaciones();
        
        if (allClients.length > 0) {
            const firstClientUUID = allClients[0].id_miembro;
            if (firstClientUUID) {
                clienteGraficoSelect.value = firstClientUUID;
                updateChart(firstClientUUID, 'todos');
            }
        }
    })();

    pesoActualInput.addEventListener('input', calcularIMC);
});
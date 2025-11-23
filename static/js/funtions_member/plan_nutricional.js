const API_BASE = "/api/miembros";
const API_NUTRICION = "/api/nutricion";

const statusAlert = document.getElementById('statusAlert');
const chatForm = document.getElementById('chatForm');
let progressChartInstance = null;

function showAlert(message, type) {
    statusAlert.textContent = message;
    statusAlert.classList.remove('hidden', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800');
    if (type === 'success') {
        statusAlert.classList.add('bg-green-100', 'text-green-800');
    } else {
        statusAlert.classList.add('bg-red-100', 'text-red-800');
    }
    setTimeout(() => { statusAlert.classList.add('hidden'); }, 5000);
}

async function postData(endpoint, data) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (!response.ok || !result.ok) {
            throw new Error(result.error || `Error HTTP: ${response.status}`);
        }
        return result.data;
    } catch (error) {
        console.error(`Error en POST a ${endpoint}:`, error);
        showAlert(`Error al realizar la operación: ${error.message}`, 'error');
        return null;
    }
}

async function fetchData(endpoint) {
    try {
        const response = await fetch(endpoint, { method: 'GET' });
        const result = await response.json();
        
        if (!response.ok || !result.ok) {
            throw new Error(result.error || `Error HTTP: ${response.status}`);
        }
        return result.data;
    } catch (error) {
        console.error(`Error en GET a ${endpoint}:`, error);
        return null;
    }
}

function renderProgressChart(data) {
    const chartLoading = document.getElementById('chartLoading');
    chartLoading.classList.add('hidden');

    if (!data || data.length === 0) {
        chartLoading.textContent = 'No hay suficientes datos para mostrar el progreso.';
        chartLoading.classList.remove('hidden');
        return;
    }

    data.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const labels = data.map(item => new Date(item.fecha).toLocaleDateString());
    const pesos = data.map(item => item.peso);
    const grasaCorporal = data.map(item => item.grasa_corporal);
    const masaMuscular = data.map(item => item.masa_muscular);

    const ctx = document.getElementById('progressChart').getContext('2d');

    if (progressChartInstance) {
        progressChartInstance.destroy();
    }

    progressChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Peso (kg)',
                    data: pesos,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Grasa Corporal (%)',
                    data: grasaCorporal,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Masa Muscular (kg)',
                    data: masaMuscular,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            family: 'Inter'
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Valor'
                    }
                }
            }
        }
    });
}

async function loadDashboardData() {
    const historicalProgress = await fetchData(`${API_BASE}/obtener_progreso_historico`);
    renderProgressChart(historicalProgress);

    if (historicalProgress && historicalProgress.length > 0) {
        const latestProgress = historicalProgress[historicalProgress.length - 1];
        document.getElementById('currentWeight').innerHTML = 
            `Último Peso: <span class="font-bold text-xl text-blue-600">${latestProgress.peso} kg</span> (el ${new Date(latestProgress.fecha).toLocaleDateString()})`;
    } else {
            document.getElementById('currentWeight').innerHTML = `Último Peso: <span class="font-bold text-xl text-red-500">No registrado</span>`;
    }

    const objetivo = await fetchData(`${API_BASE}/obtener_objetivo`);
    if (objetivo && objetivo.length > 0) {
        const goal = objetivo[0];
        document.getElementById('goalDescription').textContent = goal.descripcion;
        document.getElementById('goalDeadline').textContent = `Fecha Límite: ${new Date(goal.fecha_limite).toLocaleDateString()}`;
    } else {
            document.getElementById('goalDescription').textContent = 'No hay objetivo establecido.';
            document.getElementById('goalDeadline').textContent = 'Fecha Límite: N/A';
    }

    const plan = await fetchData(`${API_NUTRICION}/obtener_plan_actual`);
    if (plan && plan.length > 0) {
        const currentPlan = plan[0];
        document.getElementById('planDescription').innerHTML = `Plan: <span class="font-bold">${currentPlan.descripcion || 'Sin descripción'}</span>`;
        document.getElementById('planMacros').textContent = 
            `Calorías: ${currentPlan.calorias || 0} | Prot: ${currentPlan.proteina || 0}g | Grasa: ${currentPlan.grasa || 0}g | Carb: ${currentPlan.carbohidratos || 0}g`;
    } else {
        document.getElementById('planDescription').innerHTML = 'Plan: <span class="italic text-red-500">No hay plan activo.</span>';
        document.getElementById('planMacros').textContent = 'Macros: --';
    }

    const ingesta = await fetchData(`${API_NUTRICION}/obtener_ingesta`);
    const intakeList = document.getElementById('intakeList');
    intakeList.innerHTML = '';
    if (ingesta && ingesta.length > 0) {
        ingesta.forEach(item => {
            const li = document.createElement('li');
            li.className = 'py-2 px-3 flex justify-between text-gray-700';
            li.innerHTML = `
                <span style="color: black;">${item.alimento} (${item.cantidad}g)</span>
                <span style="color: black;" class="font-medium text-sm text-green-600">${item.calorias || 0} cal</span>
            `;
            intakeList.appendChild(li);
        });
    } else {
        intakeList.innerHTML = '<li class="py-2 px-3 text-gray-500 text-sm italic">Aún no has registrado ingestas hoy.</li>';
    }
    
    loadChatMessages();
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    const data = await postData(`${API_NUTRICION}/enviar_mensaje`, {
        mensaje: message,
        remitente: 'miembro',
        id_nutricionista: null 
    });

    if (data) {
        chatInput.value = '';
        loadChatMessages(); 
    }
});

async function loadChatMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    
    const messages = await fetchData(`${API_NUTRICION}/obtener_chat`);

    messagesContainer.innerHTML = '';
    if (messages && messages.length > 0) {
        messages.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        
        messages.forEach(msg => {
            const isMember = msg.remitente === 'miembro';
            const messageDiv = document.createElement('div');
            
            messageDiv.className = isMember 
                ? 'flex justify-end' 
                : 'flex justify-start';
                
            const senderLabel = isMember ? 'Tú' : 'Nutricionista';
                
            messageDiv.innerHTML = `
                <div style="color: black;" class="max-w-[90%] p-3 rounded-xl shadow-md ${isMember 
                    ? 'bg-purple-500 text-white rounded-br-sm' 
                    : 'bg-white text-gray-800 rounded-tl-sm border border-gray-200'}">
                    <p style="color: black;" class="text-xs font-semibold mb-1 opacity-80">${senderLabel}</p>
                    <p style="color: black;">${msg.mensaje}</p>
                    <span style="color: black;" class="block text-right text-[10px] opacity-70 mt-1">${new Date(msg.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
            messagesContainer.appendChild(messageDiv);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        messagesContainer.innerHTML = '<div class="text-center text-gray-500 text-sm italic py-4">Inicia una conversación con tu nutricionista.</div>';
    }
}

window.onload = loadDashboardData;
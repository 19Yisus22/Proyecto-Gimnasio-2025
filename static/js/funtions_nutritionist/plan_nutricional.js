document.addEventListener('DOMContentLoaded', () => {
  let currentMemberId = null;
  const currentNutricionistaId = document.querySelector('body').dataset.userId || '';
  
  let planesData = [];
  let ingestaData = [];
  let progresoData = [];
  
  let planesPage = 1;
  let ingestaPage = 1;
  let progresoPage = 1;
  const itemsPerPage = 5;

  const searchInput = document.getElementById('searchMemberInput');
  const btnSearch = document.getElementById('btnSearchMember');
  const searchResults = document.getElementById('searchResults');
  const selectedMemberInfo = document.getElementById('selectedMemberInfo');
  const selectedMemberName = document.getElementById('selectedMemberName');
  const btnClearSelection = document.getElementById('btnClearSelection');
  const mainContent = document.getElementById('mainContent');

  document.getElementById('ingesta_fecha').valueAsDate = new Date();
  document.getElementById('progreso_fecha').valueAsDate = new Date();

  btnSearch.addEventListener('click', searchMembers);
  searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchMembers(); });

  async function searchMembers() {
    const query = searchInput.value.trim();
    if (!query) return;
    try {
      const res = await fetch(`/api/nutricionista/perfil/buscar?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      searchResults.innerHTML = '';
      if (data.items && data.items.length > 0) {
        data.items.forEach(item => {
          const div = document.createElement('div');
          div.className = 'list-group-item list-group-item-action member-item';
          div.innerHTML = `<strong>${item.name}</strong><br><small class="text-muted">${item.email}</small>`;
          div.onclick = () => selectMember(item);
          searchResults.appendChild(div);
        });
      } else searchResults.innerHTML = '<div class="list-group-item">No se encontraron miembros</div>';
    } catch (error) {
      console.error('Error al buscar miembros:', error);
      searchResults.innerHTML = '<div class="list-group-item text-danger">Error al buscar</div>';
    }
  }

  function selectMember(member) {
    currentMemberId = member.id;
    selectedMemberName.textContent = member.name;
    selectedMemberInfo.classList.remove('d-none');
    mainContent.classList.remove('d-none');
    searchResults.innerHTML = '';
    searchInput.value = '';
    planesPage = 1;
    ingestaPage = 1;
    progresoPage = 1;
    cargarPlanes();
    cargarProgreso();
    cargarChat();
    cargarEvaluacion();
    cargarIngesta();
  }

  btnClearSelection.addEventListener('click', () => {
    currentMemberId = null;
    selectedMemberInfo.classList.add('d-none');
    mainContent.classList.add('d-none');
    searchResults.innerHTML = '';
  });

  const formEval = document.getElementById('formEval');
  formEval.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentMemberId) return;
    const data = {
      id_miembro: currentMemberId,
      nombre: document.getElementById('eval_nombre').value,
      edad: parseInt(document.getElementById('eval_edad').value),
      sexo: document.getElementById('eval_sexo').value,
      peso: parseFloat(document.getElementById('eval_peso').value),
      altura: parseFloat(document.getElementById('eval_altura').value),
      actividad: document.getElementById('eval_actividad').value,
      restricciones: document.getElementById('eval_restricciones').value
    };
    try {
      const res = await fetch('/api/nutricionista/n_evaluacion_inicial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      document.getElementById('evalResultados').innerHTML = res.ok ? '<div class="alert alert-success">Evaluación registrada correctamente</div>' : '<div class="alert alert-danger">Error al registrar evaluación</div>';
      setTimeout(() => { document.getElementById('evalResultados').innerHTML = ''; }, 3000);
    } catch (error) { 
      console.error('Error:', error); 
      document.getElementById('evalResultados').innerHTML = '<div class="alert alert-danger">Error al registrar evaluación</div>'; 
    }
  });

  async function cargarEvaluacion() {
    if (!currentMemberId) return;
    try {
      const res = await fetch(`/api/nutricionista/n_evaluacion_inicial/${currentMemberId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const evalData = data[0];
          document.getElementById('eval_nombre').value = evalData.nombre || '';
          document.getElementById('eval_edad').value = evalData.edad || '';
          document.getElementById('eval_sexo').value = evalData.sexo || '';
          document.getElementById('eval_peso').value = evalData.peso || '';
          document.getElementById('eval_altura').value = evalData.altura || '';
          document.getElementById('eval_actividad').value = evalData.actividad || '';
          document.getElementById('eval_restricciones').value = evalData.restricciones || '';
        } else formEval.reset();
      }
    } catch (error) { console.error('Error al cargar evaluación:', error); }
  }

  const formPlan = document.getElementById('formPlan');
  formPlan.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentMemberId) return;
    const data = {
      id_miembro: currentMemberId,
      id_nutricionista: currentNutricionistaId,
      descripcion: document.getElementById('plan_titulo').value,
      calorias: parseInt(document.getElementById('plan_calorias').value),
      proteina: parseInt(document.getElementById('macro_prot').value),
      grasa: parseInt(document.getElementById('macro_grasa').value),
      carbohidratos: parseInt(document.getElementById('macro_carbs').value),
      plantilla: document.getElementById('plan_template').value,
      fecha_inicio: document.getElementById('plan_inicio').value,
      fecha_fin: document.getElementById('plan_fin').value
    };
    try {
      const res = await fetch('/api/nutricionista/n_planes_nutricion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      if (res.ok) { 
        formPlan.reset(); 
        planesPage = 1;
        cargarPlanes(); 
      }
    } catch (error) { console.error(error); }
  });

  async function cargarPlanes() {
    if (!currentMemberId) return;
    try {
      const res = await fetch(`/api/nutricionista/n_planes_nutricion/miembro/${currentMemberId}`);
      planesData = await res.json();
      renderPlanes();
    } catch (error) { 
      console.error(error); 
      document.getElementById('planesAsignados').innerHTML = '<p class="text-danger">Error al cargar planes</p>'; 
    }
  }

  function renderPlanes() {
    const container = document.getElementById('planesAsignados');
    const pagination = document.getElementById('planesPagination');
    
    if (!planesData || planesData.length === 0) {
      container.innerHTML = '<p class="text-muted">No hay planes asignados aún.</p>';
      pagination.classList.add('d-none');
      return;
    }

    const totalPages = Math.ceil(planesData.length / itemsPerPage);
    if (planesPage < 1) planesPage = 1;
    if (planesPage > totalPages) planesPage = totalPages;

    const start = (planesPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = planesData.slice(start, end);

    container.innerHTML = '';
    currentItems.forEach(plan => {
      const div = document.createElement('div');
      div.className = 'card plan-card p-3 mb-2';
      div.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <h6 class="mb-2" style="color: black;"><i class="bi bi-clipboard-check text-primary"></i> ${plan.descripcion || 'Plan sin nombre'}</h6>
            <div class="plan-info mb-2">
              <span class="badge bg-primary me-2">${plan.calorias || 0} kcal/día</span>
              <span class="badge bg-info me-2">Proteína: ${plan.proteina || 0}%</span>
              <span class="badge bg-warning text-dark me-2">Grasa: ${plan.grasa || 0}%</span>
              <span class="badge bg-success">Carbos: ${plan.carbohidratos || 0}%</span>
            </div>
            <div class="mb-2">
              <small class="text-muted">
                <i class="bi bi-calendar-range"></i> ${plan.fecha_inicio || '--'} → ${plan.fecha_fin || '--'}
              </small>
            </div>
            ${plan.recomendaciones ? `<div class="mt-2"><small style="color: black;"><strong>Recomendaciones:</strong> ${plan.recomendaciones}</small></div>` : ''}
            ${plan.feedback ? `<div class="mt-2"><small style="color: black;"><strong>Feedback:</strong> ${plan.feedback}</small></div>` : ''}
          </div>
          <button class="btn btn-sm btn-danger btn-delete-plan ms-2" data-id="${plan.id_plan}">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      `;
      
      div.querySelector('button').addEventListener('click', async function() {
        const planId = this.getAttribute('data-id');
        if (!confirm('¿Deseas eliminar este plan?')) return;
        try {
          const delRes = await fetch(`/api/nutricionista/n_planes_nutricion/${planId}`, { method: 'DELETE' });
          if (delRes.ok) {
            if (currentItems.length === 1 && planesPage > 1) planesPage--;
            cargarPlanes();
          }
        } catch (error) { console.error(error); }
      });
      
      container.appendChild(div);
    });

    renderPagination(pagination, totalPages, planesPage, (page) => { planesPage = page; renderPlanes(); });
  }

  function renderPagination(paginationContainer, totalPages, currentPage, onPageClick) {
    paginationContainer.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
      btn.textContent = i;
      btn.onclick = () => onPageClick(i);
      paginationContainer.appendChild(btn);
    }
    
    paginationContainer.classList.remove('d-none');
  }

  const chatContainer = document.getElementById('chatNutri');
  const mensajeInput = document.getElementById('mensajeNutri');
  
  document.getElementById('btnEnviarNutri').addEventListener('click', async () => {
    if (!mensajeInput.value.trim() || !currentMemberId) return;
    const data = { 
      id_miembro: currentMemberId, 
      id_nutricionista: currentNutricionistaId, 
      mensaje: mensajeInput.value,
      remitente: 'nutricionista'
    };
    try {
      const res = await fetch('/api/nutricionista/n_chat_nutricion', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(data) 
      });
      if (res.ok) { 
        mensajeInput.value = ''; 
        cargarChat(); 
      }
    } catch (error) { console.error(error); }
  });

  async function cargarChat() {
    if (!currentMemberId) return;
    try {
      const res = await fetch(`/api/nutricionista/n_chat_nutricion/miembro/${currentMemberId}`);
      const data = await res.json();
      chatContainer.innerHTML = '';
      
      if (data && data.length > 0) {
        data.forEach(msg => {
          const div = document.createElement('div');
          const isNutricionista = msg.remitente === 'nutricionista';
          div.className = 'msg ' + (isNutricionista ? 'msg-nutricionista' : 'msg-miembro');
          
          const fecha = msg.fecha_hora ? new Date(msg.fecha_hora).toLocaleString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : '';
          
          div.innerHTML = `
            <div class="meta">${isNutricionista ? 'Tú' : 'Miembro'} • ${fecha}</div>
            <div class="texto">${msg.mensaje}</div>
          `;
          chatContainer.appendChild(div);
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
      } else {
        chatContainer.innerHTML = '<p class="text-muted text-center mt-3">No hay mensajes aún. ¡Inicia la conversación!</p>';
      }
    } catch (error) { 
      console.error('Error al cargar chat:', error); 
      chatContainer.innerHTML = '<p class="text-danger text-center mt-3">Error al cargar mensajes</p>';
    }
  }

  setInterval(() => {
    if (currentMemberId) {
      cargarChat();
    }
  }, 5000);

  const formIngesta = document.getElementById('formIngesta');
  formIngesta.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentMemberId) return;
    const data = {
      id_miembro: currentMemberId,
      id_plan: null,
      fecha: document.getElementById('ingesta_fecha').value,
      alimento: document.getElementById('ingesta_alimento').value,
      cantidad: parseFloat(document.getElementById('ingesta_cantidad').value),
      calorias: parseFloat(document.getElementById('ingesta_calorias').value) || 0,
      proteina: parseFloat(document.getElementById('ingesta_prot').value) || 0,
      grasa: parseFloat(document.getElementById('ingesta_grasa').value) || 0,
      carbohidratos: parseFloat(document.getElementById('ingesta_carbs').value) || 0
    };
    try {
      const res = await fetch('/api/nutricionista/n_ingesta', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(data) 
      });
      if (res.ok) { 
        formIngesta.reset(); 
        document.getElementById('ingesta_fecha').valueAsDate = new Date();
        ingestaPage = 1;
        cargarIngesta(); 
      }
    } catch (error) { console.error(error); }
  });

  async function cargarIngesta() {
    if (!currentMemberId) return;
    try {
      const res = await fetch(`/api/nutricionista/n_ingesta/miembro/${currentMemberId}`);
      ingestaData = await res.json();
      renderIngesta();
    } catch (error) { 
      console.error(error); 
      document.getElementById('listaIngesta').innerHTML = '<p class="text-danger">Error al cargar ingesta</p>'; 
    }
  }

  function renderIngesta() {
    const container = document.getElementById('listaIngesta');
    const pagination = document.getElementById('ingestaPagination');
    
    if (!ingestaData || ingestaData.length === 0) {
      container.innerHTML = '<p class="text-muted">No hay registros de ingesta.</p>';
      pagination.classList.add('d-none');
      return;
    }

    const totalPages = Math.ceil(ingestaData.length / itemsPerPage);
    if (ingestaPage < 1) ingestaPage = 1;
    if (ingestaPage > totalPages) ingestaPage = totalPages;

    const start = (ingestaPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = ingestaData.slice(start, end);

    container.innerHTML = '';
    currentItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'ingesta-item';
      div.innerHTML = `
        <div>
          <strong style="color: black;">${item.alimento}</strong> 
          <span style="color: black;">(${item.cantidad}g)</span>
          <br>
          <small class="text-muted">
            <i class="bi bi-calendar3"></i> ${item.fecha} | 
            ${item.calorias || 0} kcal | 
            P: ${item.proteina || 0}g | 
            G: ${item.grasa || 0}g | 
            C: ${item.carbohidratos || 0}g
          </small>
        </div>
      `;
      container.appendChild(div);
    });

    renderPagination(pagination, totalPages, ingestaPage, (page) => { ingestaPage = page; renderIngesta(); });
  }

  const formProgreso = document.getElementById('formProgreso');
  formProgreso.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentMemberId) return;

    const data = {
      id_miembro: currentMemberId,
      fecha: document.getElementById('progreso_fecha').value,
      peso: parseFloat(document.getElementById('progreso_peso').value),
      grasa_corporal: parseFloat(document.getElementById('progreso_grasa').value) || null,
      masa_muscular: parseFloat(document.getElementById('progreso_musculo').value) || null,
      seguimiento_dieta: document.getElementById('progreso_seguimiento').value || null,
      observaciones: document.getElementById('progreso_observaciones').value || null
    };

    try {
      const res = await fetch('/api/nutricionista/progreso/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        formProgreso.reset();
        document.getElementById('progreso_fecha').valueAsDate = new Date();
        progresoPage = 1;
        cargarProgreso();
      } else {
        alert('Error al registrar progreso');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al registrar progreso');
    }
  });

  async function cargarProgreso() {
    if (!currentMemberId) return;
    try {
      const res = await fetch(`/api/nutricionista/progreso/listar/${currentMemberId}`);
      progresoData = await res.json();
      renderProgreso();
    } catch (error) {
      console.error('Error al cargar progreso:', error);
      document.getElementById('listaProgreso').innerHTML = '<p class="text-danger">Error al cargar progreso</p>';
    }
  }

  function renderProgreso() {
    const container = document.getElementById('listaProgreso');
    const pagination = document.getElementById('progresoPagination');

    if (!progresoData || progresoData.length === 0) {
      container.innerHTML = '<p class="text-muted">No hay registros de progreso.</p>';
      pagination.classList.add('d-none');
      return;
    }

    const totalPages = Math.ceil(progresoData.length / itemsPerPage);
    if (progresoPage < 1) progresoPage = 1;
    if (progresoPage > totalPages) progresoPage = totalPages;

    const start = (progresoPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = progresoData.slice(start, end);

    container.innerHTML = '';
    currentItems.forEach(p => {
      const div = document.createElement('div');
      div.className = 'card p-2 mb-2';
      div.innerHTML = `
        <div><strong style="color: black;">${p.fecha || '--'}</strong></div>
        <div class="row g-2 mt-1">
          <div class="col-md-4">
            <small style="color: black;"><i class="bi bi-speedometer2"></i> Peso: <strong>${p.peso || '--'} kg</strong></small>
          </div>
          <div class="col-md-4">
            <small style="color: black;"><i class="bi bi-droplet"></i> Grasa: <strong>${p.grasa_corporal || '--'}%</strong></small>
          </div>
          <div class="col-md-4">
            <small style="color: black;"><i class="bi bi-lightning"></i> Músculo: <strong>${p.masa_muscular || '--'} kg</strong></small>
          </div>
        </div>
        ${p.seguimiento_dieta ? `<div class="mt-2"><small style="color: black;"><strong>Seguimiento:</strong> ${p.seguimiento_dieta}</small></div>` : ''}
        ${p.observaciones ? `<div><small style="color: black;"><strong>Observaciones:</strong> ${p.observaciones}</small></div>` : ''}
      `;
      container.appendChild(div);
    });

    renderPagination(pagination, totalPages, progresoPage, (page) => { progresoPage = page; renderProgreso(); });
  }

});
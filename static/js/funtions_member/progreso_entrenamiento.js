document.addEventListener("DOMContentLoaded", () => {
  const tabla = document.getElementById("tablaHistorial");
  const toastContainer = document.getElementById("toastContainer");
  const formObjetivo = document.getElementById("formObjetivo");
  const listaMetas = document.getElementById("listaMetas");
  const barraProgreso = document.getElementById("barraProgreso");
  const filtroGrafico = document.getElementById("filtroGrafico");
  const ctx = document.getElementById("graficoProgreso").getContext("2d");
  let chartProgreso = null;

  function mostrarToast(msg, tipo="success") {
    const color = tipo==="error"?"bg-danger":"bg-success";
    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-white ${color} border-0 show`;
    toast.role = "alert";
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    toastContainer.appendChild(toast);
    setTimeout(()=>toast.remove(),3000);
  }

  async function miembros_progreso_listar() {
    const res = await fetch("/api/miembros_progreso");
    const data = await res.json();
    if(!data.ok){mostrarToast(data.error||"Error al cargar progreso","error"); return;}
    tabla.innerHTML = "";
    if(data.data.length===0) return;
    const pesoProm = (data.data.reduce((a,b)=>a+parseFloat(b.peso),0)/data.data.length).toFixed(1);
    const grasaProm = (data.data.reduce((a,b)=>a+parseFloat(b.grasa_corporal),0)/data.data.length).toFixed(1);
    const musculoProm = (data.data.reduce((a,b)=>a+parseFloat(b.masa_muscular),0)/data.data.length).toFixed(1);
    document.getElementById("pesoActual").textContent = pesoProm;
    document.getElementById("grasaCorporal").textContent = grasaProm;
    document.getElementById("masaMuscular").textContent = musculoProm;

    data.data.forEach(p=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${p.fecha}</td>
        <td>${p.peso}</td>
        <td>${p.grasa_corporal}</td>
        <td>${p.masa_muscular}</td>
        <td>${p.calorias_quemadas}</td>
        <td>${p.fuerza}</td>
        <td>${p.resistencia}</td>
        <td>${p.objetivo_personal||""}</td>`;
      tabla.appendChild(tr);
    });

    actualizarGrafico(data.data);
  }

  function formatearFecha(fechaStr, tipo='semanal'){
    const fecha = new Date(fechaStr);
    if(tipo==='mensual') return `${fecha.getFullYear()}-${fecha.getMonth()+1}`;
    return `${fecha.getDate()}/${fecha.getMonth()+1}`;
  }

  function actualizarGrafico(datos) {
    const tipoFiltro = filtroGrafico.value;
    const etiquetas = datos.map(d=>formatearFecha(d.fecha, tipoFiltro));
    const peso = datos.map(d=>parseFloat(d.peso));
    const grasa = datos.map(d=>parseFloat(d.grasa_corporal));
    const musculo = datos.map(d=>parseFloat(d.masa_muscular));

    if(chartProgreso) chartProgreso.destroy();

    chartProgreso = new Chart(ctx, {
      type: 'line',
      data: {
        labels: etiquetas,
        datasets: [
          { label: 'Peso (kg)', data: peso, borderColor: 'rgb(75, 192, 192)', tension: 0.3, fill:false },
          { label: 'Grasa (%)', data: grasa, borderColor: 'rgb(255, 99, 132)', tension: 0.3, fill:false },
          { label: 'Masa Muscular (%)', data: musculo, borderColor: 'rgb(54, 162, 235)', tension: 0.3, fill:false }
        ]
      },
      options: { responsive:true, plugins:{legend:{position:'top'}}, scales:{y:{beginAtZero:true}} }
    });
  }

  async function miembros_mis_reservas_listar() {
    const res = await fetch("/api/miembros/mis_reservas");
    const data = await res.json();
    if(!data.ok){mostrarToast(data.message||"Error al cargar reservas","error"); return;}
    
    const container = document.getElementById("misReservasContainer");
    container.innerHTML = "";
    
    data.clases.forEach(r => {
        const div = document.createElement("div");
        div.className = "d-flex justify-content-between align-items-center mb-2 p-2 border rounded bg-dark-purple text-white";
        div.innerHTML = `
            <span>${r.tipo_clase} - ${r.horario} - Estado: ${r.estado}</span>
            <div>
                ${r.estado==='reservada'?`<button class="btn btn-sm btn-danger" onclick="cancelarReserva('${r.id_reserva}')">Cancelar</button>`:''}
            </div>
        `;
        container.appendChild(div);
    });
}

async function cancelarReserva(id_reserva){
    const res = await fetch("/api/miembros/cancelar_reservas/"+id_reserva, {method:"PUT"});
    const data = await res.json();
    if(data.ok){mostrarToast("Reserva cancelada"); miembros_mis_reservas_listar();}
    else mostrarToast(data.message||"Error al cancelar","error");
}

  filtroGrafico.addEventListener("change", () => {
    const datos = Array.from(tabla.querySelectorAll("tr")).map(tr => {
      const tds = tr.querySelectorAll("td");
      return {
        fecha: tds[0].textContent,
        peso: parseFloat(tds[1].textContent),
        grasa_corporal: parseFloat(tds[2].textContent),
        masa_muscular: parseFloat(tds[3].textContent)
      };
    });
    actualizarGrafico(datos);
  });

  async function miembros_objetivos_listar() {
    const res = await fetch("/api/miembros_objetivos");
    const data = await res.json();
    if(!data.ok){mostrarToast(data.error||"Error al cargar objetivos","error"); return;}
    listaMetas.innerHTML="";
    let cumplidos=0;
    data.data.forEach(o=>{
      const tr = document.createElement("div");
      tr.className="d-flex justify-content-between align-items-center mb-2 p-2 border rounded bg-dark-purple text-black";
      tr.innerHTML=`<span style="color: black;">${o.descripcion} (Limite: ${o.fecha_limite})</span>
        <div>
          <button class="btn btn-sm btn-success me-1" onclick="marcarCumplido('${o.id_objetivo}')">${o.estado==='cumplido'?'✅':'Marcar Cumplido'}</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarObjetivo('${o.id_objetivo}')">Eliminar</button>
        </div>`;
      if(o.estado==='cumplido') cumplidos++;
      listaMetas.appendChild(tr);
    });
    const porcentaje = data.data.length ? Math.round((cumplidos/data.data.length)*100) : 0;
    barraProgreso.style.width = porcentaje+"%";
    barraProgreso.textContent = porcentaje+"%";
  }

  formObjetivo.addEventListener("submit", async e=>{
      e.preventDefault();
      if(!ID_USUARIO){mostrarToast("Usuario no autenticado","error"); return;}
      const body = {
        descripcion: document.getElementById("metaDescripcion").value,
        fecha_limite: document.getElementById("metaFecha").value
      };
      const res = await fetch("/api/miembros_objetivos", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if(data.ok){mostrarToast("Objetivo creado"); formObjetivo.reset(); miembros_objetivos_listar();}
      else mostrarToast(data.error||"Error al crear objetivo","error");
  });

  window.marcarCumplido = async id=>{
    const res = await fetch("/api/miembros_objetivos/"+id, {
      method:"PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({estado:'cumplido'})
    });
    const data = await res.json();
    if(data.ok){mostrarToast("Objetivo cumplido"); miembros_objetivos_listar();}
    else mostrarToast(data.error||"Error","error");
  };

  window.eliminarObjetivo = async id=>{
    const res = await fetch("/api/miembros_objetivos/"+id, { method:"DELETE" });
    const data = await res.json();
    if(data.ok){mostrarToast("Objetivo eliminado"); miembros_objetivos_listar();}
    else mostrarToast(data.error||"Error al eliminar","error");
  };

  miembros_progreso_listar();
  miembros_objetivos_listar();
});
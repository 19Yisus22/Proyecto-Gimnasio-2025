document.addEventListener('DOMContentLoaded', () => {
  cargarGrafica();
  document.getElementById('formProgreso').addEventListener('submit', async e => {
    e.preventDefault();
    try{
      const payload = {
        peso: parseFloat(document.getElementById('peso').value),
        grasa_corporal: parseFloat(document.getElementById('grasa').value),
        calorias_quemadas: parseFloat(document.getElementById('calorias').value),
        notas: document.getElementById('notas').value
      };
      const res = await fetch('/api/progreso',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const data = await res.json();
      if(res.ok){
        mostrarToast('Progreso registrado','success');
        cargarGrafica();
        document.getElementById('formProgreso').reset();
      } else {
        mostrarToast(data.error||'Error al guardar','danger');
      }
    }catch(error){
      mostrarToast('Error al guardar progreso','danger');
    }
  });
  document.getElementById('tipoGrafica').addEventListener('change', cargarGrafica);
});

async function cargarGrafica(){
  try{
    const res = await fetch('/progreso_entrenamiento');
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(await res.text(), 'text/html');
    const progresoElems = htmlDoc.querySelectorAll('#rutinasContainer');
    const progresoData = Array.from(progresoElems).map(e => ({
      peso: parseFloat(e.dataset.peso||0),
      grasa: parseFloat(e.dataset.grasa||0),
      calorias: parseFloat(e.dataset.calorias||0),
      nombre: e.dataset.nombre || '',
      fecha: e.dataset.fecha || ''
    }));
    const tipo = document.getElementById('tipoGrafica').value;
    const ctx = document.getElementById('graficaProgreso').getContext('2d');
    let labels = [];
    let datasets = [];
    if(tipo==='fecha'){
      labels = progresoData.map(p=>p.fecha);
      datasets = [
        {label:'Peso (kg)', data: progresoData.map(p=>p.peso), borderColor:'blue', tension:0.3},
        {label:'Grasa (%)', data: progresoData.map(p=>p.grasa), borderColor:'red', tension:0.3},
        {label:'Calorías', data: progresoData.map(p=>p.calorias), borderColor:'green', tension:0.3}
      ];
    } else {
      const tipos = progresoData.map(p=>p.nombre);
      labels = [...new Set(tipos)];
      datasets = [
        {label:'Peso (kg)', data: labels.map(l=>progresoData.filter(p=>p.nombre===l).reduce((a,b)=>a+b.peso,0)/progresoData.filter(p=>p.nombre===l).length), borderColor:'blue', tension:0.3},
        {label:'Grasa (%)', data: labels.map(l=>progresoData.filter(p=>p.nombre===l).reduce((a,b)=>a+b.grasa,0)/progresoData.filter(p=>p.nombre===l).length), borderColor:'red', tension:0.3},
        {label:'Calorías', data: labels.map(l=>progresoData.filter(p=>p.nombre===l).reduce((a,b)=>a+b.calorias,0)/progresoData.filter(p=>p.nombre===l).length), borderColor:'green', tension:0.3}
      ];
    }
    if(window.chartInstance) window.chartInstance.destroy();
    window.chartInstance = new Chart(ctx,{type:'line',data:{labels, datasets}});
  }catch(error){}
}

async function cancelarEntrenamiento(id){
  try{
    const res = await fetch(`/api/entrenamientos/${id}`, {method:'DELETE'});
    const data = await res.json();
    if(res.ok){mostrarToast('Entrenamiento cancelado','success');location.reload()}
    else{mostrarToast(data.error||'Error al cancelar','danger')}
  }catch(error){mostrarToast('Error al cancelar entrenamiento','danger')}
}

async function subirReporte(){
  const file = document.getElementById('fileReporte').files[0];
  if(!file){mostrarToast('Seleccione un archivo','warning');return;}
  const formData = new FormData();
  formData.append('file', file);
  try{
    const res = await fetch('/api/reportes', {method:'POST', body:formData});
    const data = await res.json();
    if(res.ok) mostrarToast('Reporte subido','success');
    else mostrarToast(data.error||'Error al subir','danger');
  }catch(e){mostrarToast('Error al subir reporte','danger');}
}

function descargarReporte(){
  window.open('/api/reportes/download','_blank');
}

function mostrarToast(mensaje,tipo='info'){
  const container=document.getElementById('toastContainer') || document.body;
  const toastId=`toast-${Date.now()}`;
  const toast=document.createElement('div');
  toast.className=`toast align-items-center text-bg-${tipo} border-0 mb-2 position-fixed top-0 end-0 p-3`;
  toast.id=toastId;
  toast.setAttribute('role','alert');
  toast.setAttribute('aria-live','assertive');
  toast.setAttribute('aria-atomic','true');
  toast.innerHTML=`<div class="d-flex"><div class="toast-body">${mensaje}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  container.appendChild(toast);
  new bootstrap.Toast(toast).show();
}

let chartReporte;

async function generarReporte(tipo){
  const res=await fetch(`/api/admin/reportes/${tipo}`);
  const data=await res.json();
  const ctx=document.getElementById('chartReporte').getContext('2d');
  if(chartReporte) chartReporte.destroy();
  chartReporte=new Chart(ctx,{type:'bar',data:{labels:data.labels,datasets:[{label:data.label,data:data.values,backgroundColor:'rgba(54, 162, 235, 0.7)'}]},options:{responsive:true}});
}

let idNotificacionEditando=null

function toast(msg,tipo="success"){
  const div=document.createElement("div")
  div.className="toast align-items-center text-bg-"+tipo+" border-0 toast-notificacion"
  div.innerHTML=`<div class="d-flex w-100">
    ${msg}
    <button type="button" class="btn-close btn-close-white ms-2 m-auto" data-bs-dismiss="toast"></button>
  </div>`
  document.getElementById("toastContainer").appendChild(div)
  new bootstrap.Toast(div).show()
}

function mostrarToastNotificacion(imagen,titulo,descripcion){
  const html=`<img src="${imagen||''}"><div class="flex-grow-1"><strong>${titulo||''}</strong><br>${descripcion||''}</div>`
  toast(html,'info')
}

document.getElementById("archivoNotificacion").addEventListener("change",e=>{
  const file=e.target.files[0]
  if(!file)return
  const r=new FileReader()
  r.onload=ev=>{
    document.getElementById("previewNotificacionImg").src=ev.target.result
    document.getElementById("previewNotificacion").style.display="block"
  }
  r.readAsDataURL(file)
})

function guardarIdioma(){
  const idioma=idiomaSistema.value
  fetch("/api/admin/configuracion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idioma})})
  .then(r=>r.json()).then(d=>{toast(d.msg);document.documentElement.lang=idioma})
}

function crearNotificacion(){
  const fileInput=document.getElementById("archivoNotificacion")
  const titulo=document.getElementById("tituloNotificacion").value
  const desc=document.getElementById("descNotificacion").value
  if(!titulo||!desc)return toast("Ingrese título y descripción","warning")
  const formData=new FormData()
  formData.append("archivo",fileInput.files[0]||"")
  formData.append("titulo",titulo)
  formData.append("descripcion",desc)
  fetch("/api/admin/notificaciones",{method:"POST",body:formData})
    .then(r=>r.json()).then(d=>{
      toast(d.msg)
      fileInput.value=""
      document.getElementById("previewNotificacion").style.display="none"
      document.getElementById("tituloNotificacion").value=""
      document.getElementById("descNotificacion").value=""
      cargarAlertas()
      mostrarToastNotificacion(d.imagen_url,d.titulo,d.descripcion)
    })
}

function cargarAlertas(){
  fetch("/api/admin/notificaciones").then(r=>r.json()).then(data=>{
    const cont=document.getElementById("contenedorAlertas")
    cont.innerHTML=""
    data.forEach(a=>{
      const div=document.createElement("div")
      div.className="alert alert-warning d-flex justify-content-between align-items-center"
      div.innerHTML=`
        <div class="d-flex align-items-center gap-3">
          <img src="${a.imagen_url || ''}" style="height:60px;width:60px;border-radius:6px;object-fit:cover">
          <div><strong>${a.titulo}</strong><br>${a.descripcion}</div>
        </div>
        <div>
          <button class="btn btn-sm btn-warning me-2" onclick="abrirModalEditar('${a.id_notificacion}','${a.imagen_url || ""}','${a.titulo}','${a.descripcion}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarAlerta('${a.id_notificacion}')">Eliminar</button>
        </div>`
      cont.appendChild(div)
    })
  })
}

function eliminarAlerta(id){
  fetch("/api/admin/notificaciones/"+id,{method:"DELETE"})
    .then(r=>r.json()).then(d=>{toast(d.msg);cargarAlertas()})
}

function abrirModalEditar(id,img,titulo,descripcion){
  idNotificacionEditando=id
  modalImgActual.src=img||""
  modalTitulo.value=titulo
  modalDescripcion.value=descripcion
  modalArchivoNuevo.value=""
  new bootstrap.Modal(document.getElementById("modalEditarNotificacion")).show()
}

function guardarEdicionNotificacion(){
  const formData=new FormData()
  formData.append("titulo",modalTitulo.value)
  formData.append("descripcion",modalDescripcion.value)
  if(modalArchivoNuevo.files[0]) formData.append("archivo",modalArchivoNuevo.files[0])
  fetch("/api/admin/notificaciones/"+idNotificacionEditando,{
    method:"PUT",
    body:formData
  }).then(r=>r.json()).then(d=>{
    toast(d.msg)
    cargarAlertas()
    bootstrap.Modal.getInstance(document.getElementById("modalEditarNotificacion")).hide()
  })
}

let carruselIndex=0,seccionIndex=0

function agregarCarrusel(imgUrl="",titulo="",desc=""){
  const container=document.getElementById("carruselContainer")
  const div=document.createElement("div")
  div.className="section-preview"
  div.dataset.index=carruselIndex
  div.innerHTML=`
    <div class="preview-img-box" style="display:${imgUrl?'block':'none'}">
      <img src="${imgUrl}">
    </div>
    <input type="file" class="form-control" onchange="previewInputImage(this);actualizarPreview()">
    <input type="text" class="form-control" placeholder="Título" value="${titulo}" onchange="actualizarPreview()">
    <input type="text" class="form-control" placeholder="Descripción" value="${desc}" onchange="actualizarPreview()">
    <button class="btn btn-danger btn-sm" onclick="eliminarSeccion(this)">Eliminar</button>
  `
  if(imgUrl)div.dataset.url=imgUrl
  container.appendChild(div)
  carruselIndex++
  actualizarPreview()
}

function agregarSeccion(imgUrl="",titulo="",desc=""){
  const container=document.getElementById("seccionesContainer")
  const div=document.createElement("div")
  div.className="section-preview"
  div.dataset.index=seccionIndex
  div.innerHTML=`
    <div class="preview-img-box" style="display:${imgUrl?'block':'none'}">
      <img src="${imgUrl}">
    </div>
    <input type="file" class="form-control" onchange="previewInputImage(this);actualizarPreview()">
    <input type="text" class="form-control" placeholder="Título" value="${titulo}" onchange="actualizarPreview()">
    <input type="text" class="form-control" placeholder="Descripción" value="${desc}" onchange="actualizarPreview()">
    <button class="btn btn-danger btn-sm" onclick="eliminarSeccion(this)">Eliminar</button>
  `
  if(imgUrl)div.dataset.url=imgUrl
  container.appendChild(div)
  seccionIndex++
  actualizarPreview()
}

function previewInputImage(input){
  const file=input.files[0]
  const box=input.parentElement.querySelector(".preview-img-box")
  const img=box.querySelector("img")
  if(!file){box.style.display="none";return}
  const r=new FileReader()
  r.onload=e=>{img.src=e.target.result;box.style.display="block"}
  r.readAsDataURL(file)
}

function eliminarSeccion(btn){
  btn.parentElement.remove()
  actualizarPreview()
}

function actualizarPreview(){
  const previewCarrusel=document.querySelector("#previewCarrusel .carousel-inner")
  const previewSecciones=document.getElementById("previewSecciones")
  const previewInfo=document.getElementById("previewInfo")
  previewCarrusel.innerHTML=""
  previewSecciones.innerHTML=""

  document.querySelectorAll("#carruselContainer .section-preview").forEach((div,i)=>{
    const imgInput=div.querySelector('input[type="file"]')
    const title=div.querySelectorAll('input')[1].value
    const desc=div.querySelectorAll('input')[2].value
    const item=document.createElement("div")
    item.className="carousel-item"+(i===0?" active":"")
    let imgTag=document.createElement("img")
    imgTag.className="d-block"
    if(imgInput.files[0]){
      const reader=new FileReader()
      reader.onload=()=>{imgTag.src=reader.result}
      reader.readAsDataURL(imgInput.files[0])
    }else if(div.dataset.url){
      imgTag.src=div.dataset.url
    }
    const caption=document.createElement("div")
    caption.className="carousel-caption-below"
    caption.innerHTML=`<strong>${title}</strong><br>${desc}`
    item.appendChild(imgTag)
    item.appendChild(caption)
    previewCarrusel.appendChild(item)
  })

  document.querySelectorAll("#seccionesContainer .section-preview").forEach(div=>{
    const wrapper=document.createElement("div")
    const imgInput=div.querySelector('input[type="file"]')
    const title=div.querySelectorAll('input')[1].value
    const desc=div.querySelectorAll('input')[2].value
    let imgTag=document.createElement("img")
    if(imgInput.files[0]){
      const reader=new FileReader()
      reader.onload=()=>{imgTag.src=reader.result;wrapper.appendChild(imgTag)}
      reader.readAsDataURL(imgInput.files[0])
    }else if(div.dataset.url){
      imgTag.src=div.dataset.url
      wrapper.appendChild(imgTag)
    }
    if(title||desc){
      const divText=document.createElement("div")
      divText.innerHTML=`<strong>${title}</strong><br>${desc}`
      wrapper.appendChild(divText)
    }
    previewSecciones.appendChild(wrapper)
  })

  previewInfo.textContent=document.getElementById("infoInicio").value
}

function guardarMarketing(updateOnly=false){
  const formData=new FormData()
  document.querySelectorAll("#carruselContainer .section-preview").forEach((div,i)=>{
    const file=div.querySelector('input[type="file"]').files[0]
    if(file||!updateOnly)formData.append(`carrusel[${i}][imagen]`,file||"")
    formData.append(`carrusel[${i}][titulo]`,div.querySelectorAll('input')[1].value)
    formData.append(`carrusel[${i}][descripcion]`,div.querySelectorAll('input')[2].value)
  })
  document.querySelectorAll("#seccionesContainer .section-preview").forEach((div,i)=>{
    const file=div.querySelector('input[type="file"]').files[0]
    if(file||!updateOnly)formData.append(`secciones[${i}][imagen]`,file||"")
    formData.append(`secciones[${i}][titulo]`,div.querySelectorAll('input')[1].value)
    formData.append(`secciones[${i}][descripcion]`,div.querySelectorAll('input')[2].value)
  })
  formData.append("info_inicio",document.getElementById("infoInicio").value)
  fetch("/api/admin/marketing",{method:"POST",body:formData})
    .then(r=>r.json()).then(d=>{toast(d.msg);actualizarPreviewsBackend()})
}

function actualizarPreviewsBackend(){
  fetch("/api/inicio/imagenes").then(r=>r.json()).then(data=>{
    document.getElementById("carruselContainer").innerHTML=""
    document.getElementById("seccionesContainer").innerHTML=""
    data.carrusel.forEach(c=>agregarCarrusel(c.imagen,c.titulo,c.descripcion))
    data.secciones.forEach(s=>agregarSeccion(s.imagen,s.titulo,s.descripcion))
    document.getElementById("infoInicio").value=data.info_inicio||""
    actualizarPreview()
  })
}

document.addEventListener("DOMContentLoaded",()=>{
  cargarAlertas()
  actualizarPreviewsBackend()
})
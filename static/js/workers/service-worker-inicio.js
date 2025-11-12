const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const mensajeInput = document.getElementById("mensajeInput");
const toastContainer = document.getElementById('toastContainer');
let comentarioAbierto = null;
let editandoComentario = null;
const usuario = {id_usuario: window.userId};

function showMessage(msg, isError=false){
    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-bg-light border-0';
    toastEl.setAttribute('role','alert');
    toastEl.setAttribute('aria-live','assertive');
    toastEl.setAttribute('aria-atomic','true');
    toastEl.innerHTML = `<div class="d-flex"><div class="toast-body">${isError?'❌':'✅'} ${msg}</div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    toastContainer.appendChild(toastEl);
    new bootstrap.Toast(toastEl,{delay:800}).show();
}

function bloquearAcciones(){
    document.querySelectorAll("button, input, textarea").forEach(el => el.disabled = true);
}

function renderComentario(c){
    const div = document.createElement("div");
    div.classList.add("message", "position-relative");
    div.dataset.id = c.id;
    div.dataset.usuario = c.id_usuario;
    const fotoPerfil = c.usuario_info?.foto_perfil;
    const nombreUsuario = c.usuario_info?.nombre_usuario || 'Usuario';
    const telefono = c.usuario_info?.telefono || 'N/A';
    const correo = c.usuario_info?.correo || 'N/A';
    let imgHtml = '';
    if(fotoPerfil){
        imgHtml = `<img src="${fotoPerfil}" alt="perfil" class="rounded-circle me-2 foto-click" 
            style="width:40px;height:40px;object-fit:cover;cursor:pointer;">`;
    }
    div.innerHTML = `
        <div class="d-flex align-items-start">
            ${imgHtml}
            <div class="message-content flex-grow-1">
                <div class="message-header d-flex justify-content-between">
                    <span class="username fw-bold">${nombreUsuario}</span>
                    <span class="time text-muted small" style="margin-left:4px;">
                        ${new Date(c.created_at).toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </span>
                </div>
                <div class="mensaje-texto">${c.mensaje}</div>
            </div>
        </div>
    `;
    if(c.id_usuario === usuario.id_usuario){
        const dots = document.createElement("i");
        dots.className = "bi bi-three-dots-vertical fw-bold";
        dots.style.cursor = "pointer";
        dots.style.position = "absolute";
        dots.style.top = "10px";
        dots.style.right = "10px";
        dots.style.fontSize = "1.5rem";
        dots.style.transition = "transform 0.2s ease";
        dots.addEventListener("mouseenter",()=>dots.style.transform="scale(1.2)");
        dots.addEventListener("mouseleave",()=>dots.style.transform="scale(1)");
        div.appendChild(dots);

        dots.addEventListener("click",(e)=>{
            e.stopPropagation();
            document.querySelectorAll("body > .comentario-dropdown").forEach(dd=>dd.remove());
            const dropdown = document.createElement("ul");
            dropdown.className = "list-group position-absolute bg-white shadow rounded comentario-dropdown";
            dropdown.style.position = "absolute";
            dropdown.style.zIndex = "99999";
            dropdown.innerHTML = `
                <li class="list-group-item p-2" style="cursor:pointer;" onclick="iniciarEdicion('${c.id}','${c.mensaje.replace(/'/g,"\\'")}');this.closest('ul').remove();">✏️ Editar</li>
                <li class="list-group-item p-2 text-danger" style="cursor:pointer;" onclick="eliminarComentario('${c.id}');this.closest('ul').remove();">🗑️ Eliminar</li>
            `;
            document.body.appendChild(dropdown);
            const rect = dots.getBoundingClientRect();
            dropdown.style.top = `${rect.bottom + window.scrollY}px`;
            dropdown.style.left = `${rect.left + window.scrollX - dropdown.offsetWidth + 25}px`;
            const closeDropdown = (ev)=>{
                if(!dropdown.contains(ev.target) && ev.target!==dots){
                    dropdown.remove();
                    document.removeEventListener("click", closeDropdown);
                }
            };
            document.addEventListener("click", closeDropdown);
        });
    }
    const imgEl = div.querySelector(".foto-click");
    if(imgEl){
        imgEl.addEventListener("click", ()=>{
            const modalHtml = `
                <div class="modal fade" id="perfilModal" tabindex="-1">
                  <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content p-3">
                      <img src="${fotoPerfil}" alt="perfil-grande" class="img-fluid rounded mb-3">
                      <div class="card p-3">
                        <h5 class="mb-2">${nombreUsuario}</h5>
                        <p class="mb-1"><strong>Teléfono:</strong> ${telefono}</p>
                        <p class="mb-0"><strong>Correo:</strong> ${correo}</p>
                      </div>
                    </div>
                  </div>
                </div>`;
            document.body.insertAdjacentHTML("beforeend", modalHtml);
            const modal = new bootstrap.Modal(document.getElementById("perfilModal"));
            modal.show();
            document.getElementById("perfilModal").addEventListener("hidden.bs.modal", function(){
                this.remove();
            });
        });
    }
    return div;
}

async function cargarComentarios(){
    try{
        const cached = localStorage.getItem('chatCache');
        if(cached){
            const data = JSON.parse(cached);
            chatBox.innerHTML = "";
            data.forEach(c => chatBox.appendChild(renderComentario(c)));
        }

        const res = await fetch("/comentarios");
        if(res.status===401 || res.status===403){
            showMessage("Inicie Sesión para ver comentarios", true);
            bloquearAcciones();
            return;
        }
        const data = await res.json();
        localStorage.setItem('chatCache', JSON.stringify(data));
        chatBox.innerHTML = "";
        data.forEach(c => chatBox.appendChild(renderComentario(c)));

        const scrollPos = localStorage.getItem('chatScroll');
        chatBox.scrollTop = scrollPos ? parseInt(scrollPos) : chatBox.scrollHeight;
    }catch(error){
        showMessage("Error al cargar comentarios",true);
    }
}

function iniciarEdicion(id,mensaje){
    mensajeInput.value = mensaje;
    editandoComentario = id;
    sendBtn.textContent = "Guardar Cambios";
    mensajeInput.focus();
}

sendBtn.addEventListener("click", async()=>{
    const mensaje = mensajeInput.value.trim();
    if(!mensaje) return;
    try{
        if(editandoComentario){
            const res = await fetch(`/comentarios/${editandoComentario}`,{
                method:"PUT",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({mensaje})
            });
            if(res.ok) showMessage("Comentario Editado");
            editandoComentario = null;
            sendBtn.textContent = "Enviar Sugerencia";
        } else {
            const res = await fetch("/comentarios",{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({mensaje})
            });
            if(res.ok) showMessage("Comentario Publicado");
        }
        mensajeInput.value = "";
        cargarComentarios();
    }catch(error){
        showMessage("Error enviando comentario",true);
    }
});

async function eliminarComentario(id){
    try{
        const res = await fetch(`/comentarios/${id}`,{method:"DELETE"});
        if(res.ok){
            showMessage("Comentario eliminado");
            cargarComentarios();
        }
    }catch(error){
        showMessage("Error eliminando comentario",true);
    }
}

window.addEventListener('beforeunload', ()=>{
    localStorage.setItem('chatScroll', chatBox.scrollTop);
});

cargarComentarios();

if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
        navigator.serviceWorker.register('/service-worker.js');
    });
}
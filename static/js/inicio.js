const toastContainer = document.getElementById("toastContainer");

function showMessage(msg, isError=false){
    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-bg-light border-0';
    toastEl.setAttribute('role','alert');
    toastEl.setAttribute('aria-live','assertive');
    toastEl.setAttribute('aria-atomic','true');
    toastEl.innerHTML = `<div class="d-flex">
        <div class="toast-body">${isError?'❌':'✅'} ${msg}</div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
    toastContainer.appendChild(toastEl);
    new bootstrap.Toast(toastEl, {delay: 2000}).show();
}

function promocionActiva(titulo){
    showMessage(`Promoción activa: ${titulo}`);
}

document.addEventListener('DOMContentLoaded', () => {
    const firstPromo = document.querySelector('.card-body h5');
    if(firstPromo) promocionActiva(firstPromo.textContent);
});
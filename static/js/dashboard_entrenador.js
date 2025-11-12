document.addEventListener('DOMContentLoaded', () => {
    mostrarClasesHoy();
    mostrarAlertas();
    generarGraficaAsistencia();
});

function mostrarClasesHoy() {
    const clasesHoy = ["Yoga - 8:00 AM", "Crossfit - 10:00 AM", "Spinning - 6:00 PM"];
    const clasesHoyUl = document.getElementById("clasesHoy");
    clasesHoyUl.innerHTML = "";
    clasesHoy.forEach(c => {
        const li = document.createElement("li");
        li.textContent = c;
        clasesHoyUl.appendChild(li);
    });
}

function mostrarAlertas() {
    const alertas = ["Pago vencido: Juan Pérez", "Clase cancelada: Spinning 6:00 PM"];
    const alertasDiv = document.getElementById("alertas");
    alertasDiv.innerHTML = "";
    alertas.forEach(a => {
        const div = document.createElement("div");
        div.className = "alert alert-danger alert-box";
        div.textContent = a;
        alertasDiv.appendChild(div);
    });
}

function generarGraficaAsistencia() {
    const asistenciaData = {
        labels: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
        datasets: [{
            label: "Asistencia diaria",
            data: [50, 45, 60, 55, 70, 40, 30],
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1
        }]
    };
    const ctx = document.getElementById("asistenciaChart").getContext("2d");
    new Chart(ctx, { type: "bar", data: asistenciaData, options: { responsive: true, scales: { y: { beginAtZero: true } } } });
}

function guardarClase() {
    const nombre = document.getElementById("nombreClase").value;
    const inicio = document.getElementById("inicioClase").value;
    const fin = document.getElementById("finClase").value;
    const capacidad = document.getElementById("capacidadClase").value;
    const tabla = document.getElementById("tablaClases");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${nombre}</td><td>${inicio}</td><td>${fin}</td><td>${capacidad}</td><td>0</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editarClase(this)">Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarClase(this)">Eliminar</button>
                    </td>`;
    tabla.appendChild(tr);
    const modalBootstrap = bootstrap.Modal.getInstance(document.getElementById('modalClase'));
    modalBootstrap.hide();
    document.getElementById("nombreClase").value = "";
    document.getElementById("inicioClase").value = "";
    document.getElementById("finClase").value = "";
    document.getElementById("capacidadClase").value = "";
}

function editarClase(btn) {
    const tr = btn.closest("tr");
    document.getElementById("nombreClase").value = tr.children[0].textContent;
    document.getElementById("inicioClase").value = tr.children[1].textContent;
    document.getElementById("finClase").value = tr.children[2].textContent;
    document.getElementById("capacidadClase").value = tr.children[3].textContent;
    const modalBootstrap = new bootstrap.Modal(document.getElementById('modalClase'));
    modalBootstrap.show();
    tr.remove();
}

function eliminarClase(btn) {
    btn.closest("tr").remove();
}

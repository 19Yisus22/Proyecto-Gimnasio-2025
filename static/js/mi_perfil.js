const btnEditar = document.getElementById('btnEditarPerfil');
const btnGuardar = document.getElementById('btnGuardarPerfil');
const btnCancelar = document.getElementById('btnCancelar');
const formPerfil = document.getElementById('formPerfil');
const inputs = formPerfil.querySelectorAll('input:not([type=file]):not([type=password]), select, textarea');
const imagenInput = document.getElementById('imagen_url');
const previewImg = document.getElementById('previewImagen');

let datosOriginales = {};
let userId = null;

async function cargarDatosUsuario() {
    try {
        const res = await fetch('/api/usuario/perfil');
        const result = await res.json();
        
        if (result.success && result.user) {
            const user = result.user;
            userId = user.id_usuario;
            
            document.getElementById('cedulaPerfil').value = user.cedula || '';
            document.getElementById('nombrePerfil').value = user.nombre || '';
            document.getElementById('apellidoPerfil').value = user.apellido || '';
            document.getElementById('generoPerfil').value = user.genero || '';
            document.getElementById('telefonoPerfil').value = user.telefono || '';
            document.getElementById('correoPerfil').value = user.correo || '';
            document.getElementById('direccionPerfil').value = user.direccion || '';
            document.getElementById('fechaNacimientoPerfil').value = user.fecha_nacimiento || '';
            document.getElementById('metodoPagoPerfil').value = user.metodo_pago || 'Efectivo';
            
            if (user.imagen_url) {
                previewImg.src = user.imagen_url;
            }
            
            guardarDatosOriginales();
        } else {
            alert('Error al cargar datos del usuario');
        }
    } catch (err) {
        console.error(err);
        alert('Error al conectar con el servidor');
    }
}

function guardarDatosOriginales() {
    inputs.forEach(input => {
        datosOriginales[input.name] = input.value;
    });
    datosOriginales.imagenSrc = previewImg.src;
}

function restaurarDatosOriginales() {
    inputs.forEach(input => {
        input.value = datosOriginales[input.name] || '';
    });
    previewImg.src = datosOriginales.imagenSrc;
    imagenInput.value = '';
}

previewImg.addEventListener('click', () => {
    if (!imagenInput.disabled) {
        imagenInput.click();
    }
});

imagenInput.addEventListener('change', e => {
    const archivo = e.target.files[0];
    document.getElementById('errorImagen').textContent = '';
    imagenInput.classList.remove('is-invalid');
    
    if (archivo) {
        const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png'];
        const tamañoMax = 5 * 1024 * 1024;
        
        if (!tiposPermitidos.includes(archivo.type)) {
            document.getElementById('errorImagen').textContent = 'Solo se permiten archivos JPG, JPEG o PNG';
            imagenInput.classList.add('is-invalid');
            imagenInput.value = '';
            return;
        }
        
        if (archivo.size > tamañoMax) {
            document.getElementById('errorImagen').textContent = 'La imagen no puede superar 5MB';
            imagenInput.classList.add('is-invalid');
            imagenInput.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = ev => { previewImg.src = ev.target.result; }
        reader.readAsDataURL(archivo);
    }
});

function limpiarErrores() {
    document.querySelectorAll('.text-danger').forEach(el => el.textContent = '');
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

function validarCedula(cedula) {
    const regex = /^\d{6,15}$/;
    if (!cedula) return 'La cédula es obligatoria';
    if (!regex.test(cedula)) return 'La cédula debe contener entre 6 y 15 dígitos';
    return '';
}

function validarNombre(nombre) {
    const regex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
    if (!nombre) return 'El nombre es obligatorio';
    if (!regex.test(nombre)) return 'El nombre solo puede contener letras (2-50 caracteres)';
    return '';
}

function validarApellido(apellido) {
    const regex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
    if (!apellido) return 'El apellido es obligatorio';
    if (!regex.test(apellido)) return 'El apellido solo puede contener letras (2-50 caracteres)';
    return '';
}

function validarTelefono(telefono) {
    const regex = /^\d{10}$/;
    if (telefono && !regex.test(telefono)) return 'El teléfono debe tener exactamente 10 dígitos';
    return '';
}

function validarCorreo(correo) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correo) return 'El correo es obligatorio';
    if (!regex.test(correo)) return 'El formato del correo no es válido';
    return '';
}

function validarDireccion(direccion) {
    if (!direccion) return 'La dirección es obligatoria';
    if (direccion.length < 10) return 'La dirección debe tener al menos 10 caracteres';
    if (direccion.length > 200) return 'La dirección no puede superar 200 caracteres';
    return '';
}

function validarFechaNacimiento(fecha) {
    if (fecha) {
        const fechaNac = new Date(fecha);
        const hoy = new Date();
        let edad = hoy.getFullYear() - fechaNac.getFullYear();
        const mes = hoy.getMonth() - fechaNac.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
            edad--;
        }
        if (edad < 12) return 'Debe tener al menos 12 años';
        if (edad > 120) return 'Fecha de nacimiento no válida';
    }
    return '';
}

function validarFormulario() {
    limpiarErrores();
    let valido = true;
    
    const validaciones = [
        { campo: 'cedulaPerfil', funcion: validarCedula, error: 'errorCedula' },
        { campo: 'nombrePerfil', funcion: validarNombre, error: 'errorNombre' },
        { campo: 'apellidoPerfil', funcion: validarApellido, error: 'errorApellido' },
        { campo: 'telefonoPerfil', funcion: validarTelefono, error: 'errorTelefono' },
        { campo: 'correoPerfil', funcion: validarCorreo, error: 'errorCorreo' },
        { campo: 'direccionPerfil', funcion: validarDireccion, error: 'errorDireccion' },
        { campo: 'fechaNacimientoPerfil', funcion: validarFechaNacimiento, error: 'errorFechaNacimiento' }
    ];
    
    validaciones.forEach(v => {
        const input = document.getElementById(v.campo);
        const errorMsg = v.funcion(input.value);
        if (errorMsg) {
            document.getElementById(v.error).textContent = errorMsg;
            input.classList.add('is-invalid');
            valido = false;
        }
    });
    
    const metodoPago = document.getElementById('metodoPagoPerfil');
    if (!metodoPago.value) {
        document.getElementById('errorMetodoPago').textContent = 'Debe seleccionar un método de pago';
        metodoPago.classList.add('is-invalid');
        valido = false;
    }
    
    return valido;
}

btnEditar.addEventListener('click', () => {
    inputs.forEach(i => i.disabled = false);
    imagenInput.disabled = false;
    btnEditar.style.display = 'none';
    btnGuardar.style.display = 'inline-block';
    btnCancelar.style.display = 'inline-block';
    document.getElementById('cedulaPerfil').disabled = true;
});

btnCancelar.addEventListener('click', () => {
    restaurarDatosOriginales();
    limpiarErrores();
    inputs.forEach(i => i.disabled = true);
    imagenInput.disabled = true;
    btnGuardar.style.display = 'none';
    btnCancelar.style.display = 'none';
    btnEditar.style.display = 'inline-block';
});

formPerfil.addEventListener('submit', async e => {
    e.preventDefault();
    
    if (!validarFormulario()) {
        return;
    }
    
    const formData = new FormData();
    
    formData.append('nombre', document.getElementById('nombrePerfil').value);
    formData.append('apellido', document.getElementById('apellidoPerfil').value);
    formData.append('genero', document.getElementById('generoPerfil').value);
    formData.append('telefono', document.getElementById('telefonoPerfil').value);
    formData.append('correo', document.getElementById('correoPerfil').value);
    formData.append('direccion', document.getElementById('direccionPerfil').value);
    formData.append('fecha_nacimiento', document.getElementById('fechaNacimientoPerfil').value);
    formData.append('metodo_pago', document.getElementById('metodoPagoPerfil').value);
    
    if (imagenInput.files.length > 0) {
        formData.append('imagen_url', imagenInput.files[0]);
    }
    
    try {
        const res = await fetch('/api/usuario/actualizar', {
            method: 'PUT',
            body: formData
        });
        
        const result = await res.json();
        
        if (result.success) {
            alert('Perfil actualizado correctamente');
            inputs.forEach(i => i.disabled = true);
            imagenInput.disabled = true;
            btnGuardar.style.display = 'none';
            btnCancelar.style.display = 'none';
            btnEditar.style.display = 'inline-block';
            
            if (result.user.imagen_url) {
                previewImg.src = result.user.imagen_url;
            }
            
            guardarDatosOriginales();
        } else {
            alert(result.message || 'Error al actualizar perfil');
        }
    } catch (err) {
        console.error(err);
        alert('Error en la conexión con el servidor');
    }
});

document.getElementById('btnCambiarContrasena').addEventListener('click', async () => {
    const nueva = document.getElementById('nuevaContrasena').value;
    const confirmar = document.getElementById('confirmarContrasena').value;
    
    limpiarErrores();
    
    let valido = true;
    
    if (!nueva) {
        document.getElementById('errorContrasena').textContent = 'Ingrese una nueva contraseña';
        document.getElementById('nuevaContrasena').classList.add('is-invalid');
        valido = false;
    } else if (nueva.length < 6) {
        document.getElementById('errorContrasena').textContent = 'La contraseña debe tener al menos 6 caracteres';
        document.getElementById('nuevaContrasena').classList.add('is-invalid');
        valido = false;
    }
    
    if (!confirmar) {
        document.getElementById('errorConfirmar').textContent = 'Confirme la contraseña';
        document.getElementById('confirmarContrasena').classList.add('is-invalid');
        valido = false;
    } else if (nueva !== confirmar) {
        document.getElementById('errorConfirmar').textContent = 'Las contraseñas no coinciden';
        document.getElementById('confirmarContrasena').classList.add('is-invalid');
        valido = false;
    }
    
    if (!valido) return;
    
    try {
        const res = await fetch('/api/usuario/cambiar_contrasena', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contrasena: nueva })
        });
        
        const result = await res.json();
        
        if (result.success) {
            alert('Contraseña cambiada correctamente');
            document.getElementById('nuevaContrasena').value = '';
            document.getElementById('confirmarContrasena').value = '';
        } else {
            alert(result.message || 'Error al cambiar la contraseña');
        }
    } catch (err) {
        console.error(err);
        alert('Error en la conexión con el servidor');
    }
});

cargarDatosUsuario();
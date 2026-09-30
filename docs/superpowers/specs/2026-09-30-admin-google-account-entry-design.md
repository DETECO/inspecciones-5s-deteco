# Entrada al panel 5S con cuenta Google Workspace

## Objetivo

Evitar que alguien llegue a una página genérica de error de Google Drive al abrir Administración sin una sesión Google Workspace adecuada. Orientar al usuario para iniciar sesión o cambiar de cuenta y explicar claramente que las cuentas que no pertenecen a DETECO no tienen acceso.

## Diseño aprobado

- El enlace Administración abre el selector oficial de cuentas Google y conserva como destino el panel Apps Script de DETECO. El selector debe permitir continuar con una cuenta ya abierta, agregar/iniciar otra cuenta y volver al panel.
- El panel mantiene la autorización actual del servidor y su lista de administradores. Tener una cuenta `@deteco.cl` no concede acceso automáticamente: la cuenta además debe estar habilitada en el registro administrativo.
- Si Google Apps Script no reconoce una sesión Workspace DETECO, el panel muestra una explicación con dos acciones: **Iniciar o cambiar cuenta** y **Volver a comprobar acceso**.
- Si la cuenta activa es externa al dominio corporativo, el aviso explica que no puede acceder y que debe cambiar a una cuenta `@deteco.cl` autorizada.
- Si la cuenta pertenece a DETECO pero no está habilitada en el registro, se informa que debe solicitar autorización al administrador.
- Los QR de inspección y el acceso de inspectores no cambian. No se les exige cuenta Google.

## Opciones consideradas

1. Abrir directamente Apps Script y depender del error predeterminado de Google. No da guía suficiente y puede producir la pantalla de Drive observada.
2. Mostrar el selector de cuentas como paso previo y presentar mensajes claros dentro del panel. Recomendada y aprobada: mantiene la validación de Google y de la lista existente, sin añadir autenticación propia.
3. Crear autenticación independiente para el panel. Se descarta por complejidad y por duplicar los controles de acceso existentes.

## Flujo y errores

1. El usuario pulsa Administración.
2. Google solicita elegir, agregar o iniciar una cuenta y continúa al panel.
3. El panel consulta el correo de sesión y valida dominio y permisos registrados.
4. Si falla, muestra un estado legible y acciones para cambiar la cuenta o reintentar, conservando intactos los controles del servidor.

Mensaje para cuenta sin sesión reconocible o externa:

> No se reconoció una sesión Google Workspace de DETECO. Este panel es solo para cuentas `@deteco.cl` autorizadas. Inicia sesión o cambia a una cuenta DETECO y vuelve a comprobar el acceso.

Mensaje para cuenta DETECO no habilitada:

> Tu cuenta DETECO todavía no tiene acceso al panel. Solicita al administrador que la habilite.

## Seguridad y alcance

- Nunca se conceden permisos desde el selector ni desde la interfaz; el servidor sigue verificando el correo de sesión y la tabla de administradores en cada operación.
- El panel no revela ni cambia credenciales, configuración de Drive o permisos del Sheet.
- No se modifican el escáner, los QR, las inspecciones ni el flujo de los inspectores.

## Verificación

- Probar selector con sesión iniciada, sin sesión y con más de una cuenta.
- Probar en el panel: administrador habilitado, cuenta DETECO no habilitada y sesión ausente/externa.
- Confirmar que las cuentas no autorizadas no pueden consultar estaciones, Kaizen, fotos ni ejecutar acciones administrativas.
- Verificar el comportamiento en navegador móvil y escritorio, y publicar solo luego de pasar las pruebas automatizadas.

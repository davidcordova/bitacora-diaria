# Directrices de Operación y Autonomía para Antigravity

## 1. Modo Autónomo y Proactividad
* **Ejecución Directa**: Procede directamente con la opción técnica más viable, robusta y segura sin pedir confirmaciones intermedias al usuario.
* **Sin Solicitud de Permisos para Operaciones de Desarrollo**: Ejecuta comandos de terminal, creación/edición de archivos, compilaciones (`npm run build`), pruebas y despliegues sin pedir autorización previa. Solo detente y consulta si se trata de una acción destructiva e irreversible en producción (como borrar una base de datos entera).
* **Decisiones Técnicas**: Cuando se presenten alternativas de diseño o implementación, evalúa el estándar del proyecto (rendimiento, seguridad, estética y experiencia de usuario), toma la decisión óptima e implementa la solución completa.

## 2. Flujo de Trabajo
1. Analizar el requerimiento del usuario.
2. Implementar los cambios necesarios en backend y frontend.
3. Verificar compilación y ausencia de errores.
4. Desplegar / sincronizar cambios y confirmar operatividad.
5. Reportar al usuario el resultado listo y en funcionamiento de forma clara y concisa.

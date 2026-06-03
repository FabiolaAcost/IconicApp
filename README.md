# Clinica Consentimientos

Aplicacion web para completar consentimientos informados, capturar firma del paciente y generar PDFs finales sobre plantillas existentes.

## Requisitos

- Node.js
- npm
- Android Studio, solo si se va a generar APK con Capacitor

## Instalacion

```bash
npm install
```

## Desarrollo local

```bash
npm start
```

El servidor publica la carpeta `www/`. La aplicacion carga las plantillas PDF desde `www/assets/` y la configuracion de tratamientos desde `www/config/tratamientos.json`.

## Flujo principal

1. Seleccionar tipo de consentimiento.
2. Visualizar y confirmar lectura del PDF base.
3. Ingresar datos del paciente.
4. Capturar firma en pantalla.
5. Generar el PDF final con `pdf-lib`.
6. Guardar el registro en el historial local del navegador.

## Estructura relevante

- `www/index.html`: pantalla principal de la aplicacion.
- `www/js/app.js`: flujo de pantallas, formulario, historial y descarga.
- `www/js/pdf-generator.js`: insercion de datos y firmas en las plantillas PDF.
- `www/js/signature.js`: captura de firma en canvas.
- `www/js/storage.js`: persistencia local de consentimientos.
- `www/assets/`: PDFs base y firma de doctora.
- `www/config/tratamientos.json`: doctora y lista de tratamientos.

## Generar APK

Cuando se requiera empaquetar para Android:

```bash
npx cap add android
npx cap copy android
npx cap open android
```

Desde Android Studio se puede compilar y firmar el APK/AAB. Los proyectos nativos y artefactos generados quedan fuera de Git mediante `.gitignore`.

## Archivos ignorados

No se versionan dependencias, salidas de build, proyectos nativos generados, APK/AAB, llaves de firma, archivos temporales ni PDFs de debug como `coord_debug/`.

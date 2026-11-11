# ModuPlant · Catálogo editable

Catálogo editable local de ModuPlant con 100 fichas, 300 fotos e iconos del directorio de Green Digital. La portada, las fichas y el editor comparten la identidad visual de ModuPlant.

## Arrancar

Requiere Node.js 22 y npm.

```bash
cd dev/moduplant
npm ci
npm run dev
```

Abre el [catálogo local](http://127.0.0.1:8780/) o la [ficha de Adelfa](http://127.0.0.1:8780/plantas/nerium-oleander). Activa **Modo administrador** y pulsa **Editar ficha**.

- **Ficha** permite cambiar los nombres, la introducción, la categoría, la visibilidad y el consejo de cultivo.
- **Contenido** agrupa los cuidados, las características botánicas, los problemas, las precauciones y las preguntas frecuentes presentes en cada ficha.
- **Fotos** permite reemplazar las imágenes por archivos JPG, PNG o WebP y elegir la portada.
- **Bloques** permite añadir campos de texto, títulos, secciones y módulos destacados. Aparecen antes de las fuentes.

La selección atlántica reúne Camelia y Hortensia con consejos iniciales de cultivo y sus fuentes. Cada ficha admite un consejo propio.

**Guardar cambios** actualiza la ficha, la tarjeta y el buscador en la demo. **Ver como visitante** muestra el resultado sin los controles de edición. **Restaurar ficha original** recupera los datos y fotos de la copia inicial.

El modo administrador simula el rol de WordPress. Con `npm run dev`, las personalizaciones se guardan en `.local/edits.json` en este equipo. En Vercel, cada navegador conserva sus personalizaciones y fotos en IndexedDB. Los favoritos se guardan en el navegador.

La copia de las fichas y las tarjetas está en `directory/`. Los recursos públicos están en `public/directory/`. El prototipo previo de React se conserva en `src/` y sus pruebas en `tests/`.

`npm run build` exporta la portada y las 100 fichas completas a `dist/`, junto con los recursos y la aplicación que resuelve búsqueda, filtros y edición directamente en el navegador. `vercel.json` configura el despliegue desde `main` usando ese comando y esa carpeta. Las URLs de las fichas pueden abrirse directamente.

`npm run test:hosted` verifica la exportación de todas las fichas y la persistencia de textos, fotos, bloques y modo de edición después de volver a cargar la aplicación.

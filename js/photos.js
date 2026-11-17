// Foto verkleinern (max. 1600 px Kantenlänge) und als JPEG-Data-URL liefern.
// Als Text gespeichert, damit das Backup (JSON) die Fotos direkt enthält.
const MAX = 1600;

export async function resizePhoto(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return canvas.toDataURL('image/jpeg', 0.85);
}

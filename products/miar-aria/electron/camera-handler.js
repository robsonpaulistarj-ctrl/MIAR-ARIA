/**
 * MIAR ÁRIA — Camera Handler
 * Captura imagens da câmera (webcam) para a IA "ver".
 * Usa a Web Camera API do Electron via navigator.mediaDevices (no renderer)
 * ou captura via screenshot para fallback.
 */

/**
 * Gera uma lista de dispositivos de câmera disponíveis no sistema.
 */
async function getCameras() {
  // No Electron, usamos o IPC para obter da renderer ou retornamos info genérica
  return { ok: true, message: 'Use captureFromRenderer para capturar via câmera' };
}

module.exports = { getCameras };

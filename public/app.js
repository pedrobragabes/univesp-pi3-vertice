const connectionBadge = document.querySelector('[data-connection]');
const locationButton = document.querySelector('[data-location-button]');
const locationStatus = document.querySelector('[data-location-status]');

function updateConnection() {
  if (!connectionBadge) return;
  connectionBadge.textContent = navigator.onLine ? 'Online' : 'Sem conexão';
  connectionBadge.dataset.state = navigator.onLine ? 'online' : 'offline';
}

updateConnection();
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {
    if (connectionBadge) connectionBadge.title = 'O modo offline não pôde ser preparado.';
  }));
}

locationButton?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    locationStatus.textContent = 'Geolocalização não disponível neste navegador.';
    return;
  }
  locationButton.disabled = true;
  locationStatus.textContent = 'Obtendo posição…';
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      document.querySelector('[name="latitude"]').value = coords.latitude.toFixed(6);
      document.querySelector('[name="longitude"]').value = coords.longitude.toFixed(6);
      locationStatus.textContent = `Posição adicionada com precisão aproximada de ${Math.round(coords.accuracy)} m. Confira antes de enviar.`;
      locationButton.disabled = false;
    },
    () => {
      locationStatus.textContent = 'Não foi possível obter a posição. O preenchimento continua opcional.';
      locationButton.disabled = false;
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
  );
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('https://192.168.222.15:3000/service-worker.js')
      .then(registration => {
          console.log('Service Worker registered:', registration);
      })
      .catch(error => {
          console.error('Service Worker registration failed:', error);
      });
}
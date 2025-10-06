const vapidPublicKey = `BG9UECCi5ZjzsRRQg5E7Jbqsn-H_pZJlSVh78x-OmmoI_Vh8Z2wohWdSsv-MCzxAuGXuKZNS5hJ7bq0pdpIS4_E`;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isPushManagerActive(pushManager) {
  if (!pushManager) {
    console.warn('PushManager is not available');
    return false;
  }
  return true;
}

async function initServiceWorker() {
  try {
    const swRegistration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    const pushManager = swRegistration.pushManager;

    if (!isPushManagerActive(pushManager)) {
      return;
    }

    const permissionState = await pushManager.permissionState({ userVisibleOnly: true });

    switch (permissionState) {
      case 'prompt': // Разрешение на push-уведомления пока не дано
        return 'prompt';
      case 'granted': { // Разрешение на push-уведомления дано
        const existingSubscription = await pushManager.getSubscription();
        if (existingSubscription) {
          await sendSubscriptionToServer(existingSubscription);
        }
        return 'granted';
      }
      case 'denied': // Пользователь отказал в разрешении push-уведомлений
        return 'denied';
    }
  } catch (error) {
    console.error('Service Worker initialization error:', error);
    return 'error';
  }
}

async function subscribeToPush() {
  if (!vapidPublicKey) {
    console.error('VAPID key is not configured');
    return;
  }

  try {
    const swRegistration = await navigator.serviceWorker.ready;
    const pushManager = swRegistration.pushManager;

    if (!isPushManagerActive(pushManager)) {
      return;
    }

    const subscriptionOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    };

    const subscription = await pushManager.subscribe(subscriptionOptions);
    
    await sendSubscriptionToServer(subscription);
    return true;
  } catch (error) {
    console.error('Push subscription error:', error);
    return false;
  }
}

async function sendSubscriptionToServer(subscription) {
  try {
    const subscriptionJson = subscription.toJSON();

    if (!subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth || !subscriptionJson.endpoint) {
      throw new Error('Отсутствуют необходимые данные подписки');
    }

    const subscriptionInfo = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscriptionJson.keys.p256dh,
        auth: subscriptionJson.keys.auth,
      },
    };

    const response = await fetch('/web-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriptionInfo),
    });
    
  } catch (error) {
    console.error('Server subscription error:', error);
    throw error;
  }
}



// Запуск при загрузке страницы
if (navigator.serviceWorker && 'PushManager' in window) {
  initServiceWorker().then((state) => {
    if (state === 'prompt') {
      // Показываем UI компонент для запроса разрешения на уведомления который при нажатии будет вызывать нашу функцию `subscribeToPush()`
    }
  });
} else {
  console.warn('Push-уведомления не поддерживаются в этом браузере');
}

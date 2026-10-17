// Web Push Notification Listener for 掌上课表 PWA

self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { body: event.data ? event.data.text() : '您有一项新的课表提醒' };
  }

  const title = data.title || '课程与作业提醒';
  const options = {
    body: data.body || '您有一项新的课程或作业提醒，请及时查看',
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'course-reminder-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If a window is already open, focus it and navigate
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          if (client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Support direct messages from webpage to trigger system notification on Android
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || '🔔 掌上课表 · 本地系统级提醒';
    const options = {
      body: event.data.body || '开课与作业提醒',
      icon: event.data.icon || '/icon.svg',
      badge: event.data.badge || '/icon.svg',
      tag: event.data.tag || 'course-reminder-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: {
        url: event.data.url || '/',
        timestamp: Date.now()
      }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

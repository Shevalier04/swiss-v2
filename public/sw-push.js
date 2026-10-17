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
    vibrate: [300, 100, 300],
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

// Support direct messages & background delayed lockscreen notifications
self.addEventListener('message', function (event) {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || '🔔 掌上课表 · 本地系统级提醒';
    const options = {
      body: event.data.body || '开课与作业提醒',
      icon: event.data.icon || '/icon.svg',
      badge: event.data.badge || '/icon.svg',
      tag: event.data.tag || 'course-reminder-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      vibrate: event.data.vibrate || [300, 100, 300],
      data: {
        url: event.data.url || '/',
        timestamp: Date.now()
      }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } else if (event.data.type === 'SCHEDULE_LOCK_NOTIFICATION') {
    const delay = event.data.delay || 5000;
    const title = event.data.title || '🔔 掌上课表 · 系统级锁屏推送测试';
    const body = event.data.body || '测试成功！这是一条高优先级锁屏通知。若能在黑屏锁屏看到，说明系统通知与震动已放行！';
    const vibrate = event.data.vibrate || [300, 100, 300];
    const url = event.data.url || '/?tab=remind';

    const promise = new Promise(function (resolve) {
      setTimeout(function () {
        const options = {
          body: body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: 'delayed-lock-test-' + Date.now(),
          renotify: true,
          requireInteraction: true,
          vibrate: vibrate,
          data: {
            url: url,
            timestamp: Date.now()
          }
        };
        self.registration.showNotification(title, options).then(resolve).catch(resolve);
      }, delay);
    });

    event.waitUntil(promise);
  }
});

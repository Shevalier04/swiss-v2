/**
 * Web Push Notification Manager
 * Handles Service Worker PushManager subscription, VAPID key conversion, and backend sync.
 */

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPushPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function getActiveServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    // Try to get ready registration with a quick timeout fallback
    const timeoutPromise = new Promise<ServiceWorkerRegistration | null>(resolve => {
      setTimeout(async () => {
        try {
          const existing = await navigator.serviceWorker.getRegistration();
          resolve(existing || null);
        } catch {
          resolve(null);
        }
      }, 1200);
    });

    const readyPromise = navigator.serviceWorker.ready;
    const reg = await Promise.race([readyPromise, timeoutPromise]);
    if (reg) return reg;

    // Fallback: register /sw-push.js directly
    return await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
  } catch (err) {
    console.warn('[WebPush] Error finding active service worker:', err);
    try {
      return await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
    } catch (e) {
      console.error('[WebPush] Fallback registration failed:', e);
      return null;
    }
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const reg = await getActiveServiceWorker();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn('[WebPush] Error fetching current subscription:', err);
    return null;
  }
}

export async function subscribeToPushNotifications(): Promise<{
  success: boolean;
  message: string;
  subscription?: PushSubscription;
}> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      message: '当前浏览器或环境不支持系统级 Web Push 通知（建议使用 Chrome / Edge 或将应用添加到主屏幕）',
    };
  }

  try {
    // 1. Request Notification Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        message: permission === 'denied'
          ? '通知权限已被拒绝，请在浏览器地址栏权限设置中允许通知'
          : '未完成通知授权',
      };
    }

    // 2. Fetch VAPID public key from backend
    const keyRes = await fetch('/api/push/vapid-public-key');
    const keyData = await keyRes.json();
    if (!keyData.success || !keyData.publicKey) {
      throw new Error(keyData.error || '获取服务端推送公钥失败');
    }

    const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);

    // 3. Ensure Service Worker is ready
    const reg = await getActiveServiceWorker();
    if (!reg) {
      throw new Error('Service Worker 注册未就绪，请刷新重试');
    }

    // 4. Subscribe with PushManager
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });
    }

    // 5. Send subscription to server
    const token = localStorage.getItem('cs_token') || 'admin';
    const subJson = sub.toJSON();

    const syncRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subscription: subJson,
        userAgent: navigator.userAgent,
      }),
    });

    const syncData = await syncRes.json();
    if (!syncData.success) {
      throw new Error(syncData.error || '向服务器同步推送令牌失败');
    }

    return {
      success: true,
      message: '系统级 Web Push 锁屏推送已成功开启！',
      subscription: sub,
    };
  } catch (err: any) {
    console.error('[WebPush] Subscription error:', err);
    return {
      success: false,
      message: err.message || '订阅推送通知时发生未知错误',
    };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<{
  success: boolean;
  message: string;
}> {
  if (!isPushNotificationSupported()) {
    return { success: false, message: '环境不支持 Web Push' };
  }

  try {
    const reg = await getActiveServiceWorker();
    if (!reg) return { success: false, message: 'Service Worker 未注册' };

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      // Tell backend to remove
      const token = localStorage.getItem('cs_token') || 'admin';
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint }),
      });
    }

    return {
      success: true,
      message: '已关闭当前设备的锁屏推送订阅',
    };
  } catch (err: any) {
    console.error('[WebPush] Unsubscribe error:', err);
    return {
      success: false,
      message: err.message || '注销推送订阅失败',
    };
  }
}

export async function sendServerTestPush(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const token = localStorage.getItem('cs_token') || 'admin';
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (data.success) {
      return {
        success: true,
        message: data.message || '测试推送已发送！请熄屏或切到后台查看通知栏。',
      };
    } else {
      return {
        success: false,
        message: data.message || data.error || '测试推送发送失败',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || '网络异常，测试推送发送失败',
    };
  }
}

export async function fetchServerPushStatus(): Promise<{
  supported: boolean;
  hasSubscriptions: boolean;
  subscriptionCount: number;
}> {
  try {
    const token = localStorage.getItem('cs_token') || 'admin';
    const res = await fetch('/api/push/status', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    return {
      supported: !!data.supported,
      hasSubscriptions: !!data.hasSubscriptions,
      subscriptionCount: data.subscriptionCount || 0,
    };
  } catch {
    return {
      supported: isPushNotificationSupported(),
      hasSubscriptions: false,
      subscriptionCount: 0,
    };
  }
}

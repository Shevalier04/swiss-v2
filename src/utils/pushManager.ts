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

export interface NotificationCapability {
  hasPushManager: boolean;
  hasNotification: boolean;
  hasServiceWorker: boolean;
  isHuaweiOrDomestic: boolean;
  permission: NotificationPermission | 'unsupported';
  mode: 'webpush' | 'local_system' | 'unsupported';
}

export function detectNotificationCapability(): NotificationCapability {
  if (typeof window === 'undefined') {
    return {
      hasPushManager: false,
      hasNotification: false,
      hasServiceWorker: false,
      isHuaweiOrDomestic: false,
      permission: 'unsupported',
      mode: 'unsupported',
    };
  }

  const ua = (navigator.userAgent || '').toLowerCase();
  const isHuaweiOrDomestic =
    /huaweibrowser|huawei|harmonyos|honor|heytap|micromessenger|mqqbrowser|ucbrowser|baidubrowser|quark/i.test(
      ua
    );

  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window && hasServiceWorker;
  const hasNotification = 'Notification' in window;
  const permission: NotificationPermission | 'unsupported' = hasNotification
    ? Notification.permission
    : 'unsupported';

  let mode: 'webpush' | 'local_system' | 'unsupported' = 'unsupported';
  if (hasPushManager && hasNotification) {
    mode = 'webpush';
  } else if (hasNotification) {
    mode = 'local_system';
  }

  return {
    hasPushManager,
    hasNotification,
    hasServiceWorker,
    isHuaweiOrDomestic,
    permission,
    mode,
  };
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
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

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

export async function requestLocalSystemPermission(): Promise<{
  granted: boolean;
  status: NotificationPermission | 'unsupported';
  message: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      granted: false,
      status: 'unsupported',
      message: '当前浏览器不支持系统通知 API，建议在手机“添加到桌面”或使用 Chrome / Edge 访问',
    };
  }

  try {
    const res = await Notification.requestPermission();
    if (res === 'granted') {
      return {
        granted: true,
        status: res,
        message: '手机系统级通知权限已开启！',
      };
    } else {
      return {
        granted: false,
        status: res,
        message: '通知权限未允许，请在浏览器或手机“设置 - 通知”中允许通知',
      };
    }
  } catch (err: any) {
    return {
      granted: false,
      status: 'denied',
      message: err?.message || '申请通知权限失败',
    };
  }
}

export async function sendLocalTestNotification(): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, message: '当前浏览器不支持通知 API' };
  }
  if (Notification.permission !== 'granted') {
    return { success: false, message: '系统通知权限尚未允许，请先点击上方“开启系统通知权限”' };
  }

  try {
    const reg = await getActiveServiceWorker();
    if (reg && reg.showNotification) {
      await reg.showNotification('🔔 掌上课表 · 本地系统级提醒测试', {
        body: '这是本地系统通知！即使未连 Google FCM，配合华为手机后台常驻权限也可在开课前准时提醒。',
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: 'local-huawei-test',
        renotify: true,
      } as any);
      return { success: true, message: '本地系统通知已发出！请下拉通知栏或锁屏查看。' };
    }
  } catch (e) {}

  try {
    new Notification('🔔 掌上课表 · 本地系统级提醒测试', {
      body: '这是本地系统通知！在上课与作业截止前，手机通知中心将准时推送横幅与声音。',
      icon: '/icon.svg',
    });
    return { success: true, message: '本地系统通知已弹出！' };
  } catch (err: any) {
    return { success: false, message: err?.message || '发送本地系统通知失败' };
  }
}


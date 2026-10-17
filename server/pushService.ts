import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { dbStore, StoredPushSubscription } from './store';
import { Course, Homework } from './data';

const VAPID_FILE = path.resolve('data/vapid_keys.json');

export const SLOTS: Record<number, { s: string; e: string; label: string }> = {
  1: { s: '08:20', e: '09:05', label: '08:20 - 09:05' },
  2: { s: '09:10', e: '09:55', label: '09:10 - 09:55' },
  3: { s: '10:15', e: '11:00', label: '10:15 - 11:00' },
  4: { s: '11:05', e: '11:50', label: '11:05 - 11:50' },
  5: { s: '14:20', e: '15:05', label: '14:20 - 15:05' },
  6: { s: '15:10', e: '15:55', label: '15:10 - 15:55' },
  7: { s: '16:15', e: '17:00', label: '16:15 - 17:00' },
  8: { s: '17:05', e: '17:50', label: '17:05 - 17:50' },
  9: { s: '19:00', e: '19:45', label: '19:00 - 19:45' },
  10: { s: '19:55', e: '20:40', label: '19:55 - 20:40' },
  11: { s: '20:50', e: '21:35', label: '20:50 - 21:35' },
};

export const SEM_START = new Date(2026, 8, 7); // 2026-09-07 Week 1 Monday

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const w = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - w);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getWeekNo(d: Date): number {
  const diff = mondayOf(d).getTime() - mondayOf(SEM_START).getTime();
  return Math.floor(diff / (7 * 864e5)) + 1;
}

function parseWeekSet(ws?: string): Set<number> {
  const s = new Set<number>();
  if (!ws) return s;
  String(ws).split(/[,，;；]/).forEach(p => {
    const m = /^\s*(\d+)\s*-\s*(\d+)\s*周?\s*$/.exec(p) || /^\s*(\d+)\s*周\s*$/.exec(p);
    if (m) {
      const a = +m[1];
      const b = m[2] !== undefined ? +m[2] : a;
      for (let i = a; i <= b; i++) {
        s.add(i);
      }
    }
  });
  return s;
}

function isCourseInWeek(weekNo: number, ws?: string): boolean {
  if (!ws || !ws.trim()) return true;
  return parseWeekSet(ws).has(weekNo);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

class PushNotificationService {
  private vapidKeys: VapidKeys;
  private schedulerTimer: NodeJS.Timeout | null = null;
  // Key format: `${username}:${type}:${id}:${dateStr}`
  private sentAlertCache: Set<string> = new Set();

  constructor() {
    this.vapidKeys = this.loadOrGenerateVapidKeys();
    webpush.setVapidDetails(
      this.vapidKeys.subject || 'mailto:admin@coursetable.local',
      this.vapidKeys.publicKey,
      this.vapidKeys.privateKey
    );
  }

  private loadOrGenerateVapidKeys(): VapidKeys {
    try {
      if (fs.existsSync(VAPID_FILE)) {
        const raw = fs.readFileSync(VAPID_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.publicKey && parsed.privateKey) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to read vapid_keys.json, regenerating new keypair', err);
    }

    const generated = webpush.generateVAPIDKeys();
    const keys: VapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject: 'mailto:admin@coursetable.local',
    };

    try {
      const dir = path.dirname(VAPID_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), 'utf-8');
      console.log('✓ VAPID keys generated and stored successfully in data/vapid_keys.json');
    } catch (err) {
      console.error('Failed to write vapid_keys.json to disk', err);
    }

    return keys;
  }

  getPublicKey(): string {
    return this.vapidKeys.publicKey;
  }

  async sendToSubscription(subscription: StoredPushSubscription['subscription'], payload: PushPayload): Promise<boolean> {
    try {
      const payloadString = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icon.svg',
        badge: payload.badge || '/icon.svg',
        url: payload.url || '/',
        tag: payload.tag || `remind-${Date.now()}`,
      });

      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
        },
        payloadString
      );
      return true;
    } catch (err: any) {
      // Clean up dead subscriptions (HTTP 404 or 410 Gone)
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log(`[WebPush] Subscription expired or unsubscribed (status ${err.statusCode}), cleaning endpoint:`, subscription.endpoint);
        dbStore.cleanInvalidPushSubscription(subscription.endpoint);
      } else {
        console.error('[WebPush] Error sending notification:', err.message || err);
      }
      return false;
    }
  }

  async sendToUser(username: string, payload: PushPayload): Promise<{ sent: number; total: number }> {
    const subs = dbStore.getPushSubscriptions(username);
    if (!subs || subs.length === 0) {
      return { sent: 0, total: 0 };
    }

    let sent = 0;
    await Promise.all(
      subs.map(async sub => {
        const ok = await this.sendToSubscription(sub.subscription, payload);
        if (ok) sent++;
      })
    );

    return { sent, total: subs.length };
  }

  async sendTestPush(username: string): Promise<{ success: boolean; sent: number; total: number; message: string }> {
    const subs = dbStore.getPushSubscriptions(username);
    if (subs.length === 0) {
      return {
        success: false,
        sent: 0,
        total: 0,
        message: '未找到本账号的有效推送订阅，请先在当前设备点击“开启锁屏系统推送”授权。',
      };
    }

    const payload: PushPayload = {
      title: '🔔 掌上课表 · 系统级锁屏推送测试',
      body: '恭喜！您的设备已成功开启系统级 Web Push 离线推送。即使手机熄屏或未打开网页，课前与作业截止前也能准时收到提醒！',
      url: '/?tab=remind',
      tag: 'test-push',
    };

    const res = await this.sendToUser(username, payload);
    return {
      success: res.sent > 0,
      sent: res.sent,
      total: res.total,
      message: res.sent > 0 ? `已成功向 ${res.sent} 台设备发送系统级离线推送！` : '推送发送失败，可能需要重新授权订阅。',
    };
  }

  startScheduler() {
    if (this.schedulerTimer) return;
    console.log('[WebPush] Starting scheduled push notification background worker...');

    // Run immediately once, then every 60 seconds
    this.runScheduleCheck();
    this.schedulerTimer = setInterval(() => {
      this.runScheduleCheck();
    }, 60 * 1000);
  }

  stopScheduler() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private async runScheduleCheck() {
    try {
      const allSubs = dbStore.getAllPushSubscriptions();
      if (allSubs.length === 0) return;

      const now = new Date();
      const currentWeek = Math.max(1, Math.min(25, getWeekNo(now)));
      const todayDayIdx = (now.getDay() + 6) % 7;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Clear old entries from sentAlertCache to prevent memory leaks (keep only today)
      if (now.getHours() === 0 && now.getMinutes() === 1) {
        this.sentAlertCache.clear();
      }

      // Group subscriptions by user
      const userSubsMap = new Map<string, StoredPushSubscription[]>();
      for (const sub of allSubs) {
        if (!userSubsMap.has(sub.username)) userSubsMap.set(sub.username, []);
        userSubsMap.get(sub.username)!.push(sub);
      }

      for (const [username, _subs] of userSubsMap.entries()) {
        const courses = dbStore.getCourses(username);
        const homework = dbStore.getHomework(username);

        // 1. Course Upcoming Alert: Check courses starting in 15 minutes (between 5 and 20 mins)
        const todayCourses = courses
          .filter(c => c.day === todayDayIdx && isCourseInWeek(currentWeek, c.weeks))
          .sort((a, b) => a.s - b.s);

        for (const c of todayCourses) {
          const slot = SLOTS[c.s];
          if (!slot) continue;
          const sMin = toMinutes(slot.s);
          const diff = sMin - currentMinutes;

          // Alert 15 minutes before class
          if (diff > 0 && diff <= 15) {
            const cacheKey = `${username}:course:${c.id}:${todayDateStr}`;
            if (!this.sentAlertCache.has(cacheKey)) {
              this.sentAlertCache.add(cacheKey);
              await this.sendToUser(username, {
                title: `🔔 课前提醒 · 《${c.name}》即将开始`,
                body: `还有 ${diff} 分钟上课（${slot.s}-${SLOTS[c.e]?.e || slot.e}）｜ 教室：${c.room || '待定'}${c.teacher ? ` ｜ 教师：${c.teacher}` : ''}`,
                url: '/?tab=today',
                tag: `course-${c.id}`,
              });
            }
          }
        }

        // 2. Homework Deadline Alert: Check unfinished homework due soon
        for (const hw of homework) {
          if (hw.done || !hw.due) continue;
          try {
            const dueStr = hw.due.includes(':') ? hw.due : `${hw.due} 23:59`;
            const dueTime = new Date(dueStr.replace(/-/g, '/')).getTime();
            if (isNaN(dueTime)) continue;

            const msRemaining = dueTime - now.getTime();
            const hoursRemaining = msRemaining / (1000 * 60 * 60);

            // Trigger alerts at ~24 hours and ~3 hours before deadline
            if (hoursRemaining > 0 && hoursRemaining <= 24) {
              const alertType = hoursRemaining <= 3 ? 'urgent' : 'warning';
              const cacheKey = `${username}:hw:${hw.id}:${alertType}:${todayDateStr}`;

              if (!this.sentAlertCache.has(cacheKey)) {
                this.sentAlertCache.add(cacheKey);
                const timeText = hoursRemaining <= 3
                  ? `仅剩约 ${Math.max(1, Math.round(hoursRemaining * 60))} 分钟`
                  : `仅剩约 ${Math.round(hoursRemaining)} 小时`;

                await this.sendToUser(username, {
                  title: hoursRemaining <= 3 ? `⚠️ 作业紧急临期 · ${hw.course}` : `📝 作业截止预警 · ${hw.course}`,
                  body: `《${hw.title}》${timeText}截止（${hw.due}），请尽快完成提交！`,
                  url: '/?tab=hw',
                  tag: `hw-${hw.id}`,
                });
              }
            }
          } catch (e) {}
        }

        // 3. Sunday Evening Preview: Sundays around 20:00 - 21:00
        if (now.getDay() === 0 && now.getHours() >= 20 && now.getHours() < 22) {
          const cacheKey = `${username}:sunday_eve:${todayDateStr}`;
          if (!this.sentAlertCache.has(cacheKey)) {
            const nextWeekNo = currentWeek + 1;
            const mondayCourses = courses
              .filter(c => c.day === 0 && isCourseInWeek(nextWeekNo, c.weeks))
              .sort((a, b) => a.s - b.s);

            if (mondayCourses.length > 0) {
              this.sentAlertCache.add(cacheKey);
              const firstC = mondayCourses[0];
              const slot = SLOTS[firstC.s];
              await this.sendToUser(username, {
                title: `🌙 周日晚间提醒 · 明天周一有课 (${slot?.s || '早课'})`,
                body: `首节课《${firstC.name}》第${firstC.s}-${firstC.e}节 ｜ @${firstC.room || '待定'} ｜ 明日共 ${mondayCourses.length} 节课程，课表已提前就绪！`,
                url: '/?tab=today',
                tag: 'sunday-eve-preview',
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[WebPush] Error during runScheduleCheck:', err);
    }
  }
}

export const pushService = new PushNotificationService();

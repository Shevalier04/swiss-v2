import React from 'react';
import { Course, RemindSettings } from '../types';
import { SLOTS, toMinutes, isCourseInWeek, getWeekNo, getNextDayInfo } from '../utils/time';
import { Bell, Volume2, ShieldCheck, Play, Moon, Calendar, Sparkles } from 'lucide-react';

interface ReminderTabProps {
  settings: RemindSettings;
  onUpdateSettings: (newSettings: Partial<RemindSettings>) => void;
  courses: Course[];
  onTriggerTestReminder: () => void;
  onTriggerSundayTestReminder?: () => void;
  toast: (msg: string) => void;
}

export const ReminderTab: React.FC<ReminderTabProps> = ({
  settings,
  onUpdateSettings,
  courses,
  onTriggerTestReminder,
  onTriggerSundayTestReminder,
  toast,
}) => {
  const now = new Date();
  const currentWeek = Math.max(1, Math.min(25, getWeekNo(now)));
  const todayDayIdx = (now.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const nextCourse = courses
    .filter(c => c.day === todayDayIdx && isCourseInWeek(currentWeek, c.weeks))
    .sort((a, b) => a.s - b.s)
    .find(c => toMinutes(SLOTS[c.s].s) > currentMinutes);

  // Check tomorrow's morning course
  const nextDay = getNextDayInfo(now);
  const tomorrowCourses = courses
    .filter(c => c.day === nextDay.dayIdx && isCourseInWeek(nextDay.weekNo, c.weeks))
    .sort((a, b) => a.s - b.s);
  const tomorrowFirstCourse = tomorrowCourses[0];

  const notificationPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  const requestSysPermission = async () => {
    if (typeof Notification === 'undefined') {
      toast('当前浏览器环境不支持系统级通知');
      return;
    }
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        onUpdateSettings({ sys: true });
        toast('系统通知权限已开启');
      } else {
        toast('未开启通知权限，请在浏览器地址栏或手机设置中允许');
      }
    } catch (e) {
      toast('通知权限请求失败');
    }
  };

  return (
    <div className="space-y-4 pb-6 select-none">
      {/* Title */}
      <div className="border-b-[2.5px] border-[#e9e4d8] pb-2">
        <div className="font-editorial text-2xl sm:text-3xl font-extrabold tracking-wide text-[#e9e4d8]">
          上课提醒
        </div>
        <div className="text-[9.5px] font-mono tracking-[3px] text-[#8f8b80] mt-0.5">
          CLASS REMINDER NOTIFICATIONS
        </div>
      </div>

      {/* Status Pad */}
      <div className="bg-[#26282e] border-2 border-[#33363d] p-4 text-xs leading-relaxed space-y-1.5 rounded">
        <div>
          即时提醒：
          <b className={settings.enabled ? 'text-[#6b7cff]' : 'text-[#8f8b80]'}>
            {settings.enabled ? '已启用 ✓' : '已关闭 ✕'}
          </b>
          {' ｜ '}课前 <b className="text-[#6b7cff]">{settings.lead}</b> 分钟提醒
        </div>
        <div>
          周日晚提醒：
          <b className={settings.sundayEveEnabled ? 'text-[#4ade80]' : 'text-[#8f8b80]'}>
            {settings.sundayEveEnabled ? `已开启 (${settings.sundayEveHour || 20}:00 推送明日早课)` : '已关闭'}
          </b>
          {' ｜ '}课表提前更新：
          <b className={settings.sundayAutoAdvance ? 'text-[#6b7cff]' : 'text-[#8f8b80]'}>
            {settings.sundayAutoAdvance ? '周日晚自动切换下周 ✓' : '手动切换'}
          </b>
        </div>
        <div>
          系统通知权限：
          <b className={notificationPermission === 'granted' ? 'text-[#4ade80]' : 'text-[#ff6b57]'}>
            {notificationPermission === 'granted'
              ? '已授权 ✓'
              : notificationPermission === 'denied'
              ? '已被拒绝（需在浏览器设置中开启）'
              : '未授权'}
          </b>
        </div>
        <div>
          明日早课情况：
          {tomorrowFirstCourse ? (
            <b className="text-[#e9e4d8]">
              {nextDay.isMonday ? '【周一开课】' : '明天'}{tomorrowFirstCourse.name} ({SLOTS[tomorrowFirstCourse.s].s} 首节 ｜ @{tomorrowFirstCourse.room || '待定'})
            </b>
          ) : (
            <span className="text-[#8f8b80]">明天暂无课程安排</span>
          )}
        </div>
      </div>

      {/* Featured Feature: Sunday Evening & Next Day Class Preview */}
      <div className="bg-gradient-to-r from-[#1c223a] to-[#1a1c22] border-2 border-[#6b7cff] p-4 rounded-lg shadow-lg text-[#e9e4d8] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-[#6b7cff]" />
            <h4 className="font-editorial font-bold text-base text-[#e9e4d8]">
              周日晚间备课提醒与课表提前更新
            </h4>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#6b7cff]/20 text-[#8ea4ff] font-bold">
            PRO
          </span>
        </div>

        <p className="text-xs text-[#a8a399] leading-relaxed">
          每到周日晚上，自动检查新一周（周一早晨）是否有课并准时提醒，同时将课程表和小组件<strong>提前切换到新一周</strong>，让你睡前从容掌握明早行程与教室！
        </p>

        <div className="border-t border-[#333644] pt-2.5 divide-y divide-[#2a2d36] text-xs">
          {/* Sunday Eve Alert Toggle */}
          <div
            onClick={() => onUpdateSettings({ sundayEveEnabled: !settings.sundayEveEnabled })}
            className="flex items-center justify-between py-2 cursor-pointer hover:bg-white/[0.02]"
          >
            <div>
              <div className="font-bold text-[#e9e4d8] flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-[#6b7cff]" />
                <span>周日晚间提醒明天周一有课</span>
              </div>
              <div className="text-[11px] text-[#8f8b80] mt-0.5">
                在周日晚向你推送周一早课名称、时间、教室与总课程数
              </div>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                settings.sundayEveEnabled
                  ? 'bg-[#4ade80] text-[#1d1f24]'
                  : 'border border-[#8f8b80] text-[#8f8b80]'
              }`}
            >
              {settings.sundayEveEnabled ? '开' : '关'}
            </span>
          </div>

          {/* Sunday Eve Alert Hour Selector */}
          {settings.sundayEveEnabled && (
            <div className="py-2.5 space-y-1.5">
              <div className="text-[11px] text-[#8f8b80] font-mono">周日晚提醒时间点：</div>
              <div className="grid grid-cols-5 border border-[#333644] divide-x divide-[#333644] text-xs font-bold rounded overflow-hidden">
                {[19, 20, 21, 22].map(hour => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ sundayEveHour: hour });
                      toast(`已设为周日晚 ${hour}:00 提醒`);
                    }}
                    className={`py-1.5 transition-colors cursor-pointer ${
                      (settings.sundayEveHour || 20) === hour
                        ? 'bg-[#6b7cff] text-white'
                        : 'bg-[#181a20] text-[#a8a399] hover:text-white'
                    }`}
                  >
                    {hour}:00
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ sundayEveHour: 21 });
                    toast('已设为周日晚 21:30 提醒');
                  }}
                  className={`py-1.5 transition-colors cursor-pointer ${
                    (settings.sundayEveHour || 20) === 21
                      ? 'bg-[#6b7cff] text-white'
                      : 'bg-[#181a20] text-[#a8a399] hover:text-white'
                  }`}
                >
                  21:30
                </button>
              </div>
            </div>
          )}

          {/* Sunday Auto Advance Timetable Toggle */}
          <div
            onClick={() => onUpdateSettings({ sundayAutoAdvance: !settings.sundayAutoAdvance })}
            className="flex items-center justify-between py-2 cursor-pointer hover:bg-white/[0.02]"
          >
            <div>
              <div className="font-bold text-[#e9e4d8] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#6b7cff]" />
                <span>周日晚间课表自动提前更新</span>
              </div>
              <div className="text-[11px] text-[#8f8b80] mt-0.5">
                周日 18:00 后课程表与小组件自动切换到新一周第 {currentWeek + 1} 周
              </div>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                settings.sundayAutoAdvance
                  ? 'bg-[#6b7cff] text-white'
                  : 'border border-[#8f8b80] text-[#8f8b80]'
              }`}
            >
              {settings.sundayAutoAdvance ? '开' : '关'}
            </span>
          </div>

          {/* Every Eve Preview */}
          <div
            onClick={() => onUpdateSettings({ everyEvePreview: !settings.everyEvePreview })}
            className="flex items-center justify-between py-2 cursor-pointer hover:bg-white/[0.02]"
          >
            <div>
              <div className="font-bold text-[#e9e4d8] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#d99a2b]" />
                <span>每日晚间早课预告</span>
              </div>
              <div className="text-[11px] text-[#8f8b80] mt-0.5">
                周一至周六晚间 21:00 也同样弹窗预报次日首节课程
              </div>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                settings.everyEvePreview
                  ? 'bg-[#d99a2b] text-[#1d1f24]'
                  : 'border border-[#8f8b80] text-[#8f8b80]'
              }`}
            >
              {settings.everyEvePreview ? '开' : '关'}
            </span>
          </div>
        </div>
      </div>

      {/* Lead Time Selection */}
      <div>
        <div className="text-[10px] font-bold tracking-[3px] text-[#8f8b80] mb-2 font-mono">
          LEAD · 课前即时提醒时间
        </div>
        <div className="grid grid-cols-4 border border-[#e9e4d8] text-xs font-bold divide-x divide-[#e9e4d8]">
          {([5, 10, 15, 20] as const).map(lead => (
            <button
              key={lead}
              onClick={() => {
                onUpdateSettings({ lead });
                toast(`已设为课前 ${lead} 分钟提醒`);
              }}
              className={`py-2 text-center transition-colors cursor-pointer ${
                settings.lead === lead
                  ? 'bg-[#e9e4d8] text-[#1d1f24]'
                  : 'text-[#e9e4d8] hover:bg-white/10'
              }`}
            >
              提前 {lead} 分
            </button>
          ))}
        </div>
      </div>

      {/* Channels List */}
      <div>
        <div className="text-[10px] font-bold tracking-[3px] text-[#8f8b80] mb-2 font-mono">
          CHANNEL · 提醒通道设置
        </div>
        <div className="border-t-2 border-[#e9e4d8] divide-y divide-[#2a2d34] text-sm">
          {/* In-app */}
          <div
            onClick={() => onUpdateSettings({ inapp: !settings.inapp })}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <div className="font-semibold text-[#e9e4d8] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#6b7cff]" />
                应用内提醒卡片
              </div>
              <div className="text-xs text-[#8f8b80] mt-0.5">
                页面内弹出醒目提醒卡片（含教室、倒计时与快速进入）
              </div>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                settings.inapp
                  ? 'bg-[#6b7cff] text-white'
                  : 'border border-[#8f8b80] text-[#8f8b80]'
              }`}
            >
              {settings.inapp ? '开' : '关'}
            </span>
          </div>

          {/* System Notification */}
          <div
            onClick={() => {
              if (!settings.sys && notificationPermission !== 'granted') {
                requestSysPermission();
              } else {
                onUpdateSettings({ sys: !settings.sys });
              }
            }}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <div className="font-semibold text-[#e9e4d8] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#4ade80]" />
                系统级桌面/横幅通知
              </div>
              <div className="text-xs text-[#8f8b80] mt-0.5">
                锁屏或在后台时向系统通知中心推送消息
              </div>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                settings.sys && notificationPermission === 'granted'
                  ? 'bg-[#4ade80] text-[#1d1f24]'
                  : 'border border-[#8f8b80] text-[#8f8b80]'
              }`}
            >
              {settings.sys && notificationPermission === 'granted' ? '开' : '关'}
            </span>
          </div>

          {/* Audio Beep */}
          <div
            onClick={() => onUpdateSettings({ sound: !settings.sound })}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <div className="font-semibold text-[#e9e4d8] flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#d99a2b]" />
                提醒提示音
              </div>
              <div className="text-xs text-[#8f8b80] mt-0.5">
                课前触发一声清脆正弦波短蜂鸣（零网络依赖）
              </div>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                settings.sound
                  ? 'bg-[#d99a2b] text-[#1d1f24]'
                  : 'border border-[#8f8b80] text-[#8f8b80]'
              }`}
            >
              {settings.sound ? '开' : '关'}
            </span>
          </div>

          {/* Master Toggle */}
          <div
            onClick={() => onUpdateSettings({ enabled: !settings.enabled })}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <div className="font-semibold text-[#e9e4d8]">总开关 · 启用提醒</div>
              <div className="text-xs text-[#8f8b80] mt-0.5">一键控制全部课前提醒行为</div>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                settings.enabled
                  ? 'bg-[#e9e4d8] text-[#1d1f24]'
                  : 'border border-[#8f8b80] text-[#8f8b80]'
              }`}
            >
              {settings.enabled ? '开' : '关'}
            </span>
          </div>
        </div>
      </div>

      {/* Test Buttons Area */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={onTriggerSundayTestReminder || onTriggerTestReminder}
          className="w-full py-3 bg-[#6b7cff] hover:bg-[#5b6cee] text-white font-bold text-xs tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer rounded shadow-md"
        >
          <Moon className="w-4 h-4" />
          <span>立即测试【周日晚间提醒明天有课】弹窗与通知</span>
        </button>

        <button
          type="button"
          onClick={onTriggerTestReminder}
          className="w-full py-2.5 bg-[#252832] hover:bg-[#2e323e] border border-[#3e4252] text-[#e9e4d8] font-semibold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer rounded"
        >
          <Play className="w-3.5 h-3.5 fill-current text-[#8f8b80]" />
          <span>测试课前 10 分钟即时提醒卡片</span>
        </button>
      </div>

      {/* Note */}
      <div className="p-3 border-l-2 border-[#8f8b80] bg-[#1a1c21] text-xs text-[#8f8b80] leading-relaxed">
        提示：周日晚间提醒将在周日晚 20:00 准时通过应用内弹窗、系统通知中心及蜂鸣声播报周一早晨课程；同时课程表将在周日晚 18:00 自动为您提前载入新一周课表。
      </div>
    </div>
  );
};

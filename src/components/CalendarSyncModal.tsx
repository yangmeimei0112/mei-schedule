import React, { useState } from 'react';
import { LucideIcon } from './BrandMark';
import {
  buildGoogleCalendarUrl,
  exportEventsToIcs,
  parseIcsContent,
  triggerIcsFileDownload
} from '../services/icsService';
import {
  detectRuntimePlatform,
  requestNotificationPermission,
  scheduleUpcomingEventReminders,
  sendInstantNotification
} from '../services/notificationBridge';
import { useScheduleStore } from '../store/useScheduleStore';

export default function CalendarSyncModal() {
  const {
    activeModal,
    closeModal,
    calendars,
    events,
    currentMember,
    replaceEventsAtomic,
    showToast
  } = useScheduleStore();

  const [targetCalendarId, setTargetCalendarId] = useState(calendars[0]?.id || '');
  const [icsPasteText, setIcsPasteText] = useState('');
  const [importReport, setImportReport] = useState<string | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<string>('');

  if (activeModal !== 'sync') return null;

  const runtimePlatform = detectRuntimePlatform();
  const effectiveCalId = targetCalendarId || calendars[0]?.id || '';

  const handleExportIcs = () => {
    const icsText = exportEventsToIcs(events, '咩時光 MeiSchedule');
    triggerIcsFileDownload(icsText, 'meischedule-export.ics');
    showToast(`已匯出 ${events.length} 筆排程至標準 .ics 日曆檔`, { icon: 'download' });
  };

  const runIcsImport = (rawText: string) => {
    if (!rawText.trim()) return;
    const existingUids = new Set(
      events.map((e) => e.externalUid).filter((u): u is string => Boolean(u))
    );
    const parsed = parseIcsContent(rawText, {
      calendarId: effectiveCalId,
      creatorId: currentMember?.uid || 'local-guest',
      existingExternalUids: existingUids
    });

    if (parsed.events.length === 0) {
      setImportReport(
        parsed.skippedCount > 0
          ? `未新增行程（略過 ${parsed.skippedCount} 筆已存在或格式不完整事件）`
          : '找不到有效的 VEVENT 行程內容'
      );
      return;
    }

    replaceEventsAtomic(
      [...events, ...parsed.events],
      `已從 .ics 匯入 ${parsed.events.length} 筆排程`
    );
    setImportReport(
      `成功匯入 ${parsed.events.length} 筆行程${parsed.skippedCount > 0 ? `（略過重複 ${parsed.skippedCount} 筆）` : ''}`
    );
    setIcsPasteText('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    runIcsImport(text);
    e.target.value = '';
  };

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    if (perm === 'granted') {
      const scheduled = await scheduleUpcomingEventReminders(events);
      await sendInstantNotification({
        title: '咩時光通知已啟用',
        body: `已同步排入未來 24 小時內 ${scheduled} 筆行程提醒。`
      });
      setNotifyStatus(`已啟用提醒（執行環境：${runtimePlatform}，已排程 ${scheduled} 筆）`);
      showToast('已啟用跨平台排程提醒通知', { icon: 'bell-ring' });
    } else {
      setNotifyStatus('瀏覽器或系統未授予通知權限，請於系統設定允許通知');
    }
  };

  const nextUpcomingEvent = events
    .filter((e) => e.status === 'scheduled' && Date.parse(e.startAt) >= Date.now() - 3600_000)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))[0];

  return (
    <div
      data-testid="calendar-sync-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-md"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="標準日曆互通與跨平台提醒設定"
        onClick={(e) => e.stopPropagation()}
        className="landscape-compact-modal max-h-dvh-92 overflow-y-auto w-full max-w-2xl bento-glass-card p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LucideIcon name="refresh-cw" size={20} className="theme-accent-text" />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-main)]">
                標準日曆互通（.ics / Google）與跨端提醒
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                與 Apple Calendar、Google Calendar、Outlook 雙向交換 RFC 5545 標準檔案
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="關閉日曆同步視窗"
            className="p-2 rounded-xl hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
          >
            <LucideIcon name="x" size={18} />
          </button>
        </div>

        {/* 1. Export .ics & Google Quick Link */}
        <section className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-3">
          <h3 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
            <LucideIcon name="download" size={14} className="theme-accent-text" />
            <span>匯出標準 .ics 與 Google 日曆連動</span>
          </h3>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              data-testid="sync-export-ics-btn"
              onClick={handleExportIcs}
              className="btn-sky-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <LucideIcon name="download" size={14} />
              <span>匯出全部排程 (.ics)</span>
            </button>

            {nextUpcomingEvent && (
              <a
                href={buildGoogleCalendarUrl(nextUpcomingEvent)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-sky-secondary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
              >
                <LucideIcon name="external-link" size={14} />
                <span>將下筆行程加入 Google 日曆</span>
              </a>
            )}
          </div>
        </section>

        {/* 2. Import .ics File or Paste */}
        <section className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
              <LucideIcon name="upload" size={14} className="text-emerald-500" />
              <span>匯入外部 .ics 行事曆（自動去重並支援復原）</span>
            </h3>
            <select
              value={effectiveCalId}
              onChange={(e) => setTargetCalendarId(e.target.value)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--surface-glass)] border border-[var(--border-subtle)]"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  匯入至：{c.name}
                </option>
              ))}
            </select>
          </div>

          <label className="block p-4 rounded-xl border-2 border-dashed border-[var(--accent-soft-border)] hover:border-[var(--accent-primary)] bg-[var(--accent-soft-bg)]/45 text-center cursor-pointer transition-colors">
            <input
              type="file"
              accept=".ics,text/calendar"
              data-testid="sync-import-file-input"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            <LucideIcon name="upload" size={20} className="mx-auto theme-accent-text mb-1" />
            <span className="text-xs font-bold text-[var(--text-main)] block">
              點擊選擇 .ics 檔案（來自 Google / Apple / Outlook）
            </span>
          </label>

          <div className="space-y-1.5">
            <textarea
              rows={3}
              data-testid="sync-import-paste-textarea"
              value={icsPasteText}
              onChange={(e) => setIcsPasteText(e.target.value)}
              placeholder="或直接貼上 BEGIN:VCALENDAR ... END:VCALENDAR 內容..."
              className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-main)]"
            />
            <div className="flex items-center justify-between gap-2">
              {importReport ? (
                <span data-testid="sync-import-report" className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {importReport}
                </span>
              ) : (
                <span className="text-[11px] text-[var(--text-muted)]">支援 RRULE 重複規則與全天事件</span>
              )}
              <button
                type="button"
                data-testid="sync-import-paste-btn"
                disabled={!icsPasteText.trim()}
                onClick={() => runIcsImport(icsPasteText)}
                className="btn-sky-secondary px-3.5 py-1.5 rounded-xl text-xs font-bold disabled:opacity-45"
              >
                解析並匯入
              </button>
            </div>
          </div>
        </section>

        {/* 3. Native Desktop / Mobile / PWA Notification Bridge */}
        <section className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
                <LucideIcon name="bell-ring" size={14} className="theme-accent-text" />
                <span>跨五端原生通知提醒（{runtimePlatform}）</span>
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                桌面端支援 Electron 系統匣與原生通知、行動端支援 Capacitor 本地排程推播
              </p>
            </div>
            <button
              type="button"
              data-testid="sync-enable-notify-btn"
              onClick={() => void handleEnableNotifications()}
              className="btn-sky-secondary px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <LucideIcon name="bell" size={14} />
              <span>啟用並測試通知</span>
            </button>
          </div>
          {notifyStatus && (
            <p className="text-xs font-semibold theme-accent-deep">{notifyStatus}</p>
          )}
        </section>
      </div>
    </div>
  );
}

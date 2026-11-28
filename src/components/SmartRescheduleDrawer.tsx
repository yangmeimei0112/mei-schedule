import React, { useEffect, useMemo, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { parseLocalDateKey } from '../services/recurrenceEngine';
import { proposeAutoFill, proposeSmartPush } from '../services/smartScheduler';
import { useScheduleStore } from '../store/useScheduleStore';
import type { ScheduleProposal, SmartProposalResult } from '../types/schedule';
import { useBackdropDismissGuard, useElasticTabMarker } from '../utils/uiMomentsMotion';

function formatShortTime(iso: string | null): string {
  if (!iso) return '未排程';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

export default function SmartRescheduleDrawer() {
  const {
    activeModal,
    closeModal,
    events,
    tasks,
    preferences,
    selectedDate,
    applySmartProposals
  } = useScheduleStore();

  const [mode, setMode] = useState<'autofill' | 'push'>('autofill');
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [selectedAnchorId, setSelectedAnchorId] = useState('');
  const [proposals, setProposals] = useState<ScheduleProposal[]>([]);
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [unscheduledNotes, setUnscheduledNotes] = useState<SmartProposalResult['unscheduledItems']>([]);
  const backdropGuard = useBackdropDismissGuard(closeModal);
  const modeTabMarker = useElasticTabMarker(mode, [activeModal]);

  const timedScheduledEvents = useMemo(
    () =>
      events
        .filter((e) => !e.allDay && e.status === 'scheduled')
        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    [events]
  );

  useEffect(() => {
    if (activeModal !== 'smart') return;
    if (!selectedAnchorId && timedScheduledEvents.length > 0) {
      setSelectedAnchorId(timedScheduledEvents[0].id);
    }
  }, [activeModal, selectedAnchorId, timedScheduledEvents]);

  // Compute preview whenever inputs change (NEVER auto-applies without explicit user click!)
  useEffect(() => {
    if (activeModal !== 'smart') return;
    if (mode === 'autofill') {
      const res = proposeAutoFill(tasks, events, preferences, parseLocalDateKey(selectedDate), 5);
      setProposals(res.proposals);
      setLockedIds(res.lockedEventIds);
      setUnscheduledNotes(res.unscheduledItems);
    } else {
      const anchor = selectedAnchorId || timedScheduledEvents[0]?.id || '';
      const res = proposeSmartPush(anchor, delayMinutes, events, preferences, 4);
      setProposals(res.proposals);
      setLockedIds(res.lockedEventIds);
      setUnscheduledNotes(res.unscheduledItems);
    }
  }, [activeModal, mode, delayMinutes, selectedAnchorId, tasks, events, preferences, selectedDate, timedScheduledEvents]);

  if (activeModal !== 'smart') return null;

  const selectedCount = proposals.filter((p) => p.selected).length;

  const toggleProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleApply = () => {
    const result = applySmartProposals(proposals);
    if (result.appliedCount > 0) {
      closeModal();
    }
  };

  return (
    <div
      data-testid="smart-reschedule-drawer"
      className="um-backdrop-enter fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/45 backdrop-blur-sm"
      {...backdropGuard}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="智慧排程與預覽重排差異面板"
        onClick={(e) => e.stopPropagation()}
        className="um-drawer-right-enter landscape-compact-modal max-h-dvh-92 sm:max-h-none sm:h-full w-full sm:max-w-lg bg-[var(--surface-glass-strong)] border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="landscape-compact-drawer-bar px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LucideIcon name="wand-sparkles" size={18} className="theme-accent-text" />
            <div>
              <h2 className="text-base font-extrabold text-[var(--text-main)]">
                智慧排程與變更預覽 (Preview Mode)
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                系統不會擅自改動行程，請檢視前後差異後再確認套用（支援一鍵復原）
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="關閉智慧排程"
            className="p-1.5 rounded-xl hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
          >
            <LucideIcon name="x" size={18} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 pt-4 space-y-3">
          <div
            ref={modeTabMarker.containerRef}
            className="relative grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]"
          >
            <span
              ref={modeTabMarker.indicatorRef}
              aria-hidden="true"
              data-testid="smart-mode-tab-indicator"
              className="um-elastic-indicator theme-accent-solid rounded-xl shadow-sm"
            />
            <button
              type="button"
              data-um-tab-active={mode === 'autofill' ? 'true' : 'false'}
              data-testid="smart-tab-autofill"
              onClick={() => setMode('autofill')}
              className={`relative z-10 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'autofill'
                  ? 'theme-accent-solid'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <LucideIcon name="sparkles" size={14} />
              <span>自動填入空檔</span>
            </button>
            <button
              type="button"
              data-um-tab-active={mode === 'push' ? 'true' : 'false'}
              data-testid="smart-tab-push"
              onClick={() => setMode('push')}
              className={`relative z-10 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'push'
                  ? 'theme-accent-solid'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <LucideIcon name="clock" size={14} />
              <span>延誤智慧順延</span>
            </button>
          </div>

          {mode === 'push' && (
            <div className="p-3 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                  選擇延誤或延長的行程
                </label>
                <select
                  data-testid="smart-push-anchor-select"
                  value={selectedAnchorId}
                  onChange={(e) => setSelectedAnchorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-main)]"
                >
                  {timedScheduledEvents.map((e) => (
                    <option key={e.id} value={e.id}>
                      {formatShortTime(e.startAt)} — {e.title} {e.isFlexible ? '(彈性)' : '(鎖定)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[var(--text-muted)]">預計延誤時間：</span>
                <div className="flex items-center gap-1">
                  {[15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDelayMinutes(m)}
                      className={`px-2.5 py-1 rounded-lg font-mono font-bold ${
                        delayMinutes === m
                          ? 'theme-accent-solid'
                          : 'bg-[var(--surface-glass)] text-[var(--text-muted)]'
                      }`}
                    >
                      +{m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Protected Locked Meetings Notice */}
          <div className="px-3 py-2 rounded-xl theme-accent-soft border text-[11px] flex items-center gap-2">
            <LucideIcon name="lock" size={14} className="shrink-0" />
            <span>
              已嚴格保護 {lockedIds.length} 筆不可移動之鎖定行程，僅自動調整未排待辦與標記「彈性」的時間塊。
            </span>
          </div>
        </div>

        {/* Proposal Diff List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {proposals.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <LucideIcon name="circle-check" size={28} className="mx-auto text-emerald-500 opacity-75" />
              <p className="text-sm font-bold text-[var(--text-main)]">
                {mode === 'autofill' ? '目前沒有尚未排程的待辦事項' : '此延誤不會與後續彈性時間塊產生衝突'}
              </p>
            </div>
          ) : (
            proposals.map((prop) => (
              <label
                key={prop.id}
                data-testid={`smart-proposal-item-${prop.targetId}`}
                className={`block p-3.5 rounded-2xl border transition-colors cursor-pointer space-y-2 ${
                  prop.selected
                    ? 'bg-[var(--accent-soft-bg)]/55 border-[var(--accent-soft-border)]'
                    : 'bg-[var(--surface-subtle)] border-[var(--border-subtle)] opacity-60'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={prop.selected}
                    onChange={() => toggleProposal(prop.id)}
                    className="mt-1 rounded theme-checkbox"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs sm:text-sm font-extrabold text-[var(--text-main)] schedule-title-wrap">
                        {prop.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold theme-accent-soft shrink-0">
                        {prop.action === 'schedule_task' ? '新排入時間塊' : '彈性順延'}
                      </span>
                    </div>

                    {/* Before -> After Diff */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-[var(--text-muted)] line-through">
                        {formatShortTime(prop.originalStartAt)}
                      </span>
                      <LucideIcon name="arrow-right" size={12} className="theme-accent-text" />
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                        {formatShortTime(prop.proposedStartAt)} – {formatShortTime(prop.proposedEndAt).slice(-5)}
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)]">{prop.reason}</p>
                  </div>
                </div>
              </label>
            ))
          )}

          {unscheduledNotes.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-1.5">
              <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                以下項目暫時無合適空檔：
              </div>
              {unscheduledNotes.map((u) => (
                <div key={u.id} className="text-[11px] text-[var(--text-muted)]">
                  · {u.title}：{u.reason}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="landscape-compact-drawer-bar px-4 sm:px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)]/75 flex items-center justify-between gap-2 pb-safe-bottom">
          <button
            type="button"
            onClick={closeModal}
            className="btn-sky-secondary px-3 sm:px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0"
          >
            取消預覽
          </button>
          <button
            type="button"
            data-testid="smart-apply-proposals-btn"
            disabled={selectedCount === 0}
            onClick={handleApply}
            className="btn-sky-primary px-3.5 sm:px-5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-45"
          >
            <LucideIcon name="check" size={14} className="shrink-0" />
            <span>套用 {selectedCount} 筆建議（可復原）</span>
          </button>
        </div>
      </div>
    </div>
  );
}

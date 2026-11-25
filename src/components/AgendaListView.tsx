import React, { useMemo, useState } from 'react';
import { LucideIcon } from './BrandMark';
import { COLOR_TOKEN_PALETTE } from '../data/seedData';
import { describeRecurrenceRule } from '../services/recurrenceEngine';
import { useScheduleStore } from '../store/useScheduleStore';
import type { ExpandedEventInstance } from '../types/schedule';

type AgendaFilter = 'all' | 'scheduled' | 'completed' | 'recurring' | 'flexible';

function formatHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface AgendaListViewProps {
  instances: ExpandedEventInstance[];
}

function AgendaListView({ instances }: AgendaListViewProps) {
  const {
    searchQuery,
    setSearchQuery,
    selectEvent,
    toggleEventComplete,
    openModal
  } = useScheduleStore();

  const [filter, setFilter] = useState<AgendaFilter>('all');

  const filteredInstances = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return instances.filter((inst) => {
      if (filter === 'scheduled' && inst.status === 'completed') return false;
      if (filter === 'completed' && inst.status !== 'completed') return false;
      if (filter === 'recurring' && !inst.recurrenceRule) return false;
      if (filter === 'flexible' && !inst.isFlexible) return false;

      if (!q) return true;
      return (
        inst.title.toLowerCase().includes(q) ||
        inst.notes.toLowerCase().includes(q) ||
        inst.categoryTag.toLowerCase().includes(q) ||
        inst.location.toLowerCase().includes(q)
      );
    });
  }, [instances, filter, searchQuery]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, ExpandedEventInstance[]>();
    for (const inst of filteredInstances) {
      const list = groups.get(inst.occurrenceDate) || [];
      list.push(inst);
      groups.set(inst.occurrenceDate, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredInstances]);

  const filterOptions: Array<{ id: AgendaFilter; label: string }> = [
    { id: 'all', label: '全部行程' },
    { id: 'scheduled', label: '進行中' },
    { id: 'completed', label: '已完成' },
    { id: 'recurring', label: '重複規則' },
    { id: 'flexible', label: '彈性可調' }
  ];

  return (
    <div data-testid="agenda-list-view" className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bento-glass-card p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0">
          <LucideIcon
            name="search"
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            data-testid="agenda-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="即時篩選行程標題、地點、備註或標籤..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                filter === opt.id
                  ? 'theme-accent-solid'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Agenda List */}
      {groupedByDate.length === 0 ? (
        <div className="bento-glass-card py-12 text-center space-y-2">
          <LucideIcon name="list-todo" size={28} className="mx-auto theme-accent-text opacity-75" />
          <p className="text-sm font-bold text-[var(--text-main)]">找不到符合條件的排程項目</p>
          <p className="text-xs text-[var(--text-muted)]">可調整篩選條件或使用上方自然語言快速新增</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([dateKey, items]) => (
            <section key={dateKey} className="bento-glass-card p-4 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <h3 className="text-xs sm:text-sm font-extrabold font-mono theme-accent-deep">
                  {dateKey}
                </h3>
                <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                  {items.length} 項排程
                </span>
              </div>

              <div className="space-y-2">
                {items.map((evt) => {
                  const palette = COLOR_TOKEN_PALETTE[evt.colorToken] || COLOR_TOKEN_PALETTE.sky;
                  const isDone = evt.status === 'completed';
                  return (
                    <div
                      key={evt.instanceId}
                      className={`p-3 rounded-2xl border flex items-center gap-3 ${palette.surfaceClass} ${palette.borderClass} ${
                        isDone ? 'opacity-65' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleEventComplete(evt.masterEventId)}
                        aria-label={isDone ? '標記為未完成' : '標記為已完成'}
                        className="shrink-0"
                      >
                        <LucideIcon
                          name={isDone ? 'circle-check' : 'circle'}
                          size={18}
                          className={isDone ? 'text-emerald-500' : 'opacity-65'}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => selectEvent(evt.masterEventId, evt.occurrenceDate)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-extrabold ${isDone ? 'line-through' : ''}`}>
                            {evt.title}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${palette.badgeClass}`}>
                            {evt.categoryTag}
                          </span>
                          {evt.recurrenceRule && (
                            <span className="text-[10px] font-semibold opacity-75 inline-flex items-center gap-0.5">
                              <LucideIcon name="repeat" size={10} />
                              {describeRecurrenceRule(evt.recurrenceRule)}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-[11px] opacity-80 flex-wrap">
                          <span className="font-mono">
                            {evt.allDay ? '全天' : `${formatHM(evt.startAt)} – ${formatHM(evt.endAt)}`}
                          </span>
                          {evt.location && (
                            <span className="inline-flex items-center gap-1">
                              <LucideIcon name="map-pin" size={11} />
                              {evt.location}
                            </span>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => openModal('focus', { focusTargetEventId: evt.masterEventId })}
                        aria-label="啟動專注番茄鐘"
                        className="p-2 rounded-xl bg-white/60 dark:bg-slate-900/50 hover:bg-[var(--accent-solid-bg)] hover:text-white transition-colors shrink-0"
                      >
                        <LucideIcon name="play" size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(AgendaListView);

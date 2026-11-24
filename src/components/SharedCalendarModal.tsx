import React, { useState } from 'react';
import { LucideIcon } from './BrandMark';
import { COLOR_TOKEN_LIST, COLOR_TOKEN_PALETTE } from '../data/seedData';
import { useScheduleStore } from '../store/useScheduleStore';
import type { CalendarRole, ColorToken } from '../types/schedule';

export default function SharedCalendarModal() {
  const {
    activeModal,
    closeModal,
    calendars,
    createCalendar,
    joinSharedCalendar,
    updateCalendarMemberRole,
    removeCalendarMember,
    getCurrentUserRoleForCalendar,
    showToast
  } = useScheduleStore();

  const [newCalName, setNewCalName] = useState('');
  const [newCalDesc, setNewCalDesc] = useState('');
  const [newCalColor, setNewCalColor] = useState<ColorToken>('violet');
  const [inviteInput, setInviteInput] = useState('');
  const [joining, setJoining] = useState(false);

  if (activeModal !== 'shared') return null;

  const sharedCalendars = calendars.filter((c) => c.isShared);

  const handleCreateShared = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalName.trim()) return;
    const created = createCalendar({
      name: newCalName.trim(),
      description: newCalDesc.trim() || '多人協作共享日曆',
      colorToken: newCalColor,
      icon: 'users',
      calendarSet: 'shared',
      isShared: true
    });
    setNewCalName('');
    setNewCalDesc('');
    showToast(`已建立共享日曆「${created.name}」，邀請碼：${created.inviteCode}`, {
      icon: 'users'
    });
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inviteInput.trim().toUpperCase();
    if (!clean) return;
    setJoining(true);
    try {
      const res = await joinSharedCalendar(clean);
      if (res.success) {
        setInviteInput('');
      }
    } finally {
      setJoining(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      }
    } catch {
      // Ignore clipboard fallback
    }
    showToast(`已複製共享邀請碼：${code}`, { icon: 'copy' });
  };

  return (
    <div
      data-testid="shared-calendar-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-md"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="多人共享日曆與成員權限管理"
        onClick={(e) => e.stopPropagation()}
        className="landscape-compact-modal max-h-dvh-92 overflow-y-auto w-full max-w-2xl bento-glass-card p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LucideIcon name="users" size={20} className="text-violet-500" />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-main)]">
                多人共享日曆與協作
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                與家人、情侶或團隊共用行事曆，在每一筆行程內即時留言討論
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="關閉共享日曆管理"
            className="p-2 rounded-xl hover:bg-[var(--surface-subtle)] text-[var(--text-muted)]"
          >
            <LucideIcon name="x" size={18} />
          </button>
        </div>

        {/* Join via 6-Char Invite Code */}
        <form
          onSubmit={handleJoin}
          className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-2.5"
        >
          <label className="block text-xs font-extrabold text-[var(--text-main)]">
            透過 6 碼邀請碼加入共享日曆
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              data-testid="shared-join-code-input"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
              maxLength={12}
              placeholder="輸入 6 碼邀請碼，例如 MEI248"
              className="flex-1 px-3 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-main)]"
            />
            <button
              type="submit"
              data-testid="shared-join-submit-btn"
              disabled={!inviteInput.trim() || joining}
              className="btn-sky-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 disabled:opacity-45"
            >
              <LucideIcon name="user-plus" size={14} />
              <span>{joining ? '加入中...' : '加入日曆'}</span>
            </button>
          </div>
        </form>

        {/* Active Shared Calendars & Member Roles */}
        <section className="space-y-3">
          <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
            已參與的共享日曆 ({sharedCalendars.length})
          </h3>

          {sharedCalendars.map((cal) => {
            const palette = COLOR_TOKEN_PALETTE[cal.colorToken] || COLOR_TOKEN_PALETTE.violet;
            const canManageMembers = getCurrentUserRoleForCalendar(cal.id) === 'owner';
            return (
              <div
                key={cal.id}
                data-testid={`shared-cal-card-${cal.id}`}
                className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/70 space-y-3"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${palette.dotClass}`} />
                    <div>
                      <h4 className="text-sm font-extrabold text-[var(--text-main)]">{cal.name}</h4>
                      <p className="text-[11px] text-[var(--text-muted)]">{cal.description}</p>
                    </div>
                  </div>
                  {cal.inviteCode && (
                    <button
                      type="button"
                      data-testid={`copy-invite-code-${cal.id}`}
                      onClick={() => void handleCopyCode(cal.inviteCode!)}
                      className="btn-sky-secondary px-3 py-1.5 rounded-xl text-xs font-mono font-bold inline-flex items-center gap-1.5"
                    >
                      <span>邀請碼：{cal.inviteCode}</span>
                      <LucideIcon name="copy" size={12} />
                    </button>
                  )}
                </div>

                {/* Members, Role Selector & Remove Member Action */}
                <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                  <div
                    data-testid={`shared-member-count-${cal.id}`}
                    className="text-[11px] font-bold text-[var(--text-muted)]"
                  >
                    成員權限 ({cal.members?.length || 1} 人)
                  </div>
                  {(cal.members || []).map((member) => {
                    const isOwnerMember = member.role === 'owner';
                    return (
                      <div
                        key={`${cal.id}-${member.userId}`}
                        data-testid={`shared-member-row-${cal.id}-${member.userId}`}
                        className="flex items-center justify-between gap-2 text-xs py-1 flex-wrap sm:flex-nowrap"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <LucideIcon name="user" size={13} className="text-sky-500 shrink-0" />
                          <span className="font-semibold text-[var(--text-main)] truncate">
                            {member.displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            aria-label={`${member.displayName} 的共享權限`}
                            value={member.role}
                            disabled={isOwnerMember || !canManageMembers}
                            onChange={(e) =>
                              updateCalendarMemberRole(cal.id, member.userId, e.target.value as CalendarRole)
                            }
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[var(--surface-glass)] border border-[var(--border-subtle)] disabled:opacity-70"
                          >
                            <option value="owner">擁有者 (Owner)</option>
                            <option value="editor">可編輯與留言 (Editor)</option>
                            <option value="viewer">僅檢視與留言 (Viewer)</option>
                          </select>
                          {!isOwnerMember && canManageMembers && (
                            <button
                              type="button"
                              data-testid={`remove-member-${cal.id}-${member.userId}`}
                              onClick={() => removeCalendarMember(cal.id, member.userId)}
                              aria-label={`移除成員 ${member.displayName}`}
                              title={`移除成員 ${member.displayName}`}
                              className="px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-400/25 hover:bg-rose-500/20 inline-flex items-center gap-1 transition-colors"
                            >
                              <LucideIcon name="user-minus" size={12} />
                              <span>移除</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {/* Create New Shared Calendar */}
        <form
          onSubmit={handleCreateShared}
          className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/70 space-y-3"
        >
          <h3 className="text-xs font-extrabold text-[var(--text-main)] inline-flex items-center gap-1.5">
            <LucideIcon name="plus" size={14} className="text-sky-500" />
            <span>建立新的多人共享日曆</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              data-testid="shared-create-name-input"
              value={newCalName}
              onChange={(e) => setNewCalName(e.target.value)}
              placeholder="共享日曆名稱（例如：家庭行程、旅行規劃）"
              className="px-3 py-2 rounded-xl text-xs bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-main)]"
            />
            <input
              type="text"
              value={newCalDesc}
              onChange={(e) => setNewCalDesc(e.target.value)}
              placeholder="簡短說明（選填）"
              className="px-3 py-2 rounded-xl text-xs bg-[var(--surface-glass)] border border-[var(--border-subtle)] text-[var(--text-main)]"
            />
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {COLOR_TOKEN_LIST.slice(0, 6).map((c) => (
                <button
                  key={c.token}
                  type="button"
                  onClick={() => setNewCalColor(c.token)}
                  className={`w-6 h-6 rounded-full ${c.dotClass} ${
                    newCalColor === c.token ? 'ring-2 ring-offset-2 ring-sky-500' : 'opacity-70'
                  }`}
                />
              ))}
            </div>
            <button
              type="submit"
              data-testid="shared-create-submit-btn"
              disabled={!newCalName.trim()}
              className="btn-sky-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 disabled:opacity-45"
            >
              <LucideIcon name="share-2" size={14} />
              <span>建立並產生邀請碼</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

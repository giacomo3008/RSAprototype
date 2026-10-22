import { useState, useEffect } from 'react';
import {
  X,
  Check,
  ArrowRight,
  Clock3,
  Send,
  MapPin,
  Search,
  ChevronLeft,
  AlertTriangle,
  Paperclip,
  Trash2,
} from 'lucide-react';
import type { CareEvent, EventDraft, EventType, Priority, Media } from '../domain/types';
import { EVENT_DEFAULTS } from '../domain/types';
import { t, localInput, fromLocalInput, time } from '../i18n';
import { EventIcon, PriorityBadge, ErrorBox } from './ui';
import { MediaCapture } from './MediaCapture';
import { useDialog } from './useDialog';
import type { Workspace } from './workspace';
export function Report({
  w,
  prefill,
  onClose,
}: {
  w: Workspace;
  prefill?: Partial<EventDraft>;
  onClose: () => void;
}) {
  const dialog = useDialog(onClose);
  const storageKey = `ras-event-draft-${w.person.id}-${w.session.wardId}`;
  const [draft, setDraft] = useState<EventDraft>(() => {
    const now = new Date(Date.now() + w.state.clockOffset).toISOString();
    const initial = {
      key: crypto.randomUUID(),
      wardId: w.session.wardId,
      type: 'Fall' as EventType,
      priority: 'High' as Priority,
      place: 'Room',
      notes: '',
      occurredAt: now,
      originalOccurredAt: now,
      mediaIds: [],
    };
    if (prefill) return { ...initial, ...prefill };
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : initial;
    } catch {
      return initial;
    }
  });
  const [residentQuery, setResidentQuery] = useState('');
  const [other, setOther] = useState(!!draft.subject);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<CareEvent>();
  const [attached, setAttached] = useState<Media[]>(
    w.state.media.filter((m) => draft.mediaIds.includes(m.id)),
  );
  const update = (data: Partial<EventDraft>) => setDraft((d) => ({ ...d, ...data }));
  useEffect(() => {
    if (!result) localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, storageKey, result]);

  const residents = w.state.residents
    .filter((r) => r.wardId === w.session.wardId && r.assignedStaffIds.includes(w.person.id))
    .filter((r) =>
      `${r.name} ${r.id} ${r.room}`.toLowerCase().includes(residentQuery.toLowerCase()),
    );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError('');
    setSending(true);
    try {
      const event = await w.api.report(w.session, draft);
      setResult(event);
      localStorage.removeItem(storageKey);
      await w.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="report-backdrop">
      <section
        ref={dialog}
        className="report-view"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
      >
        <header className="report-header">
          <div className="button-row">
            <span className="report-logo">
              <EventIcon type={draft.type} />
            </span>
            <div>
              <h2 id="report-title">{result ? 'Report submitted' : t('report.title')}</h2>
              <p>{result ? 'One report. A connected care team.' : t('report.subtitle')}</p>
            </div>
          </div>
          <button
            autoFocus
            className="icon-button"
            onClick={onClose}
            aria-label="Close report and keep draft"
          >
            <X size={22} />
          </button>
        </header>
        {result ? (
          <div className="report-success">
            <div className={`success-icon ${result.queued ? 'queued' : ''}`}>
              {result.queued ? <Clock3 size={36} /> : <Check size={36} />}
            </div>
            <span className="eyebrow">{result.id}</span>
            <h1>{result.queued ? t('report.queued') : t('report.sent')}</h1>
            {result.queued ? (
              <div className="warning-box">
                <AlertTriangle size={20} />
                <p>
                  Queued offline. Staff have not been notified. Use your ward’s urgent communication
                  procedure.
                </p>
              </div>
            ) : (
              <p>
                {result.priority === 'Low'
                  ? 'Saved to the diary and handover. No targeted notification was created.'
                  : w.state.notices.find((n) => n.eventId === result.id)?.recipientIds.length
                    ? 'Sent to eligible on-duty staff.'
                    : 'No eligible recipient is currently present. This event remains visibly unhandled for authorized follow-up.'}
              </p>
            )}
            <div className="report-receipt">
              <EventIcon type={result.type} />
              <div>
                <strong>
                  {result.type} · {result.residentId || result.subject}
                </strong>
                <span>
                  {result.place} · {time(result.occurredAt)}
                </span>
              </div>
              <PriorityBadge priority={result.priority} />
            </div>
            <button
              className="button primary full"
              onClick={() => {
                onClose();
                w.openEvent(result);
              }}
            >
              {t('common.view')}
              <ArrowRight size={18} />
            </button>
            {!result.queued && (
              <button
                className="button full"
                onClick={() => {
                  onClose();
                  w.openChat(`thread-${result.id}`);
                }}
              >
                {t('common.conversation')}
              </button>
            )}
            <button className="text-button" onClick={onClose}>
              Back to workspace
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="report-form">
            <div className="report-body">
              <div className="form-intro">
                <span className="badge neutral">
                  {w.state.wards.find((x) => x.id === w.session.wardId)?.name}
                </span>
                <label className="time-field">
                  <Clock3 size={16} />
                  {t('report.time')}
                  <input
                    type="datetime-local"
                    required
                    aria-label="Event occurrence time"
                    value={localInput(draft.occurredAt)}
                    onChange={(e) => {
                      try {
                        update({ occurredAt: fromLocalInput(e.target.value) });
                      } catch {
                        /* invalid input stays native-invalid */
                      }
                    }}
                  />
                </label>
              </div>
              <fieldset>
                <legend>{t('report.type')}</legend>
                <div className="event-type-grid">
                  {(Object.keys(EVENT_DEFAULTS) as EventType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={draft.type === type}
                      className={draft.type === type ? 'selected' : ''}
                      onClick={() => update({ type, priority: EVENT_DEFAULTS[type] })}
                    >
                      <EventIcon type={type} size={24} />
                      <span>{type}</span>
                      {draft.type === type && <Check className="type-check" size={12} />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="priority-field">
                <legend>{t('report.priority')}</legend>
                <div className="priority-options">
                  {(['Low', 'Medium', 'High'] as Priority[]).map((p) => (
                    <button
                      type="button"
                      key={p}
                      aria-pressed={draft.priority === p}
                      className={`priority-option ${draft.priority === p ? 'selected' : ''}`}
                      onClick={() => update({ priority: p })}
                    >
                      <PriorityBadge priority={p} />
                      {draft.priority === p && <Check size={15} />}
                    </button>
                  ))}
                </div>
                {draft.priority !== EVENT_DEFAULTS[draft.type] && (
                  <small>
                    Priority changed from {EVENT_DEFAULTS[draft.type]} to {draft.priority}. This
                    change will be recorded.
                  </small>
                )}
              </fieldset>
              <div className="report-two-fields">
                <fieldset>
                  <legend>{t('report.resident')}</legend>
                  <div className="search-field">
                    <Search size={16} />
                    <input
                      placeholder="Search assigned residents"
                      aria-label="Search assigned residents"
                      value={residentQuery}
                      onChange={(e) => setResidentQuery(e.target.value)}
                    />
                  </div>
                  <select
                    required={!other}
                    aria-label="Resident"
                    value={other ? 'other' : draft.residentId || ''}
                    onChange={(e) => {
                      if (e.target.value === 'other') {
                        setOther(true);
                        update({ residentId: undefined, subject: '', place: 'Corridor' });
                      } else {
                        const r = residents.find((r) => r.id === e.target.value);
                        setOther(false);
                        update({
                          residentId: r?.id,
                          subject: undefined,
                          place: r ? `Room ${r.room}` : 'Room',
                        });
                      }
                    }}
                  >
                    <option value="">Select a resident</option>
                    {residents.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {r.id} · Room {r.room}
                      </option>
                    ))}
                    <option value="other">Other · person, equipment or environment</option>
                  </select>
                  {other && (
                    <input
                      aria-label="Other subject"
                      placeholder="Person, equipment or environment"
                      required
                      value={draft.subject || ''}
                      onChange={(e) => update({ subject: e.target.value })}
                    />
                  )}
                </fieldset>
                <fieldset>
                  <legend>{t('report.place')}</legend>
                  <div className="place-input">
                    <MapPin size={17} />
                    <input
                      aria-label="Place"
                      required
                      value={draft.place}
                      onChange={(e) => update({ place: e.target.value })}
                    />
                  </div>
                  <div className="place-chips">
                    {['Room', 'Bathroom', 'Corridor', 'Dining room', 'Other'].map((p) => (
                      <button
                        className={draft.place.startsWith(p) ? 'selected' : ''}
                        key={p}
                        type="button"
                        onClick={() => {
                          const r = w.state.residents.find((r) => r.id === draft.residentId);
                          update({
                            place: p === 'Room' && r ? `Room ${r.room}` : p === 'Other' ? '' : p,
                          });
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              <label className="notes-label">
                {t('report.notes')}
                <span>{t('report.optional')}</span>
                <textarea
                  rows={2}
                  placeholder={t('report.notesPlaceholder')}
                  value={draft.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                />
              </label>
              <MediaCapture
                api={w.api}
                session={w.session}
                onAttach={(m) => {
                  setAttached((a) => [...a, m]);
                  update({ mediaIds: [...draft.mediaIds, m.id] });
                }}
              />
              {attached.length > 0 && (
                <div className="attached-list">
                  {attached
                    .filter((m) => draft.mediaIds.includes(m.id))
                    .map((m) => (
                      <span className="attachment-chip" key={m.id}>
                        <Paperclip size={14} />
                        {m.name}
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove ${m.name} from draft`}
                          onClick={() =>
                            update({ mediaIds: draft.mediaIds.filter((id) => id !== m.id) })
                          }
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                </div>
              )}
              {draft.sourceMessageId && (
                <div className="info-box">
                  Linked to the original message. Sending confirms this as an official event.
                </div>
              )}
              {error && <ErrorBox message={error} />}
            </div>
            <footer className="report-footer">
              <span>
                <span className="draft-dot" />
                {t('report.draft')}
              </span>
              <button
                type="button"
                className="text-button discard-draft"
                onClick={() => {
                  if (confirm('Discard this unsent event draft?')) {
                    localStorage.removeItem(storageKey);
                    onClose();
                  }
                }}
              >
                Discard
              </button>
              <button type="submit" className="button primary" disabled={sending}>
                {sending ? t('report.sending') : t('report.send')}
                <Send size={17} />
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  History,
  Link,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import type { CareEvent, Media } from '../domain/types';
import { has, eligible } from '../domain/permissions';
import { time, date } from '../i18n';
import { Modal, EventIcon, PriorityBadge, StatusBadge, Avatar, ErrorBox } from './ui';
import type { Workspace } from './workspace';
export function MediaView({ media }: { media: Media }) {
  return (
    <div className="record-media">
      {media.kind === 'photo' ? (
        <a href={media.url} target="_blank" rel="noreferrer">
          <img src={media.url} alt={media.name} />
        </a>
      ) : (
        <audio controls src={media.url} />
      )}
      <small>
        {media.name}
        {media.synthetic ? ' · Synthetic sample' : ''}
        {media.duration !== undefined ? ` · ${media.duration}s` : ''}
      </small>
      {media.transcript && (
        <details>
          <summary>Reviewed transcript · separate from recording</summary>
          <p>{media.transcript}</p>
        </details>
      )}
    </div>
  );
}
export function EventDetail({ w, id, onClose }: { w: Workspace; id: string; onClose: () => void }) {
  const e = w.state.events.find((e) => e.id === id);
  const [outcome, setOutcome] = useState('');
  const [amendment, setAmendment] = useState('');
  const [showHistory, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void w.api
      .readNotice(w.session, id)
      .then(w.refresh)
      .catch(() => {});
  }, [id]);
  if (!e)
    return (
      <Modal title="Record unavailable" onClose={onClose}>
        <div className="padded">
          <ErrorBox message="Access denied or record unavailable in your current scope." />
        </div>
      </Modal>
    );
  const r = w.state.residents.find((r) => r.id === e.residentId);
  const author = w.state.staff.find((p) => p.id === e.authorId);
  const notice = w.state.notices.find((n) => n.eventId === e.id);
  const diary = w.state.diary.find((d) => d.eventId === e.id);
  const doAction = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    const ok = await w.run(fn, success);
    setBusy(false);
    return ok;
  };
  return (
    <Modal title="Event details" onClose={onClose} wide>
      <div className="record-detail">
        <div className="record-hero">
          <span className={`event-symbol symbol-${e.priority.toLowerCase()}`}>
            <EventIcon type={e.type} size={27} />
          </span>
          <div>
            <span className="eyebrow">{e.id}</span>
            <h2>
              {e.type} · {r?.name || e.subject || e.residentId}
            </h2>
            <p>
              {e.place} · {date(e.occurredAt)} at {time(e.occurredAt)}
            </p>
          </div>
          <PriorityBadge priority={e.priority} />
        </div>
        <div className="record-status">
          <StatusBadge event={e} />
          {e.claimedBy && (
            <span>
              by {w.state.staff.find((p) => p.id === e.claimedBy)?.name} at {time(e.claimedAt!)}
            </span>
          )}
        </div>
        {e.queued && (
          <div className="warning-box">
            Queued offline. Staff have not been notified. Use your ward’s urgent communication
            procedure.{e.syncError && <p>{e.syncError}</p>}
            {!w.session.offline && (
              <button
                className="button"
                onClick={() => void w.run(() => w.api.sync(w.session), 'Synchronization checked.')}
              >
                Retry synchronization
              </button>
            )}
          </div>
        )}
        <section className="detail-section">
          <h3>Original report</h3>
          <p className="preserve-lines">{e.notes || 'No additional notes.'}</p>
          <div className="author-line">
            <Avatar person={author} size="small" />
            <span>
              {author?.name} · Registered {time(e.createdAt)}
            </span>
          </div>
          {e.originalOccurredAt !== e.occurredAt && (
            <p className="small muted">
              Occurrence time corrected from {time(e.originalOccurredAt)} to {time(e.occurredAt)}.
            </p>
          )}
          {e.priority !== e.defaultPriority && (
            <p className="small muted">
              Operational priority changed from {e.defaultPriority} to {e.priority} by the reporter.
            </p>
          )}
          {e.syncedAt && e.queued === false && e.syncedAt !== e.createdAt && (
            <p className="small muted">
              Synchronized {date(e.syncedAt)} at {time(e.syncedAt)}. Original occurrence time
              retained.
            </p>
          )}
          {e.sourceMessageId && (
            <button
              className="source-link"
              onClick={() => {
                const m = w.state.messages.find((m) => m.id === e.sourceMessageId);
                if (m) {
                  onClose();
                  w.openChat(m.conversationId);
                }
              }}
            >
              <Link size={15} />
              Original message · {e.sourceMessageId}
            </button>
          )}
        </section>
        {e.amendments.map((a, i) => (
          <section className="amendment" key={i}>
            <span className="badge neutral">Amendment {i + 1}</span>
            <p>{a.text}</p>
            <small>
              {w.state.staff.find((p) => p.id === a.authorId)?.name} · {time(a.at)}
            </small>
          </section>
        ))}
        {!!e.mediaIds.length && (
          <section className="detail-section">
            <h3>Attachments</h3>
            <div className="media-grid">
              {e.mediaIds
                .map((id) => w.state.media.find((m) => m.id === id))
                .filter((m): m is Media => !!m)
                .map((m) => (
                  <MediaView key={m.id} media={m} />
                ))}
            </div>
          </section>
        )}
        {e.status === 'Unhandled' && eligible(w.state, e, w.person, true) && !e.queued && (
          <button
            className="button primary full"
            disabled={busy || w.session.offline}
            onClick={() =>
              void doAction(
                () => w.api.claim(w.session, e.id),
                'You have taken charge of this event.',
              )
            }
          >
            <CheckCircle2 size={18} />
            Take charge
          </button>
        )}
        {e.status === 'Taken charge' && e.claimedBy === w.person.id && (
          <section className="detail-section">
            <label>
              Outcome note
              <textarea
                placeholder="Record the outcome without changing the original report"
                value={outcome}
                onChange={(x) => setOutcome(x.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={busy || !outcome.trim() || w.session.offline}
              onClick={() =>
                void doAction(
                  () => w.api.close(w.session, e.id, outcome),
                  'Event closed with outcome recorded.',
                )
              }
            >
              Close event
            </button>
          </section>
        )}
        {e.outcome && (
          <section className="detail-section outcome">
            <h3>Recorded outcome</h3>
            <p>{e.outcome}</p>
            <small>
              Closed by {w.state.staff.find((p) => p.id === e.closedBy)?.name} at{' '}
              {time(e.closedAt!)}
            </small>
          </section>
        )}
        {!e.queued && (
          <button
            className="button full"
            onClick={() => {
              onClose();
              w.openChat(`thread-${e.id}`);
            }}
          >
            Open event conversation <ArrowRight size={17} />
          </button>
        )}
        <details className="activity-details">
          <summary>Sources & activity</summary>
          <div className="detail-section">
            <p>
              <CheckCircle2 size={15} />
              Diary entry created · {diary?.id}
            </p>
            <p>
              <Clock3 size={15} />
              Occurrence: {time(e.occurredAt)} · Registration: {time(e.createdAt)}
            </p>
            {e.priority === 'Low' ? (
              <p>Low priority — diary and handover only. No targeted alert.</p>
            ) : (
              notice && (
                <>
                  <p>
                    Recipients selected:{' '}
                    {notice.recipientIds
                      .map((id) => w.state.staff.find((p) => p.id === id)?.name)
                      .filter(Boolean)
                      .join(', ') || 'None currently eligible — remains unhandled'}
                  </p>
                  <p>
                    Sent: {notice.sentAt ? time(notice.sentAt) : 'Not sent'} · Delivered in demo:{' '}
                    {notice.deliveredAt ? time(notice.deliveredAt) : 'Not delivered'}
                  </p>
                  <p>
                    Read by {Object.keys(notice.readBy).length} staff · Taken charge:{' '}
                    {notice.takenAt ? time(notice.takenAt) : 'No'} · Closed:{' '}
                    {notice.closedAt ? time(notice.closedAt) : 'No'}
                  </p>
                  <p>
                    Escalation level {notice.escalation}
                    {notice.remindedAt ? ` · Reminder at ${time(notice.remindedAt)}` : ''}
                  </p>
                </>
              )
            )}
            <p>Correlation: {e.correlationId}</p>
          </div>
        </details>
        <button className="button full" onClick={() => setHistory(!showHistory)}>
          <History size={17} />
          Version history ({diary?.versions.length || 1})
        </button>
        {showHistory && (
          <div className="version-history">
            {diary?.versions.map((v, i) => (
              <div key={i}>
                <strong>{i === 0 ? 'Original report' : `Amendment ${i}`}</strong>
                <p>{v.text || 'No notes.'}</p>
                <small>
                  {w.state.staff.find((p) => p.id === v.authorId)?.name} · {date(v.at)} {time(v.at)}
                </small>
              </div>
            ))}
          </div>
        )}
        {(e.authorId === w.person.id || has(w.person, e.wardId, 'coordinate')) && (
          <details className="activity-details">
            <summary>Add tracked amendment</summary>
            <label>
              Amendment
              <textarea
                value={amendment}
                onChange={(e) => setAmendment(e.target.value)}
                placeholder="Original content will be preserved"
              />
            </label>
            <button
              className="button"
              disabled={busy || !amendment.trim()}
              onClick={() =>
                void doAction(
                  () => w.api.amend(w.session, e.id, amendment),
                  'Amendment saved. Original report preserved.',
                ).then((ok) => {
                  if (ok) setAmendment('');
                })
              }
            >
              Save amendment
            </button>
          </details>
        )}
      </div>
    </Modal>
  );
}
export function OcrReview({ w, id, onClose }: { w: Workspace; id: string; onClose: () => void }) {
  const item = w.state.ocr.find((o) => o.id === id);
  const [text, setText] = useState(item?.corrected || item?.original || '');
  if (!item) return null;
  return (
    <Modal title="Document extraction review" onClose={onClose} wide>
      <div className="ocr-layout">
        <div>
          <img
            className="document-preview"
            src={w.state.media.find((m) => m.id === item.mediaId)?.url}
            alt="Original synthetic shift note"
          />
          <span className="badge neutral">Original image · synthetic sample</span>
        </div>
        <div>
          <span className={`badge ${item.reviewedAt ? 'priority-low' : 'priority-medium'}`}>
            {item.reviewedAt ? 'Extraction reviewed' : 'OCR · needs review'}
          </span>
          <h3>Check the extracted text</h3>
          <p className="muted">
            Extraction review confirms the transcription. It is separate from physician clinical
            validation.
          </p>
          <label>
            Original AI extraction<pre className="extraction-original">{item.original}</pre>
          </label>
          <p className="small">
            Uncertain value: <mark>{item.uncertain.join(', ')}</mark>
          </p>
          <label>
            Human-corrected text
            <textarea
              rows={5}
              value={text}
              readOnly={!!item.reviewedAt}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          {item.reviewedAt ? (
            <p className="small">
              Reviewed by {w.state.staff.find((p) => p.id === item.reviewedBy)?.name} ·{' '}
              {date(item.reviewedAt)} {time(item.reviewedAt)}
            </p>
          ) : (
            <button
              className="button primary full"
              onClick={() =>
                void w.run(
                  () => w.api.reviewOcr(w.session, id, text),
                  'Extracted text confirmed. Original output retained.',
                )
              }
            >
              <CheckCircle2 size={17} />
              Confirm extracted text
            </button>
          )}
          {has(w.person, item.wardId, 'validate') && item.reviewedAt && !item.validatedAt && (
            <button
              className="button full"
              onClick={() =>
                void w.run(() => w.api.validateOcr(w.session, id), 'Clinical validation recorded.')
              }
            >
              Validate clinical content
            </button>
          )}
          {item.validatedAt && (
            <p className="small">
              Clinical validation: {w.state.staff.find((p) => p.id === item.validatedBy)?.name} ·{' '}
              {time(item.validatedAt)}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

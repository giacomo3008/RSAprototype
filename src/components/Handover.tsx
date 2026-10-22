import { useState } from 'react';
import {
  Sparkles,
  ClipboardCheck,
  CheckCircle2,
  PenLine,
  ArrowRight,
  FileText,
  Send,
  Clock3,
  ShieldCheck,
  Link,
} from 'lucide-react';
import { has } from '../domain/permissions';
import { t, time, date } from '../i18n';
import { PageHeading, Avatar, Empty } from './ui';
import type { Workspace } from './workspace';
export function Handover({ w }: { w: Workspace }) {
  const h = w.state.handovers.find((h) => h.wardId === w.session.wardId);
  const [selected, setSelected] = useState<number>();
  const [contribution, setContribution] = useState('');
  const [busy, setBusy] = useState(false);
  if (!h) return <Empty title="No handover available" />;
  const v = h.versions.find((v) => v.number === selected) || h.versions.at(-1)!;
  const latest = v.number === h.versions.at(-1)!.number;
  const canSign = has(w.person, h.wardId, 'sign');
  const canValidate = has(w.person, h.wardId, 'validate');
  const unresolved = w.state.events.filter(
    (e) =>
      e.wardId === w.session.wardId && e.priority === 'High' && e.status !== 'Closed' && !e.queued,
  );
  const acked = v.acknowledgements.some((a) => a.staffId === w.person.id);
  const perform = async (fn: () => Promise<unknown>, text: string) => {
    setBusy(true);
    const ok = await w.run(fn, text);
    setBusy(false);
    return ok;
  };
  return (
    <>
      <PageHeading
        title={t('handover.title')}
        description={t('handover.subtitle')}
        action={
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void perform(
                () => w.api.draftHandover(w.session),
                'AI draft prepared from current ward records.',
              ).then(() => setSelected(undefined))
            }
          >
            <Sparkles size={17} />
            {v.signed ? 'Prepare amendment draft' : t('handover.draft')}
          </button>
        }
      />
      <div className="handover-overview">
        <div>
          <span className="badge neutral">
            {w.state.wards.find((w) => w.id === h.wardId)?.name}
          </span>
          <h2>Morning → Afternoon</h2>
          <p>Outgoing shift 07:00–14:00 · Incoming shift 14:00–21:00</p>
        </div>
        <div className="handover-steps">
          {[
            { label: 'AI draft', done: true },
            { label: 'Reviewed', done: !!v.reviewed },
            { label: 'Signed', done: !!v.signed },
            { label: 'Acknowledged', done: v.acknowledgements.length === h.incomingIds.length },
          ].map((s, i) => (
            <div key={s.label} className={s.done ? 'done' : ''}>
              <span>{s.done ? <CheckCircle2 size={17} /> : i + 1}</span>
              {s.label}
            </div>
          ))}
        </div>
      </div>
      {unresolved.length > 0 && (
        <div className="warning-box">
          <Clock3 size={20} />
          <div>
            <strong>
              {unresolved.length} unresolved high-priority{' '}
              {unresolved.length === 1 ? 'item' : 'items'}
            </strong>
            <p>
              These remain active until explicitly closed. Signing the handover does not resolve
              them.
            </p>
            {unresolved.map((e) => (
              <button className="source-link" key={e.id} onClick={() => w.openEvent(e)}>
                {e.type} · {e.residentId || e.subject}
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="handover-columns">
        <section className="panel">
          <div className="panel-header">
            <h2>
              <ClipboardCheck size={19} />
              Handover record
            </h2>
            <select
              aria-label="Handover version"
              value={v.number}
              onChange={(e) => setSelected(+e.target.value)}
            >
              {h.versions.map((v) => (
                <option key={v.number} value={v.number}>
                  Version {v.number}
                  {v.signed ? ' · Signed' : ' · AI draft'}
                </option>
              ))}
            </select>
          </div>
          <div className="handover-document">
            <div className="document-label">
              <span className={`badge ${v.signed ? 'priority-low' : 'neutral'}`}>
                {v.signed
                  ? 'Signed version'
                  : v.reviewed
                    ? 'Reviewed draft'
                    : 'AI draft · review required'}
              </span>
              <small>
                {date(v.createdAt)} · {time(v.createdAt)}
              </small>
            </div>
            <p className="preserve-lines handover-text">{v.text}</p>
            <div className="handover-source-list">
              <h3>
                <Link size={16} />
                Linked source reports
              </h3>
              {v.sourceIds.map((id) => {
                const e = w.state.events.find((e) => e.id === id);
                return e ? (
                  <button key={id} className="source-link" onClick={() => w.openEvent(e)}>
                    <FileText size={15} />
                    {e.type} · {e.residentId || e.subject}
                    <time>{time(e.occurredAt)}</time>
                    <ArrowRight size={14} />
                  </button>
                ) : null;
              })}
            </div>
            <div className="signature-list">
              {v.reviewed && (
                <p>
                  <CheckCircle2 size={16} />
                  <span>
                    Reviewed by{' '}
                    <strong>{w.state.staff.find((p) => p.id === v.reviewed?.staffId)?.name}</strong>
                    <small>
                      {date(v.reviewed.at)} {time(v.reviewed.at)} · v{v.number}
                    </small>
                  </span>
                </p>
              )}
              {v.validated && (
                <p>
                  <ShieldCheck size={16} />
                  <span>
                    Clinical validation by{' '}
                    <strong>
                      {w.state.staff.find((p) => p.id === v.validated?.staffId)?.name}
                    </strong>
                    <small>
                      {date(v.validated.at)} {time(v.validated.at)} · Physician
                    </small>
                  </span>
                </p>
              )}
              {v.signed && (
                <p>
                  <PenLine size={16} />
                  <span>
                    Signed by{' '}
                    <strong>{w.state.staff.find((p) => p.id === v.signed?.staffId)?.name}</strong>
                    <small>
                      {date(v.signed.at)} {time(v.signed.at)} · Outgoing coordinator · v{v.number}
                    </small>
                  </span>
                </p>
              )}
            </div>
            {!h.requiresClinicalValidation && (
              <p className="small muted">
                Clinical validation is a separate physician action; it is not required for this
                synthetic operational handover.
              </p>
            )}
            <div className="button-row">
              {latest && !v.signed && canSign && !v.reviewed && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void perform(
                      () => w.api.handoverAction(w.session, 'review'),
                      'Handover marked reviewed.',
                    )
                  }
                >
                  Mark reviewed
                </button>
              )}
              {latest && !v.signed && v.reviewed && canValidate && !v.validated && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    void perform(
                      () => w.api.handoverAction(w.session, 'validate'),
                      'Clinical validation recorded.',
                    )
                  }
                >
                  Validate clinical content
                </button>
              )}
              {latest && !v.signed && canSign && v.reviewed && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void perform(
                      () => w.api.handoverAction(w.session, 'sign'),
                      'Outgoing handover signed. This version is preserved.',
                    )
                  }
                >
                  <PenLine size={17} />
                  Sign outgoing handover
                </button>
              )}
              {latest && v.signed && h.incomingIds.includes(w.person.id) && !acked && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void perform(
                      () => w.api.handoverAction(w.session, 'acknowledge'),
                      'You acknowledged this signed version.',
                    )
                  }
                >
                  <CheckCircle2 size={17} />
                  Acknowledge this version
                </button>
              )}
              {acked && (
                <span className="badge priority-low">You acknowledged version {v.number}</span>
              )}
            </div>
            {v.signed && (
              <p className="small muted">
                Demo signature record · not a legally qualified digital signature.
              </p>
            )}
            {!canSign && !canValidate && !v.signed && (
              <div className="info-box">
                The outgoing coordinator reviews and signs this draft. You can contribute a shift
                summary below.
              </div>
            )}
          </div>
        </section>
        <aside>
          <section className="panel padded contribution">
            <h2>
              <PenLine size={18} />
              {t('handover.contribute')}
            </h2>
            <p className="muted small">
              Add the facts and open items you want the next shift to know.
            </p>
            <textarea
              aria-label="Your shift summary"
              rows={5}
              placeholder="What should the next team know?"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
            />
            <button
              className="button primary full"
              disabled={busy || !contribution.trim()}
              onClick={() =>
                void perform(
                  () => w.api.contribute(w.session, contribution),
                  'Your contribution was saved. Prepare a new draft to include it.',
                ).then((ok) => {
                  if (ok) setContribution('');
                })
              }
            >
              Add contribution <Send size={16} />
            </button>
            {w.state.summaries
              .filter((s) => s.wardId === h.wardId)
              .map((s) => (
                <div className="contribution-item" key={s.id}>
                  <strong>{w.state.staff.find((p) => p.id === s.authorId)?.name}</strong>
                  <p>{s.text}</p>
                  <small>
                    {time(s.createdAt)} · {s.eventIds.length} linked reports
                  </small>
                </div>
              ))}
          </section>
          <section className="panel acknowledgement-card">
            <div className="panel-header">
              <h2>Incoming team</h2>
            </div>
            {h.incomingIds.map((id) => {
              const p = w.state.staff.find((p) => p.id === id);
              const a = v.acknowledgements.find((a) => a.staffId === id);
              return (
                <div className="team-person" key={id}>
                  <Avatar person={p} />
                  <div>
                    <strong>{p?.name}</strong>
                    <small>
                      {a
                        ? `Acknowledged ${time(a.at)}`
                        : v.signed
                          ? 'Awaiting acknowledgement'
                          : 'Awaiting signed version'}
                    </small>
                  </div>
                  {a ? (
                    <CheckCircle2 size={18} className="text-teal" />
                  ) : (
                    <Clock3 size={18} className="muted" />
                  )}
                </div>
              );
            })}
          </section>
        </aside>
      </div>
    </>
  );
}

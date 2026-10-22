import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Users,
  Clock3,
  Search,
  ChevronRight,
  Check,
  LogIn,
  LogOut,
  ShieldCheck,
  Activity,
  Plus,
  FileText,
  SlidersHorizontal,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react';
import type { CareEvent, Availability } from '../domain/types';
import { has, eligible } from '../domain/permissions';
import { t, time, date, fullDate } from '../i18n';
import { Avatar, EventIcon, PriorityBadge, StatusBadge, Empty, PageHeading, Modal } from './ui';
import { MediaCapture } from './MediaCapture';
import type { Workspace } from './workspace';
import { roleName } from './workspace';
export function EventRow({
  event: e,
  w,
  compact = false,
}: {
  event: CareEvent;
  w: Workspace;
  compact?: boolean;
}) {
  const resident = w.state.residents.find((r) => r.id === e.residentId);
  const owner = w.state.staff.find((p) => p.id === e.claimedBy);
  const canClaim = eligible(w.state, e, w.person, true) && !e.queued && !w.session.offline;
  return (
    <article className={`event-row ${compact ? 'compact' : ''}`}>
      <button
        className={`event-symbol symbol-${e.priority.toLowerCase()}`}
        onClick={() => w.openEvent(e)}
        aria-label={`Open ${e.type} ${e.id}`}
      >
        <EventIcon type={e.type} />
      </button>
      <div className="event-main">
        <div className="event-title">
          <button className="title-button" onClick={() => w.openEvent(e)}>
            {e.type}
          </button>
          <PriorityBadge priority={e.priority} />
          {e.queued && <span className="badge">Queued</span>}
        </div>
        <button className="event-subject" onClick={() => w.openEvent(e)}>
          {resident?.name || e.subject || e.residentId}
          <span>·</span>
          {e.place}
        </button>
        {!compact && (
          <p className="event-note">
            {e.amendments.at(-1)?.text || e.notes || 'No additional notes.'}
          </p>
        )}
        <div className="event-meta">
          <StatusBadge event={e} />
          {owner && <span>by {owner.name.split(' ')[0]}</span>}
          <span className="dot-separator">·</span>
          <span>{time(e.occurredAt)}</span>
        </div>
      </div>
      <div className="event-action">
        {e.status === 'Unhandled' && canClaim ? (
          <button
            className="button claim-button"
            onClick={() =>
              void w.run(() => w.api.claim(w.session, e.id), 'You have taken charge of this event.')
            }
          >
            {t('inbox.claim')}
            <ArrowUpRight size={15} />
          </button>
        ) : (
          <button
            className="icon-button"
            aria-label={`View ${e.id}`}
            onClick={() => w.openEvent(e)}
          >
            <ChevronRight size={19} />
          </button>
        )}
      </div>
    </article>
  );
}
export function AttendanceControl({ w, large = false }: { w: Workspace; large?: boolean }) {
  const a = w.state.attendance.find(
    (a) => a.staffId === w.person.id && a.wardId === w.session.wardId,
  );
  if (!a) return null;
  return (
    <div className={large ? 'attendance-large' : 'attendance-control'}>
      <div className="attendance-heading">
        <span className={`presence ${a.checkedIn ? 'present' : ''}`} />
        <span>{a.checkedIn ? t('shift.checkedIn') : t('shift.checkedOut')}</span>
        <button
          className="text-button"
          onClick={() =>
            void w.run(
              () => w.api.attendance(w.session, w.person.id, !a.checkedIn, a.availability),
              a.checkedIn
                ? 'Checked out. You are no longer eligible for alerts.'
                : 'Checked in. Routing eligibility updated.',
            )
          }
        >
          {a.checkedIn ? <LogOut size={15} /> : <LogIn size={15} />}{' '}
          {a.checkedIn ? t('shift.checkOut') : t('shift.checkIn')}
        </button>
      </div>
      <div className="segmented availability">
        {(['Available', 'Busy', 'On break'] as Availability[]).map((v) => (
          <button
            key={v}
            disabled={!a.checkedIn}
            className={a.availability === v ? 'selected' : ''}
            onClick={() =>
              void w.run(
                () => w.api.attendance(w.session, w.person.id, a.checkedIn, v),
                'Availability updated.',
              )
            }
          >
            <span className={`availability-dot ${v.toLowerCase().replace(' ', '-')}`} />
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
export function Home({ w }: { w: Workspace }) {
  const [filter, setFilter] = useState('All active');
  const es = w.state.events.filter((e) => e.wardId === w.session.wardId && !e.queued);
  const active = es.filter((e) => e.status !== 'Closed');
  const notices = w.state.notices;
  const mine = active.filter(
    (e) =>
      e.claimedBy === w.person.id ||
      (e.status === 'Unhandled' &&
        notices.some((n) => n.eventId === e.id && n.recipientIds.includes(w.person.id))),
  );
  const list = (
    filter === 'Assigned to me'
      ? mine
      : filter === 'High priority'
        ? active.filter((e) => e.priority === 'High')
        : active
  ).sort(
    (a, b) =>
      ({ High: 0, Medium: 1, Low: 2 })[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority],
  );
  const ward = w.state.wards.find((x) => x.id === w.session.wardId);
  const h = w.state.handovers.find((x) => x.wardId === w.session.wardId);
  const v = h?.versions.at(-1);
  const team = w.state.attendance.filter((a) => a.wardId === w.session.wardId && a.checkedIn);
  const today = new Date(Date.now() + w.state.clockOffset).toISOString();
  return (
    <>
      <PageHeading
        eyebrow={t('home.eyebrow')}
        title={`Hello, ${w.person.name.replace('Dr. ', '').split(' ')[0]}.`}
        description={t('home.description')}
        action={
          <div className="date-display">
            <CalendarDays size={17} />
            {fullDate(today)}
          </div>
        }
      />
      <div className="shift-strip">
        <div className="shift-strip-label">
          <span className="shift-icon">
            <Activity size={20} />
          </span>
          <div>
            <strong>{ward?.name}</strong>
            <span>
              Morning shift <span className="dot-separator">·</span> 07:00–14:00
            </span>
          </div>
        </div>
        <span className="role-tag">
          {roleName(w.person.assignments.find((a) => a.wardId === w.session.wardId)!.role)}
        </span>
        <AttendanceControl w={w} />
      </div>
      <div className="stats-grid">
        {[
          {
            label: t('home.assigned'),
            value: mine.length,
            icon: ClipboardCheck,
            color: 'teal',
            desc: 'Your attention makes a difference',
            filter: 'Assigned to me',
          },
          {
            label: t('home.unhandled'),
            value: active.filter((e) => e.status === 'Unhandled' && e.priority !== 'Low').length,
            icon: Clock3,
            color: 'amber',
            desc: 'Waiting for someone to take charge',
            filter: 'All active',
          },
          {
            label: t('home.high'),
            value: active.filter((e) => e.priority === 'High').length,
            icon: ArrowUpRight,
            color: 'red',
            desc: 'Prioritized for the on-duty team',
            filter: 'High priority',
          },
        ].map((item) => (
          <button
            key={item.label}
            className={`stat-card stat-${item.color}`}
            onClick={() => setFilter(item.filter)}
          >
            <div>
              <span className="stat-label">{item.label}</span>
              <span className="stat-number">{String(item.value).padStart(2, '0')}</span>
              <span className="stat-description">{item.desc}</span>
            </div>
            <span className="stat-icon">
              <item.icon size={21} />
            </span>
          </button>
        ))}
      </div>
      <div className="home-columns">
        <div className="home-primary">
          <section className="panel active-panel">
            <div className="panel-header">
              <h2>
                {t('home.active')}
                <span className="count-bubble">{active.length}</span>
              </h2>
              <button className="text-button" onClick={() => w.go('inbox')}>
                View inbox <ArrowRight size={16} />
              </button>
            </div>
            <div className="tabs small-tabs">
              {['All active', 'Assigned to me', 'High priority'].map((f) => (
                <button
                  key={f}
                  className={filter === f ? 'active' : ''}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="event-list">
              {list.map((e) => (
                <EventRow key={e.id} event={e} w={w} />
              ))}
              {!list.length && <Empty title={t('home.empty')} description={t('home.emptyText')} />}
            </div>
          </section>
          <div className="shortcut-grid">
            <button className="shortcut" onClick={() => w.go('diary')}>
              <span className="shortcut-icon">
                <BookOpen size={23} />
              </span>
              <span>
                <strong>{t('home.diary')}</strong>
                <small>{t('home.diaryText')}</small>
                <b>
                  Open ward diary <ArrowRight size={14} />
                </b>
              </span>
            </button>
            <button className="shortcut" onClick={() => w.go('handover')}>
              <span className="shortcut-icon lavender">
                <ClipboardCheck size={23} />
              </span>
              <span>
                <strong>{t('home.handover')}</strong>
                <small>{t('home.handoverText')}</small>
                <b>
                  Go to handover <ArrowRight size={14} />
                </b>
              </span>
            </button>
          </div>
          <section className="panel activity-panel">
            <div className="panel-header">
              <h2>{t('home.activity')}</h2>
              <span className="muted small">Today</span>
            </div>
            {es.slice(0, 3).map((e) => (
              <button key={e.id} className="activity-line" onClick={() => w.openEvent(e)}>
                <span className="timeline-dot" />
                <div>
                  <strong>{w.state.staff.find((p) => p.id === e.authorId)?.name}</strong> reported a{' '}
                  {e.type.toLowerCase()}
                  <span>
                    {e.residentId || e.subject} · {e.place}
                  </span>
                </div>
                <time>{time(e.createdAt)}</time>
              </button>
            ))}
          </section>
        </div>
        <aside className="home-aside">
          <section className="panel handover-card">
            <div className="panel-header">
              <h2>
                <ClipboardCheck size={18} /> Shift handover
              </h2>
              <span className="badge neutral">Morning</span>
            </div>
            <div className="handover-illustration">
              <ClipboardCheck size={30} />
              <span>Keep care moving forward.</span>
            </div>
            <div className="handover-card-body">
              <span className={`badge ${v?.signed ? 'priority-medium' : 'neutral'}`}>
                {v?.signed ? 'Awaiting acknowledgement' : 'AI draft · needs review'}
              </span>
              <h3>The next shift starts with you.</h3>
              <p>
                {v?.signed
                  ? `${v.acknowledgements.length} of ${h?.incomingIds.length} incoming staff have acknowledged this handover.`
                  : 'Review the recorded facts and open items before signing.'}
              </p>
              <div className="progress-track">
                <i
                  style={{
                    width: `${v?.acknowledgements.length ? (v.acknowledgements.length / (h?.incomingIds.length || 1)) * 100 : 0}%`,
                  }}
                />
              </div>
              <button className="button full" onClick={() => w.go('handover')}>
                Review handover <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <section className="panel team-card">
            <div className="panel-header">
              <h2>{t('home.team')}</h2>
              <span className="muted small">{team.length} present</span>
            </div>
            {team.slice(0, 4).map((a) => {
              const p = w.state.staff.find((p) => p.id === a.staffId);
              return (
                <div className="team-person" key={a.staffId}>
                  <Avatar person={p} />
                  <div>
                    <strong>
                      {p?.name}
                      {p?.id === w.person.id && <span className="muted small"> (you)</span>}
                    </strong>
                    <small>
                      {roleName(
                        p?.assignments.find((a) => a.wardId === w.session.wardId)?.role || '',
                      )}
                    </small>
                  </div>
                  <span
                    className={`availability-dot ${a.availability.toLowerCase().replace(' ', '-')}`}
                    title={a.availability}
                    aria-label={a.availability}
                  />
                </div>
              );
            })}
            <button
              className="text-button team-link"
              onClick={() => w.go(has(w.person, w.session.wardId, 'coordinate') ? 'team' : 'shift')}
            >
              View shift details <ArrowRight size={15} />
            </button>
          </section>
          <div className="quiet-note">
            <ShieldCheck size={18} />
            <p>
              Shared with your authorized ward team.
              <br />
              Always grounded in recorded facts.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
export function Inbox({ w }: { w: Workspace }) {
  const [filter, setFilter] = useState('My items');
  const [priority, setPriority] = useState('All priorities');
  const list = w.state.events
    .filter((e) => e.wardId === w.session.wardId && e.priority !== 'Low' && !e.queued)
    .filter((e) => priority === 'All priorities' || e.priority === priority)
    .filter((e) =>
      filter === 'My items'
        ? e.claimedBy === w.person.id ||
          w.state.notices.some((n) => n.eventId === e.id && n.recipientIds.includes(w.person.id))
        : filter === 'Unhandled'
          ? e.status === 'Unhandled'
          : filter === 'Closed'
            ? e.status === 'Closed'
            : true,
    )
    .sort(
      (a, b) =>
        ({ High: 0, Medium: 1, Low: 2 })[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority],
    );
  return (
    <>
      <PageHeading title={t('inbox.title')} description={t('inbox.subtitle')} />
      <section className="panel">
        <div className="filter-bar">
          <div className="tabs">
            {['My items', 'Ward', 'Unhandled', 'Closed'].map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {['All priorities', 'High', 'Medium'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        {list.map((e) => (
          <div key={e.id}>
            <EventRow event={e} w={w} />
            {w.state.notices.find((n) => n.eventId === e.id)?.escalation ? (
              <div className="escalation-line">Escalated · coordinator notified if eligible</div>
            ) : null}
          </div>
        ))}
        {!list.length && (
          <Empty
            title="No notifications in this view"
            description="Low-priority reports remain in the diary and handover."
          />
        )}
      </section>
    </>
  );
}
export function Diary({ w, onOcr }: { w: Workspace; onOcr: (id: string) => void }) {
  const [captureDoc, setCaptureDoc] = useState(false);
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('All priorities');
  const [status, setStatus] = useState('All statuses');
  const [type, setType] = useState('All types');
  const [day, setDay] = useState('');
  const events = w.state.events
    .filter((e) => e.wardId === w.session.wardId)
    .filter((e) => priority === 'All priorities' || e.priority === priority)
    .filter((e) => status === 'All statuses' || e.status === status)
    .filter((e) => type === 'All types' || e.type === type)
    .filter(
      (e) =>
        !day ||
        new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(
          new Date(e.occurredAt),
        ) === day,
    )
    .filter((e) =>
      `${e.id} ${e.residentId} ${w.state.residents.find((r) => r.id === e.residentId)?.name} ${e.subject} ${e.type} ${e.notes} ${e.place} ${e.amendments.map((a) => a.text).join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  return (
    <>
      <PageHeading
        title={t('diary.title')}
        description={t('diary.subtitle')}
        action={
          <button className="button primary" onClick={() => w.report()}>
            <Plus size={18} />
            {t('nav.report')}
          </button>
        }
      />
      <div className="diary-layout">
        <section className="panel">
          <div className="diary-filters">
            <div className="search-field">
              <Search size={18} />
              <input
                aria-label={t('diary.search')}
                placeholder={t('diary.search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="button-row">
              <select
                aria-label="Diary priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {['All priorities', 'High', 'Medium', 'Low'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                aria-label="Diary status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {['All statuses', 'Unhandled', 'Taken charge', 'Closed'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                aria-label="Diary event type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {[
                  'All types',
                  'Fall',
                  'Health',
                  'Wandering',
                  'Agitation',
                  'Refusal',
                  'Skin / wound',
                  'Safety',
                  'Hygiene',
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <input
                type="date"
                aria-label="Diary date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
          </div>
          <div className="section-day">
            <CalendarDays size={16} />
            {day ? date(`${day}T12:00:00Z`) : 'All recorded reports'}
            <span>{events.length} entries</span>
          </div>
          {events.map((e) => (
            <EventRow key={e.id} event={e} w={w} />
          ))}
          {!events.length && (
            <Empty
              title={t('common.noResults')}
              description="Try another date, resident or event type."
            />
          )}
        </section>
        <aside>
          <section className="panel">
            <div className="panel-header">
              <h2>
                <FileText size={18} />
                {t('diary.documents')}
              </h2>
            </div>
            <button className="button document-capture" onClick={() => setCaptureDoc(true)}>
              <Plus size={16} />
              Capture document
            </button>
            {w.state.ocr
              .filter((o) => o.wardId === w.session.wardId)
              .map((o) => (
                <button className="document-card" key={o.id} onClick={() => onOcr(o.id)}>
                  <img
                    src={w.state.media.find((m) => m.id === o.mediaId)?.url}
                    alt="Synthetic shift note"
                  />
                  <strong>{o.title}</strong>
                  <span className={`badge ${o.reviewedAt ? 'priority-low' : 'priority-medium'}`}>
                    {o.reviewedAt ? 'Extraction reviewed' : 'OCR · needs review'}
                  </span>
                  <span className="text-button">
                    Open document <ArrowRight size={15} />
                  </span>
                </button>
              ))}
            {!w.state.ocr.some((o) => o.wardId === w.session.wardId) && (
              <Empty title="No documents to review" />
            )}
          </section>
        </aside>
      </div>
      {captureDoc && (
        <Modal title="Capture a document" onClose={() => setCaptureDoc(false)}>
          <div className="padded">
            <p className="muted">
              Attach an image for text review. Synthetic samples include simulated OCR; real images
              require manual transcription.
            </p>
            <MediaCapture
              api={w.api}
              session={w.session}
              onAttach={(m) =>
                void w.run(async () => {
                  if (m.kind !== 'photo') throw new Error('Choose a photo for document review.');
                  const id = await w.api.createOcr(w.session, m.id);
                  await w.refresh();
                  setCaptureDoc(false);
                  onOcr(id);
                })
              }
            />
          </div>
        </Modal>
      )}
    </>
  );
}
export function Shift({ w, team = false }: { w: Workspace; team?: boolean }) {
  const attendance = w.state.attendance.filter((a) => a.wardId === w.session.wardId);
  return (
    <>
      <PageHeading
        title={team ? 'Ward team overview' : t('nav.shift')}
        description="Attendance is shared with routing. Keep your availability up to date."
      />
      <div className="two-columns">
        <section className="panel padded">
          <h2>Morning shift</h2>
          <p className="muted">
            07:00–14:00 · {w.state.wards.find((wd) => wd.id === w.session.wardId)?.name}
          </p>
          <AttendanceControl w={w} large />
          <div className="info-box">
            <Clock3 size={19} />
            <p>
              Checked-out and on-break staff are excluded from new alert routing. Busy qualified
              staff remain eligible so urgent events are never silently discarded.
            </p>
          </div>
          <h3>Ward shifts</h3>
          {w.state.shifts
            .filter((s) => s.wardId === w.session.wardId)
            .map((s) => (
              <div className="settings-row" key={s.id}>
                <strong>{s.name}</strong>
                <span>
                  {s.start}–{s.end}
                </span>
              </div>
            ))}
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>
              <Users size={18} />
              Staff & coverage
            </h2>
          </div>
          {attendance.map((a) => {
            const p = w.state.staff.find((p) => p.id === a.staffId);
            if (!p) return null;
            return (
              <div className="staff-detail" key={a.staffId}>
                <div className="team-person">
                  <Avatar person={p} />
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {roleName(
                        p.assignments.find((a) => a.wardId === w.session.wardId)?.role || '',
                      )}
                    </small>
                  </div>
                  <span className={`badge ${a.checkedIn ? 'priority-low' : 'neutral'}`}>
                    {a.checkedIn ? a.availability : 'Off duty'}
                  </span>
                </div>
                <div className="staff-skills">
                  {p.skills.map((s) => (
                    <span className="badge neutral" key={s}>
                      {s}
                    </span>
                  ))}
                  <span>
                    {
                      w.state.events.filter(
                        (e) => e.claimedBy === p.id && e.status === 'Taken charge',
                      ).length
                    }{' '}
                    assigned
                  </span>
                </div>
                {team && has(w.person, w.session.wardId, 'coordinate') && (
                  <div className="button-row">
                    <button
                      className="button"
                      onClick={() =>
                        void w.run(
                          () => w.api.attendance(w.session, p.id, !a.checkedIn, a.availability),
                          'Staff attendance updated.',
                        )
                      }
                    >
                      {a.checkedIn ? 'Check out' : 'Check in'}
                    </button>
                    <select
                      aria-label={`${p.name} availability`}
                      value={a.availability}
                      onChange={(e) =>
                        void w.run(
                          () =>
                            w.api.attendance(
                              w.session,
                              p.id,
                              a.checkedIn,
                              e.target.value as Availability,
                            ),
                          'Staff availability updated.',
                        )
                      }
                    >
                      <option>Available</option>
                      <option>Busy</option>
                      <option>On break</option>
                    </select>
                    <select
                      aria-label={`${p.name} assigned shift`}
                      value={a.shiftId}
                      onChange={(e) =>
                        void w.run(
                          () => w.api.assignShift(w.session, p.id, e.target.value),
                          'Shift assigned. Staff must check in for the new shift.',
                        )
                      }
                    >
                      {w.state.shifts
                        .filter((s) => s.wardId === w.session.wardId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} shift
                          </option>
                        ))}
                    </select>
                    <button
                      className="button"
                      onClick={() => {
                        const value = prompt(
                          'Edit staff skills (comma separated). Routing uses care and safety skills.',
                          p.skills.join(', '),
                        );
                        if (value !== null)
                          void w.run(
                            () => w.api.updateSkills(w.session, p.id, value.split(',')),
                            'Skills updated. Future routing uses the new skills.',
                          );
                      }}
                    >
                      Edit skills
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}
export function More({ w }: { w: Workspace }) {
  return (
    <>
      <PageHeading
        title="Your workspace"
        description="Everything you need for a connected shift."
      />
      <div className="more-grid">
        {[
          {
            page: 'diary' as const,
            icon: BookOpen,
            title: 'Ward diary',
            text: 'Reports, amendments and document review',
          },
          {
            page: 'handover' as const,
            icon: ClipboardCheck,
            title: 'Shift handover',
            text: 'Contributions, signatures and acknowledgements',
          },
          {
            page: 'shift' as const,
            icon: Clock3,
            title: 'My shift',
            text: 'Attendance and team coverage',
          },
          {
            page: 'settings' as const,
            icon: SlidersHorizontal,
            title: 'Settings',
            text: 'Ward preferences and routing summary',
          },
          ...(has(w.person, w.session.wardId, 'coordinate')
            ? [
                {
                  page: 'team' as const,
                  icon: Users,
                  title: 'Team overview',
                  text: 'Manage ward attendance and coverage',
                },
              ]
            : []),
        ].map((x) => (
          <button className="panel more-link" key={x.page} onClick={() => w.go(x.page)}>
            <x.icon size={24} />
            <div>
              <strong>{x.title}</strong>
              <small>{x.text}</small>
            </div>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    </>
  );
}

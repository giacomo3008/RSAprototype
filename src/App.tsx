import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home as HomeIcon,
  MessageCircle,
  Plus,
  Bell,
  MoreHorizontal,
  BookOpen,
  ClipboardCheck,
  Clock3,
  Users,
  Settings2,
  ShieldCheck,
  LayoutDashboard,
  Unplug,
  ChevronDown,
  ArrowUpRight,
  WifiOff,
  Wifi,
  Sparkles,
  FlaskConical,
  X,
  RefreshCw,
  ArrowRight,
  LifeBuoy,
  LogOut,
} from 'lucide-react';
import type { CareEvent, EventDraft, State, Session } from './domain/types';
import { has } from './domain/permissions';
import { IndexedRepository, subscribe } from './services/repository';
import { DemoApi } from './services/api';
import { t, date } from './i18n';
import { Avatar, Modal, Empty, ErrorBox } from './components/ui';
import { Home, Inbox, Diary, Shift, More } from './components/CareScreens';
import { Chat } from './components/Chat';
import { Handover } from './components/Handover';
import { Settings, Management, Accounts, Integrations, Audit } from './components/Consoles';
import { Report } from './components/Report';
import { EventDetail, OcrReview } from './components/RecordDetails';
import type { Workspace, Page } from './components/workspace';
import { roleName } from './components/workspace';
const api = new DemoApi(new IndexedRepository());
const navigation = [
  { id: 'home', label: 'nav.home', icon: HomeIcon },
  { id: 'chat', label: 'nav.chat', icon: MessageCircle },
  { id: 'inbox', label: 'nav.inbox', icon: Bell },
  { id: 'diary', label: 'nav.diary', icon: BookOpen },
  { id: 'handover', label: 'nav.handover', icon: ClipboardCheck },
  { id: 'shift', label: 'nav.shift', icon: Clock3 },
  { id: 'team', label: 'nav.team', icon: Users },
  { id: 'management', label: 'nav.management', icon: LayoutDashboard },
  { id: 'accounts', label: 'nav.accounts', icon: Users },
  { id: 'integrations', label: 'nav.integrations', icon: Unplug },
  { id: 'audit', label: 'nav.audit', icon: ShieldCheck },
  { id: 'settings', label: 'nav.settings', icon: Settings2 },
] as const;
function initialSession(): Session {
  try {
    const old = JSON.parse(localStorage.getItem('ras-demo-session') || 'null');
    if (old) return { ...old, offline: !navigator.onLine || old.offline };
  } catch {
    /* use default demo account */
  }
  return { staffId: 'nurse', wardId: 'willow', offline: !navigator.onLine };
}
function App() {
  const [session, setSession] = useState<Session>(initialSession);
  const [state, setState] = useState<State>();
  const [page, setPage] = useState<Page>((location.hash.slice(1).split('?')[0] || 'home') as Page);
  const [chatId, setChatId] = useState<string>();
  const [reportOpen, setReportOpen] = useState(false);
  const [prefill, setPrefill] = useState<Partial<EventDraft>>();
  const [eventId, setEventId] = useState<string>();
  const [ocrId, setOcrId] = useState<string>();
  const [demoOpen, setDemoOpen] = useState(false);
  const [personas, setPersonas] = useState<Awaited<ReturnType<DemoApi['personas']>>>([]);
  const [toast, setToast] = useState<{ text: string; error?: boolean }>();
  const [loadError, setLoadError] = useState('');
  const [queueOpen, setQueueOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [help, setHelp] = useState(false);
  const refreshRequest = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = useCallback(async () => {
    const request = ++refreshRequest.current;
    try {
      const next = await api.view(session);
      if (request === refreshRequest.current) {
        setState(next);
        setLoadError('');
      }
    } catch (e) {
      if (request === refreshRequest.current) setLoadError((e as Error).message);
    }
  }, [session]);
  useEffect(() => {
    void refresh();
    void api.personas().then(setPersonas);
    localStorage.setItem('ras-demo-session', JSON.stringify(session));
    return subscribe(() => {
      void refresh();
      void api.personas().then(setPersonas);
    });
  }, [refresh, session]);
  useEffect(() => {
    const fn = () => setPage((location.hash.slice(1).split('?')[0] || 'home') as Page);
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 7000);
  }, []);
  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      try {
        await fn();
        await refresh();
        if (success) notify(success);
        return true;
      } catch (e) {
        notify((e as Error).message, true);
        return false;
      }
    },
    [refresh, notify],
  );
  useEffect(() => {
    const online = () => setSession((s) => ({ ...s, offline: false }));
    const offline = () => setSession((s) => ({ ...s, offline: true }));
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);
  useEffect(() => {
    if (!session.offline)
      void api
        .sync(session)
        .then((result) => {
          if (result.some((r) => !r.error))
            notify('Queued reports synchronized once. Original event times retained.');
          if (result.some((r) => r.error))
            notify('Some reports could not synchronize. Review your pending queue.', true);
          void refresh();
        })
        .catch((e) => notify((e as Error).message, true));
  }, [session.offline, session.staffId]);
  const go = (p: Page) => {
    setPage(p);
    location.hash = p;
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const person = state?.staff.find((p) => p.id === session.staffId);
  const care = person && has(person, session.wardId, 'care');
  const admin = person && has(person, session.wardId, 'admin');
  const management = person && has(person, session.wardId, 'aggregate');
  useEffect(() => {
    if (!person) return;
    if (!care && page === 'home') go(admin ? 'accounts' : management ? 'management' : 'settings');
  }, [person?.id, care, admin, management]);
  const report = (data?: Partial<EventDraft>) => {
    setPrefill(data);
    setReportOpen(true);
  };
  const openChat = (id: string) => {
    setChatId(id);
    go('chat');
  };
  const allowed = (p: string) => {
    if (p === 'team') return !!person && has(person, session.wardId, 'coordinate');
    if (p === 'management') return !!management;
    if (['accounts', 'integrations', 'audit'].includes(p)) return !!admin;
    if (p === 'settings') return true;
    return !!care && ['home', 'chat', 'inbox', 'diary', 'handover', 'shift', 'more'].includes(p);
  };
  if (!state || !person || loadError)
    return (
      <div className="boot-screen">
        <div className="brand-mark">
          <Plus size={31} />
        </div>
        <h1>RAS Agentica</h1>
        {loadError ? (
          <>
            <ErrorBox message={loadError} retry={() => void refresh()} />
            <button
              className="button"
              onClick={() => {
                setSession({ staffId: 'nurse', wardId: 'willow', offline: false });
              }}
            >
              Return to demo nurse
            </button>
          </>
        ) : (
          <p>{t('common.loading')}</p>
        )}
      </div>
    );
  const w: Workspace = {
    state,
    person,
    session,
    api,
    refresh,
    run,
    go,
    report,
    openChat,
    openEvent: (e) => setEventId(e.id),
  };
  const nav = navigation.filter((n) => allowed(n.id));
  const unread = state.messages.filter(
    (m) => !m.readBy.includes(person.id) && m.senderId !== person.id,
  ).length;
  const high = state.events.filter(
    (e) =>
      e.wardId === session.wardId && e.priority === 'High' && e.status === 'Unhandled' && !e.queued,
  ).length;
  const queued = state.events.filter((e) => e.queued && e.authorId === person.id);
  const ward = state.wards.find((w) => w.id === session.wardId);
  const currentRole = person.assignments.find((a) => a.wardId === session.wardId)?.role || '';
  const content = () => {
    if (!allowed(page))
      return (
        <Empty
          title="This page is unavailable"
          description="Your current role does not grant access to this workspace."
          action={
            <button
              className="button primary"
              onClick={() => go(care ? 'home' : admin ? 'accounts' : 'management')}
            >
              Go to your workspace
            </button>
          }
        />
      );
    switch (page) {
      case 'home':
        return <Home w={w} />;
      case 'chat':
        return <Chat w={w} selected={chatId} onSelect={setChatId} />;
      case 'inbox':
        return <Inbox w={w} />;
      case 'diary':
        return <Diary w={w} onOcr={setOcrId} />;
      case 'handover':
        return <Handover w={w} />;
      case 'shift':
        return <Shift w={w} />;
      case 'team':
        return <Shift w={w} team />;
      case 'more':
        return <More w={w} />;
      case 'settings':
        return <Settings w={w} />;
      case 'management':
        return <Management w={w} />;
      case 'accounts':
        return <Accounts w={w} />;
      case 'integrations':
        return <Integrations />;
      case 'audit':
        return <Audit w={w} />;
    }
  };
  return (
    <div className={`app-shell ${page === 'chat' ? 'chat-shell' : ''}`}>
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href={`#${care ? 'home' : admin ? 'accounts' : 'management'}`}>
          <span className="brand-mark">
            <Plus size={27} strokeWidth={3} />
          </span>
          <span>
            <strong>{t('app.name')}</strong>
            <small>{t('app.subtitle')}</small>
          </span>
        </a>
        <div className="facility-label">
          <span className="facility-icon">
            <HomeIcon size={16} />
          </span>
          <div>
            <strong>Oakwood Residence</strong>
            <small>Care coordination workspace</small>
          </div>
        </div>
        {care && (
          <button className="button primary sidebar-report" onClick={() => report()}>
            <Plus size={21} />
            {t('nav.report')}
            <ArrowUpRight size={17} />
          </button>
        )}
        <p className="nav-section-label">{care ? 'WORKSPACE' : 'CONSOLE'}</p>
        <nav aria-label="Main navigation">
          {nav
            .filter((n) => n.id !== 'settings')
            .map((n) => (
              <button
                aria-label={t(n.label)}
                key={n.id}
                className={`nav-item ${page === n.id ? 'active' : ''}`}
                onClick={() => go(n.id)}
              >
                <n.icon size={20} />
                {t(n.label)}
                {n.id === 'chat' && unread > 0 && <span className="nav-count">{unread}</span>}
                {n.id === 'inbox' && high > 0 && (
                  <span className="nav-count priority-count">{high}</span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="assistant-prompt" role="region" aria-label="Assistant shortcut">
            <span className="assistant-mini">
              <Sparkles size={18} />
            </span>
            <strong>A little clarity goes a long way.</strong>
            <p>
              {care
                ? 'Find facts, organize your shift, and keep care connected.'
                : 'Built around clear roles and accountable care.'}
            </p>
            {care && (
              <button className="text-button" onClick={() => openChat(`ai-${person.id}`)}>
                Ask RAS Assistant <ArrowUpRight size={14} />
              </button>
            )}
          </div>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => go('settings')}
          >
            <Settings2 size={19} />
            {t('nav.settings')}
          </button>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <LifeBuoy size={19} />
            Help & guidance
          </button>
          <button
            className="sidebar-profile"
            onClick={() => setDemoOpen(true)}
            aria-label="Open demo persona controls"
          >
            <Avatar person={person} />
            <span>
              <strong>{person.name}</strong>
              <small>{roleName(currentRole)}</small>
            </span>
            <ChevronDown size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">
              <Plus size={21} strokeWidth={3} />
            </span>
            <strong>RAS Agentica</strong>
          </div>
          <div className="breadcrumb">
            <span>Oakwood Residence</span>
            <span>/</span>
            <strong>
              {nav.find((n) => n.id === page)
                ? t(nav.find((n) => n.id === page)!.label)
                : 'Workspace'}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className={`connection ${session.offline ? 'offline' : ''}`}>
              {session.offline ? <WifiOff size={14} /> : <span className="presence present" />}
              {session.offline ? 'Offline' : 'Connected'}
            </span>
            <button className="demo-badge" onClick={() => setDemoOpen(true)}>
              <FlaskConical size={13} />
              {t('app.demo')}
              <ChevronDown size={12} />
            </button>
            {care && (
              <button
                className="icon-button notification-button"
                aria-label={`Open inbox, ${high} unhandled high priority items`}
                onClick={() => go('inbox')}
              >
                <Bell size={20} />
                {high > 0 && <span />}
              </button>
            )}
            <button
              className="profile-button"
              aria-label="Choose demo persona"
              onClick={() => setDemoOpen(true)}
            >
              <Avatar person={person} size="small" />
            </button>
          </div>
        </header>
        {session.offline && (
          <div className="offline-banner">
            <WifiOff size={16} />
            <span>
              You are offline. Reports are queued; staff will not be notified until synchronization.
            </span>
          </div>
        )}
        {queued.length > 0 && (
          <button className="queue-banner" onClick={() => setQueueOpen(true)}>
            <Clock3 size={16} />
            {queued.length} {queued.length === 1 ? 'report' : 'reports'} pending synchronization{' '}
            <ArrowRight size={16} />
          </button>
        )}
        <main id="main" tabIndex={-1} className={`main-content page-${page}`}>
          {content()}
        </main>
        <footer className="desktop-footer">
          <span>Care is a team effort.</span>
          <span>
            Oakwood Residence <span>·</span> Europe/Rome
          </span>
        </footer>
      </div>
      {care && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <button className={page === 'home' ? 'active' : ''} onClick={() => go('home')}>
            <HomeIcon size={22} />
            <span>Home</span>
          </button>
          <button
            aria-label="Chat"
            className={page === 'chat' ? 'active' : ''}
            onClick={() => go('chat')}
          >
            <span className="mobile-icon">
              <MessageCircle size={22} />
              {unread > 0 && <b>{unread}</b>}
            </span>
            <span>Chat</span>
          </button>
          <button className="mobile-report" onClick={() => report()}>
            <span>
              <Plus size={29} />
            </span>
            <b>Report event</b>
          </button>
          <button className={page === 'inbox' ? 'active' : ''} onClick={() => go('inbox')}>
            <Bell size={22} />
            <span>Inbox</span>
          </button>
          <button
            className={
              ['more', 'diary', 'handover', 'shift', 'settings', 'team'].includes(page)
                ? 'active'
                : ''
            }
            onClick={() => go('more')}
          >
            <MoreHorizontal size={24} />
            <span>More</span>
          </button>
        </nav>
      )}
      {!care && (
        <nav className="console-mobile-nav" aria-label="Console navigation">
          {nav.map((n) => (
            <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => go(n.id)}>
              <n.icon size={18} />
              {t(n.label)}
            </button>
          ))}
        </nav>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? 'toast-error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          <span>{toast.text}</span>
          <button
            onClick={() => setToast(undefined)}
            className="icon-button"
            aria-label="Dismiss notification"
          >
            <X size={17} />
          </button>
        </div>
      )}
      {reportOpen && care && (
        <Report w={w} prefill={prefill} onClose={() => setReportOpen(false)} />
      )}
      {eventId && <EventDetail w={w} id={eventId} onClose={() => setEventId(undefined)} />}
      {ocrId && <OcrReview w={w} id={ocrId} onClose={() => setOcrId(undefined)} />}
      {queueOpen && (
        <Modal title="Pending reports" onClose={() => setQueueOpen(false)}>
          <div className="padded">
            <p className="muted">
              Queued does not mean delivered. Original occurrence times are preserved.
            </p>
            {queued.map((e) => (
              <div className="queue-item" key={e.id}>
                <strong>
                  {e.type} · {e.residentId || e.subject}
                </strong>
                <span>{e.syncError || 'Waiting for connection'}</span>
                <button
                  className="text-button"
                  onClick={() => {
                    setEventId(e.id);
                    setQueueOpen(false);
                  }}
                >
                  View report <ArrowRight size={15} />
                </button>
              </div>
            ))}
            {!queued.length && <Empty title="No pending reports" />}
            <button
              className="button primary"
              disabled={session.offline}
              onClick={() => void run(() => api.sync(session), 'Synchronization checked.')}
            >
              <RefreshCw size={17} />
              Retry synchronization
            </button>
          </div>
        </Modal>
      )}
      {demoOpen && (
        <Modal title={t('demo.title')} onClose={() => setDemoOpen(false)}>
          <div className="padded demo-controls">
            <div className="info-box">
              <FlaskConical size={19} />
              <p>
                Fictional people and records. This selector is a demo utility, not production
                authentication.
              </p>
            </div>
            <label>
              {t('demo.persona')}
              <select
                aria-label="View as"
                value={person.id}
                onChange={(e) => {
                  const p = personas.find((p) => p.id === e.target.value)!;
                  const next = {
                    staffId: p.id,
                    wardId: p.assignments[0].wardId,
                    offline: session.offline,
                  };
                  setState(undefined);
                  setSession(next);
                  setChatId(undefined);
                  setEventId(undefined);
                  setOcrId(undefined);
                  setReportOpen(false);
                  setDemoOpen(false);
                  const role = p.assignments[0].role;
                  go(
                    role === 'administrator'
                      ? 'accounts'
                      : role === 'management'
                        ? 'management'
                        : 'home',
                  );
                }}
              >
                {personas
                  .filter((p) => p.active)
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name} · {roleName(p.assignments[0]?.role || '')}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Current ward
              <select
                aria-label="Current ward"
                value={session.wardId}
                onChange={(e) => {
                  setState(undefined);
                  setSession((s) => ({ ...s, wardId: e.target.value }));
                  setChatId(undefined);
                  setEventId(undefined);
                  setOcrId(undefined);
                }}
              >
                {person.assignments.map((a) => (
                  <option key={`${a.wardId}-${a.role}`} value={a.wardId}>
                    {a.wardId === 'willow' ? 'Willow Ward' : 'Cedar Ward'}
                  </option>
                ))}
              </select>
            </label>
            <label className="toggle-row">
              <span>
                <strong>{t('demo.connectivity')}</strong>
                <small>Event reports stay queued until reconnection.</small>
              </span>
              <input
                type="checkbox"
                checked={session.offline}
                onChange={(e) => setSession((s) => ({ ...s, offline: e.target.checked }))}
              />
            </label>
            <button
              className="button full"
              onClick={() =>
                void run(
                  () => api.advance(session),
                  'Demo clock advanced by 10 minutes. Escalation policy evaluated.',
                )
              }
            >
              <Clock3 size={17} />
              {t('demo.advance')}
            </button>
            <p className="small muted">
              Elapsed demo time: +{state.clockOffset / 60000} minutes. Sample timeouts are demo
              assumptions.
            </p>
            <button className="button full danger-text" onClick={() => setResetConfirm(true)}>
              <RefreshCw size={16} />
              {t('demo.reset')}
            </button>
            {resetConfirm && (
              <div className="warning-box">
                <p>This replaces all synthetic records and removes local drafts. Continue?</p>
                <div className="button-row">
                  <button className="button" onClick={() => setResetConfirm(false)}>
                    Cancel
                  </button>
                  <button
                    className="button primary"
                    onClick={() =>
                      void run(async () => {
                        await api.reset();
                        Object.keys(localStorage)
                          .filter(
                            (k) =>
                              k.startsWith('ras-event-draft-') || k.startsWith('ras-chat-draft-'),
                          )
                          .forEach((k) => localStorage.removeItem(k));
                        setResetConfirm(false);
                        setDemoOpen(false);
                      }, 'Synthetic data reset.')
                    }
                  >
                    Reset demo
                  </button>
                </div>
              </div>
            )}
            <small>{t('demo.time')}</small>
          </div>
        </Modal>
      )}
      {help && (
        <Modal title="Care workspace guidance" onClose={() => setHelp(false)}>
          <div className="padded">
            <h3>From report to handover</h3>
            <p>
              Report an event, let eligible staff take charge, record an outcome, and carry open
              items into the next shift.
            </p>
            <p>
              Chat supports team communication. Reading a message never takes charge of an event.
              Use the explicit “Take charge” action.
            </p>
            <p>
              If a high-priority report is queued offline, staff have not been notified. Follow your
              ward’s urgent communication procedure.
            </p>
            <div className="info-box">
              Synthetic demonstration only. AI responses organize recorded facts; they do not
              provide medical advice.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default App;

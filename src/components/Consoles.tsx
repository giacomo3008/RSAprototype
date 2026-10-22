import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowUpRight,
  CheckCircle2,
  Unplug,
  Settings2,
  Users,
  Clock3,
  Activity,
  ExternalLink,
} from 'lucide-react';
import type { Role } from '../domain/types';
import { has } from '../domain/permissions';
import { t, date, time } from '../i18n';
import { PageHeading, Avatar, Empty } from './ui';
import { roleName } from './workspace';
import type { Workspace } from './workspace';
export function Settings({ w }: { w: Workspace }) {
  return (
    <>
      <PageHeading
        title={t('settings.title')}
        description="A consistent workspace for your ward."
      />
      <div className="two-columns">
        <section className="panel padded">
          <h2>Workspace preferences</h2>
          <div className="settings-row">
            <span>Interface language</span>
            <strong>English (UK)</strong>
          </div>
          <div className="settings-row">
            <span>Facility time zone</span>
            <strong>Europe/Rome</strong>
          </div>
          <div className="settings-row">
            <span>Notifications</span>
            <strong>In-app demo</strong>
          </div>
          <div className="settings-row">
            <span>Offline reports</span>
            <strong>Queued on this device</strong>
          </div>
          <div className="info-box">
            <ShieldCheck size={20} />
            <p>
              This workspace uses fictional data. Do not enter real health information. Production
              identity, secure storage and push services are not connected.
            </p>
          </div>
        </section>
        <section className="panel padded">
          <h2>
            <Settings2 size={20} />
            Routing policy
          </h2>
          <p className="muted">Read-only operational summary</p>
          {['high', 'medium', 'low'].map((level) => (
            <div className="policy-row" key={level}>
              <span className={`badge priority-${level}`}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </span>
              <p>
                {level === 'high'
                  ? 'Notify the on-duty nurse and present coordinator immediately.'
                  : level === 'medium'
                    ? 'Notify the on-duty nurse quietly.'
                    : 'Diary and handover only. No targeted alert.'}
              </p>
            </div>
          ))}
          {(has(w.person, w.session.wardId, 'coordinate') ||
            has(w.person, w.session.wardId, 'admin')) && (
            <details className="activity-details">
              <summary>Demo policy assumptions</summary>
              <p>{t('settings.assumptions')}</p>
              <p>
                High: escalate after 5 minutes. Medium: reminder at 10 minutes and escalation at 20
                minutes.
              </p>
              <p>
                Off-duty and on-break staff are excluded. Busy qualified staff remain eligible.
                Items with no eligible recipients remain unhandled and visible to the ward.
              </p>
              <p>These values are configured in the demo seed, not a clinical policy editor.</p>
            </details>
          )}
        </section>
      </div>
    </>
  );
}
export function Management({ w }: { w: Workspace }) {
  const [counts, setCounts] = useState<{
    total: number;
    unhandled: number;
    closed: number;
    high: number;
    present: number;
  }>();
  const [day, setDay] = useState('');
  useEffect(() => {
    void w.api.aggregates(w.session, day).then(setCounts);
  }, [w.session.wardId, w.state.revision, day]);
  return (
    <>
      <PageHeading
        eyebrow="OPERATIONS CONSOLE"
        title="A shared view of operations."
        description="Aggregate operational activity across your assigned wards."
      />
      <div className="filter-bar panel padded">
        <span>{w.state.wards.find((x) => x.id === w.session.wardId)?.name}</span>
        <label className="inline-label">
          Report date
          <input
            type="date"
            aria-label="Report date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <button className="text-button" onClick={() => setDay('')}>
          All dates
        </button>
        <span className="badge neutral">Synthetic counts</span>
      </div>
      <div className="stats-grid management-stats">
        {[
          { label: 'Reported events', value: counts?.total, icon: Activity },
          { label: 'Unhandled reports', value: counts?.unhandled, icon: Clock3 },
          { label: 'Closed reports', value: counts?.closed, icon: CheckCircle2 },
        ].map((c) => (
          <div className="stat-card" key={c.label}>
            <div>
              <span className="stat-label">{c.label}</span>
              <span className="stat-number">{c.value ?? '—'}</span>
              <span className="stat-description">Current synthetic ward records</span>
            </div>
            <span className="stat-icon">
              <c.icon size={21} />
            </span>
          </div>
        ))}
      </div>
      <div className="two-columns">
        <section className="panel padded">
          <h2>Operational report</h2>
          <div className="settings-row">
            <span>Present staff</span>
            <strong>{counts?.present ?? '—'}</strong>
          </div>
          <div className="settings-row">
            <span>High-priority reports</span>
            <strong>{counts?.high ?? '—'}</strong>
          </div>
          <div className="settings-row">
            <span>Source</span>
            <span>Current demo repository</span>
          </div>
          <button
            className="button"
            disabled={!counts}
            onClick={() => {
              const csv = `Ward,Period,Total,Unhandled,Closed,High,Present\n${w.session.wardId},${day || 'demo period'},${counts?.total},${counts?.unhandled},${counts?.closed},${counts?.high},${counts?.present}\n`;
              const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = 'ras-operational-report.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export aggregate report <ArrowUpRight size={16} />
          </button>
        </section>
        <section className="panel padded">
          <h2>
            <ShieldCheck size={20} />
            Your access
          </h2>
          <p className="muted">
            This management role can review aggregate operations in assigned wards. Resident
            records, private conversations and clinical sign-off require a separate explicit care
            role.
          </p>
          <p className="small muted">
            Counts describe fictional records. They are not measured improvements or predictions.
          </p>
        </section>
      </div>
    </>
  );
}
export function Accounts({ w }: { w: Workspace }) {
  const [editing, setEditing] = useState<string>();
  const [role, setRole] = useState<Role>('nurse');
  const [active, setActive] = useState(true);
  const ward = w.session.wardId;
  return (
    <>
      <PageHeading
        eyebrow="TECHNICAL CONSOLE"
        title="Accounts & access"
        description="Explicit ward roles. No inherited clinical privileges."
      />
      <section className="panel">
        <div className="panel-header">
          <h2>
            <Users size={20} />
            Synthetic demo accounts
          </h2>
          <span className="badge neutral">{w.state.staff.length} accounts</span>
        </div>
        {w.state.staff.map((p) => (
          <div className="account-row" key={p.id}>
            <Avatar person={p} />
            <div className="account-name">
              <strong>{p.name}</strong>
              <small>
                {p.assignments.map((a) => `${a.wardId} · ${roleName(a.role)}`).join(' / ')}
              </small>
            </div>
            {editing === p.id ? (
              <div className="account-edit">
                <select
                  value={role}
                  aria-label={`Ward role for ${p.name}`}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {(
                    [
                      'nurse',
                      'assistant',
                      'technician',
                      'physician',
                      'coordinator',
                      'management',
                      'administrator',
                    ] as Role[]
                  ).map((r) => (
                    <option value={r} key={r}>
                      {roleName(r)}
                    </option>
                  ))}
                </select>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Active
                </label>
                <button
                  className="button primary"
                  onClick={() =>
                    void w
                      .run(
                        () => w.api.updateAccount(w.session, p.id, ward, role, active),
                        'Ward assignment saved.',
                      )
                      .then((ok) => {
                        if (ok) setEditing(undefined);
                      })
                  }
                >
                  Save
                </button>
                <button className="button" onClick={() => setEditing(undefined)}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <span className={`badge ${p.active ? 'priority-low' : 'neutral'}`}>
                  {p.active ? 'Active' : 'Disabled'}
                </span>
                <button
                  className="button"
                  disabled={p.id === w.person.id}
                  onClick={() => {
                    setEditing(p.id);
                    setRole(p.assignments.find((a) => a.wardId === ward)?.role || 'assistant');
                    setActive(p.active);
                  }}
                >
                  Edit access
                </button>
              </>
            )}
          </div>
        ))}
      </section>
      <div className="info-box">
        <ShieldCheck size={20} />
        <p>
          The persona switcher is a demo utility. Production access must be derived from corporate
          authentication and enforced by the backend for every operation.
        </p>
      </div>
    </>
  );
}
export function Integrations() {
  return (
    <>
      <PageHeading
        eyebrow="TECHNICAL CONSOLE"
        title="Integration status"
        description="Connection boundaries for the future production platform."
      />
      <div className="integration-grid">
        {[
          {
            name: 'Demo repository',
            detail: 'IndexedDB · synthetic data on this device',
            connected: true,
          },
          {
            name: 'Corporate SSO / MFA',
            detail: 'Identity provider connection required',
            connected: false,
          },
          {
            name: 'FastAPI / LangGraph',
            detail: 'External authenticated backend adapter',
            connected: false,
          },
          {
            name: 'Protected media storage',
            detail: 'Encrypted EU object storage required',
            connected: false,
          },
          {
            name: 'Platform push notifications',
            detail: 'Production delivery infrastructure required',
            connected: false,
          },
          {
            name: 'Clinical systems / HL7 FHIR',
            detail: 'Future integration · outside this MVP',
            connected: false,
          },
        ].map((i) => (
          <section className="panel integration-card" key={i.name}>
            <span className="integration-icon">
              {i.connected ? <CheckCircle2 size={25} /> : <Unplug size={25} />}
            </span>
            <h2>{i.name}</h2>
            <p className="muted">{i.detail}</p>
            <span className={`badge ${i.connected ? 'priority-low' : 'neutral'}`}>
              {i.connected ? 'Local demo active' : 'Not connected'}
            </span>
          </section>
        ))}
      </div>
    </>
  );
}
export function Audit({ w }: { w: Workspace }) {
  return (
    <>
      <PageHeading
        title="Audit activity"
        description="Restricted operational metadata. Demo logs are not a tamper-proof production audit store."
      />
      <section className="panel">
        <div className="panel-header">
          <h2>
            <ShieldCheck size={19} />
            Recent activity
          </h2>
          <span className="badge neutral">Metadata only</span>
        </div>
        {w.state.audit
          .slice()
          .reverse()
          .slice(0, 100)
          .map((a) => (
            <div className="audit-row" key={a.id}>
              <span className="timeline-dot" />
              <div>
                <strong>{a.action}</strong>
                <small>
                  {a.actorId} · {a.entityId} · {a.wardId}
                </small>
              </div>
              <time>
                {date(a.at)} · {time(a.at)}
              </time>
            </div>
          ))}
        {!w.state.audit.length && (
          <Empty
            title="No recorded activity yet"
            description="Authorized actions will appear here as metadata."
          />
        )}
      </section>
    </>
  );
}

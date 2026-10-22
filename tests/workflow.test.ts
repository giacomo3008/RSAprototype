import { describe, it, expect, beforeEach } from 'vitest';
import { DemoApi } from '../src/services/api';
import { MemoryRepository, IndexedRepository } from '../src/services/repository';
import { seed } from '../src/domain/seed';
import { has, eligible } from '../src/domain/permissions';
import type { Session, EventDraft, Role } from '../src/domain/types';
import 'fake-indexeddb/auto';
let repo: MemoryRepository;
let api: DemoApi;
const se = (staffId = 'nurse', wardId = 'willow', offline = false): Session => ({
  staffId,
  wardId,
  offline,
});
const draft = (overrides: Partial<EventDraft> = {}): EventDraft => ({
  key: crypto.randomUUID(),
  wardId: 'willow',
  type: 'Fall',
  priority: 'High',
  residentId: 'R-014',
  place: 'Room 108',
  notes: 'Synthetic report for workflow verification.',
  occurredAt: new Date(Date.now() - 60000).toISOString(),
  originalOccurredAt: new Date(Date.now() - 60000).toISOString(),
  mediaIds: [],
  ...overrides,
});
beforeEach(() => {
  repo = new MemoryRepository(seed());
  api = new DemoApi(repo);
});
describe('connected care workflow', () => {
  it('assistant reports once; the same record resolves in diary, nurse inbox, thread and handover', async () => {
    const d = draft();
    const e = await api.report(se('assistant'), d);
    const again = await api.report(se('assistant'), d);
    expect(again.id).toBe(e.id);
    const s = await api.view(se());
    expect(s.events.filter((x) => x.id === e.id)).toHaveLength(1);
    expect(s.diary.filter((x) => x.eventId === e.id)).toHaveLength(1);
    expect(s.notices.find((n) => n.eventId === e.id)?.recipientIds).toContain('nurse');
    expect(s.conversations.find((c) => c.eventId === e.id)?.id).toBe(`thread-${e.id}`);
    await api.draftHandover(se('coordinator'));
    expect((await api.view(se())).handovers[0].versions.at(-1)?.sourceIds).toContain(e.id);
  });
  it('High targets only qualified on-duty ward nurses and present coordinator', async () => {
    const e = await api.report(se('assistant'), draft());
    const n = repo.state.notices.find((n) => n.eventId === e.id)!;
    expect(n.recipientIds.sort()).toEqual(['coordinator', 'nurse', 'nurse2']);
    for (const id of ['assistant', 'technician', 'physician', 'off-duty', 'cedar-nurse'])
      expect(n.recipientIds).not.toContain(id);
  });
  it('Medium routes quietly to nurses; Low creates no targeted notification', async () => {
    const m = await api.report(se('assistant'), draft({ type: 'Refusal', priority: 'Medium' }));
    expect(repo.state.notices.find((n) => n.eventId === m.id)?.recipientIds.sort()).toEqual([
      'nurse',
      'nurse2',
    ]);
    const low = await api.report(se('assistant'), draft({ type: 'Hygiene', priority: 'Low' }));
    expect(repo.state.notices.some((n) => n.eventId === low.id)).toBe(false);
    expect(repo.state.diary.some((d) => d.eventId === low.id)).toBe(true);
  });
  it('attendance, skills and availability change eligibility without discarding urgent reports', async () => {
    await api.attendance(se(), 'nurse', false, 'Available');
    await api.attendance(se('nurse2'), 'nurse2', true, 'On break');
    await api.attendance(se('coordinator'), 'coordinator', false, 'Available');
    const e = await api.report(se('assistant'), draft());
    expect(repo.state.notices.find((n) => n.eventId === e.id)?.recipientIds).toEqual([]);
    expect(e.status).toBe('Unhandled');
    await api.attendance(se('off-duty'), 'off-duty', true, 'Busy');
    const next = await api.report(se('assistant'), draft());
    expect(repo.state.notices.find((n) => n.eventId === next.id)?.recipientIds).toContain(
      'off-duty',
    );
    expect(
      eligible(
        repo.state,
        e,
        repo.state.staff.find((p) => p.id === 'technician')!,
      ),
    ).toBe(false);
  });
  it('reading the event conversation does not claim it or mark its alert read', async () => {
    await api.sendMessage(se('assistant'), 'thread-EV-1042', 'Please review the report.');
    await api.readConversation(se(), 'thread-EV-1042');
    expect(repo.state.events.find((e) => e.id === 'EV-1042')?.status).toBe('Unhandled');
    expect(repo.state.notices.find((n) => n.eventId === 'EV-1042')?.readBy).toEqual({});
  });
  it('claiming is atomic; second claimant is refused and reminders stop', async () => {
    const results = await Promise.allSettled([
      api.claim(se(), 'EV-1042'),
      api.claim(se('nurse2'), 'EV-1042'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    await api.advance(se(), 30);
    const n = repo.state.notices.find((n) => n.eventId === 'EV-1042')!;
    expect(n.escalation).toBe(0);
    expect(n.remindedAt).toBeUndefined();
  });
  it('Medium reminds then escalates without duplicate events or notifications', async () => {
    const e = await api.report(se('assistant'), draft({ type: 'Refusal', priority: 'Medium' }));
    const count = repo.state.events.length;
    await api.advance(se(), 10);
    let n = repo.state.notices.find((n) => n.eventId === e.id)!;
    expect(n.remindedAt).toBeTruthy();
    expect(n.escalation).toBe(0);
    await api.advance(se(), 10);
    n = repo.state.notices.find((n) => n.eventId === e.id)!;
    expect(n.escalation).toBe(1);
    expect(n.recipientIds).toContain('coordinator');
    await api.advance(se(), 30);
    expect(repo.state.events.length).toBe(count);
    expect(repo.state.notices.filter((n) => n.eventId === e.id)).toHaveLength(1);
  });
  it('closing records outcome and preserves the report; another person cannot close', async () => {
    await api.claim(se(), 'EV-1042');
    await expect(api.close(se('nurse2'), 'EV-1042', 'Done')).rejects.toThrow('responsible');
    await expect(api.close(se(), 'EV-1042', '')).rejects.toThrow('outcome');
    const original = repo.state.events.find((e) => e.id === 'EV-1042')!.notes;
    await api.close(se(), 'EV-1042', 'Reviewed and documented by staff.');
    const e = repo.state.events.find((e) => e.id === 'EV-1042')!;
    expect(e.notes).toBe(original);
    expect(e.status).toBe('Closed');
    expect(e.closedAt).toBeTruthy();
  });
  it('ordinary chat remains a message until a linked event is explicitly confirmed', async () => {
    const count = repo.state.events.length;
    const m = await api.sendMessage(
      se('assistant'),
      'team-willow',
      'A new safety issue in the corridor.',
    );
    expect(repo.state.events.length).toBe(count);
    const d = draft({ sourceMessageId: m.id, type: 'Safety', priority: 'Medium' });
    const e = await api.report(se('assistant'), d);
    const retry = await api.report(se('assistant'), { ...d, key: 'different-retry-key' });
    expect(retry.id).toBe(e.id);
    expect(repo.state.events.length).toBe(count + 1);
    expect(repo.state.messages.find((x) => x.id === m.id)?.linkedEventId).toBe(e.id);
  });
  it('assistant retrieves current authorized evidence and refuses other wards without sources', async () => {
    await api.sendMessage(se(), 'ai-nurse', 'Show unresolved events in my ward.');
    let m = repo.state.messages.at(-1)!;
    expect(m.ai).toBe(true);
    expect(m.sources.map((s) => s.id)).toContain('EV-1042');
    expect(m.sources.map((s) => s.id)).not.toContain('EV-2001');
    await api.claim(se(), 'EV-1042');
    await api.close(se(), 'EV-1042', 'Documented.');
    await api.sendMessage(se(), 'ai-nurse', 'Show unresolved events in my ward.');
    m = repo.state.messages.at(-1)!;
    expect(m.sources.map((s) => s.id)).not.toContain('EV-1042');
    await api.sendMessage(se(), 'ai-nurse', 'Show Cedar Ward reports for R-031.');
    m = repo.state.messages.at(-1)!;
    expect(m.text).toContain('Access denied');
    expect(m.sources).toEqual([]);
    expect(m.text).not.toContain('Arthur');
  });
  it('assistant cannot execute a mutation by request', async () => {
    await api.sendMessage(se('assistant'), 'ai-assistant', 'Sign and approve my handover.');
    expect(repo.state.messages.at(-1)?.text).toContain('I have not changed');
    expect(repo.state.handovers[0].versions).toHaveLength(1);
  });
  it('query, direct message, attachment, guessed ID and assistant scope are denied', async () => {
    const view = await api.view(se('assistant'));
    expect(view.events.some((e) => e.wardId === 'cedar')).toBe(false);
    expect(view.media.some((m) => m.wardId === 'cedar')).toBe(false);
    await expect(api.claim(se(), 'EV-2001')).rejects.toThrow('Access denied');
    await expect(api.sendMessage(se(), 'team-cedar', 'hello')).rejects.toThrow('Access denied');
    await expect(api.direct(se(), 'cedar-nurse')).rejects.toThrow('unavailable');
    await expect(api.report(se('assistant'), draft({ residentId: 'R-031' }))).rejects.toThrow(
      'unavailable',
    );
    await expect(
      api.report(se('assistant'), draft({ mediaIds: ['guessed-media'] })),
    ).rejects.toThrow('unavailable');
  });
  it('OCR extraction review preserves original; clinical validation requires physician capability', async () => {
    const original = repo.state.ocr[0].original;
    await api.reviewOcr(
      se('assistant'),
      'OCR-1',
      'Room 108 — follow-up at 14:30. Call bell checked.',
    );
    expect(repo.state.ocr[0].original).toBe(original);
    expect(repo.state.ocr[0].reviewedBy).toBe('assistant');
    expect(repo.state.ocr[0].corrected).toContain('14:30');
    await expect(api.validateOcr(se('coordinator'), 'OCR-1')).rejects.toThrow('Access denied');
    await api.validateOcr(se('physician'), 'OCR-1');
    expect(repo.state.ocr[0].validatedBy).toBe('physician');
  });
  it('contribution → draft → review → coordinator sign → assigned incoming acknowledgement', async () => {
    await api.contribute(se('assistant'), 'Open items have been recorded in the diary.');
    await api.draftHandover(se('assistant'));
    let v = repo.state.handovers[0].versions.at(-1)!;
    expect(v.text).toContain('Open items have been recorded');
    expect(v.sourceIds).toContain('EV-1042');
    await expect(api.handoverAction(se('assistant'), 'sign')).rejects.toThrow('Access denied');
    await expect(api.handoverAction(se('coordinator'), 'sign')).rejects.toThrow('Review');
    await api.handoverAction(se('coordinator'), 'review');
    await expect(api.handoverAction(se('physician'), 'sign')).rejects.toThrow('Access denied');
    await expect(api.handoverAction(se('coordinator'), 'validate')).rejects.toThrow(
      'Access denied',
    );
    await api.handoverAction(se('physician'), 'validate');
    await api.handoverAction(se('coordinator'), 'sign');
    await expect(api.handoverAction(se('off-duty'), 'acknowledge')).rejects.toThrow('not assigned');
    await api.handoverAction(se('assistant'), 'acknowledge');
    v = repo.state.handovers[0].versions.at(-1)!;
    expect(v.acknowledgements[0].staffId).toBe('assistant');
    expect(v.signed?.role).toBe('coordinator');
    expect(v.validated?.role).toBe('physician');
  });
  it('signed handovers require a new amendment version; prior signatures remain intact', async () => {
    const before = structuredClone(repo.state.handovers[0].versions[0]);
    await expect(api.handoverAction(se('coordinator'), 'review')).rejects.toThrow(
      'Signed versions',
    );
    await api.draftHandover(se('coordinator'));
    expect(repo.state.handovers[0].versions[0]).toEqual(before);
    expect(repo.state.handovers[0].versions[1].signed).toBeUndefined();
  });
  it('diary amendments and message corrections preserve original content and retention snapshots', async () => {
    const original = repo.state.events[0].notes;
    await api.amend(se('assistant'), 'EV-1042', 'Additional location detail recorded.');
    expect(repo.state.events[0].notes).toBe(original);
    expect(repo.state.diary[0].versions).toHaveLength(2);
    const m = await api.sendMessage(se('assistant'), 'team-willow', 'Original text');
    await api.editMessage(se('assistant'), m.id, 'Corrected text');
    expect(repo.state.messages.find((x) => x.id === m.id)?.text).toBe('Original text');
    expect(repo.state.retention.some((r) => r.kind === 'message-correction')).toBe(true);
  });
  it('offline reports are persisted with no alerts; reconnect syncs the same event exactly once', async () => {
    const d = draft();
    const e = await api.report(se('assistant', 'willow', true), d);
    expect(e.queued).toBe(true);
    expect(e.syncedAt).toBeUndefined();
    expect(repo.state.notices.some((n) => n.eventId === e.id)).toBe(false);
    await api.sync(se('assistant'));
    await api.sync(se('assistant'));
    const synced = repo.state.events.find((x) => x.id === e.id)!;
    expect(synced.queued).toBe(false);
    expect(synced.occurredAt).toBe(d.occurredAt);
    expect(repo.state.notices.filter((n) => n.eventId === e.id)).toHaveLength(1);
    expect(repo.state.conversations.filter((c) => c.eventId === e.id)).toHaveLength(1);
  });
  it('sync rechecks authorization and exposes recoverable conflicts rather than falsely delivering', async () => {
    const e = await api.report(se('assistant', 'willow', true), draft());
    repo.state.residents.find((r) => r.id === 'R-014')!.assignedStaffIds = [];
    const result = await api.sync(se('assistant'));
    expect(result[0].error).toContain('assignment changed');
    expect(repo.state.events.find((x) => x.id === e.id)?.queued).toBe(true);
    expect(repo.state.notices.some((n) => n.eventId === e.id)).toBe(false);
  });
  it('management receives aggregates, admin gets metadata, neither receives clinical content', async () => {
    for (const p of ['management', 'administrator']) {
      const v = await api.view(se(p));
      for (const key of [
        'events',
        'residents',
        'messages',
        'media',
        'handovers',
        'ocr',
        'summaries',
      ] as const)
        expect(v[key]).toEqual([]);
      await expect(api.report(se(p), draft())).rejects.toThrow('Access denied');
      await expect(api.handoverAction(se(p), 'sign')).rejects.toThrow('Access denied');
    }
    const counts = await api.aggregates(se('management'));
    expect(counts.total).toBe(4);
    expect((await api.aggregates(se('management'), '1900-01-01')).total).toBe(0);
    await expect(api.aggregates(se('administrator'))).rejects.toThrow('Access denied');
  });
  it('all personas use explicit ward capabilities with no global role hierarchy', () => {
    const s = repo.state;
    const p = (id: string) => s.staff.find((p) => p.id === id)!;
    expect(has(p('nurse'), 'willow', 'claim')).toBe(true);
    for (const id of ['assistant', 'technician', 'physician', 'administrator', 'management'])
      expect(has(p(id), 'willow', 'claim')).toBe(false);
    expect(has(p('physician'), 'willow', 'validate')).toBe(true);
    expect(has(p('coordinator'), 'willow', 'validate')).toBe(false);
    expect(has(p('coordinator'), 'cedar', 'care')).toBe(false);
  });
  it('technical account management changes future query and mutation permissions', async () => {
    await api.updateAccount(se('administrator'), 'nurse', 'willow', 'management', true);
    const v = await api.view(se());
    expect(v.events).toEqual([]);
    await expect(api.claim(se(), 'EV-1042')).rejects.toThrow('Access denied');
    await expect(
      api.updateAccount(se('assistant'), 'nurse2', 'willow', 'nurse', false),
    ).rejects.toThrow('Access denied');
  });
});
describe('IndexedDB transaction persistence', () => {
  it('persists across repository instances and serializes competing claims across clients', async () => {
    const first = new IndexedRepository();
    await first.reset();
    const a = new DemoApi(first);
    const b = new DemoApi(new IndexedRepository());
    const d = draft();
    const e = await a.report(se('assistant'), d);
    expect((await b.view(se())).events.find((x) => x.id === e.id)).toBeTruthy();
    const results = await Promise.allSettled([a.claim(se(), e.id), b.claim(se('nurse2'), e.id)]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1);
  });
});

describe('coordination and captured documents', () => {
  it('coordinator skill changes and shift assignment affect subsequent routing', async () => {
    await expect(api.updateSkills(se('assistant'), 'nurse', ['care'])).rejects.toThrow(
      'Access denied',
    );
    await api.updateSkills(se('coordinator'), 'nurse', []);
    let e = await api.report(se('assistant'), draft());
    expect(repo.state.notices.find((n) => n.eventId === e.id)?.recipientIds).not.toContain('nurse');
    await api.updateSkills(se('coordinator'), 'nurse', ['care', 'safety']);
    await api.assignShift(se('coordinator'), 'nurse', 'willow-afternoon');
    expect(repo.state.attendance.find((a) => a.staffId === 'nurse')?.checkedIn).toBe(false);
    e = await api.report(se('assistant'), draft());
    expect(repo.state.notices.find((n) => n.eventId === e.id)?.recipientIds).not.toContain('nurse');
    await expect(
      api.assignShift(se('coordinator'), 'cedar-nurse', 'cedar-afternoon'),
    ).rejects.toThrow('unavailable');
  });
  it('document capture retains synthetic extraction and denies unauthorized media references', async () => {
    const media = await api.upload(se('assistant'), {
      kind: 'photo',
      url: '/sample-document.svg',
      name: 'Synthetic document',
      synthetic: true,
    });
    const oid = await api.createOcr(se('assistant'), media.id);
    expect(repo.state.ocr.find((o) => o.id === oid)?.original).toContain('14:00');
    expect(repo.state.retention.some((r) => r.entityId === oid && r.kind === 'ocr-original')).toBe(
      true,
    );
    await expect(api.createOcr(se('cedar-nurse', 'cedar'), media.id)).rejects.toThrow(
      'unavailable',
    );
  });
  it('clinical validation cannot overwrite a prior validation record', async () => {
    await api.reviewOcr(se('assistant'), 'OCR-1', 'Reviewed synthetic transcription.');
    await api.validateOcr(se('physician'), 'OCR-1');
    await expect(api.validateOcr(se('physician'), 'OCR-1')).rejects.toThrow('already recorded');
  });
});

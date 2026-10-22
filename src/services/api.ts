import { createId } from '../lib/id';
import type {
  State,
  Session,
  CareApi,
  EventDraft,
  CareEvent,
  Source,
  Media,
  Role,
  Availability,
  HandoverVersion,
} from '../domain/types';
import { EVENT_DEFAULTS } from '../domain/types';
import { has, requireCapability, eligible, conversationAllowed } from '../domain/permissions';
import type { Repository } from './repository';
const id = (prefix: string) => `${prefix}-${createId()}`;
export const now = (s: State) => new Date(Date.now() + s.clockOffset).toISOString();
const checksum = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `demo-fnv-${(h >>> 0).toString(16)}`;
};
function retain(s: State, kind: string, entityId: string, data: unknown) {
  const snapshot = JSON.stringify(data);
  s.retention.push({
    id: id('RET'),
    kind,
    entityId,
    at: now(s),
    fingerprint: checksum(snapshot),
    snapshot,
  });
}
function audit(s: State, se: Session, action: string, entityId: string) {
  s.audit.push({
    id: id('AUD'),
    actorId: se.staffId,
    action,
    entityId,
    wardId: se.wardId,
    at: now(s),
  });
}
function event(s: State, se: Session, eventId: string) {
  const e = s.events.find((e) => e.id === eventId);
  if (!e) throw new Error('Record unavailable.');
  requireCapability(s, se, 'care', e.wardId);
  return e;
}
function handover(s: State, se: Session) {
  requireCapability(s, se, 'care');
  const h = s.handovers.find((x) => x.wardId === se.wardId);
  if (!h) throw new Error('Handover unavailable.');
  return h;
}
function route(s: State, e: CareEvent) {
  if (e.priority === 'Low' || e.queued) return;
  const recipients = s.staff.filter((p) => eligible(s, e, p)).map((p) => p.id);
  s.notices.push({
    id: id('NT'),
    eventId: e.id,
    wardId: e.wardId,
    recipientIds: recipients,
    createdAt: now(s),
    sentAt: recipients.length ? now(s) : undefined,
    deliveredAt: recipients.length ? now(s) : undefined,
    readBy: {},
    escalation: 0,
  });
}
function careMembers(s: State, ward: string) {
  return s.staff.filter((p) => has(p, ward, 'care')).map((p) => p.id);
}
export class DemoApi implements CareApi {
  constructor(public repo: Repository) {}
  async personas() {
    const s = await this.repo.read();
    return s.staff.map(({ id, name, initials, assignments, active }) => ({
      id,
      name,
      initials,
      assignments,
      active,
    }));
  }
  async view(se: Session): Promise<State> {
    const s = await this.repo.read();
    const p = s.staff.find((p) => p.id === se.staffId);
    if (!p || !p.active || !p.assignments.some((a) => a.wardId === se.wardId))
      throw new Error('Access denied. No active ward assignment.');
    const scoped = (ward: string) => p.assignments.some((a) => a.wardId === ward);
    const care = (ward: string) => has(p, ward, 'care');
    const v = structuredClone(s);
    v.wards = s.wards.filter((w) => scoped(w.id));
    v.events = s.events.filter((e) => care(e.wardId) && (!e.queued || e.authorId === se.staffId));
    v.residents = s.residents.filter((r) => care(r.wardId));
    v.conversations = s.conversations.filter(
      (c) => care(c.wardId) && c.memberIds.includes(se.staffId),
    );
    v.messages = s.messages.filter((m) => v.conversations.some((c) => c.id === m.conversationId));
    v.notices = s.notices.filter((n) => care(n.wardId) && v.events.some((e) => e.id === n.eventId));
    v.diary = s.diary.filter((d) => v.events.some((e) => e.id === d.eventId));
    v.handovers = s.handovers.filter((h) => care(h.wardId));
    v.summaries = s.summaries.filter((x) => care(x.wardId));
    v.ocr = s.ocr.filter((o) => care(o.wardId));
    v.media = s.media.filter(
      (m) =>
        care(m.wardId) &&
        (v.events.some((e) => e.mediaIds.includes(m.id)) ||
          v.messages.some((x) => x.mediaIds.includes(m.id)) ||
          v.ocr.some((o) => o.mediaId === m.id) ||
          m.authorId === se.staffId),
    );
    v.attendance = s.attendance.filter(
      (a) => has(p, a.wardId, 'coordinate') || a.staffId === p.id || care(a.wardId),
    );
    v.staff = s.staff.filter(
      (x) =>
        x.id === p.id ||
        has(p, se.wardId, 'admin') ||
        (x.assignments.some((a) => a.wardId === se.wardId) && care(se.wardId)),
    );
    v.shifts = s.shifts.filter((x) => scoped(x.wardId));
    v.audit = has(p, se.wardId, 'audit') ? s.audit.filter((a) => scoped(a.wardId || '')) : [];
    v.retention = [];
    // All returned records are scoped. Counts for management are exposed separately, never raw records.
    return v;
  }
  async aggregates(se: Session, period = 'all') {
    const s = await this.repo.read();
    requireCapability(s, se, 'aggregate');
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' });
    const e = s.events.filter(
      (e) =>
        e.wardId === se.wardId &&
        !e.queued &&
        (!period ||
          period === 'all' ||
          day.format(new Date(e.occurredAt)) ===
            (period === 'today' ? day.format(new Date(now(s))) : period)),
    );
    return {
      total: e.length,
      unhandled: e.filter((e) => e.status === 'Unhandled').length,
      closed: e.filter((e) => e.status === 'Closed').length,
      high: e.filter((e) => e.priority === 'High').length,
      present: s.attendance.filter((a) => a.wardId === se.wardId && a.checkedIn).length,
    };
  }
  async report(se: Session, d: EventDraft) {
    return this.repo.mutate((s) => {
      requireCapability(s, se, 'care', d.wardId);
      const previous = s.events.find(
        (e) => e.key === d.key || (d.sourceMessageId && e.sourceMessageId === d.sourceMessageId),
      );
      if (previous) {
        if (previous.authorId !== se.staffId)
          throw new Error('This message already has a linked event.');
        return previous;
      }
      if (!(d.type in EVENT_DEFAULTS) || !['High', 'Medium', 'Low'].includes(d.priority))
        throw new Error('Select a valid event type and priority.');
      if (!d.place.trim() || (!d.residentId && !d.subject?.trim()))
        throw new Error('Select a resident or describe the other subject, and add a place.');
      if (
        !Number.isFinite(Date.parse(d.occurredAt)) ||
        Date.parse(d.occurredAt) > Date.now() + s.clockOffset + 60000
      )
        throw new Error('Event time must be valid and cannot be in the future.');
      if (
        d.residentId &&
        !s.residents.some(
          (r) =>
            r.id === d.residentId &&
            r.wardId === d.wardId &&
            r.assignedStaffIds.includes(se.staffId),
        )
      )
        throw new Error('Resident unavailable for your shift assignment.');
      if (d.sourceMessageId) {
        const m = s.messages.find((m) => m.id === d.sourceMessageId);
        if (!m || m.ai) throw new Error('Original message unavailable.');
        conversationAllowed(s, se, m.conversationId);
      }
      for (const mid of d.mediaIds) {
        if (
          !s.media.some((m) => m.id === mid && m.wardId === d.wardId && m.authorId === se.staffId)
        )
          throw new Error('Attachment unavailable.');
      }
      const e: CareEvent = {
        ...d,
        id: id('EV'),
        correlationId: id('COR'),
        authorId: se.staffId,
        defaultPriority: EVENT_DEFAULTS[d.type],
        createdAt: now(s),
        syncedAt: se.offline ? undefined : now(s),
        queued: se.offline,
        status: 'Unhandled',
        amendments: [],
      };
      s.events.unshift(e);
      s.diary.unshift({
        id: `D-${e.id}`,
        eventId: e.id,
        wardId: e.wardId,
        createdAt: now(s),
        versions: [{ text: e.notes, authorId: se.staffId, at: now(s) }],
      });
      if (!e.queued) {
        route(s, e);
        this.addThread(s, e);
      }
      if (d.sourceMessageId) {
        const m = s.messages.find((m) => m.id === d.sourceMessageId)!;
        m.linkedEventId = e.id;
        retain(s, 'message-link', m.id, m);
      }
      audit(s, se, e.queued ? 'event.queued' : 'event.reported', e.id);
      retain(s, 'event', e.id, e);
      return e;
    });
  }
  private addThread(s: State, e: CareEvent) {
    s.conversations.push({
      id: `thread-${e.id}`,
      wardId: e.wardId,
      title: `${e.type} · ${e.residentId || e.subject}`,
      kind: 'event',
      memberIds: careMembers(s, e.wardId),
      eventId: e.id,
    });
  }
  async sync(se: Session) {
    if (se.offline) throw new Error('Still offline. Reports remain queued.');
    return this.repo.mutate((s) => {
      const results: { id: string; error?: string }[] = [];
      for (const e of s.events.filter((e) => e.queued && e.authorId === se.staffId)) {
        try {
          requireCapability(s, se, 'care', e.wardId);
          if (
            e.residentId &&
            !s.residents.some(
              (r) => r.id === e.residentId && r.assignedStaffIds.includes(se.staffId),
            )
          )
            throw new Error(
              'Resident assignment changed. Ask your coordinator to restore access, then retry.',
            );
          e.queued = false;
          e.syncedAt = now(s);
          e.syncError = undefined;
          route(s, e);
          this.addThread(s, e);
          audit(s, se, 'event.synchronized', e.id);
          retain(s, 'event-synced', e.id, e);
          results.push({ id: e.id });
        } catch (error) {
          e.syncError = (error as Error).message;
          results.push({ id: e.id, error: e.syncError });
        }
      }
      return results;
    });
  }
  async claim(se: Session, eventId: string) {
    return this.repo.mutate((s) => {
      const e = event(s, se, eventId);
      if (se.offline || e.queued) throw new Error('Reconnect before taking charge.');
      const p = requireCapability(s, se, 'claim', e.wardId);
      if (!eligible(s, e, p, true))
        throw new Error('You must be qualified, checked in and available or busy to take charge.');
      if (e.status !== 'Unhandled')
        throw new Error(
          `Already ${e.status.toLowerCase()}${e.claimedBy ? ' by ' + s.staff.find((p) => p.id === e.claimedBy)?.name : ''}.`,
        );
      e.status = 'Taken charge';
      e.claimedBy = se.staffId;
      e.claimedAt = now(s);
      const n = s.notices.find((n) => n.eventId === e.id);
      if (n) n.takenAt = e.claimedAt;
      audit(s, se, 'event.taken-charge', e.id);
      retain(s, 'event-claimed', e.id, e);
    });
  }
  async close(se: Session, eventId: string, outcome: string) {
    return this.repo.mutate((s) => {
      const e = event(s, se, eventId);
      requireCapability(s, se, 'claim', e.wardId);
      if (se.offline || e.queued) throw new Error('Reconnect before closing.');
      if (e.claimedBy !== se.staffId || e.status !== 'Taken charge')
        throw new Error('Only the responsible staff member can close this item.');
      if (!outcome.trim()) throw new Error('Add a brief outcome note.');
      e.status = 'Closed';
      e.closedBy = se.staffId;
      e.closedAt = now(s);
      e.outcome = outcome.trim();
      const n = s.notices.find((n) => n.eventId === e.id);
      if (n) n.closedAt = e.closedAt;
      audit(s, se, 'event.closed', e.id);
      retain(s, 'event-closed', e.id, e);
    });
  }
  async amend(se: Session, eventId: string, text: string) {
    return this.repo.mutate((s) => {
      const e = event(s, se, eventId);
      if (!text.trim()) throw new Error('Enter an amendment.');
      if (
        e.authorId !== se.staffId &&
        !has(requireCapability(s, se, 'care'), e.wardId, 'coordinate')
      )
        throw new Error('Only the author or ward coordinator can amend this report.');
      const v = { text, authorId: se.staffId, at: now(s) };
      e.amendments.push(v);
      s.diary.find((d) => d.eventId === e.id)!.versions.push(v);
      audit(s, se, 'diary.amended', e.id);
      retain(s, 'diary-amendment', e.id, v);
    });
  }
  async attendance(se: Session, staffId: string, checkedIn: boolean, availability: Availability) {
    return this.repo.mutate((s) => {
      requireCapability(s, se, staffId === se.staffId ? 'care' : 'coordinate');
      if (!['Available', 'Busy', 'On break'].includes(availability))
        throw new Error('Invalid availability.');
      const a = s.attendance.find((a) => a.staffId === staffId && a.wardId === se.wardId);
      if (!a) throw new Error('Attendance unavailable.');
      a.checkedIn = checkedIn;
      a.availability = availability;
      if (checkedIn) a.checkInAt = now(s);
      else a.checkOutAt = now(s);
      audit(s, se, 'attendance.updated', staffId);
    });
  }
  async sendMessage(
    se: Session,
    conversationId: string,
    text: string,
    mediaIds: string[] = [],
    replyTo?: string,
  ) {
    return this.repo.mutate((s) => {
      const c = conversationAllowed(s, se, conversationId);
      if (se.offline) throw new Error('Messages are not sent offline. Your draft is preserved.');
      if (!text.trim() && !mediaIds.length) throw new Error('Write a message or attach media.');
      for (const mid of mediaIds)
        if (
          !s.media.some((m) => m.id === mid && m.wardId === c.wardId && m.authorId === se.staffId)
        )
          throw new Error('Attachment unavailable.');
      if (replyTo && !s.messages.some((m) => m.id === replyTo && m.conversationId === c.id))
        throw new Error('Reply source unavailable.');
      const m = {
        id: id('MSG'),
        wardId: c.wardId,
        conversationId,
        senderId: se.staffId,
        text: text.trim(),
        createdAt: now(s),
        mediaIds,
        replyTo,
        status: 'Delivered' as const,
        readBy: [se.staffId],
        sources: [],
        versions: [],
        ai: false,
      };
      s.messages.push(m);
      audit(s, se, 'message.sent', m.id);
      retain(s, 'message', m.id, m);
      if (c.kind === 'assistant') {
        const answer = this.answer(s, se, text);
        const ai = {
          ...m,
          id: id('AI'),
          senderId: 'ras-assistant',
          text: answer.text,
          mediaIds: [],
          sources: answer.sources,
          ai: true,
          operation: 'Completed' as const,
        };
        s.messages.push(ai);
        retain(s, 'assistant-message', ai.id, ai);
      }
      return m;
    });
  }
  private answer(s: State, se: Session, query: string): { text: string; sources: Source[] } {
    const q = query.toLowerCase();
    const other = s.wards.find(
      (w) => w.id !== se.wardId && (q.includes(w.id) || q.includes(w.name.toLowerCase())),
    );
    if (
      other ||
      (/r-031/i.test(q) && se.wardId !== 'cedar') ||
      (/r-0(14|08|21)/i.test(q) && se.wardId !== 'willow')
    )
      return {
        text: 'Access denied. I can only use records in your current authorized ward.',
        sources: [],
      };
    if (/(sign|validate|close|take charge|delete|change|approve)/i.test(q))
      return {
        text: 'I have not changed any record. Open the source record to review the proposed action and explicitly confirm it with your own permissions.',
        sources: [],
      };
    let records = s.events.filter((e) => e.wardId === se.wardId && !e.queued);
    if (/today/.test(q)) {
      const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' });
      records = records.filter(
        (e) => day.format(new Date(e.occurredAt)) === day.format(new Date(now(s))),
      );
    }
    const resident = q.match(/r-\d+/i)?.[0].toUpperCase();
    if (resident) records = records.filter((e) => e.residentId === resident);
    if (/unresolved|open|follow.up/.test(q)) records = records.filter((e) => e.status !== 'Closed');
    if (/last shift/.test(q)) {
      const h = s.handovers.find((h) => h.wardId === se.wardId);
      const signed = h?.versions.filter((v) => v.signed).at(-1);
      if (signed)
        return {
          text: `Recorded outgoing handover, version ${signed.number}: ${signed.text}`,
          sources: [
            {
              kind: 'handover',
              id: h!.id,
              label: `Signed handover · v${signed.number}`,
              at: signed.createdAt,
            },
          ],
        };
    }
    if (!records.length)
      return {
        text: 'No matching authorized reports were found. I do not have evidence to add further details.',
        sources: [],
      };
    return {
      text: `${/draft|summary|summarize/.test(q) ? 'AI draft — review before use. ' : ''}${records.length} recorded ${records.length === 1 ? 'event' : 'events'} in ${s.wards.find((w) => w.id === se.wardId)?.name}.\n\n${records.map((e) => `• ${e.type} · ${e.residentId || e.subject} · ${e.priority} · ${e.status}. ${e.notes}${e.outcome ? ' Outcome recorded: ' + e.outcome : ''}`).join('\n\n')}\n\nBased only on recorded reports. No additional outcomes or care instructions are inferred.`,
      sources: records.map((e) => ({
        kind: 'event',
        id: e.id,
        label: `${e.type} · ${e.residentId || e.subject}`,
        at: e.occurredAt,
      })),
    };
  }
  async readConversation(se: Session, conversationId: string) {
    return this.repo.mutate((s) => {
      conversationAllowed(s, se, conversationId);
      let changed = false;
      for (const m of s.messages.filter((m) => m.conversationId === conversationId)) {
        if (!m.readBy.includes(se.staffId)) {
          m.readBy.push(se.staffId);
          m.status = 'Read';
          changed = true;
        }
      }
      if (changed) audit(s, se, 'conversation.read', conversationId);
    });
  }
  async readNotice(se: Session, eventId: string) {
    return this.repo.mutate((s) => {
      event(s, se, eventId);
      const n = s.notices.find((n) => n.eventId === eventId);
      if (n) {
        n.readBy[se.staffId] = now(s);
        audit(s, se, 'notification.read', n.id);
      }
      audit(s, se, 'record.read', eventId);
    });
  }
  async editMessage(se: Session, messageId: string, text: string) {
    return this.repo.mutate((s) => {
      const m = s.messages.find((m) => m.id === messageId);
      if (!m) throw new Error('Message unavailable.');
      conversationAllowed(s, se, m.conversationId);
      if (m.senderId !== se.staffId || m.ai)
        throw new Error('Only the author can correct a message.');
      if (!text.trim()) throw new Error('Enter a correction.');
      m.versions.push({ text, authorId: se.staffId, at: now(s) });
      retain(s, 'message-correction', m.id, m);
      audit(s, se, 'message.corrected', m.id);
    });
  }
  async direct(se: Session, staffId: string) {
    return this.repo.mutate((s) => {
      requireCapability(s, se, 'care');
      const p = s.staff.find((p) => p.id === staffId);
      if (!p || !has(p, se.wardId, 'care') || p.id === se.staffId)
        throw new Error('Staff member unavailable.');
      const members = [se.staffId, staffId].sort();
      const cid = `dm-${se.wardId}-${members.join('-')}`;
      if (!s.conversations.some((c) => c.id === cid))
        s.conversations.push({
          id: cid,
          wardId: se.wardId,
          title: 'Direct conversation',
          kind: 'direct',
          memberIds: members,
        });
      audit(s, se, 'conversation.created', cid);
      return cid;
    });
  }
  async upload(
    se: Session,
    input: Omit<Media, 'id' | 'wardId' | 'authorId' | 'createdAt' | 'fingerprint'>,
  ) {
    requireCapability(await this.repo.read(), se, 'care');
    const fingerprint = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.url))),
    )
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');
    return this.repo.mutate((s) => {
      requireCapability(s, se, 'care');
      const m = {
        ...input,
        id: id('MEDIA'),
        wardId: se.wardId,
        authorId: se.staffId,
        createdAt: now(s),
        fingerprint,
      };
      s.media.push(m);
      retain(s, 'media', m.id, m);
      audit(s, se, 'media.added', m.id);
      return m;
    });
  }
  async reviewOcr(se: Session, ocrId: string, text: string) {
    return this.repo.mutate((s) => {
      const o = s.ocr.find((o) => o.id === ocrId);
      if (!o) throw new Error('Document unavailable.');
      requireCapability(s, se, 'care', o.wardId);
      if (o.reviewedAt)
        throw new Error(
          'This extraction has already been reviewed. Original and reviewed versions are retained.',
        );
      if (!text.trim()) throw new Error('Review the extracted text first.');
      o.corrected = text;
      o.reviewedBy = se.staffId;
      o.reviewedAt = now(s);
      retain(s, 'ocr-reviewed', o.id, o);
      audit(s, se, 'ocr.reviewed', o.id);
    });
  }
  async validateOcr(se: Session, ocrId: string) {
    return this.repo.mutate((s) => {
      const o = s.ocr.find((o) => o.id === ocrId);
      if (!o) throw new Error('Document unavailable.');
      requireCapability(s, se, 'validate', o.wardId);
      if (!o.reviewedAt) throw new Error('Human extraction review is required first.');
      if (o.validatedAt) throw new Error('Clinical validation is already recorded.');
      o.validatedBy = se.staffId;
      o.validatedAt = now(s);
      retain(s, 'ocr-validated', o.id, o);
      audit(s, se, 'ocr.clinically-validated', o.id);
    });
  }
  async contribute(se: Session, text: string) {
    return this.repo.mutate((s) => {
      requireCapability(s, se, 'care');
      if (!text.trim()) throw new Error('Write your shift contribution.');
      const summary = {
        id: id('SUM'),
        wardId: se.wardId,
        shiftId: `${se.wardId}-morning`,
        authorId: se.staffId,
        text,
        eventIds: s.events.filter((e) => e.wardId === se.wardId && !e.queued).map((e) => e.id),
        createdAt: now(s),
      };
      s.summaries.push(summary);
      retain(s, 'staff-summary', summary.id, summary);
      audit(s, se, 'summary.contributed', summary.id);
    });
  }
  async draftHandover(se: Session) {
    return this.repo.mutate((s) => {
      const h = handover(s, se);
      const es = s.events.filter((e) => e.wardId === se.wardId && !e.queued);
      const summaries = s.summaries.filter((x) => x.wardId === se.wardId);
      const text = [
        'Important reported events',
        ...es
          .filter((e) => e.priority === 'High')
          .map((e) => `${e.type} · ${e.residentId || e.subject} — ${e.status}. ${e.notes}`),
        '',
        'Open follow-ups',
        ...es
          .filter((e) => e.status === 'Taken charge')
          .map((e) => `${e.type} · ${e.residentId || e.subject} — taken charge.`),
        '',
        'Unresolved notifications',
        ...es
          .filter((e) => e.status === 'Unhandled' && e.priority !== 'Low')
          .map((e) => `${e.priority}: ${e.type} · ${e.residentId || e.subject} — unhandled.`),
        '',
        'Items to pass to the next shift',
        ...es
          .filter((e) => e.priority === 'Low')
          .map((e) => `${e.type} · ${e.residentId || e.subject}. ${e.notes}`),
        ...summaries.map((x) => `${s.staff.find((p) => p.id === x.authorId)?.name}: ${x.text}`),
      ].join('\n');
      const v: HandoverVersion = {
        number: h.versions.length + 1,
        text,
        sourceIds: es.map((e) => e.id),
        createdAt: now(s),
        acknowledgements: [],
      };
      h.versions.push(v);
      retain(s, 'handover-draft', h.id, v);
      audit(s, se, 'handover.drafted', h.id);
    });
  }
  async handoverAction(se: Session, action: 'review' | 'validate' | 'sign' | 'acknowledge') {
    return this.repo.mutate((s) => {
      const h = handover(s, se);
      const v = h.versions.at(-1)!;
      const p = requireCapability(
        s,
        se,
        action === 'validate'
          ? 'validate'
          : action === 'sign' || action === 'review'
            ? 'sign'
            : 'care',
      );
      const role = p.assignments.find(
        (a) =>
          a.wardId === se.wardId &&
          a.role ===
            (action === 'validate'
              ? 'physician'
              : action === 'acknowledge'
                ? a.role
                : 'coordinator'),
      )!.role;
      const signature = { staffId: p.id, role, at: now(s), version: v.number };
      if (action === 'acknowledge') {
        if (!v.signed) throw new Error('Only a signed handover can be acknowledged.');
        if (!h.incomingIds.includes(p.id))
          throw new Error('You are not assigned to receive this handover.');
        if (v.acknowledgements.some((a) => a.staffId === p.id))
          throw new Error('You already acknowledged this version.');
        v.acknowledgements.push(signature);
      } else {
        if (v.signed) throw new Error('Signed versions are preserved. Create an amendment draft.');
        if (action === 'review') v.reviewed = signature;
        if (action === 'validate') {
          if (!v.reviewed) throw new Error('Coordinator review is required first.');
          v.validated = signature;
        }
        if (action === 'sign') {
          if (!v.reviewed) throw new Error('Review this draft before signing.');
          if (h.requiresClinicalValidation && !v.validated)
            throw new Error('Physician validation is required.');
          v.signed = signature;
        }
      }
      retain(s, `handover-${action}`, h.id, v);
      audit(s, se, `handover.${action}`, h.id);
    });
  }
  async advance(se: Session, minutes = 10) {
    return this.repo.mutate((s) => {
      const p = s.staff.find((p) => p.id === se.staffId);
      if (!p || !p.active) throw new Error('Demo account unavailable.');
      s.clockOffset += minutes * 60000;
      for (const n of s.notices) {
        const e = s.events.find((e) => e.id === n.eventId)!;
        if (e.status !== 'Unhandled' || e.queued) continue;
        const rule = s.rules.find((r) => r.priority === e.priority)!;
        const elapsed = (Date.parse(now(s)) - Date.parse(n.createdAt)) / 60000;
        if (rule.reminderMinutes && elapsed >= rule.reminderMinutes && !n.remindedAt) {
          n.remindedAt = now(s);
          audit(s, { ...se, wardId: e.wardId }, 'notification.reminded', n.id);
        }
        if (rule.escalationMinutes && elapsed >= rule.escalationMinutes && !n.escalation) {
          n.escalation = 1;
          n.lastEscalatedAt = now(s);
          n.recipientIds = [
            ...new Set([
              ...n.recipientIds,
              ...s.staff.filter((p) => eligible(s, e, p, true)).map((p) => p.id),
            ]),
          ];
          if (n.recipientIds.length && !n.sentAt) {
            n.sentAt = now(s);
            n.deliveredAt = now(s);
          }
          audit(s, { ...se, wardId: e.wardId }, 'notification.escalated', n.id);
        }
      }
    });
  }
  async updateSkills(se: Session, staffId: string, skills: string[]) {
    return this.repo.mutate((s) => {
      requireCapability(s, se, 'coordinate');
      const p = s.staff.find(
        (p) => p.id === staffId && p.assignments.some((a) => a.wardId === se.wardId),
      );
      if (!p) throw new Error('Staff member unavailable.');
      p.skills = [...new Set(skills.map((x) => x.trim()).filter(Boolean))];
      audit(s, se, 'staff.skills-updated', p.id);
    });
  }
  async assignShift(se: Session, staffId: string, shiftId: string) {
    return this.repo.mutate((s) => {
      requireCapability(s, se, 'coordinate');
      const a = s.attendance.find((a) => a.staffId === staffId && a.wardId === se.wardId);
      const shift = s.shifts.find((x) => x.id === shiftId && x.wardId === se.wardId);
      if (!a || !shift) throw new Error('Shift assignment unavailable.');
      a.shiftId = shiftId;
      a.checkedIn = false;
      a.checkOutAt = now(s);
      audit(s, se, 'shift.assigned', staffId);
    });
  }
  async createOcr(se: Session, mediaId: string) {
    return this.repo.mutate((s) => {
      requireCapability(s, se, 'care');
      const m = s.media.find(
        (m) =>
          m.id === mediaId &&
          m.wardId === se.wardId &&
          m.authorId === se.staffId &&
          m.kind === 'photo',
      );
      if (!m) throw new Error('Document image unavailable.');
      const o = {
        id: id('OCR'),
        wardId: se.wardId,
        title: m.synthetic
          ? 'Synthetic shift note · review requested'
          : 'Document · manual transcription required',
        mediaId,
        original: m.synthetic ? 'Room 108 — follow-up at 14:00. Call bell checked.' : '',
        uncertain: m.synthetic
          ? ['14:00']
          : ['Automatic OCR is not connected. Enter and review the text manually.'],
      };
      s.ocr.push(o);
      retain(s, 'ocr-original', o.id, o);
      audit(s, se, 'document.captured', o.id);
      return o.id;
    });
  }
  async updateAccount(se: Session, staffId: string, wardId: string, role: Role, active: boolean) {
    return this.repo.mutate((s) => {
      requireCapability(s, se, 'admin', wardId);
      const p = s.staff.find((p) => p.id === staffId);
      if (!p) throw new Error('Account unavailable.');
      if (staffId === se.staffId)
        throw new Error('Use a second administrator to change your own account.');
      if (
        ![
          'nurse',
          'assistant',
          'technician',
          'physician',
          'coordinator',
          'management',
          'administrator',
        ].includes(role)
      )
        throw new Error('Invalid role.');
      p.assignments = p.assignments.filter((a) => a.wardId !== wardId);
      p.assignments.push({ wardId, role });
      p.active = active;
      for (const c of s.conversations.filter((c) => c.wardId === wardId)) {
        if (c.kind === 'team' || c.kind === 'event') {
          c.memberIds = c.memberIds.filter((x) => x !== p.id);
          if (has(p, wardId, 'care')) c.memberIds.push(p.id);
        }
      }
      audit(s, se, 'account.updated', p.id);
    });
  }
  async reset() {
    return this.repo.reset();
  }
}

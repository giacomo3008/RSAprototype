export type Role =
  | 'nurse'
  | 'assistant'
  | 'technician'
  | 'physician'
  | 'coordinator'
  | 'management'
  | 'administrator';
export type Capability =
  'care' | 'claim' | 'validate' | 'coordinate' | 'sign' | 'aggregate' | 'admin' | 'audit';
export type Priority = 'High' | 'Medium' | 'Low';
export type EventType =
  'Fall' | 'Health' | 'Wandering' | 'Agitation' | 'Refusal' | 'Skin / wound' | 'Safety' | 'Hygiene';
export const EVENT_DEFAULTS: Record<EventType, Priority> = {
  Fall: 'High',
  Health: 'High',
  Wandering: 'High',
  Agitation: 'Medium',
  Refusal: 'Medium',
  'Skin / wound': 'Medium',
  Safety: 'Medium',
  Hygiene: 'Low',
};
export interface Assignment {
  wardId: string;
  role: Role;
}
export interface Staff {
  id: string;
  name: string;
  initials: string;
  color: string;
  assignments: Assignment[];
  skills: string[];
  active: boolean;
}
export interface Ward {
  id: string;
  name: string;
  floor: string;
}
export interface Resident {
  id: string;
  wardId: string;
  name: string;
  room: string;
  assignedStaffIds: string[];
}
export type Availability = 'Available' | 'Busy' | 'On break';
export interface Shift {
  id: string;
  wardId: string;
  name: string;
  start: string;
  end: string;
  incomingIds: string[];
}
export interface Attendance {
  staffId: string;
  shiftId: string;
  wardId: string;
  checkedIn: boolean;
  availability: Availability;
  checkInAt?: string;
  checkOutAt?: string;
}
export interface Media {
  id: string;
  wardId: string;
  authorId: string;
  kind: 'photo' | 'voice';
  url: string;
  name: string;
  duration?: number;
  synthetic: boolean;
  transcript?: string;
  createdAt: string;
  fingerprint: string;
}
export interface Correction {
  text: string;
  authorId: string;
  at: string;
}
export interface CareEvent {
  id: string;
  correlationId: string;
  key: string;
  wardId: string;
  authorId: string;
  residentId?: string;
  subject?: string;
  place: string;
  type: EventType;
  priority: Priority;
  defaultPriority: Priority;
  notes: string;
  occurredAt: string;
  originalOccurredAt: string;
  createdAt: string;
  syncedAt?: string;
  queued: boolean;
  syncError?: string;
  status: 'Unhandled' | 'Taken charge' | 'Closed';
  claimedBy?: string;
  claimedAt?: string;
  closedBy?: string;
  closedAt?: string;
  outcome?: string;
  mediaIds: string[];
  sourceMessageId?: string;
  amendments: Correction[];
}
export interface Notice {
  id: string;
  eventId: string;
  wardId: string;
  recipientIds: string[];
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readBy: Record<string, string>;
  takenAt?: string;
  closedAt?: string;
  escalation: number;
  remindedAt?: string;
  lastEscalatedAt?: string;
}
export interface DiaryEntry {
  id: string;
  eventId: string;
  wardId: string;
  createdAt: string;
  versions: Correction[];
}
export interface Conversation {
  id: string;
  wardId: string;
  title: string;
  kind: 'team' | 'direct' | 'event' | 'assistant';
  memberIds: string[];
  eventId?: string;
  ownerId?: string;
}
export interface Source {
  kind: 'event' | 'diary' | 'handover' | 'message';
  id: string;
  label: string;
  at: string;
}
export interface Message {
  id: string;
  wardId: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  mediaIds: string[];
  replyTo?: string;
  status: 'Sending' | 'Sent' | 'Delivered' | 'Read';
  readBy: string[];
  sources: Source[];
  versions: Correction[];
  linkedEventId?: string;
  ai: boolean;
  operation?: 'Completed' | 'Failed' | 'Needs review';
}
export interface StaffSummary {
  id: string;
  wardId: string;
  shiftId: string;
  authorId: string;
  text: string;
  eventIds: string[];
  createdAt: string;
}
export interface Signature {
  staffId: string;
  role: Role;
  at: string;
  version: number;
}
export interface HandoverVersion {
  number: number;
  text: string;
  sourceIds: string[];
  createdAt: string;
  reviewed?: Signature;
  validated?: Signature;
  signed?: Signature;
  acknowledgements: Signature[];
}
export interface Handover {
  id: string;
  wardId: string;
  shiftId: string;
  incomingIds: string[];
  versions: HandoverVersion[];
  requiresClinicalValidation: boolean;
}
export interface OcrItem {
  id: string;
  wardId: string;
  title: string;
  mediaId: string;
  original: string;
  uncertain: string[];
  corrected?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  validatedBy?: string;
  validatedAt?: string;
}
export interface Audit {
  id: string;
  actorId: string;
  action: string;
  entityId: string;
  wardId?: string;
  at: string;
}
export interface Retention {
  id: string;
  entityId: string;
  kind: string;
  at: string;
  fingerprint: string;
  snapshot: string;
}
export interface RoutingRule {
  priority: Priority;
  roles: Role[];
  reminderMinutes?: number;
  escalationMinutes?: number;
}
export interface State {
  revision: number;
  wards: Ward[];
  staff: Staff[];
  residents: Resident[];
  shifts: Shift[];
  attendance: Attendance[];
  events: CareEvent[];
  notices: Notice[];
  diary: DiaryEntry[];
  conversations: Conversation[];
  messages: Message[];
  media: Media[];
  summaries: StaffSummary[];
  handovers: Handover[];
  ocr: OcrItem[];
  audit: Audit[];
  retention: Retention[];
  rules: RoutingRule[];
  clockOffset: number;
}
export interface EventDraft {
  key: string;
  wardId: string;
  type: EventType;
  priority: Priority;
  residentId?: string;
  subject?: string;
  place: string;
  notes: string;
  occurredAt: string;
  originalOccurredAt: string;
  mediaIds: string[];
  sourceMessageId?: string;
}
export interface Session {
  staffId: string;
  wardId: string;
  offline: boolean;
}
export interface CareApi {
  view(session: Session): Promise<State>;
  report(session: Session, draft: EventDraft): Promise<CareEvent>;
  claim(session: Session, eventId: string): Promise<void>;
  close(session: Session, eventId: string, outcome: string): Promise<void>;
  sendMessage(
    session: Session,
    conversationId: string,
    text: string,
    mediaIds?: string[],
    replyTo?: string,
  ): Promise<Message>;
}

import type { Capability, Role, Staff, State, Session, CareEvent } from './types';
export const CAPABILITIES: Record<Role, readonly Capability[]> = {
  nurse: ['care', 'claim'],
  assistant: ['care'],
  technician: ['care'],
  physician: ['care', 'validate'],
  coordinator: ['care', 'claim', 'coordinate', 'sign'],
  management: ['aggregate'],
  administrator: ['admin', 'audit'],
};
export function has(staff: Staff, wardId: string, capability: Capability) {
  return (
    staff.active &&
    staff.assignments.some((a) => a.wardId === wardId && CAPABILITIES[a.role].includes(capability))
  );
}
export function requireCapability(
  s: State,
  session: Session,
  capability: Capability,
  wardId = session.wardId,
) {
  const staff = s.staff.find((x) => x.id === session.staffId);
  if (!staff || !has(staff, wardId, capability))
    throw new Error('Access denied. This action is outside your assigned role or ward.');
  return staff;
}
export function eligible(
  s: State,
  e: Pick<CareEvent, 'wardId' | 'type' | 'priority'>,
  staff: Staff,
  escalation = false,
) {
  if (!staff.active || !has(staff, e.wardId, 'claim')) return false;
  const roles = staff.assignments.filter((a) => a.wardId === e.wardId).map((a) => a.role);
  if (!(
    roles.includes('nurse') ||
    ((e.priority === 'High' || escalation) && roles.includes('coordinator'))
  ))
    return false;
  if (!staff.skills.includes(e.type === 'Safety' ? 'safety' : 'care')) return false;
  return s.attendance.some(
    (a) =>
      a.staffId === staff.id &&
      a.wardId === e.wardId &&
      a.checkedIn &&
      a.availability !== 'On break',
  );
}
export function conversationAllowed(s: State, session: Session, id: string) {
  const c = s.conversations.find((c) => c.id === id);
  if (
    !c ||
    !has(
      s.staff.find((p) => p.id === session.staffId)!,
      c.wardId,
      'care',
    ) ||
    !c.memberIds.includes(session.staffId)
  )
    throw new Error('Access denied. Conversation unavailable.');
  return c;
}

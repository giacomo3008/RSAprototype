import type { ReactNode } from 'react';
import { useDialog } from './useDialog';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  Footprints,
  Hand,
  Utensils,
  Bandage,
  Wrench,
  Droplets,
  ArrowUpRight,
  Minus,
  CheckCircle2,
  Circle,
  Clock3,
  X,
} from 'lucide-react';
import type { CareEvent, EventType, Priority, Staff } from '../domain/types';
import { time } from '../i18n';
export const eventIcons = {
  Fall: Footprints,
  Health: Activity,
  Wandering: Footprints,
  Agitation: Hand,
  Refusal: Utensils,
  'Skin / wound': Bandage,
  Safety: Wrench,
  Hygiene: Droplets,
};
export function EventIcon({ type, size = 20 }: { type: EventType; size?: number }) {
  const Icon = eventIcons[type];
  return <Icon size={size} strokeWidth={1.8} />;
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  const Icon = priority === 'High' ? ArrowUpRight : priority === 'Medium' ? Minus : Circle;
  return (
    <span className={`badge priority-${priority.toLowerCase()}`}>
      <Icon size={13} />
      {priority}
    </span>
  );
}
export function StatusBadge({ event }: { event: CareEvent }) {
  const Icon = event.queued
    ? Clock3
    : event.status === 'Closed'
      ? CheckCircle2
      : event.status === 'Taken charge'
        ? CheckCircle2
        : Circle;
  return (
    <span className={`status status-${event.status.split(' ')[0].toLowerCase()}`}>
      <Icon size={13} />
      {event.queued
        ? 'Queued offline'
        : event.status === 'Unhandled'
          ? 'Not taken charge'
          : event.status}
    </span>
  );
}
export function Avatar({
  person,
  size = 'normal',
}: {
  person?: Pick<Staff, 'initials' | 'color' | 'name'>;
  size?: 'small' | 'normal' | 'large';
}) {
  return (
    <span
      className={`avatar avatar-${person?.color || 'teal'} avatar-${size}`}
      title={person?.name}
    >
      {person?.initials || 'AI'}
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <CheckCircle2 size={32} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useDialog(onClose);
  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={22} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <AlertTriangle size={18} />
      <span>{message}</span>
      {retry && <button onClick={retry}>Retry</button>}
    </div>
  );
}
export function Timestamp({ value }: { value: string }) {
  return (
    <time dateTime={value} title={new Date(value).toISOString()}>
      {time(value)}
    </time>
  );
}

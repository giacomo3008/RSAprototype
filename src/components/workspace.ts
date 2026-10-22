import type { State, Session, Staff, CareEvent, EventDraft } from '../domain/types';
import type { DemoApi } from '../services/api';
export type Page =
  | 'home'
  | 'chat'
  | 'inbox'
  | 'diary'
  | 'handover'
  | 'shift'
  | 'team'
  | 'settings'
  | 'management'
  | 'accounts'
  | 'integrations'
  | 'audit'
  | 'more';
export interface Workspace {
  state: State;
  session: Session;
  person: Staff;
  api: DemoApi;
  refresh: () => Promise<void>;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
  go: (page: Page) => void;
  openEvent: (event: CareEvent) => void;
  openChat: (id: string) => void;
  report: (prefill?: Partial<EventDraft>) => void;
}
export const roleName = (role: string) =>
  ({
    assistant: 'Healthcare assistant',
    technician: 'Technician',
    nurse: 'Registered nurse',
    physician: 'Physician',
    coordinator: 'Ward coordinator',
    management: 'Medical management',
    administrator: 'System administrator',
  })[role] || role;

import type { CareApi, CareEvent, EventDraft, Message, Session, State } from '../domain/types';
// Future adapter: the authenticated backend derives identity and capabilities from the session.
// Never send client-selected demo roles to a production authorization endpoint.
export class HttpCareApi implements CareApi {
  constructor(private base = '/api/v1') {}
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.base}${path}`, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`Request failed (${response.status}).`);
    return response.status === 204 ? (undefined as T) : response.json();
  }
  view(_session: Session) {
    return this.request<State>('/workspace');
  }
  report(_session: Session, draft: EventDraft) {
    return this.request<CareEvent>('/events', draft);
  }
  claim(_session: Session, eventId: string) {
    return this.request<void>(`/events/${encodeURIComponent(eventId)}/claim`, {});
  }
  close(_session: Session, eventId: string, outcome: string) {
    return this.request<void>(`/events/${encodeURIComponent(eventId)}/close`, { outcome });
  }
  sendMessage(
    _session: Session,
    conversationId: string,
    text: string,
    mediaIds: string[] = [],
    replyTo?: string,
  ) {
    return this.request<Message>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      text,
      mediaIds,
      replyTo,
    });
  }
}
export interface AgentProvider {
  run(request: {
    operation: 'summary' | 'ocr' | 'retrieve';
    sourceIds: string[];
    correlationId: string;
  }): Promise<{
    status: 'Completed' | 'Needs review' | 'Failed';
    text: string;
    sourceIds: string[];
  }>;
}
// A real AgentProvider is implemented on FastAPI/LangGraph, never in browser components.

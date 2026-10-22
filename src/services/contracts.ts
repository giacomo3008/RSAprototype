/** Service seams. DemoApi implements these against one transactional repository.
 * Production implementations delegate to authenticated FastAPI endpoints.
 * LangGraph orchestration, identity and authorization stay on the server.
 */
import type { DemoApi } from './api';
export type AttendanceService = Pick<DemoApi, 'attendance' | 'assignShift' | 'updateSkills'>;
export type MessagingService = Pick<
  DemoApi,
  'sendMessage' | 'readConversation' | 'editMessage' | 'direct'
>;
export type EventService = Pick<DemoApi, 'report' | 'sync' | 'claim' | 'close' | 'amend'>;
export type NotificationService = Pick<DemoApi, 'readNotice' | 'advance'>;
export type MediaService = Pick<DemoApi, 'upload'>;
export type OcrService = Pick<DemoApi, 'createOcr' | 'reviewOcr' | 'validateOcr'>;
export type DiaryService = Pick<DemoApi, 'view' | 'amend'>;
export type HandoverService = Pick<DemoApi, 'contribute' | 'draftHandover' | 'handoverAction'>;
export type AssistantService = Pick<DemoApi, 'sendMessage'>;

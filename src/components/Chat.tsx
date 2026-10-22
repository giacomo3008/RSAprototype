import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  ArrowLeft,
  Send,
  MessageCircle,
  Sparkles,
  Users,
  MoreHorizontal,
  Reply,
  FilePlus2,
  Link,
  CheckCheck,
  Paperclip,
  X,
  ChevronDown,
} from 'lucide-react';
import type { Message, Media, Source } from '../domain/types';
import { t, time, date } from '../i18n';
import {
  Avatar,
  EventIcon,
  PriorityBadge,
  StatusBadge,
  Empty,
  PageHeading,
  Modal,
  ErrorBox,
} from './ui';
import { MediaCapture } from './MediaCapture';
import { MediaView } from './RecordDetails';
import { roleName } from './workspace';
import type { Workspace } from './workspace';
function conversationTitle(w: Workspace, id: string) {
  const c = w.state.conversations.find((c) => c.id === id);
  if (!c) return 'Conversation';
  if (c.kind === 'direct')
    return (
      w.state.staff.find((p) => c.memberIds.includes(p.id) && p.id !== w.person.id)?.name || c.title
    );
  return c.title;
}
export function Chat({
  w,
  selected,
  onSelect,
}: {
  w: Workspace;
  selected?: string;
  onSelect: (id?: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<Message>();
  const [showMedia, setShowMedia] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [newChat, setNewChat] = useState(false);
  const [correction, setCorrection] = useState<Message>();
  const [correctionText, setCorrectionText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<string>();
  const bottom = useRef<HTMLDivElement>(null);
  const conversations = w.state.conversations
    .filter((c) => c.wardId === w.session.wardId)
    .filter((c) =>
      `${conversationTitle(w, c.id)} ${w.state.messages
        .filter((m) => m.conversationId === c.id)
        .map((m) => m.text + ' ' + m.versions.map((v) => v.text).join(' '))
        .join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const c = w.state.conversations.find((c) => c.id === selected);
  const messages = w.state.messages.filter((m) => m.conversationId === c?.id);
  const linkedEvent = w.state.events.find((e) => e.id === c?.eventId);
  const draftKey = `ras-chat-draft-${w.person.id}-${selected}`;
  useEffect(() => {
    setMessage(localStorage.getItem(draftKey) || '');
    setReply(undefined);
    setMedia([]);
    setShowMedia(false);
    setError('');
    if (selected)
      void w.api
        .readConversation(w.session, selected)
        .then(w.refresh)
        .catch(() => {});
  }, [selected, w.person.id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'nearest',
    });
  }, [messages.length]);
  useEffect(() => {
    if (selected && messages.some((m) => !m.readBy.includes(w.person.id)))
      void w.api
        .readConversation(w.session, selected)
        .then(w.refresh)
        .catch(() => {});
  }, [selected, messages.length]);
  const setDraft = (text: string) => {
    setMessage(text);
    localStorage.setItem(draftKey, text);
  };
  function sourceOpen(source: Source) {
    if (source.kind === 'event' || source.kind === 'diary') {
      const e = w.state.events.find((e) => e.id === source.id || `D-${e.id}` === source.id);
      if (e) w.openEvent(e);
    } else if (source.kind === 'handover') w.go('handover');
    else {
      const m = w.state.messages.find((m) => m.id === source.id);
      if (m) onSelect(m.conversationId);
    }
  }
  async function send(text = message) {
    if (sending) return;
    setSending(true);
    setError('');
    try {
      await w.api.sendMessage(
        w.session,
        c!.id,
        text,
        media.map((m) => m.id),
        reply?.id,
      );
      setDraft('');
      setReply(undefined);
      setMedia([]);
      setShowMedia(false);
      await w.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  const suggestions = [
    'Summarize the last shift.',
    'Show unresolved events in my ward.',
    'Draft my shift summary.',
    'Find today’s reports for resident R-014.',
  ];
  let previousDay = '';
  const unreadIndex = messages.findIndex(
    (m) => !m.readBy.includes(w.person.id) && m.senderId !== w.person.id,
  );
  return (
    <>
      <div className="chat-page-heading">
        <PageHeading title={t('chat.title')} description={t('chat.subtitle')} />
      </div>
      <section className={`chat-workspace panel ${c ? 'thread-open' : ''}`}>
        <aside className="conversation-list">
          <div className="conversation-list-header">
            <h2>Messages</h2>
            <button
              className="icon-button"
              aria-label="New direct conversation"
              onClick={() => setNewChat(true)}
            >
              <Plus size={21} />
            </button>
          </div>
          <div className="search-field chat-search">
            <Search size={17} />
            <input
              placeholder="Search messages"
              aria-label={t('chat.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="conversation-items">
            {conversations
              .sort((a, b) => (a.kind === 'assistant' ? -1 : b.kind === 'assistant' ? 1 : 0))
              .map((conv) => {
                const last = w.state.messages.filter((m) => m.conversationId === conv.id).at(-1);
                const unread = w.state.messages.filter(
                  (m) =>
                    m.conversationId === conv.id &&
                    !m.readBy.includes(w.person.id) &&
                    m.senderId !== w.person.id,
                ).length;
                const direct =
                  conv.kind === 'direct'
                    ? w.state.staff.find(
                        (p) => conv.memberIds.includes(p.id) && p.id !== w.person.id,
                      )
                    : undefined;
                return (
                  <button
                    key={conv.id}
                    className={`conversation-item ${conv.id === selected ? 'selected' : ''}`}
                    onClick={() => onSelect(conv.id)}
                  >
                    {conv.kind === 'assistant' ? (
                      <span className="assistant-avatar">
                        <Sparkles size={21} />
                      </span>
                    ) : direct ? (
                      <Avatar person={direct} />
                    ) : (
                      <span
                        className={`conversation-avatar ${conv.kind === 'event' ? 'event-avatar' : ''}`}
                      >
                        {conv.kind === 'team' ? <Users size={20} /> : <MessageCircle size={20} />}
                      </span>
                    )}
                    <span className="conversation-copy">
                      <span>
                        <strong>{conversationTitle(w, conv.id)}</strong>
                        {last && <time>{time(last.createdAt)}</time>}
                      </span>
                      <small>
                        {last
                          ? last.versions.at(-1)?.text || last.text || 'Attachment'
                          : conv.kind === 'assistant'
                            ? 'A little help with the bigger picture.'
                            : conv.kind === 'event'
                              ? 'Connected to the official report.'
                              : 'Start a conversation.'}
                      </small>
                      <span className="conversation-context">
                        {conv.kind === 'assistant'
                          ? 'AI · Private to you'
                          : conv.kind === 'team'
                            ? 'Ward team'
                            : conv.kind === 'event'
                              ? 'Event thread'
                              : 'Direct message'}
                        {unread > 0 && <b className="unread-badge">{unread}</b>}
                      </span>
                    </span>
                  </button>
                );
              })}
            {!conversations.length && <Empty title="No conversations found" />}
          </div>
          <div className="chat-scope-note">
            <span className="presence present" />
            Shared ward scope · synthetic demo
          </div>
        </aside>
        {!c ? (
          <div className="chat-placeholder">
            <span className="assistant-avatar">
              <MessageCircle size={30} />
            </span>
            <h2>Care starts with a conversation.</h2>
            <p>Select your ward team, a colleague, or RAS Assistant.</p>
            <button
              className="button primary"
              onClick={() => {
                const team = conversations.find((c) => c.kind === 'team');
                if (team) onSelect(team.id);
              }}
            >
              Open team chat
            </button>
          </div>
        ) : (
          <div className="conversation-thread">
            <header className="thread-header">
              <button
                className="icon-button thread-back"
                aria-label="Back to conversations"
                onClick={() => onSelect(undefined)}
              >
                <ArrowLeft size={21} />
              </button>
              {c.kind === 'assistant' ? (
                <span className="assistant-avatar">
                  <Sparkles size={22} />
                </span>
              ) : (
                <span className="conversation-avatar">
                  <Users size={20} />
                </span>
              )}
              <div>
                <h2>
                  {conversationTitle(w, c.id)}
                  {c.kind === 'assistant' && <span className="ai-tag">AI</span>}
                </h2>
                <p>
                  {c.kind === 'assistant'
                    ? 'Private to you · Current ward records · Simulated assistant'
                    : `${w.state.wards.find((wd) => wd.id === c.wardId)?.name} · ${c.memberIds.length} members`}
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Conversation details"
                onClick={() => setMenu(menu === 'details' ? undefined : 'details')}
              >
                <MoreHorizontal size={22} />
              </button>
            </header>
            {menu === 'details' && (
              <div className="conversation-details">
                <strong>Authorized members</strong>
                <p>
                  {c.memberIds
                    .map((id) => w.state.staff.find((p) => p.id === id)?.name)
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <small>Reading messages does not take charge of linked events.</small>
              </div>
            )}
            {linkedEvent && (
              <button className="thread-event" onClick={() => w.openEvent(linkedEvent)}>
                <EventIcon type={linkedEvent.type} />
                <div>
                  <strong>
                    {linkedEvent.type} · {linkedEvent.residentId || linkedEvent.subject}
                  </strong>
                  <StatusBadge event={linkedEvent} />
                </div>
                <PriorityBadge priority={linkedEvent.priority} />
              </button>
            )}
            <div className="messages-scroll">
              {c.kind === 'assistant' && (
                <div className="assistant-intro">
                  <span className="assistant-avatar">
                    <Sparkles size={28} />
                  </span>
                  <h3>A clearer view of your shift.</h3>
                  <p>
                    I can organize recorded facts, find open reports and help draft your handover.
                    My answers link back to your authorized sources.
                  </p>
                  <div className="suggestion-grid">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        disabled={sending || w.session.offline}
                        onClick={() => void send(s)}
                      >
                        {s}
                        <ArrowLeft className="rotate-arrow" size={15} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, index) => {
                const own = m.senderId === w.person.id;
                const sender = w.state.staff.find((p) => p.id === m.senderId);
                const day = date(m.createdAt);
                const showDay = day !== previousDay;
                previousDay = day;
                const originalReply = w.state.messages.find((x) => x.id === m.replyTo);
                return (
                  <div key={m.id}>
                    {showDay && (
                      <div className="message-date">
                        <span>{day}</span>
                      </div>
                    )}
                    {index === unreadIndex && <div className="unread-marker">Unread messages</div>}
                    <div className={`message-row ${own ? 'own' : ''} ${m.ai ? 'ai-message' : ''}`}>
                      {!own &&
                        (m.ai ? (
                          <span className="assistant-avatar small-avatar">
                            <Sparkles size={17} />
                          </span>
                        ) : (
                          <Avatar person={sender} size="small" />
                        ))}
                      <div className="message-wrap">
                        <div className="message-sender">
                          {own ? 'You' : m.ai ? 'RAS Assistant' : sender?.name}
                          <span>
                            {m.ai ? (
                              <span className="ai-tag">AI</span>
                            ) : (
                              roleName(
                                sender?.assignments.find((a) => a.wardId === w.session.wardId)
                                  ?.role || '',
                              )
                            )}
                          </span>
                        </div>
                        <div className="message-bubble">
                          {originalReply && (
                            <blockquote>
                              {w.state.staff.find((p) => p.id === originalReply.senderId)?.name}
                              <p>{originalReply.versions.at(-1)?.text || originalReply.text}</p>
                            </blockquote>
                          )}
                          <p className="preserve-lines">{m.versions.at(-1)?.text || m.text}</p>
                          {m.mediaIds
                            .map((id) => w.state.media.find((x) => x.id === id))
                            .filter((x): x is Media => !!x)
                            .map((x) => (
                              <MediaView key={x.id} media={x} />
                            ))}
                          {m.versions.length > 0 && (
                            <details className="message-versions">
                              <summary>Corrected · {m.versions.length} amendment(s)</summary>
                              <p>Original: {m.text}</p>
                              {m.versions.map((v, i) => (
                                <p key={i}>
                                  {time(v.at)} · {v.text}
                                </p>
                              ))}
                            </details>
                          )}
                          {m.sources.length > 0 && (
                            <div className="message-sources">
                              <span>
                                <Link size={13} />
                                Sources · {m.sources.length}
                              </span>
                              {m.sources.map((s) => (
                                <button
                                  key={s.id}
                                  className="source-link"
                                  onClick={() => sourceOpen(s)}
                                >
                                  <FilePlus2 size={14} />
                                  {s.label}
                                  <time>{time(s.at)}</time>
                                </button>
                              ))}
                            </div>
                          )}
                          {m.ai && (
                            <details className="ai-activity">
                              <summary>Sources & activity · Completed</summary>
                              <p>
                                Authorized records selected. Response derived from current demo
                                records. No changes made.
                              </p>
                            </details>
                          )}
                          {m.linkedEventId && (
                            <button
                              className="source-link"
                              onClick={() => {
                                const e = w.state.events.find((e) => e.id === m.linkedEventId);
                                if (e) w.openEvent(e);
                              }}
                            >
                              Linked event · {m.linkedEventId}
                            </button>
                          )}
                          <div className="message-time">
                            <time>{time(m.createdAt)}</time>
                            {own && (
                              <span>
                                <CheckCheck size={13} />
                                {m.status}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="message-actions">
                          <button onClick={() => setReply(m)}>
                            <Reply size={13} />
                            Reply
                          </button>
                          {!m.ai && (
                            <button
                              onClick={() =>
                                w.report({
                                  notes:
                                    m.versions.at(-1)?.text ||
                                    m.text ||
                                    m.mediaIds
                                      .map(
                                        (id) =>
                                          w.state.media.find((x) => x.id === id)?.transcript || '',
                                      )
                                      .join(' '),
                                  sourceMessageId: m.id,
                                })
                              }
                            >
                              <FilePlus2 size={13} />
                              Create event
                            </button>
                          )}
                          {own && (
                            <button
                              onClick={() => {
                                setCorrection(m);
                                setCorrectionText(m.versions.at(-1)?.text || m.text);
                              }}
                            >
                              Correct
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>
            <div className="composer-area">
              {error && <ErrorBox message={error} />}{' '}
              {reply && (
                <div className="reply-preview">
                  <Reply size={16} />
                  <span>
                    Replying to{' '}
                    {w.state.staff.find((p) => p.id === reply.senderId)?.name || 'RAS Assistant'}
                    <small>{reply.text}</small>
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => setReply(undefined)}
                    aria-label="Cancel reply"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {showMedia && (
                <MediaCapture
                  api={w.api}
                  session={w.session}
                  onAttach={(m) => {
                    setMedia((ms) => [...ms, m]);
                    setShowMedia(false);
                  }}
                />
              )}
              {media.map((m) => (
                <span className="attachment-chip" key={m.id}>
                  <Paperclip size={13} />
                  {m.name}
                  <button
                    className="icon-button"
                    onClick={() => setMedia((ms) => ms.filter((x) => x.id !== m.id))}
                    aria-label="Remove attachment"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
              <form
                className="message-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Voice, camera and attachments"
                  onClick={() => setShowMedia(!showMedia)}
                >
                  <Plus size={23} />
                </button>
                <textarea
                  rows={1}
                  aria-label={
                    c.kind === 'assistant' ? 'Message RAS Assistant' : 'Message colleagues'
                  }
                  placeholder={c.kind === 'assistant' ? t('chat.assistant') : t('chat.message')}
                  value={message}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (message.trim() || media.length) void send();
                    }
                  }}
                />
                <button
                  className="send-button"
                  aria-label={t('chat.send')}
                  disabled={sending || (!message.trim() && !media.length)}
                >
                  <Send size={19} />
                </button>
              </form>
              <small className="composer-hint">
                {w.session.offline
                  ? 'Offline · draft saved. Reconnect to send.'
                  : c.kind === 'assistant'
                    ? 'AI assists documentation and retrieval. Review the sources.'
                    : 'A message is not an event report. Create and confirm an event when needed.'}
              </small>
            </div>
          </div>
        )}
      </section>
      {newChat && (
        <Modal title="New direct conversation" onClose={() => setNewChat(false)}>
          <div className="padded">
            {w.state.staff
              .filter(
                (p) =>
                  p.id !== w.person.id &&
                  p.assignments.some(
                    (a) =>
                      a.wardId === w.session.wardId &&
                      !['management', 'administrator'].includes(a.role),
                  ) &&
                  p.active,
              )
              .map((p) => (
                <button
                  key={p.id}
                  className="staff-picker"
                  onClick={() =>
                    void w.run(async () => {
                      const cid = await w.api.direct(w.session, p.id);
                      setNewChat(false);
                      onSelect(cid);
                    })
                  }
                >
                  <Avatar person={p} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {roleName(
                        p.assignments.find((a) => a.wardId === w.session.wardId)?.role || '',
                      )}
                    </small>
                  </span>
                  <Plus size={18} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {correction && (
        <Modal title="Correct message" onClose={() => setCorrection(undefined)}>
          <div className="padded">
            <p className="muted">The original message and all corrections are retained.</p>
            <label>
              Corrected text
              <textarea
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                rows={4}
              />
            </label>
            <button
              className="button primary"
              onClick={() =>
                void w
                  .run(
                    () => w.api.editMessage(w.session, correction.id, correctionText),
                    'Correction saved.',
                  )
                  .then((ok) => {
                    if (ok) setCorrection(undefined);
                  })
              }
            >
              Save correction
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

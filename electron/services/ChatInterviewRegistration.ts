import type { Meeting } from '../db/DatabaseManager';
import type { InterviewWorkspaceState } from './InterviewWorkspaceStateManager';

export interface ChatInterviewDependencies {
  getMeeting(id: string): Meeting | null;
  saveMeeting(meeting: Meeting, startTime: number, duration: number): void;
  saveWorkspace(state: InterviewWorkspaceState): InterviewWorkspaceState;
  updateAutoTitle(id: string, title: string): boolean;
  generateTitle(context: string): Promise<string>;
  notify(): void;
}

function cleanTitle(value: string): string {
  return value.replace(/^(?:title|interview title)\s*:\s*/i, '')
    .replace(/[\n\r]+/g, ' ').replace(/["*_`#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Register prep chat once, before starting any network request. */
export function registerChatInterview(state: InterviewWorkspaceState, deps: ChatInterviewDependencies) {
  if (state.meetingId) return { state, meeting: deps.getMeeting(state.meetingId) };
  const firstMessage = state.messages.find(message => message.role === 'user' && message.content.trim());
  if (!firstMessage || state.status !== 'draft') return { state, meeting: null };

  const id = `chat-${state.id}`;
  const existing = deps.getMeeting(id);
  const meeting: Meeting = existing || {
    id, title: cleanTitle(firstMessage.content) || 'Interview preparation',
    titleSource: 'auto', source: 'chat', date: new Date(firstMessage.createdAt).toISOString(),
    duration: '0:00', summary: '', transcript: [], usage: [], isProcessed: true,
  };
  if (!existing) deps.saveMeeting(meeting, firstMessage.createdAt, 0);
  const saved = deps.saveWorkspace({ ...state, meetingId: id });
  deps.notify();

  if (!existing) {
    // Title generation never delays the chat response or makes saving depend on API access.
    void Promise.resolve().then(() => deps.generateTitle(firstMessage.content))
      .then(raw => {
        const title = cleanTitle(raw);
        if (title && deps.updateAutoTitle(id, title)) deps.notify();
      }).catch(error => console.warn('[ChatInterviewRegistration] Keeping fallback title:', error?.message));
  }
  return { state: saved, meeting };
}

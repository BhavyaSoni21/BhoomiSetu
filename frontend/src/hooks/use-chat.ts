import { useState, useCallback } from 'react';
import apiService from '../services/apiService';
import { useTranslation } from '../context/LanguageContext';
import { enqueue } from '../offline/queue';
import { useNetworkStore } from '../offline/network';
import {
  UnderstandRequestIn,
  UnderstandRequestOut,
  ApplicationDraftIn,
  ApplicationDraftOut,
  RoutingDecisionIn,
  RoutingDecisionOut,
  ApplicationCreate,
  CaseOut,
} from '../types/aiFlow';

export type ChatStep =
  | 'parcel_select'
  | 'describe'
  | 'understanding'
  | 'followup'
  | 'application'
  | 'routing'
  | 'success'
  | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  type: 'text' | 'understanding' | 'questions' | 'draft' | 'routing' | 'error';
}

interface UseChatReturn {
  step: ChatStep;
  messages: ChatMessage[];
  understanding: UnderstandRequestOut | null;
  draft: ApplicationDraftOut | null;
  routing: RoutingDecisionOut | null;
  caseResult: CaseOut | null;
  editedDraft: string;
  isLoading: boolean;
  error: string | null;
  startChat: (parcelId: string) => void;
  sendMessage: (text: string) => Promise<void>;
  submitOwnRequest: (text: string) => Promise<void>;
  requestDraft: () => Promise<void>;
  setEditedDraft: (value: string) => void;
  confirmAndCreate: () => Promise<void>;
  createCase: () => Promise<void>;
  reset: () => void;
  goBack: () => void;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Spec §: AI features need the server; offline they degrade gracefully instead
// of surfacing a generic "try again". Case submission still queues (below) —
// only the AI reasoning steps are hard-blocked when unreachable.
const AI_OFFLINE_MSG = 'AI assistance needs an internet connection. Reconnect and try again — your progress is kept.';

const CHAT_STEPS: ChatStep[] = [
  'parcel_select',
  'describe',
  'understanding',
  'followup',
  'application',
  'routing',
  'success',
];

export function useChat(): UseChatReturn {
  const { t, currentLang } = useTranslation();
  const [step, setStep] = useState<ChatStep>('parcel_select');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [understanding, setUnderstanding] = useState<UnderstandRequestOut | null>(null);
  const [draft, setDraft] = useState<ApplicationDraftOut | null>(null);
  const [routing, setRouting] = useState<RoutingDecisionOut | null>(null);
  const [caseResult, setCaseResult] = useState<CaseOut | null>(null);
  const [editedDraft, setEditedDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Array<Record<string, unknown>>>([]);
  const [parcelId, setParcelId] = useState<string>('');
  // ponytail: hard cap on follow-up rounds so a flaky model can't loop forever
  // re-asking; after this many rounds we accept the understanding as-is.
  const [followupRounds, setFollowupRounds] = useState(0);
  const MAX_FOLLOWUP_ROUNDS = 2;

  const addMessage = useCallback((msg: Partial<ChatMessage>) => {
    setMessages((prev) => [...prev, { id: newId(), role: 'assistant', ...msg } as ChatMessage]);
  }, []);

  const addAssistantMessage = useCallback((text: string) => {
    addMessage({ role: 'assistant', text, type: 'text' });
  }, [addMessage]);

  const reset = useCallback(() => {
    setStep('parcel_select');
    setMessages([]);
    setUnderstanding(null);
    setDraft(null);
    setRouting(null);
    setCaseResult(null);
    setEditedDraft('');
    setIsLoading(false);
    setError(null);
    setConversation([]);
    setParcelId('');
    setFollowupRounds(0);
  }, []);

  const goBack = useCallback(() => {
    setStep((current) => {
      const idx = CHAT_STEPS.indexOf(current);
      if (idx <= 1) return current;
      return CHAT_STEPS[idx - 1];
    });
  }, []);

  const startChat = useCallback((id: string) => {
    setParcelId(id);
    setStep('describe');
    setMessages([]);
    addAssistantMessage(t('aiChat.describePrompt', 'I can help you describe your issue. Please explain the problem with your land parcel.'));
  }, [addAssistantMessage, t]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      setError(null);
      if (!useNetworkStore.getState().reachable) {
        const offlineMsg = t('aiChat.offline', AI_OFFLINE_MSG);
        setError(offlineMsg);
        addAssistantMessage(offlineMsg);
        return;
      }

      const userConvTurn: Record<string, unknown> = {
        role: conversation.length === 0 ? 'citizen' : 'user',
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };
      const updatedConv = [...conversation, userConvTurn];

      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'user', text: text.trim(), type: 'text' },
      ]);
      setIsLoading(true);

      try {
        const dto: UnderstandRequestIn = {
          parcel_id: parcelId,
          description: text.trim(),
          conversation: updatedConv,
          language: currentLang,
        };
        const resp = await apiService.post<UnderstandRequestOut>('/ai/understand', dto);
        const data = resp.data;
        setUnderstanding(data);
        setConversation(updatedConv);

        if (data.follow_up_questions && data.follow_up_questions.length > 0 && followupRounds < MAX_FOLLOWUP_ROUNDS) {
          setFollowupRounds((n) => n + 1);
          setStep('followup');
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: 'assistant',
              text: data.follow_up_questions.join('\n\n'),
              type: 'questions',
            },
          ]);
          addAssistantMessage(t('aiChat.answerQuestions', 'Please answer the questions above so I can build a complete understanding.'));
        } else {
          setStep('understanding');
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: 'assistant',
              text: t('aiChat.completeUnderstanding', 'I now have a complete understanding of your issue.'),
              type: 'understanding',
            },
          ]);
        }
      } catch (err: unknown) {
        setError(t('aiChat.understandError', 'Failed to understand your request. Please try again.'));
        setStep('error');
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            text: t('aiChat.processError', 'I could not process your request. Please try again.'),
            type: 'error',
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, conversation, parcelId, understanding, followupRounds, addAssistantMessage, t, currentLang],
  );

  // Bypass the AI Q&A: the citizen types their full request in their own
  // words and it becomes the application draft verbatim. We still run one
  // silent /understand call to pull intent/departments/facts from the parcel
  // record (needed for routing + case creation), but never interrogate them.
  const submitOwnRequest = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !parcelId) return;
      setError(null);
      if (!useNetworkStore.getState().reachable) {
        const offlineMsg = t('aiChat.offline', AI_OFFLINE_MSG);
        setError(offlineMsg);
        addMessage({ type: 'error', role: 'assistant', text: offlineMsg });
        return;
      }
      const conv: Array<Record<string, unknown>> = [
        { role: 'citizen', text: text.trim(), timestamp: new Date().toISOString() },
      ];
      setMessages([{ id: newId(), role: 'user', text: text.trim(), type: 'text' }]);
      setIsLoading(true);
      try {
        const resp = await apiService.post<UnderstandRequestOut>('/ai/understand', {
          parcel_id: parcelId,
          description: text.trim(),
          conversation: conv,
          language: currentLang,
        } as UnderstandRequestIn);
        const u = resp.data;
        setUnderstanding(u);
        setConversation(conv);
        // The citizen's own words ARE the application — skip AI drafting.
        setDraft({
          application_draft: text.trim(),
          facts_database: u.facts_database,
          citizen_statements: u.facts_stated_by_citizen,
        });
        setEditedDraft(text.trim());
        setStep('application');
        addMessage({
          type: 'draft',
          role: 'assistant',
          text: t('aiChat.usingYourRequest', 'Using your request as the application. Review and submit below.'),
        });
      } catch (err: unknown) {
        setError(t('aiChat.submitError', 'Failed to submit your request. Please try again.'));
        setStep('error');
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, parcelId, addMessage, t, currentLang],
  );

  const requestDraft = useCallback(async () => {
    if (!understanding || isLoading) return;
    setError(null);
    if (!useNetworkStore.getState().reachable) {
      const offlineMsg = t('aiChat.offline', AI_OFFLINE_MSG);
      setError(offlineMsg);
      addMessage({ type: 'error', role: 'assistant', text: offlineMsg });
      return;
    }
    setIsLoading(true);

    try {
      const dto: ApplicationDraftIn = {
        parcel_id: understanding.parcel_id,
        intent: understanding.intent,
        issues: understanding.issues,
        facts_stated_by_citizen: understanding.facts_stated_by_citizen,
        facts_database: understanding.facts_database,
        departments: understanding.departments,
        conversation,
        language: currentLang,
      };
      const resp = await apiService.post<ApplicationDraftOut>('/ai/application-draft', dto);
      const data = resp.data;
      setDraft(data);
      setEditedDraft(data.application_draft);
      setStep('application');
      addMessage({
        type: 'draft',
        role: 'assistant',
        text: t('aiChat.draftReady', 'Here is the formal application draft based on your confirmed understanding:'),
      });
    } catch (err: unknown) {
      setError(t('aiChat.draftError', 'Failed to generate the application draft. Please try again.'));
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  }, [understanding, isLoading, conversation, addMessage, t, currentLang]);

  const confirmAndCreate = useCallback(async () => {
    if (!understanding || !draft || isLoading) return;
    setError(null);
    if (!useNetworkStore.getState().reachable) {
      const offlineMsg = t('aiChat.offline', AI_OFFLINE_MSG);
      setError(offlineMsg);
      addMessage({ type: 'error', role: 'assistant', text: offlineMsg });
      return;
    }
    setIsLoading(true);

    try {
      const routingDto: RoutingDecisionIn = {
        parcel_id: understanding.parcel_id,
        intent: understanding.intent,
        issues: understanding.issues,
        departments: understanding.departments,
        language: currentLang,
      };
      const routingResp = await apiService.post<RoutingDecisionOut>('/ai/route', routingDto);
      const routingData = routingResp.data;
      setRouting(routingData);
      setStep('routing');
      addMessage({
        type: 'routing',
        role: 'assistant',
        text: t('aiChat.routedTo', {
          departments: routingData.departments.map((d) => d.department).join(', '),
        }),
      });
    } catch (err: unknown) {
      setError(t('aiChat.routingError', 'Failed to determine routing. Please try again.'));
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  }, [understanding, draft, isLoading, conversation, addMessage, t, currentLang]);

  const createCase = useCallback(async () => {
    if (!understanding || !draft || !routing || isLoading) return;
    setError(null);
    setIsLoading(true);

    try {
      const createDto: ApplicationCreate = {
        parcel_id: understanding.parcel_id,
        intent: understanding.intent,
        priority: routing.priority ?? undefined,
        application_draft: draft.application_draft,
        citizen_edited_version: editedDraft,
        ai_structured_understanding: understanding as unknown as Record<string, unknown>,
        facts_database: draft.facts_database,
        citizen_statements: draft.citizen_statements,
        conversation,
        routing_result: routing as unknown as Record<string, unknown>,
      };

      // Offline (or API unreachable): stage the submission in the queue instead
      // of failing (spec §7). The AI steps above already ran while online; the
      // server re-validates Invariant-1 on sync, so no duplicate is created.
      if (!useNetworkStore.getState().reachable) {
        await enqueue({ entityType: 'case', action: 'CREATE', payload: createDto, parcelId: understanding.parcel_id });
        setStep('success');
        addMessage({
          type: 'text',
          role: 'assistant',
          text: t('aiChat.savedOffline', 'Saved offline. Your case will be submitted automatically when you are back online.'),
        });
        return;
      }

      const caseResp = await apiService.post<CaseOut>('/cases/from-application', createDto);
      setCaseResult(caseResp.data);
      setStep('success');
      addMessage({
        type: 'text',
        role: 'assistant',
        text: t('aiChat.caseCreated', { caseNo: caseResp.data.case_no }),
      });
    } catch (err: unknown) {
      setError(t('aiChat.createError', 'Failed to create your case. Please try again.'));
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  }, [understanding, draft, routing, isLoading, editedDraft, conversation, addMessage, t]);

  return {
    step,
    messages,
    understanding,
    draft,
    routing,
    caseResult,
    editedDraft,
    isLoading,
    error,
    startChat,
    sendMessage,
    submitOwnRequest,
    requestDraft,
    setEditedDraft,
    confirmAndCreate,
    createCase,
    reset,
    goBack,
  };
}

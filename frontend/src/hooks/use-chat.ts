import { useState, useCallback } from 'react';
import apiService from '../services/apiService';
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
    addAssistantMessage('I can help you describe your issue. Please explain the problem with your land parcel.');
  }, [addAssistantMessage]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      setError(null);

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
        };
        const resp = await apiService.post<UnderstandRequestOut>('/ai/understand', dto);
        const data = resp.data;
        setUnderstanding(data);
        setConversation(updatedConv);

        if (data.follow_up_questions && data.follow_up_questions.length > 0) {
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
          addAssistantMessage('Please answer the questions above so I can build a complete understanding.');
        } else {
          setStep('understanding');
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: 'assistant',
              text: 'I now have a complete understanding of your issue.',
              type: 'understanding',
            },
          ]);
        }
      } catch (err: unknown) {
        setError('Failed to understand your request. Please try again.');
        setStep('error');
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            text: 'I could not process your request. Please try again.',
            type: 'error',
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, conversation, parcelId, understanding, addAssistantMessage],
  );

  const requestDraft = useCallback(async () => {
    if (!understanding || isLoading) return;
    setError(null);
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
      };
      const resp = await apiService.post<ApplicationDraftOut>('/ai/application-draft', dto);
      const data = resp.data;
      setDraft(data);
      setEditedDraft(data.application_draft);
      setStep('application');
      addMessage({
        type: 'draft',
        role: 'assistant',
        text: 'Here is the formal application draft based on your confirmed understanding:',
      });
    } catch (err: unknown) {
      setError('Failed to generate the application draft. Please try again.');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  }, [understanding, isLoading, conversation, addMessage]);

  const confirmAndCreate = useCallback(async () => {
    if (!understanding || !draft || isLoading) return;
    setError(null);
    setIsLoading(true);

    try {
      const routingDto: RoutingDecisionIn = {
        parcel_id: understanding.parcel_id,
        intent: understanding.intent,
        issues: understanding.issues,
        departments: understanding.departments,
      };
      const routingResp = await apiService.post<RoutingDecisionOut>('/ai/route', routingDto);
      const routingData = routingResp.data;
      setRouting(routingData);
      setStep('routing');
      addMessage({
        type: 'routing',
        role: 'assistant',
        text: `Your issue will be routed to: ${routingData.departments.map((d) => d.department).join(', ')}`,
      });
    } catch (err: unknown) {
      setError('Failed to determine routing. Please try again.');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  }, [understanding, draft, isLoading, conversation, addMessage]);

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
      const caseResp = await apiService.post<CaseOut>('/cases/from-application', createDto);
      setCaseResult(caseResp.data);
      setStep('success');
      addMessage({
        type: 'text',
        role: 'assistant',
        text: `Your case has been created: ${caseResp.data.case_no}`,
      });
    } catch (err: unknown) {
      setError('Failed to create your case. Please try again.');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  }, [understanding, draft, routing, isLoading, editedDraft, conversation, addMessage]);

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
    requestDraft,
    setEditedDraft,
    confirmAndCreate,
    createCase,
    reset,
    goBack,
  };
}

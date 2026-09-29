import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../../hooks/use-chat';
import ChatMessageComp from './chat-message';
import ChatInputBar from './chat-input-bar';
import RoutingDisplay from './routing-display';
import { ApplicationDraftEditor, ApplicationDraftFacts } from './application-draft';
import UnderstandingDisplay from './understanding-display';
import { useTranslation } from '../../context/LanguageContext';
import {
  MessageSquare,
  Check,
  RotateCw,
  X,
  FileText,
  PenLine,
} from 'lucide-react';

interface AiChatProps {
  parcelId?: string;
  onClose?: () => void;
}

const AiChat: React.FC<AiChatProps> = ({ parcelId, onClose }) => {
  const { t } = useTranslation();
  const chat = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Bypass mode: the citizen writes the full request in their own words and
  // the input goes straight to submitOwnRequest instead of the guided Q&A.
  const [ownMode, setOwnMode] = useState(false);

  useEffect(() => {
    if (scrollRef.current && typeof scrollRef.current.scrollTo === 'function') {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chat.messages, chat.isLoading]);

  useEffect(() => {
    if (parcelId && chat.step === 'parcel_select') {
      chat.startChat(parcelId);
    }
  }, [parcelId, chat.step, chat.startChat]);

  const handleStart = () => {
    if (parcelId && chat.step === 'parcel_select') {
      chat.startChat(parcelId);
    }
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    if (ownMode) {
      void chat.submitOwnRequest(text);
      return;
    }
    if (chat.step === 'describe' || chat.step === 'followup') {
      void chat.sendMessage(text);
    }
  };

  const isInputActive = chat.step === 'describe' || chat.step === 'followup';

  const stepLabel = {
    parcel_select: t('aiChat.stepSelectParcel', 'Select a Parcel'),
    describe: t('aiChat.stepDescribe', 'Describe Your Issue'),
    understanding: t('aiChat.stepUnderstanding', 'Review Understanding'),
    followup: t('aiChat.stepFollowup', 'Answer Follow-ups'),
    application: t('aiChat.stepApplication', 'Review Application'),
    routing: t('aiChat.stepRouting', 'Routing & Submitting'),
    success: t('aiChat.stepSuccess', 'Case Created'),
    error: t('aiChat.stepError', 'Error'),
  }[chat.step];

  const suggestions = [
    t('aiChat.suggestionBoundary', 'Boundary shown on map is wrong'),
    t('aiChat.suggestionEncroachment', 'Neighbor has entered my land'),
    t('aiChat.suggestionCorrection', 'Need to correct my ownership record'),
    t('aiChat.suggestionTax', 'Dispute my tax assessment'),
  ];

  const renderCenter = () => {
    switch (chat.step) {
      case 'parcel_select':
        return (
          <div className="text-center space-y-4">
            <p className="text-sm text-text-secondary">
              {t('aiChat.parcelSelectPrompt', 'Select a parcel to begin the Get Assistance flow.')}
            </p>
            {!parcelId && (
              <p className="text-xs text-text-secondary">
                {t('aiChat.parcelSelectHint', 'Pass a parcelId when embedding this component to start immediately.')}
              </p>
            )}
            {parcelId && (
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-900 text-white text-sm font-semibold hover:bg-brand-800 transition"
              >
                <MessageSquare className="w-4 h-4" />
                {t('aiChat.startChatButton', 'Start Get Assistance')}
              </button>
            )}
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Check className="w-12 h-12 text-emerald-600" />
            </div>
            <h3 className="font-heading font-bold text-lg text-text-heading">
              {t('aiChat.successHeading', 'Case Created Successfully')}
            </h3>
            {chat.caseResult && (
              <p className="text-sm text-text-secondary">
                {t('aiChat.caseNumber', 'Case Number')}:{' '}
                <span className="font-mono font-semibold text-text-heading">{chat.caseResult.caseNo}</span>
              </p>
            )}
            <p className="text-xs text-text-secondary">
              {t('aiChat.successDesc', 'Your case has been routed to the relevant departments. You can track it from your dashboard.')}
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-4">
            <p className="text-sm text-red-600">{chat.error ?? t('aiChat.genericError', 'Something went wrong.')}</p>
            <button
              type="button"
              onClick={() => {
                chat.reset();
                handleStart();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-900 text-white text-sm font-semibold hover:bg-brand-800 transition"
            >
              <RotateCw className="w-4 h-4" />
              {t('aiChat.retryButton', 'Try Again')}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // The step's output splits into two regions (see return): the "information"
  // panel sits to the *right* of the chat on desktop, and the editable
  // application draft sits full-width *under* the chat. Facts render right,
  // draft renders under - matching the requested layout.
  const draftHasFacts =
    !!chat.draft &&
    ((chat.draft.facts_database?.length ?? 0) + (chat.draft.citizen_statements?.length ?? 0)) > 0;

  const infoNode =
    chat.step === 'understanding' && chat.understanding ? (
      <UnderstandingDisplay understanding={chat.understanding} />
    ) : chat.step === 'application' && chat.draft && draftHasFacts ? (
      <ApplicationDraftFacts draft={chat.draft} />
    ) : chat.step === 'routing' && chat.routing ? (
      <RoutingDisplay routing={chat.routing} />
    ) : null;

  const underNode =
    chat.step === 'application' && chat.draft ? (
      <ApplicationDraftEditor editedDraft={chat.editedDraft} onEditDraft={chat.setEditedDraft} />
    ) : null;

  const renderActions = () => {
    switch (chat.step) {
      case 'understanding':
        return (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => chat.goBack()}
              className="px-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-text-heading text-sm font-semibold hover:bg-surface-2 transition"
            >
              {t('aiChat.goBackButton', 'Back')}
            </button>
            <button
              type="button"
              onClick={() => chat.requestDraft()}
              disabled={chat.isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-900 text-white text-sm font-semibold hover:bg-brand-800 disabled:opacity-50 transition"
            >
              <FileText className="w-4 h-4" />
              {t('aiChat.generateDraftButton', 'Generate Application')}
            </button>
          </div>
        );

      case 'followup':
        return null;

      case 'application':
        return (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => chat.goBack()}
              className="px-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-text-heading text-sm font-semibold hover:bg-surface-2 transition"
            >
              {t('aiChat.goBackButton', 'Back')}
            </button>
            <button
              type="button"
              onClick={() => chat.confirmAndCreate()}
              disabled={chat.isLoading || !chat.editedDraft.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-900 text-white text-sm font-semibold hover:bg-brand-800 disabled:opacity-50 transition"
            >
              <Check className="w-4 h-4" />
              {t('aiChat.confirmAndSubmitButton', 'Confirm & Submit')}
            </button>
          </div>
        );

      case 'routing':
        return (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => chat.goBack()}
              className="px-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-text-heading text-sm font-semibold hover:bg-surface-2 transition"
            >
              {t('aiChat.goBackButton', 'Back')}
            </button>
            <button
              type="button"
              onClick={() => chat.createCase()}
              disabled={chat.isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-900 text-white text-sm font-semibold hover:bg-brand-800 disabled:opacity-50 transition"
            >
              <Check className="w-4 h-4" />
              {t('aiChat.createCaseButton', 'Create Case')}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    // Height grows with content (card + page scroll) instead of a hardcoded
    // viewport cap that made the flex-1 chat collapse once the tall draft/info
    // panel rendered below it. The chat keeps its own stable scroll region.
    <div className="flex flex-col">
      <div className="border-b border-gov-border px-4 py-3 flex items-center justify-between bg-surface-1 rounded-t-xl">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand-900" />
          <h2 className="font-heading font-bold text-text-heading">{t('aiChat.heading', 'Get Assistance')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-secondary bg-surface-2 px-2 py-0.5 rounded border border-gov-border">
            {stepLabel}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-text-secondary hover:text-text-heading hover:bg-surface-2 transition"
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat stays put on the left; the "information" panel sits to its right
          on desktop (stacks under on mobile) and the editable application draft
          spans full-width underneath. Single column until a panel exists. */}
      <div
        className={`grid gap-4 p-4 ${
          infoNode ? 'lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]' : 'grid-cols-1'
        }`}
      >
        {/* CHAT COLUMN */}
        <div className="min-w-0 flex flex-col gap-3">
          <div ref={scrollRef} className="overflow-y-auto max-h-[45vh] min-h-[240px] space-y-4">
            {chat.step === 'parcel_select' || chat.step === 'success' || chat.step === 'error' ? (
              <div className="flex justify-center items-center h-full pt-8">
                <div className="max-w-md text-center">{renderCenter()}</div>
              </div>
            ) : (
              <div className="space-y-4">
                {chat.messages.map((msg) => (
                  <ChatMessageComp key={msg.id} message={msg} />
                ))}
                {chat.isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-surface-1 border border-gov-border text-text-secondary text-sm rounded-xl px-4 py-3">
                      {t('aiChat.thinking', 'Thinking...')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {chat.error && chat.step !== 'error' && (
            <div className="px-3 py-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              {chat.error}
            </div>
          )}

          {isInputActive && (
            <>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setOwnMode((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-900 hover:text-brand-800 transition"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  {ownMode
                    ? t('aiChat.useGuidedButton', 'Use guided assistant')
                    : t('aiChat.bypassButton', 'Skip AI - write my own request')}
                </button>
              </div>
              <ChatInputBar
                onSend={handleSend}
                isLoading={chat.isLoading}
                placeholder={ownMode ? t('aiChat.ownRequestPlaceholder', 'Write your full request in your own words...') : undefined}
                suggestions={!ownMode && chat.step === 'describe' ? suggestions : undefined}
              />
            </>
          )}
        </div>

        {/* INFORMATION PANEL - right of chat on desktop, under it on mobile */}
        {infoNode && (
          <aside className="min-w-0 flex flex-col gap-3 lg:max-h-[70vh] lg:overflow-y-auto">
            {infoNode}
            {(chat.step === 'understanding' || chat.step === 'routing') && renderActions()}
          </aside>
        )}

        {/* APPLICATION DRAFT - full width, under the chat */}
        {underNode && (
          <div className="lg:col-span-2 space-y-3">
            {underNode}
            {renderActions()}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiChat;

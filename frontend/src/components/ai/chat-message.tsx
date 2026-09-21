import React from 'react';
import { ChatMessage } from '../../hooks/use-chat';
import SpeakerButton from '../SpeakerButton';
import { User, Bot } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessage;
}

const ChatMessageComp: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const Icon = isUser ? User : Bot;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-900 text-white flex items-center justify-center">
          <Icon className="w-4 h-4" aria-hidden={true} />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-brand-900 text-white rounded-br-md'
            : message.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              : 'bg-surface-1 text-text-heading border border-gov-border'
        }`}
      >
        {message.text && <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>}
        {!isUser && message.type === 'questions' && message.text && (
          <ul className="mt-2 space-y-1 list-disc list-inside pl-2 marker:text-brand-900">
            {message.text
              .split('\n\n')
              .filter(Boolean)
              .map((q: string, i: number) => (
                <li key={i} className="text-text-secondary">
                  {q.replace(/^\n+/, '')}
                </li>
              ))}
          </ul>
        )}
        {!isUser && message.type !== 'error' && message.type !== 'questions' && (
          <div className="mt-2 flex justify-end">
            <SpeakerButton text={message.text ?? ''} className="scale-75" />
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-brand-900 flex items-center justify-center">
          <Icon className="w-4 h-4" aria-hidden={true} />
        </div>
      )}
    </div>
  );
};

export default ChatMessageComp;

import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';

interface ChatInputBarProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  suggestions?: string[];
}

const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSend,
  isLoading = false,
  placeholder,
  suggestions,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="space-y-2">
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (!isLoading) onSend(s);
              }}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-full border border-gov-border bg-surface-2 text-text-secondary hover:bg-brand-900/5 hover:text-brand-900 disabled:opacity-50 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder ?? t('aiChat.inputPlaceholder', 'Describe your issue...')}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gov-border bg-surface-1 text-text-heading placeholder:text-text-muted focus:outline-none focus:border-brand-700 text-sm"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-900 text-white hover:bg-brand-800 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bhashini-accent)]"
          aria-label={t('aiChat.send', 'Send')}
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
};

export default ChatInputBar;

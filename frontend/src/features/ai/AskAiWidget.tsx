import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import apiService from '../../services/apiService';
import { AiQueryResponse } from '../../types/aiQuery';
import { ParcelSummary } from '../../types/parcel';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  results?: ParcelSummary[];
  isError?: boolean;
}

interface Position {
  x: number;
  y: number;
}

const SUGGESTIONS = ['How do I search for a parcel?', 'Parcels with overdue tax'];

// Matches the button's h-14/w-14 and the panel's w-96/h-[32rem] Tailwind
// classes - kept as plain numbers here since dragging needs to clamp
// positions in JS, not just describe them in CSS.
const BUTTON_SIZE = 56;
const PANEL_WIDTH = 384;
const PANEL_HEIGHT = 512;
const SCREEN_MARGIN = 16;
const DRAG_THRESHOLD_PX = 4;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function clampButtonPos(pos: Position): Position {
  return {
    x: clamp(pos.x, SCREEN_MARGIN, window.innerWidth - BUTTON_SIZE - SCREEN_MARGIN),
    y: clamp(pos.y, SCREEN_MARGIN, window.innerHeight - BUTTON_SIZE - SCREEN_MARGIN),
  };
}

function clampPanelPos(pos: Position): Position {
  const width = Math.min(PANEL_WIDTH, window.innerWidth - 2 * SCREEN_MARGIN);
  const height = Math.min(PANEL_HEIGHT, window.innerHeight - 2 * SCREEN_MARGIN);
  return {
    x: clamp(pos.x, SCREEN_MARGIN, window.innerWidth - width - SCREEN_MARGIN),
    y: clamp(pos.y, SCREEN_MARGIN, window.innerHeight - height - SCREEN_MARGIN),
  };
}

// Opens right above the button by default (matching where the old fixed
// bottom-right panel used to sit relative to the fixed bottom-right button),
// flipping below the button if there isn't room above.
function defaultPanelPos(buttonPos: Position): Position {
  const x = buttonPos.x + BUTTON_SIZE - PANEL_WIDTH;
  const spaceAbove = buttonPos.y - SCREEN_MARGIN;
  const y = spaceAbove >= PANEL_HEIGHT ? buttonPos.y - PANEL_HEIGHT - 12 : buttonPos.y + BUTTON_SIZE + 12;
  return clampPanelPos({ x, y });
}

// The floating "Ask AI" widget (replacing the inline Ask AI bar that used to
// sit at the top of the Citizen Portal) - mounted once at the AppShell level
// (see App.tsx) so it stays available, and keeps its conversation, while
// navigating between citizen-facing pages, not just on the portal home page.
// A single request per question (AiService.askAssistant answers both a data
// question and a "how do I..." navigation question in one Groq call) keeps
// it feeling responsive - the user message renders immediately, before the
// network round trip even starts.
//
// Both the toggle button and the open panel (via its header) are freely
// draggable anywhere on screen, via the Pointer Events API - one set of
// handlers unifies mouse/touch/pen, and setPointerCapture keeps delivering
// move/up events to the dragged element even once the cursor leaves its
// bounds, with no window-level listener bookkeeping needed.
const AskAiWidget: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const [buttonPos, setButtonPos] = useState<Position>(() =>
    clampButtonPos({ x: window.innerWidth - BUTTON_SIZE - 24, y: window.innerHeight - BUTTON_SIZE - 24 }),
  );
  const [panelPos, setPanelPos] = useState<Position | null>(null);
  const [isDraggingButton, setIsDraggingButton] = useState(false);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);

  // A drag in progress (not React state - read synchronously inside the
  // same pointermove/up handlers that fire it, no re-render needed until
  // the position itself changes) plus whether it ever crossed the
  // move threshold, so the button's onClick can tell a real click from the
  // pointerup that ends a drag and skip toggling open/closed for the latter.
  const dragRef = useRef<{ target: 'button' | 'panel'; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const draggedRef = useRef(false);

  const mutation = useMutation<AiQueryResponse, Error, string>(async (q) => {
    const response = await apiService.post('/ai/query', { query: q });
    return response.data;
  });

  useEffect(() => {
    const el = scrollRef.current;
    // Guard rather than assume scrollTo exists - not every environment
    // implements it (notably jsdom in tests), and this is a nice-to-have
    // scroll convenience, not something worth a hard crash over.
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, mutation.isLoading]);

  // Keep both elements fully on screen if the window is resized/rotated.
  useEffect(() => {
    const handleResize = () => {
      setButtonPos((pos) => clampButtonPos(pos));
      setPanelPos((pos) => (pos ? clampPanelPos(pos) : pos));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startDrag = (target: 'button' | 'panel') => (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return; // left mouse button (or touch/pen) only
    const origin = target === 'button' ? buttonPos : (panelPos ?? defaultPanelPos(buttonPos));
    dragRef.current = { target, startX: e.clientX, startY: e.clientY, originX: origin.x, originY: origin.y };
    draggedRef.current = false;
    // Guard rather than assume setPointerCapture exists - not every
    // environment implements it (notably jsdom in tests); dragging still
    // works without it, just without the "keep tracking past the element's
    // bounds" guarantee.
    const target_ = e.currentTarget as Element;
    if (typeof target_.setPointerCapture === 'function') target_.setPointerCapture(e.pointerId);
    if (target === 'button') setIsDraggingButton(true);
    else setIsDraggingPanel(true);
  };

  const onDragMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!draggedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) draggedRef.current = true;
    if (!draggedRef.current) return;

    const next = { x: drag.originX + dx, y: drag.originY + dy };
    if (drag.target === 'button') setButtonPos(clampButtonPos(next));
    else setPanelPos(clampPanelPos(next));
  };

  const endDrag = () => {
    dragRef.current = null;
    setIsDraggingButton(false);
    setIsDraggingPanel(false);
  };

  const handleButtonClick = () => {
    // A drag that actually moved the button shouldn't also toggle the
    // panel open/closed - only a "real" click (press+release with no
    // meaningful movement in between) does.
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    setIsOpen((open) => {
      const next = !open;
      if (next) setPanelPos((pos) => pos ?? defaultPanelPos(buttonPos));
      return next;
    });
  };

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isLoading) return;

    // The user's own message appears the instant they submit - it never
    // waits on the network round trip.
    setMessages((prev) => [...prev, { id: newId(), role: 'user', text: trimmed }]);
    setInput('');

    mutation.mutate(trimmed, {
      onSuccess: (data) => {
        setMessages((prev) => [...prev, { id: newId(), role: 'assistant', text: data.reply, results: data.results }]);
      },
      onError: (error) => {
        const text =
          axios.isAxiosError(error) && error.response?.status === 503
            ? 'AI is not configured on this server.'
            : "Sorry, I couldn't process that. Try rephrasing your question.";
        setMessages((prev) => [...prev, { id: newId(), role: 'assistant', text, isError: true }]);
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const resolvedPanelPos = panelPos ?? defaultPanelPos(buttonPos);

  return (
    <>
      {isOpen && (
        <div
          style={{ left: resolvedPanelPos.x, top: resolvedPanelPos.y }}
          className="fixed z-50 flex h-[32rem] max-h-[70vh] w-96 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/5"
        >
          <div
            onPointerDown={startDrag('panel')}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`flex touch-none items-center justify-between bg-indigo-600 px-4 py-3 ${isDraggingPanel ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            <h3 className="text-sm font-semibold text-white select-none">Ask AI</h3>
            <button
              onClick={() => setIsOpen(false)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Close Ask AI panel"
              className="text-indigo-100 hover:text-white text-xl leading-none"
            >
              &times;
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-gray-500 space-y-3">
                <p>
                  Ask about parcel data ("parcels with overdue tax in Pune") or how to use the site ("how do I file a
                  dispute").
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => ask(suggestion)}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : message.isError
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p>{message.text}</p>
                  {message.results && message.results.length > 0 && (
                    <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-2">
                      <p className="text-xs font-medium text-gray-500">{message.results.length} parcel(s) matched</p>
                      {message.results.slice(0, 5).map((parcel) => (
                        <div key={parcel.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-gray-600">
                            Parcel #{parcel.id.substring(0, 8)}... ({parcel.stateCode}-{parcel.districtCode})
                          </span>
                          <button
                            onClick={() => navigate(`/parcels/${parcel.id}`)}
                            className="shrink-0 rounded bg-green-500 px-2 py-0.5 text-white hover:bg-green-600"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {message.results && message.results.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">No matching parcels found.</p>
                  )}
                </div>
              </div>
            ))}

            {mutation.isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-400">Thinking...</div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-100 p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={mutation.isLoading || !input.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        style={{ left: buttonPos.x, top: buttonPos.y }}
        onClick={handleButtonClick}
        onPointerDown={startDrag('button')}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label={isOpen ? 'Close Ask AI' : 'Open Ask AI'}
        className={`fixed z-50 flex h-14 w-14 touch-none items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 ${
          isDraggingButton ? 'cursor-grabbing' : 'cursor-grab transition-transform hover:scale-105'
        }`}
      >
        {isOpen ? (
          <span className="text-2xl leading-none">&times;</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
            <path d="M12 2C6.48 2 2 6.03 2 11c0 2.42 1.06 4.62 2.81 6.24-.07.9-.34 2.34-1.13 3.65a.5.5 0 0 0 .58.73c1.87-.6 3.31-1.5 4.15-2.11A11.4 11.4 0 0 0 12 20c5.52 0 10-4.03 10-9s-4.48-9-10-9Z" />
          </svg>
        )}
      </button>
    </>
  );
};

export default AskAiWidget;

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles, Landmark } from 'lucide-react';
import { GovtScheme } from '../../types/scheme';
import SchemeCard from './SchemeCard';
import { useTranslation } from '../../context/LanguageContext';

interface SchemesMarqueeProps {
  schemes: GovtScheme[];
}

export const SchemesMarquee: React.FC<SchemesMarqueeProps> = ({ schemes }) => {
  const { t } = useTranslation();
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
      }
    };
  }, []);

  // Pause briefly when user manually navigates with arrow buttons
  const pauseTemporarily = useCallback((durationMs: number = 5000) => {
    setIsManualPaused(true);
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = setTimeout(() => {
      setIsManualPaused(false);
    }, durationMs);
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    pauseTemporarily(6000);
    if (scrollContainerRef.current) {
      const scrollAmount = 370; // card width (350px) + gap (20px)
      const delta = direction === 'left' ? -scrollAmount : scrollAmount;
      if (typeof scrollContainerRef.current.scrollBy === 'function') {
        scrollContainerRef.current.scrollBy({
          left: delta,
          behavior: 'smooth',
        });
      } else {
        scrollContainerRef.current.scrollLeft += delta;
      }
    }
  };

  const toggleUserPause = () => {
    setIsUserPaused((prev) => !prev);
  };

  const isPaused = isUserPaused || isManualPaused || isHovered || isFocused;

  // Duplicate schemes array once to create seamless infinite marquee loop
  const displaySchemes = [...schemes, ...schemes];

  return (
    <section
      aria-label={t('schemes.section.heading', 'Government Schemes Linked to Your Land')}
      className="relative w-full py-10 sm:py-14 bg-[var(--surface-2)]/50 dark:bg-[var(--surface-2)]/30 border-y border-[var(--border)] overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--action-500)]/15 border border-[var(--action-500)]/30 text-[var(--action-700)] dark:text-[var(--action-500)] text-xs font-bold tracking-wide uppercase">
              <Landmark className="w-3.5 h-3.5 text-[var(--action-700)] dark:text-[var(--action-500)]" />
              <span>{t('schemes.section.eyebrow', 'Direct Farmer Benefits & Entitlements')}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-heading)] tracking-tight">
              {t('schemes.section.heading', 'Government Schemes Linked to Your Land')}
            </h2>

            <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-normal leading-relaxed">
              {t(
                'schemes.section.subheading',
                'Explore direct cash subsidies, low-interest agricultural loans, crop damage insurance, and clean solar power incentives verified through your land parcel.'
              )}
            </p>
          </div>

          {/* Controls: Manual Scroll Arrows & Play/Pause */}
          <div className="flex items-center gap-2 self-start md:self-end shrink-0">
            <button
              type="button"
              onClick={toggleUserPause}
              aria-label={isUserPaused ? 'Resume auto-scrolling' : 'Pause auto-scrolling'}
              title={isUserPaused ? 'Resume auto-scrolling' : 'Pause auto-scrolling'}
              className="p-2 rounded-xl bg-[var(--surface-1)] hover:bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] shadow-xs transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              {isUserPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-[var(--bhashini-accent)] fill-[var(--bhashini-accent)]" />
                  <span className="hidden sm:inline text-[11px]">{t('schemes.controls.play', 'Play')}</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-[var(--action-700)]" />
                  <span className="hidden sm:inline text-[11px]">{t('schemes.controls.pause', 'Pause')}</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1 bg-[var(--surface-1)] p-0.5 rounded-xl border border-[var(--border)] shadow-xs">
              <button
                type="button"
                onClick={() => handleScroll('left')}
                aria-label="Scroll schemes left"
                title="Scroll left"
                className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-primary)] hover:text-[var(--action-700)] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="w-px h-4 bg-[var(--border)]" />
              <button
                type="button"
                onClick={() => handleScroll('right')}
                aria-label="Scroll schemes right"
                title="Scroll right"
                className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-primary)] hover:text-[var(--action-700)] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Marquee Viewport with Left/Right Gradient Edge Masks */}
      <div
        className="relative w-full overflow-hidden group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        {/* Left gradient fade mask */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 z-10"
          style={{
            background: 'linear-gradient(to right, var(--page-bg), transparent)',
          }}
        />

        {/* Right gradient fade mask */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 z-10"
          style={{
            background: 'linear-gradient(to left, var(--page-bg), transparent)',
          }}
        />

        {/* Scrolling Track */}
        <div
          ref={scrollContainerRef}
          tabIndex={0}
          aria-label="Scrollable list of government schemes"
          className="flex w-full overflow-x-auto no-scrollbar scroll-smooth py-2 px-4 sm:px-6"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div
            className="flex gap-5 shrink-0 will-change-transform"
            style={{
              animation: 'schemes-marquee 55s linear infinite',
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
          >
            {displaySchemes.map((scheme, index) => (
              <SchemeCard
                key={`${scheme.id}-${index}`}
                scheme={scheme}
                isDuplicate={index >= schemes.length}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Embedded CSS for keyframes marquee */}
      <style>{`
        @keyframes schemes-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-50% - 10px));
          }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
};

export default SchemesMarquee;

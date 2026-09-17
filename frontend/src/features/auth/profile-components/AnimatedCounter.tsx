import React, { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 900,
  className = "",
  suffix = "",
}) => {
  const [displayed, setDisplayed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === 0) { setDisplayed(0); return; }
    startTimeRef.current = null;
    const animate = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * value));
      if (progress < 1) { rafRef.current = requestAnimationFrame(animate); }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <span className={className}>{displayed}{suffix}</span>;
};

export default AnimatedCounter;

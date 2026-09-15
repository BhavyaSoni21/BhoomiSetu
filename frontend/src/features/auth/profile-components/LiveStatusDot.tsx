import React from "react";

type DotColor = "green" | "amber" | "red" | "gray";

interface LiveStatusDotProps {
  color?: DotColor;
  label?: string;
  pulse?: boolean;
  className?: string;
}

const colorMap: Record<DotColor, { dot: string; ring: string; text: string }> = {
  green: { dot: "bg-emerald-500", ring: "bg-emerald-400/50", text: "text-emerald-700 dark:text-emerald-400" },
  amber: { dot: "bg-amber-500", ring: "bg-amber-400/50", text: "text-amber-700 dark:text-amber-400" },
  red:   { dot: "bg-rose-500", ring: "bg-rose-400/50",   text: "text-rose-700 dark:text-rose-400" },
  gray:  { dot: "bg-gray-400", ring: "bg-gray-300/50",   text: "text-gray-500 dark:text-gray-400" },
};

export const LiveStatusDot: React.FC<LiveStatusDotProps> = ({
  color = "green",
  label,
  pulse = true,
  className = "",
}) => {
  const c = colorMap[color];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex h-2 w-2 shrink-0">
        {pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.ring} opacity-75`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${c.dot}`} />
      </span>
      {label && <span className={`text-[10px] font-semibold uppercase tracking-wide ${c.text}`}>{label}</span>}
    </span>
  );
};

export default LiveStatusDot;

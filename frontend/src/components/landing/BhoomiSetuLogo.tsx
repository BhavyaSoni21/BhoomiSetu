import React from 'react';

interface BhoomiSetuLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  textColor?: string;
  showText?: boolean;
}

export const BhoomiSetuIcon: React.FC<{ className?: string; strokeColor?: string; fillColor?: string }> = ({
  className = 'w-6 h-6',
  strokeColor = 'currentColor',
  fillColor = 'currentColor',
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Bottom-left rounded square */}
      <rect
        x="3"
        y="7"
        width="12"
        height="12"
        rx="2.5"
        stroke={strokeColor}
        strokeWidth="2"
        fill={fillColor}
        fillOpacity="0.25"
      />
      {/* Overlapping top-right rounded square */}
      <rect
        x="8.5"
        y="3"
        width="12"
        height="12"
        rx="2.5"
        stroke={strokeColor}
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
};

export const BhoomiSetuLogo: React.FC<BhoomiSetuLogoProps> = ({
  className = 'flex items-center gap-2.5',
  iconClassName = 'w-6 h-6',
  textClassName = 'font-bold font-heading tracking-tight text-lg',
  textColor = 'text-white',
  showText = true,
}) => {
  return (
    <div className={className}>
      <BhoomiSetuIcon className={iconClassName} />
      {showText && (
        <span className={`${textClassName} ${textColor}`}>
          BhoomiSetu
        </span>
      )}
    </div>
  );
};

export default BhoomiSetuLogo;

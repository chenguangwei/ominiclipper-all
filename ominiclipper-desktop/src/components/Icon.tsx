import React from 'react';

export interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
  style?: React.CSSProperties;
}

const Icon: React.FC<IconProps> = ({ name, className = "", filled = false, onClick, style }) => {
  // Merge filled style with any custom styles
  const mergedStyle: React.CSSProperties = {
    ...(filled ? { fontVariationSettings: "'FILL' 1" } : {}),
    ...style,
  };
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={mergedStyle}
      onClick={onClick}
    >
      {name}
    </span>
  );
};

export default Icon;
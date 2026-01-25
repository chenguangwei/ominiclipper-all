import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

const Icon: React.FC<IconProps> = ({ name, className = "", filled = false, onClick }) => {
  // Using font-variation-settings to toggle fill if needed, though the CSS class mostly handles weight
  const style = filled ? { fontVariationSettings: "'FILL' 1" } : {};
  return (
    <span 
      className={`material-symbols-outlined ${className}`} 
      style={style}
      onClick={onClick}
    >
      {name}
    </span>
  );
};

export default Icon;
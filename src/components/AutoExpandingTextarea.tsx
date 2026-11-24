import React, { useEffect, useRef } from 'react';

interface AutoExpandingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
}

export const AutoExpandingTextarea: React.FC<AutoExpandingTextareaProps> = ({
  value,
  minHeight = 84,
  className = '',
  onChange,
  onInput,
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stringValue = typeof value === 'string' || typeof value === 'number' ? value : (value ? '' : '');

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const targetHeight = Math.max(minHeight, el.scrollHeight + 4);
      el.style.height = `${targetHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [stringValue, minHeight]);

  return (
    <textarea
      ref={textareaRef}
      value={stringValue}
      onChange={(e) => {
        onChange?.(e);
        adjustHeight();
      }}
      onInput={(e) => {
        adjustHeight();
        onInput?.(e);
      }}
      className={`overflow-y-hidden resize-y transition-[height] duration-75 ${className}`}
      {...props}
    />
  );
};

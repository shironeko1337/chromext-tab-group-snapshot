import { Tooltip } from '@heroui/react';

function QuestionIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16a8 8 0 0 1 0 16zm-1-5h2v2h-2zm1-10a4 4 0 0 0-4 4h2a2 2 0 1 1 3.2 1.6c-.9.7-2.2 1.6-2.2 3.4h2c0-.9.6-1.4 1.4-2A4 4 0 0 0 12 5z"
      />
    </svg>
  );
}

// A "?" icon that explains something on hover or keyboard focus.
export function Help({ label, children }) {
  return (
    <Tooltip delay={200}>
      <Tooltip.Trigger aria-label={label} className="inline-flex cursor-help text-muted hover:text-foreground">
        <QuestionIcon />
      </Tooltip.Trigger>
      <Tooltip.Content showArrow className="max-w-xs text-sm">
        {children}
      </Tooltip.Content>
    </Tooltip>
  );
}

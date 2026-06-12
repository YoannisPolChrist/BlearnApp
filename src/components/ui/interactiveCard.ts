import type { KeyboardEventHandler } from 'react';

export interface InteractiveCardProps {
  role: 'button';
  tabIndex: 0;
  onKeyDown: KeyboardEventHandler<HTMLElement>;
}

export function getInteractiveCardProps(onClick?: () => void): Partial<InteractiveCardProps> {
  if (!onClick) return {};

  return {
    role: 'button',
    tabIndex: 0,
    onKeyDown: (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onClick();
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        onClick();
      }
    },
  };
}

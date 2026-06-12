export interface SuccessFeedbackOptions {
  eyebrow?: string;
  title: string;
  description?: string;
  detail?: string;
  emoji?: string;
  durationMs?: number;
  onDone?: () => void | Promise<void>;
}

export interface SuccessFeedbackPayload extends SuccessFeedbackOptions {
  id: number;
}

type SuccessFeedbackListener = (payload: SuccessFeedbackPayload) => void;

const listeners = new Set<SuccessFeedbackListener>();
let nextId = 0;

export function showSuccessFeedback(options: SuccessFeedbackOptions) {
  const payload: SuccessFeedbackPayload = {
    ...options,
    id: ++nextId,
  };

  listeners.forEach((listener) => listener(payload));
  return payload.id;
}

export function subscribeSuccessFeedback(listener: SuccessFeedbackListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

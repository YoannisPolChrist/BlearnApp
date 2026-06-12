import {
  MAX_TYPED_ANSWER_ATTEMPTS,
  getCardAnswer,
  getCardPrompt,
  isTypedAnswerCorrect,
  shouldRequireTypedAnswer,
} from '@/lib/learning';
import type { LearningCard, LearningNote } from '@/lib/learning';
import type { LearningSessionSnapshot } from './sessionTypes';
import { hasTypedAnswerDirective } from './typedAnswerService';

export function isSessionTypedAnswerCorrect(
  card: LearningCard,
  note: LearningNote | undefined,
  answer: string,
) {
  return isTypedAnswerCorrect(card, note, answer);
}

export function getSessionCardPrompt(card: LearningCard, note?: LearningNote) {
  return getCardPrompt(card, note);
}

export function getSessionCardAnswer(note?: LearningNote) {
  return getCardAnswer(note);
}

export function shouldSessionRequireTypedAnswer(
  card: LearningCard,
  note: LearningNote | undefined,
  typedAnswerMaxWords: number,
  typedAnswerEnabled: boolean,
) {
  return shouldRequireTypedAnswer(card, note, typedAnswerMaxWords, typedAnswerEnabled);
}

export function isSessionComplete(snapshot: LearningSessionSnapshot) {
  return snapshot.status === 'completed' || (snapshot.queue.length === 0 && snapshot.candidateIds.length === 0);
}

export function getMaxTypedAnswerAttempts() {
  return MAX_TYPED_ANSWER_ATTEMPTS;
}

export { hasTypedAnswerDirective };

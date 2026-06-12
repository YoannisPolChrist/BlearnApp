import { useDeferredValue, useMemo, useRef } from 'react';
import {
  buildManualCardPreview,
  type TemplatePreview,
  type TemplatePreviewSource,
} from '@/lib/learning';

export interface TemplatePreviewInput extends TemplatePreviewSource {
  selectedClozeOrdinal?: number;
}

export interface UseTemplatePreviewResult {
  preview: TemplatePreview;
  isDirty: boolean;
  loading: boolean;
  refreshPreview: () => void;
}

function buildPreviewSignature(input: TemplatePreviewInput | null | undefined) {
  return [
    input?.type || 'basic',
    input?.front || '',
    input?.back || '',
    input?.clozeText || '',
    input?.expectedAnswer || '',
    input?.selectedClozeOrdinal || 1,
  ].join('\u001f');
}

export function useTemplatePreview(input: TemplatePreviewInput | null | undefined): UseTemplatePreviewResult {
  const currentSignature = buildPreviewSignature(input);
  const deferredInput = useDeferredValue(input);
  const deferredSignature = useDeferredValue(currentSignature);
  const committedSignatureRef = useRef(currentSignature);

  const preview = useMemo(
    () => buildManualCardPreview(deferredInput, deferredInput?.selectedClozeOrdinal),
    [deferredInput],
  );

  return {
    preview,
    isDirty: committedSignatureRef.current !== currentSignature,
    loading: deferredSignature !== currentSignature,
    refreshPreview: () => {
      committedSignatureRef.current = currentSignature;
    },
  };
}

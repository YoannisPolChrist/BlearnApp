import { type AlbyConnectionConfig, isAlbyReady } from '@/services/albyWalletService';

export interface PenaltyRuntimePartnerLike {
  lightningAddress?: string;
  validationStatus?: 'unverified' | 'verified' | 'invalid' | string;
}

export interface PenaltyRuntimeConnectionTestLike {
  status?: 'idle' | 'testing' | 'passed' | 'failed' | string;
}

export interface PenaltyRuntimeStateLike {
  penaltyAmountSats?: number | null;
  penaltyEnabled?: boolean;
  accountabilityPartner?: PenaltyRuntimePartnerLike | null;
  albyConnection?: AlbyConnectionConfig | null;
  albyConnectionTest?: PenaltyRuntimeConnectionTestLike | null;
}

export function isPenaltyAmountConfigured(amountSats: number | null | undefined): amountSats is number {
  return typeof amountSats === 'number' && Number.isFinite(amountSats) && amountSats > 0;
}

export function isPenaltyPartnerVerified(partner: PenaltyRuntimePartnerLike | null | undefined): boolean {
  return Boolean(partner && partner.validationStatus === 'verified' && partner.lightningAddress?.trim());
}

export function isPenaltyConnectionTestPassed(
  connectionTest: PenaltyRuntimeConnectionTestLike | null | undefined,
): boolean {
  return connectionTest?.status === 'passed';
}

export function isPenaltySetupReady(
  state: Omit<PenaltyRuntimeStateLike, 'penaltyEnabled'>,
): boolean {
  return Boolean(
    isAlbyReady(state.albyConnection)
      && isPenaltyPartnerVerified(state.accountabilityPartner)
      && isPenaltyConnectionTestPassed(state.albyConnectionTest)
      && isPenaltyAmountConfigured(state.penaltyAmountSats),
  );
}

export function isPenaltyRuntimeActive(state: PenaltyRuntimeStateLike): boolean {
  return Boolean(state.penaltyEnabled) && isPenaltySetupReady(state);
}

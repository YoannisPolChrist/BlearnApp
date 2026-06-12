/**
 * VPN / DNS filter notes for Blearn.
 *
 * The shipped Android runtime uses:
 * - `BlearnVpnService`
 * - `VpnPolicyBridge`
 * - `DomainRuleCompiler`
 * - `DnsDecisionEngine`
 * - `VpnNotificationController`
 *
 * Package root:
 * `android/app/src/main/java/app/blearn/mobile/`
 *
 * Rules:
 * - website blocking is DNS/VPN based
 * - app and search flows remain accessibility based
 * - blocked website hits should still open the existing Blearn intervention flow
 */

export {};

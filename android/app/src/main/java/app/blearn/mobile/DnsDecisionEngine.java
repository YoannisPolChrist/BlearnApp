package app.blearn.mobile;

import java.util.Collections;

final class DnsDecisionEngine {
    static final class Decision {
        final boolean blocked;
        final PolicyTarget target;
        final String hostname;
        final String reason;

        private Decision(boolean blocked, PolicyTarget target, String hostname, String reason) {
            this.blocked = blocked;
            this.target = target;
            this.hostname = hostname;
            this.reason = reason;
        }

        static Decision allow(String hostname, String reason) {
            return new Decision(false, null, hostname, reason);
        }

        static Decision block(PolicyTarget target, String hostname) {
            return new Decision(true, target, hostname, "blocked");
        }
    }

    private final DomainRuleCompiler.CompiledDomainIndex ruleIndex;
    private final PolicySnapshot snapshot;

    private DnsDecisionEngine(DomainRuleCompiler.CompiledDomainIndex ruleIndex, PolicySnapshot snapshot) {
        this.ruleIndex = ruleIndex;
        this.snapshot = snapshot;
    }

    static DnsDecisionEngine empty() {
        return new DnsDecisionEngine(
            new DomainRuleCompiler.CompiledDomainIndex(Collections.emptyList()),
            new PolicySnapshot()
        );
    }

    static DnsDecisionEngine fromSnapshot(PolicySnapshot snapshot) {
        if (snapshot == null) {
            return empty();
        }
        return new DnsDecisionEngine(DomainRuleCompiler.compileIndex(snapshot), snapshot);
    }

    boolean hasRules() {
        return ruleIndex.hasRules();
    }

    Decision decide(String rawHostname) {
        String hostname = DomainRuleCompiler.normalizeDomain(rawHostname);
        if (!snapshot.websiteBlockingActive) {
            return Decision.allow(hostname, "website blocking disabled");
        }
        if (!PolicySnapshot.hasText(hostname)) {
            return Decision.allow(hostname, "invalid hostname");
        }

        DomainRuleCompiler.CompiledDomainRule matchingRule = ruleIndex.findMatchingRule(hostname);
        if (matchingRule != null) {
            if (snapshot.isUnlocked(matchingRule.target.id, matchingRule.target.type)) {
                return Decision.allow(hostname, "target unlocked");
            }

            return Decision.block(matchingRule.target, hostname);
        }

        return Decision.allow(hostname, "no matching rule");
    }
}

package app.blearn.mobile;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class DomainRuleCompiler {
    static final class CompiledDomainRule {
        final String domain;
        final PolicyTarget target;

        CompiledDomainRule(String domain, PolicyTarget target) {
            this.domain = domain;
            this.target = target;
        }

        boolean matchesHost(String hostname) {
            if (!PolicySnapshot.hasText(domain) || !PolicySnapshot.hasText(hostname)) {
                return false;
            }

            return hostname.equals(domain)
                || hostname.endsWith("." + domain);
        }
    }

    static final class CompiledDomainIndex {
        final List<CompiledDomainRule> rules;
        private final Map<String, CompiledDomainRule> rulesByDomain;

        CompiledDomainIndex(List<CompiledDomainRule> rules) {
            this.rules = rules;
            this.rulesByDomain = new LinkedHashMap<>();
            for (CompiledDomainRule rule : rules) {
                this.rulesByDomain.put(rule.domain, rule);
            }
        }

        boolean hasRules() {
            return !rules.isEmpty();
        }

        CompiledDomainRule findMatchingRule(String normalizedHostname) {
            String candidate = normalizedHostname;
            while (PolicySnapshot.hasText(candidate)) {
                CompiledDomainRule rule = rulesByDomain.get(candidate);
                if (rule != null) {
                    return rule;
                }

                int nextDot = candidate.indexOf('.');
                if (nextDot < 0 || nextDot >= candidate.length() - 1) {
                    return null;
                }
                candidate = candidate.substring(nextDot + 1);
            }

            return null;
        }
    }

    private DomainRuleCompiler() {
    }

    static List<CompiledDomainRule> compile(PolicySnapshot snapshot) {
        if (snapshot == null || !snapshot.websiteBlockingActive) {
            return Collections.emptyList();
        }

        Map<String, PolicyTarget> rulesByDomain = new LinkedHashMap<>();

        for (PolicyTarget target : snapshot.websiteTargets) {
            String normalizedDomain = normalizeDomain(target.id);
            if (!PolicySnapshot.hasText(normalizedDomain) || rulesByDomain.containsKey(normalizedDomain)) continue;
            rulesByDomain.put(
                normalizedDomain,
                new PolicyTarget(
                    normalizedDomain,
                    target.type,
                    target.mode,
                    target.deckId,
                    target.requiredCorrectReviews,
                    target.unlockDurationMinutes
                )
            );
        }

        if (rulesByDomain.isEmpty()) {
            String fallbackMode = snapshot.getPreferredMode();
            for (String blockedDomain : snapshot.blockedDomains) {
                String normalizedDomain = normalizeDomain(blockedDomain);
                if (!PolicySnapshot.hasText(normalizedDomain) || rulesByDomain.containsKey(normalizedDomain)) continue;
                rulesByDomain.put(
                    normalizedDomain,
                    new PolicyTarget(normalizedDomain, "website", fallbackMode, null, 0, 0)
                );
            }
        }

        List<CompiledDomainRule> compiledRules = new ArrayList<>();
        for (Map.Entry<String, PolicyTarget> entry : rulesByDomain.entrySet()) {
            compiledRules.add(new CompiledDomainRule(entry.getKey(), entry.getValue()));
        }

        compiledRules.sort((left, right) -> Integer.compare(right.domain.length(), left.domain.length()));
        return compiledRules;
    }

    static CompiledDomainIndex compileIndex(PolicySnapshot snapshot) {
        return new CompiledDomainIndex(compile(snapshot));
    }

    static String normalizeDomain(String rawValue) {
        if (!PolicySnapshot.hasText(rawValue)) return "";

        String value = rawValue.trim().toLowerCase(Locale.ROOT);
        if (value.startsWith("*.")) {
            value = value.substring(2);
        }

        try {
            URI uri = new URI(value.contains("://") ? value : "https://" + value);
            if (PolicySnapshot.hasText(uri.getHost())) {
                value = uri.getHost().toLowerCase(Locale.ROOT);
            }
        } catch (Exception ignored) {
            int slashIndex = value.indexOf('/');
            if (slashIndex >= 0) {
                value = value.substring(0, slashIndex);
            }
        }

        int queryIndex = value.indexOf('?');
        if (queryIndex >= 0) {
            value = value.substring(0, queryIndex);
        }

        int hashIndex = value.indexOf('#');
        if (hashIndex >= 0) {
            value = value.substring(0, hashIndex);
        }

        if (value.endsWith(".")) {
            value = value.substring(0, value.length() - 1);
        }

        int colonIndex = value.indexOf(':');
        if (colonIndex >= 0 && value.indexOf(':', colonIndex + 1) < 0) {
            value = value.substring(0, colonIndex);
        }

        if (!PolicySnapshot.hasText(value) || value.contains("..") || !value.contains(".")) {
            return "";
        }

        if (looksLikeIpAddress(value)) {
            return "";
        }

        String[] labels = value.split("\\.");
        for (String label : labels) {
            if (!PolicySnapshot.hasText(label) || label.length() > 63) {
                return "";
            }

            for (int index = 0; index < label.length(); index += 1) {
                char character = label.charAt(index);
                boolean validCharacter = (character >= 'a' && character <= 'z')
                    || (character >= '0' && character <= '9')
                    || character == '-';
                if (!validCharacter) {
                    return "";
                }
            }

            if (label.startsWith("-") || label.endsWith("-")) {
                return "";
            }
        }

        return value;
    }

    static boolean matches(String rule, String hostname) {
        String normalizedRule = normalizeDomain(rule);
        String normalizedHostname = normalizeDomain(hostname);
        if (!PolicySnapshot.hasText(normalizedRule) || !PolicySnapshot.hasText(normalizedHostname)) {
            return false;
        }

        return normalizedHostname.equals(normalizedRule)
            || normalizedHostname.endsWith("." + normalizedRule);
    }

    private static boolean looksLikeIpAddress(String value) {
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            if (!((character >= '0' && character <= '9') || character == '.')) {
                return false;
            }
        }
        return true;
    }
}

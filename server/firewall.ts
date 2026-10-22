import type { FirewallEvaluation, FirewallRule } from '../shared/types.js';

function addressNumber(value: string) { return value.split('.').reduce((result, octet) => ((result << 8) | Number(octet)) >>> 0, 0); }

export function matchesSelector(ip: string, selector: string): boolean {
  if (selector === 'any') return true;
  const [address, prefix] = selector.split('/');
  if (prefix === undefined) return ip === address;
  const bits = Number(prefix);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (addressNumber(ip) & mask) === (addressNumber(address) & mask);
}

export function evaluateFirewall(rules: FirewallRule[], packet: { source: string; destination: string; protocol: 'TCP' | 'UDP'; port: number; direction?: 'inbound' | 'outbound' }): FirewallEvaluation {
  const direction = packet.direction ?? 'inbound';
  const matchedRule = rules.find(rule => rule.enabled && rule.direction === direction && matchesSelector(packet.source, rule.source)
    && matchesSelector(packet.destination, rule.destination) && (rule.protocol === 'ANY' || rule.protocol === packet.protocol)
    && (rule.port === null || rule.port === packet.port)) ?? null;
  return {
    action: matchedRule?.action ?? 'deny', matchedRule, mode: 'simulation',
    explanation: matchedRule ? `First enabled matching ${direction} rule: ${matchedRule.name}. This evaluates the policy model only; no operating-system rule is changed.`
      : `No enabled ${direction} rule matched. The simulated default policy denies this packet; no operating-system firewall is changed.`,
  };
}

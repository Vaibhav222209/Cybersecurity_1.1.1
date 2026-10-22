import { describe, expect, it } from 'vitest';
import { analyzePhishing, classifyIp, csvCell, sameIp } from './analysis';

describe('IP classification', () => {
  it('validates IPv4 and rejects ambiguous or malformed representations', () => {
    expect(classifyIp('8.8.8.8')).toMatchObject({ valid: true, version: 4, scope: 'public' });
    for (const input of ['1.2.3.256', '01.2.3.4', '1.2.3', '1.2.3.4:80', '1.2.3.4/24', 'not an IP']) expect(classifyIp(input).valid).toBe(false);
  });
  it('distinguishes private ranges at their boundaries and reserved documentation space', () => {
    expect(classifyIp('172.16.0.1').scope).toBe('private');
    expect(classifyIp('172.31.255.254').scope).toBe('private');
    expect(classifyIp('172.32.0.1').scope).toBe('public');
    for (const input of ['127.0.0.1', '203.0.113.8', '192.0.2.1', '169.254.1.1', '100.64.0.1']) expect(classifyIp(input).scope).toBe('reserved');
  });
  it('validates compressed IPv6 and normalizes equivalent addresses for correlation', () => {
    expect(classifyIp('2606:4700:4700::1111')).toMatchObject({ valid: true, version: 6, scope: 'public' });
    expect(classifyIp('fd12::1').scope).toBe('private');
    expect(classifyIp('2001:db8::1').scope).toBe('reserved');
    expect(classifyIp('::1').scope).toBe('reserved');
    expect(classifyIp('::ffff:192.168.1.2').scope).toBe('private');
    expect(sameIp('2001:db8::1', '2001:0DB8:0:0:0:0:0:1')).toBe(true);
    for (const input of ['2001:::1', '1::2::3', '1:2:3', '::ffff:999.0.0.1', '[::1]', 'fe80::1%eth0']) expect(classifyIp(input).valid).toBe(false);
  });
});

describe('offline phishing triage', () => {
  it('does not call a normal URL safe', () => {
    const result = analyzePhishing('https://example.com/docs');
    expect(result.score).toBe(0);
    expect(result.risk).toBe('low');
    expect(result.summary).toContain('does not establish');
  });
  it('finds credential pressure and a deceptive brand domain', () => {
    const result = analyzePhishing('URGENT: your account is suspended. Verify your password immediately at http://paypal-login.example.com');
    expect(result.risk).toBe('high');
    expect(result.signals.map(signal => signal.id)).toEqual(expect.arrayContaining(['urgency', 'credentials', 'brand-host', 'unencrypted']));
  });
  it('recognizes official subdomains while detecting punycode and @ confusion', () => {
    expect(analyzePhishing('https://accounts.google.com').signals.some(signal => signal.id === 'brand-host')).toBe(false);
    expect(analyzePhishing('https://google.com@evil.example/login').signals.map(signal => signal.id)).toContain('userinfo');
    expect(analyzePhishing('https://xn--pple-43d.com').signals.map(signal => signal.id)).toContain('punycode');
  });
  it('detects HTML display mismatch without executing or fetching links', () => {
    const result = analyzePhishing('<a href="https://evil.example/signin">https://paypal.com</a>');
    expect(result.signals.map(signal => signal.id)).toContain('display-mismatch');
    expect(result.urls).toContain('https://evil.example/signin');
  });
  it('deduplicates repeated indicators and caps the score', () => {
    const result = analyzePhishing('URGENT enable macros and verify your password immediately: http://paypal-login.example.com/x.exe http://apple-secure.example.com/x.exe https://xn--pple-43d.com https://bit.ly/x');
    expect(result.score).toBe(100);
    expect(new Set(result.signals.map(signal => signal.id)).size).toBe(result.signals.length);
  });
});

describe('CSV export safety', () => {
  it('escapes quotes, commas and spreadsheet formula prefixes', () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell('=WEBSERVICE("https://example.com")')).toBe('"\'=WEBSERVICE(""https://example.com"")"');
    expect(csvCell('  +SUM(1,2)')).toBe('"\'  +SUM(1,2)"');
    expect(csvCell('regular log event')).toBe('"regular log event"');
  });
});

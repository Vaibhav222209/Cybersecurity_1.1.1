import { describe, expect, it, vi } from 'vitest';
import { evaluatePassword, generatePassword, inspectUrl, sha256, type PasswordOptions } from './security';

describe('evaluatePassword', () => {
  it('gives useful initial guidance without treating an empty value as a password', () => {
    const result = evaluatePassword('');
    expect(result.score).toBe(0);
    expect(result.label).toBe('Enter a password');
    expect(result.checks.every((check) => !check.passed)).toBe(true);
    expect(result.feedback.length).toBeGreaterThan(0);
  });

  it('does not reward predictable substitutions or repeated characters', () => {
    expect(evaluatePassword('P@ssw0rd123456789!').score).toBeLessThanOrEqual(1);
    expect(evaluatePassword('aaaaaaaaaaaaaaaaaaaaaaaa').score).toBe(0);
    expect(evaluatePassword('aaaaaaaaaaaaaaaaaaaaaaaaA1!').score).toBe(0);
    expect(evaluatePassword('abababababababababababab').score).toBe(0);
  });

  it('recognizes long passphrases and varied passwords without inventing crack times', () => {
    expect(evaluatePassword('copper meadow orbit lantern').score).toBe(4);
    expect(evaluatePassword('vN8!Tj6#Lp3?Qz9$').score).toBe(4);
    expect(evaluatePassword('Short7!').score).toBe(0);
    expect(evaluatePassword('copper meadow orbit lantern').feedback.join(' ')).toContain('unique');
  });

  it('counts Unicode characters instead of UTF-16 code units', () => {
    const result = evaluatePassword('🪴🧭🦋🎒🌊🍋🌈🪁');
    expect(result.checks.find((check) => check.label === 'At least 12 characters')?.passed).toBe(false);
  });
});

describe('inspectUrl', () => {
  it('normalizes a plain hostname and reports transport limits', () => {
    const result = inspectUrl('example.com/docs');
    expect(result).toMatchObject({ valid: true, normalized: 'https://example.com/docs', hostname: 'example.com', risk: 'low' });
    expect(result.findings[0].detail).toContain('does not prove');
  });

  it('uses the actual hostname when an address disguises it with credentials', () => {
    const result = inspectUrl('https://trusted.example:password@evil.example/login');
    expect(result.hostname).toBe('evil.example');
    expect(result.risk).toBe('high');
    expect(result.findings.some((finding) => finding.severity === 'danger')).toBe(true);
  });

  it('flags HTTP, Unicode hostnames, IP destinations, and security-related bait', () => {
    expect(inspectUrl('http://example.com').risk).toBe('medium');
    expect(inspectUrl('https://раypal.com').findings.some((finding) => finding.title === 'Internationalized hostname')).toBe(true);
    expect(inspectUrl('https://127.0.0.1').findings.some((finding) => finding.title === 'IP address destination')).toBe(true);
    expect(inspectUrl('https://[::1]').findings.some((finding) => finding.title === 'IP address destination')).toBe(true);
    expect(inspectUrl('https://secure-login.example.com').risk).toBe('medium');
    expect(inspectUrl('http://secure-login.verify.accounts.example.com').risk).toBe('high');
  });

  it('handles ports and obfuscated numeric IP addresses', () => {
    expect(inspectUrl('example.com:8080/path')).toMatchObject({ valid: true, hostname: 'example.com', risk: 'medium' });
    expect(inspectUrl('https://example.com:443').risk).toBe('low');
    expect(inspectUrl('https://2130706433').hostname).toBe('127.0.0.1');
  });

  it.each(['', 'not a hostname', 'https://', 'javascript:alert(1)', 'javascript:1234', 'data:text/html,hello', 'ftp://example.com', 'http:example.com', 'https://exam\nple.com'])('rejects malformed or unsupported input %j', (value) => {
    const result = inspectUrl(value);
    expect(result.valid).toBe(false);
    expect(result.findings[0].severity).toBe('danger');
  });

  it('rejects excessively long addresses without throwing', () => {
    expect(inspectUrl(`https://example.com/${'a'.repeat(8192)}`).valid).toBe(false);
  });
});

const allCharacters: PasswordOptions = { uppercase: true, lowercase: true, numbers: true, symbols: true };

describe('generatePassword', () => {
  it('guarantees the requested length and each selected character type', () => {
    for (const length of [8, 16, 64]) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const password = generatePassword(length, allCharacters);
        expect(password).toHaveLength(length);
        expect(password).toMatch(/[A-Z]/);
        expect(password).toMatch(/[a-z]/);
        expect(password).toMatch(/[0-9]/);
        expect(password).toMatch(/[^A-Za-z0-9]/);
      }
    }
  });

  it('uses only the selected alphabet and never Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Insecure random source'); });
    try {
      expect(generatePassword(24, { uppercase: false, lowercase: false, numbers: true, symbols: false })).toMatch(/^\d{24}$/);
    } finally {
      random.mockRestore();
    }
  });

  it('discards random bytes outside a complete alphabet range instead of introducing modulo bias', () => {
    let samples = 0;
    const random = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint8Array)[0] = samples++ === 0 ? 255 : 0;
      return array;
    });
    try {
      expect(generatePassword(8, { uppercase: false, lowercase: true, numbers: false, symbols: false })).toBe('aaaaaaaa');
    } finally {
      random.mockRestore();
    }
  });

  it.each([0, 7, 65, 12.5, NaN, Infinity])('rejects invalid lengths %s', (length) => {
    expect(() => generatePassword(length, allCharacters)).toThrow('between 8 and 64');
  });

  it('rejects an empty alphabet instead of silently using a default', () => {
    expect(() => generatePassword(16, { uppercase: false, lowercase: false, numbers: false, symbols: false })).toThrow('at least one');
  });
});

describe('sha256', () => {
  it('matches standard SHA-256 vectors, including empty input', async () => {
    expect(await sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes UTF-8 input consistently and returns lowercase hexadecimal', async () => {
    expect(await sha256('hello 🌍')).toBe('92de6bbfa52e6cfa0f85916fd8176cb1644b95a4c0148cdda94745ba6c35e5eb');
  });
});

export type PasswordEvaluation = {
  score: number;
  label: string;
  feedback: string[];
  checks: { label: string; passed: boolean }[];
};

export type UrlFinding = {
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'danger';
};

export type UrlInspection = {
  valid: boolean;
  normalized: string;
  hostname: string;
  risk: 'low' | 'medium' | 'high';
  findings: UrlFinding[];
};

export type PasswordOptions = {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

/** A local teaching heuristic, not a password breach check or crack-time estimate. */
export function evaluatePassword(password: string): PasswordEvaluation {
  const length = Array.from(password).length;
  const lower = /\p{Ll}/u.test(password);
  const upper = /\p{Lu}/u.test(password);
  const number = /\p{N}/u.test(password);
  const symbol = /[^\p{L}\p{N}\s]/u.test(password);
  const simplified = password.toLowerCase().replace(/[@$01357]/g, (character) => {
    const substitutions: Record<string, string> = {
      '@': 'a', '$': 's', '0': 'o', '1': 'i', '3': 'e', '5': 's', '7': 't',
    };
    return substitutions[character];
  });
  const common = /password|qwerty|letmein|welcome|iloveyou|123456|abcdef/.test(password.toLowerCase())
    || /password|qwerty|letmein|welcome|iloveyou/.test(simplified);
  const repeated = /([^\s])\1{3,}/u.test(password) || /^(.{2,4})\1{2,}$/u.test(password);
  const checks = [
    { label: 'At least 12 characters', passed: length >= 12 },
    { label: 'At least 16 characters', passed: length >= 16 },
    { label: 'Uppercase and lowercase letters', passed: upper && lower },
    { label: 'A number', passed: number },
    { label: 'A symbol', passed: symbol },
    { label: 'No common or repeated patterns', passed: length > 0 && !common && !repeated },
  ];

  if (!password) {
    return {
      score: 0,
      label: 'Enter a password',
      feedback: ['Try a long, unique password or passphrase.'],
      checks,
    };
  }

  let score = length < 8 ? 0 : length < 12 ? 1 : length < 16 ? 2 : length < 20 ? 3 : 4;
  const variety = [lower, upper, number, symbol].filter(Boolean).length;
  if (length >= 12 && variety >= 3) score = Math.min(4, score + 1);
  if (common) score = Math.min(score, 1);
  if (repeated) score = 0;

  const feedback: string[] = [];
  if (length < 12) feedback.push('Use at least 12 characters; 16 or more is better.');
  else if (length < 16) feedback.push('Add a few more characters or another unrelated word.');
  if (common) feedback.push('Avoid common passwords, keyboard sequences, and predictable substitutions.');
  if (repeated) feedback.push('Avoid repeating the same character or short sequence.');
  if (length < 20 && variety < 3) feedback.push('Use unrelated words or add a mix of letters, numbers, and symbols.');
  if (!feedback.length) feedback.push('Good length. Keep it unique to one account and enable multi-factor authentication.');

  return { score, label: ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][score], feedback, checks };
}

function invalidUrl(title: string, detail: string): UrlInspection {
  return {
    valid: false,
    normalized: '',
    hostname: '',
    risk: 'high',
    findings: [{ title, detail, severity: 'danger' }],
  };
}

/** Inspects the supplied text only. It never opens or fetches the address. */
export function inspectUrl(input: string): UrlInspection {
  const value = input.trim();
  if (!value) return invalidUrl('Enter a web address', 'Paste an HTTP or HTTPS address to inspect its structure.');
  if (value.length > 8192) return invalidUrl('Address is too long', 'Use a web address of 8,192 characters or fewer.');
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return invalidUrl('Hidden control characters', 'Remove tabs, line breaks, or other control characters from the address.');
  }

  const explicitScheme = value.match(/^([a-z][a-z\d+.-]*):/i);
  const hostnameAndPort = /^(?:localhost|[^:@\s/?#]+\.[^:@\s/?#]+):\d{1,5}(?:[/?#]|$)/i.test(value);
  if (explicitScheme && !hostnameAndPort && !/^https?:\/\//i.test(value)) {
    return invalidUrl('Unsupported address', 'Only HTTP and HTTPS web addresses are supported.');
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('Unsupported URL');
  } catch {
    return invalidUrl('Invalid web address', 'Check the hostname and format, such as https://example.com.');
  }

  const hostname = url.hostname;
  const findings: UrlFinding[] = [];
  if (url.protocol === 'http:') {
    findings.push({
      title: 'Unencrypted connection',
      detail: 'HTTP does not protect data in transit. Avoid entering passwords or payment details.',
      severity: 'warning',
    });
  } else {
    findings.push({
      title: 'HTTPS enabled',
      detail: 'HTTPS protects the connection, but does not prove that a website is trustworthy.',
      severity: 'info',
    });
  }

  if (url.username || url.password) {
    findings.push({
      title: 'Credentials before the destination',
      detail: `Text before @ can disguise a destination. The actual hostname is ${hostname}.`,
      severity: 'danger',
    });
  }
  if (hostname.split('.').some((part) => part.startsWith('xn--'))) {
    findings.push({
      title: 'Internationalized hostname',
      detail: 'This address uses Punycode. Check for look-alike characters; internationalized names can also be legitimate.',
      severity: 'warning',
    });
  }
  const ipAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || /^\[.*\]$/.test(hostname);
  if (ipAddress) {
    findings.push({
      title: 'IP address destination',
      detail: 'This address uses an IP instead of a recognizable domain. Confirm it belongs to the intended service.',
      severity: 'warning',
    });
  }
  if (!ipAddress && hostname.split('.').filter(Boolean).length > 4) {
    findings.push({
      title: 'Many hostname segments',
      detail: 'Several subdomains can make an address harder to read. Verify the entire hostname, not just its first words.',
      severity: 'warning',
    });
  }
  const sensitiveWords = hostname.split(/[.-]/).filter((part) => /^(login|verify|secure|account|update|support|password|wallet)$/.test(part));
  if (sensitiveWords.length) {
    findings.push({
      title: 'Security-related wording',
      detail: 'Words such as “login” or “secure” are not proof of trust. Confirm the hostname independently.',
      severity: sensitiveWords.length >= 2 ? 'warning' : 'info',
    });
  }
  if (url.port) {
    findings.push({
      title: 'Nonstandard web port',
      detail: `The address uses port ${url.port}. This can be legitimate, but should match the intended service.`,
      severity: 'warning',
    });
  }
  if (value.includes('\\')) {
    findings.push({
      title: 'Unusual backslash characters',
      detail: 'Browsers can normalize backslashes into forward slashes. Review the normalized destination carefully.',
      severity: 'warning',
    });
  }

  const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
  const risk = findings.some((finding) => finding.severity === 'danger') || warningCount >= 3
    ? 'high' : warningCount ? 'medium' : 'low';
  return { valid: true, normalized: url.href, hostname, risk, findings };
}

const characterSets: Record<keyof PasswordOptions, string> = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
};

/** Rejection sampling avoids the modulo bias of byte % alphabet.length. */
function randomIndex(size: number): number {
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) throw new Error('Secure random generation is unavailable in this browser.');
  const limit = Math.floor(256 / size) * size;
  const sample = new Uint8Array(1);
  do {
    crypto.getRandomValues(sample);
  } while (sample[0] >= limit);
  return sample[0] % size;
}

export function generatePassword(length: number, options: PasswordOptions): string {
  if (!Number.isInteger(length) || length < 8 || length > 64) {
    throw new Error('Choose a whole-number length between 8 and 64.');
  }
  const sets = (Object.keys(characterSets) as (keyof PasswordOptions)[])
    .filter((key) => options[key])
    .map((key) => characterSets[key]);
  if (!sets.length) throw new Error('Select at least one character type.');

  const alphabet = sets.join('');
  const characters = sets.map((set) => set[randomIndex(set.length)]);
  while (characters.length < length) characters.push(alphabet[randomIndex(alphabet.length)]);
  for (let index = characters.length - 1; index > 0; index--) {
    const swap = randomIndex(index + 1);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }
  return characters.join('');
}

export async function sha256(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires a secure browser context.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

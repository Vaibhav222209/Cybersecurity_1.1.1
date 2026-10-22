export type IpScope = 'public' | 'private' | 'reserved';
export interface IpClassification { valid: boolean; version?: 4 | 6; scope?: IpScope; normalized?: string; explanation: string; }

function ipv4Parts(input: string): number[] | null {
  const parts = input.split('.');
  if (parts.length !== 4 || parts.some(part => !/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)) return null;
  return parts.map(Number);
}

function ipv6Parts(input: string): number[] | null {
  if (!input || !/^[0-9a-f:.]+$/i.test(input) || (input.match(/::/g)?.length ?? 0) > 1) return null;
  let value = input.toLowerCase();
  if (value.includes('.')) {
    const boundary = value.lastIndexOf(':');
    const address = ipv4Parts(value.slice(boundary + 1));
    if (!address) return null;
    value = `${value.slice(0, boundary + 1)}${((address[0] << 8) | address[1]).toString(16)}:${((address[2] << 8) | address[3]).toString(16)}`;
  }
  const sides = value.split('::');
  const left = sides[0] ? sides[0].split(':') : [];
  const right = sides[1] ? sides[1].split(':') : [];
  if ([...left, ...right].some(part => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  if (sides.length === 1 && left.length !== 8) return null;
  if (sides.length === 2 && left.length + right.length >= 8) return null;
  return [...left.map(part => parseInt(part, 16)), ...Array(sides.length === 2 ? 8 - left.length - right.length : 0).fill(0), ...right.map(part => parseInt(part, 16))];
}

export function classifyIp(raw: string): IpClassification {
  const input = raw.trim();
  const v4 = ipv4Parts(input);
  if (v4) {
    const [a, b, c] = v4;
    const privateIp = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
    const reserved = a === 0 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113);
    const scope: IpScope = privateIp ? 'private' : reserved ? 'reserved' : 'public';
    return { valid: true, version: 4, normalized: v4.join('.'), scope, explanation: privateIp ? 'Private address. Used within a local network; it cannot identify an Internet origin.' : reserved ? 'Special-use address, including loopback, documentation, shared or multicast ranges. It is not ordinary public host telemetry.' : 'Public address format. Reputation, ownership and location have not been queried.' };
  }
  const v6 = ipv6Parts(input);
  if (v6) {
    if (v6.slice(0, 5).every(part => part === 0) && v6[5] === 0xffff) {
      const result = classifyIp(`${v6[6] >> 8}.${v6[6] & 255}.${v6[7] >> 8}.${v6[7] & 255}`);
      return { ...result, version: 6, normalized: v6.map(part => part.toString(16)).join(':'), explanation: `IPv4-mapped IPv6 address. ${result.explanation}` };
    }
    const privateIp = (v6[0] & 0xfe00) === 0xfc00;
    const unspecifiedOrLoopback = v6.slice(0, 7).every(part => part === 0) && v6[7] <= 1;
    const reserved = unspecifiedOrLoopback || (v6[0] & 0xffc0) === 0xfe80 || (v6[0] & 0xff00) === 0xff00 || (v6[0] === 0x2001 && v6[1] === 0xdb8) || (v6[0] & 0xe000) !== 0x2000;
    const scope: IpScope = privateIp ? 'private' : reserved ? 'reserved' : 'public';
    return { valid: true, version: 6, scope, normalized: v6.map(part => part.toString(16)).join(':'), explanation: privateIp ? 'Unique-local IPv6 address. Meaningful within its local network.' : reserved ? 'Special-use IPv6 address, including loopback, link-local, documentation or multicast ranges.' : 'Public IPv6 address format. Reputation, ownership and location have not been queried.' };
  }
  return { valid: false, explanation: 'Enter a complete IPv4 or IPv6 address without a port, CIDR suffix or zone identifier.' };
}

export function sameIp(left: string, right: string): boolean {
  const a = classifyIp(left); const b = classifyIp(right);
  return a.valid && b.valid && a.normalized === b.normalized;
}

export interface PhishingSignal { id: string; title: string; detail: string; weight: number; }
export interface PhishingAnalysis { risk: 'low' | 'medium' | 'high'; score: number; signals: PhishingSignal[]; urls: string[]; summary: string; }

/** Offline, explainable triage only. This function never requests a URL or retains input. */
export function analyzePhishing(input: string): PhishingAnalysis {
  const signals: PhishingSignal[] = [];
  const add = (id: string, title: string, detail: string, weight: number) => { if (!signals.some(signal => signal.id === id)) signals.push({ id, title, detail, weight }); };
  const urls: URL[] = [];
  const candidates: string[] = input.match(/(?:https?:\/\/|javascript:|data:)[^\s<>"']+/gi) ?? [];
  if (!candidates.length && /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i.test(input.trim())) candidates.push(`https://${input.trim()}`);
  for (const candidate of candidates.slice(0, 100)) {
    try {
      const url = new URL(candidate.replace(/[),.;]+$/, ''));
      if (!urls.some(item => item.href === url.href)) urls.push(url);
    } catch { /* Unparseable text is not requested. */ }
  }
  for (const url of urls) {
    const host = url.hostname.toLowerCase();
    if (url.protocol === 'http:') add('unencrypted', 'Unencrypted destination', 'An HTTP link does not encrypt traffic. Avoid entering credentials there.', 14);
    if (url.protocol === 'javascript:' || url.protocol === 'data:') add('active-link', 'Active content in a link', 'A javascript: or data: destination can execute or embed content instead of navigating to an ordinary site.', 35);
    if (host.includes('xn--')) add('punycode', 'Internationalized hostname', `The hostname uses punycode (${host}). Check for characters that imitate a trusted brand.`, 24);
    if (url.username || url.password) add('userinfo', 'Misleading URL user information', `The actual destination is ${host}; text before @ is not the destination hostname.`, 25);
    if (classifyIp(host.replace(/^\[|\]$/g, '')).valid) add('ip-host', 'Raw IP destination', 'The link uses an IP address instead of a recognizable domain name.', 15);
    if (/(^|[.-])(login|signin|verify|secure|account|wallet)([.-]|$)/i.test(host)) add('credential-host', 'Credential-themed hostname', `The destination ${host} uses account or verification language. This is a weak signal on its own.`, 10);
    if (['bit.ly', 'tinyurl.com', 't.co', 'shorturl.at', 'is.gd', 'rb.gy'].includes(host)) add('shortener', 'Shortened destination', 'The final destination is hidden by a URL shortener. It has not been expanded.', 14);
    const brands: Record<string, string[]> = { paypal: ['paypal.com'], microsoft: ['microsoft.com', 'microsoftonline.com', 'live.com', 'office.com'], google: ['google.com', 'googleusercontent.com'], apple: ['apple.com', 'icloud.com'], amazon: ['amazon.com', 'amazon.in', 'amazon.co.uk'], dropbox: ['dropbox.com'] };
    for (const [brand, official] of Object.entries(brands)) {
      if (host.includes(brand) && !official.some(domain => host === domain || host.endsWith(`.${domain}`))) add('brand-host', 'Possible brand impersonation', `${host} contains “${brand}” but is outside the recognized domains checked by this local rule. Verify the organization independently.`, 28);
    }
    if (/\.(exe|scr|bat|cmd|ps1|js|vbs|hta)(?:$|[?#])/i.test(`${url.pathname}${url.search}`)) add('executable', 'Executable download link', 'The link points to a script or executable file type often used in malicious attachments.', 24);
  }
  if (/\b(urgent|immediately|act now|within \d+ hours?|account (?:will be |is )?(?:suspended|locked|disabled)|final warning|last chance)\b/i.test(input)) add('urgency', 'Urgency or account pressure', 'The text pressures the recipient to act quickly or avoid losing access.', 16);
  if (/\b(?:verify|confirm|enter|provide|update|reset)\b[\s\S]{0,60}\b(?:password|credentials|credit card|bank details|account|seed phrase|one.time (?:password|code))\b/i.test(input)) add('credentials', 'Sensitive information request', 'The text asks for account verification or sensitive information. Confirm the request through a known channel.', 18);
  if (/\b(?:enable (?:macros|content)|disable (?:antivirus|security)|gift cards?|wire transfer|seed phrase)\b/i.test(input)) add('sensitive-action', 'High-risk requested action', 'The message mentions bypassing security, recovery secrets, gift cards or a wire transfer.', 23);
  const anchors = input.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const match of anchors) {
    const displayed = match[2].replace(/<[^>]*>/g, '').trim();
    const visibleUrl = displayed.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i)?.[0];
    if (!visibleUrl) continue;
    try {
      const visible = new URL(/^https?:/i.test(visibleUrl) ? visibleUrl : `https://${visibleUrl}`);
      const actual = new URL(match[1]);
      if (visible.hostname.toLowerCase() !== actual.hostname.toLowerCase()) add('display-mismatch', 'Displayed link differs from destination', `The visible link says ${visible.hostname}, but the destination is ${actual.hostname}.`, 32);
    } catch { /* Relative and malformed anchors cannot be compared reliably. */ }
  }
  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.weight, 0));
  const risk = score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low';
  return { risk, score, signals, urls: urls.map(url => url.href), summary: signals.length ? `${signals.length} local indicator${signals.length === 1 ? '' : 's'} found. Review the evidence before deciding whether to trust this message.` : 'No configured indicators found. This does not establish that the message or destination is safe.' };
}

/** Prefix spreadsheet formulas as text as well as escaping CSV delimiters. */
export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

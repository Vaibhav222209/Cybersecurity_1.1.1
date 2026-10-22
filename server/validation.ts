export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'A JSON object is required.');
  return value as Record<string, unknown>;
}

export function fields(body: Record<string, unknown>, allowed: string[]) {
  const unknown = Object.keys(body).filter(key => !allowed.includes(key));
  if (unknown.length) throw new ApiError(400, 'The request contains unsupported fields.');
}

export function text(value: unknown, name: string, min = 1, max = 200): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new ApiError(400, `${name} must be text between ${min} and ${max} characters.`);
  }
  return value.trim();
}

export function enumValue<T extends string>(value: unknown, name: string, options: readonly T[]): T {
  if (typeof value !== 'string' || !options.includes(value as T)) throw new ApiError(400, `${name} must be one of: ${options.join(', ')}.`);
  return value as T;
}

export function boolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new ApiError(400, `${name} must be a boolean.`);
  return value;
}

export function port(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65535) throw new ApiError(400, 'port must be an integer from 1 to 65535.');
  return value;
}

export function ipv4(value: unknown, name = 'IP address'): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)
    || value.split('.').some(octet => Number(octet) > 255)) throw new ApiError(400, `${name} must be a valid IPv4 address.`);
  return value;
}

/** Canonical addresses only; no hostnames, ports, CIDRs, brackets, or zone IDs. */
export function ipAddress(value: unknown, name = 'IP address'): string {
  if (typeof value !== 'string') throw new ApiError(400, `${name} must be a complete IPv4 or IPv6 address.`);
  const address = value.trim();
  const version = isIP(address);
  if (version === 4) return ipv4(address, name);
  if (version === 6 && !address.includes('%')) {
    try { return new URL(`http://[${address}]/`).hostname.slice(1, -1); }
    catch { /* Invalid literals never become network destinations. */ }
  }
  throw new ApiError(400, `${name} must be a complete IPv4 or IPv6 address without a port, CIDR, or zone identifier.`);
}

export function selector(value: unknown): string {
  if (typeof value === 'string' && value.toLowerCase() === 'any') return 'any';
  if (typeof value !== 'string') throw new ApiError(400, 'Rule selectors must be any, an IPv4 address, or an IPv4 CIDR.');
  const parts = value.split('/');
  ipv4(parts[0], 'Rule selector');
  if (parts.length === 1) return value;
  if (parts.length !== 2 || !/^(?:[0-9]|[12][0-9]|3[0-2])$/.test(parts[1])) throw new ApiError(400, 'CIDR prefix must be an integer from 0 to 32.');
  return value;
}
import { isIP } from 'node:net';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Check, CheckCheck, CircleAlert, Clipboard, Eye, EyeOff,
  Fingerprint, Globe, Info, KeyRound, LockKeyhole, RefreshCw, ShieldCheck,
  Sparkles, WandSparkles,
} from 'lucide-react';
import { evaluatePassword, generatePassword, inspectUrl, sha256 } from '../lib/security';
import './Tools.css';

export type ToolId = 'password' | 'generator' | 'hash' | 'url';

const tools = [
  { id: 'password' as const, title: 'Password check', description: 'Understand what makes a strong password.', icon: KeyRound },
  { id: 'generator' as const, title: 'Password generator', description: 'Create a strong, random password.', icon: WandSparkles },
  { id: 'hash' as const, title: 'SHA-256 hash', description: 'Turn any text into a digital fingerprint.', icon: Fingerprint },
  { id: 'url' as const, title: 'URL inspector', description: 'Spot warning signs in a suspicious link.', icon: Globe },
];

const characterLabels = {
  uppercase: { title: 'Uppercase letters', example: 'A–Z' },
  lowercase: { title: 'Lowercase letters', example: 'a–z' },
  numbers: { title: 'Numbers', example: '0–9' },
  symbols: { title: 'Symbols', example: '!@#$' },
};

export default function Tools({ initialTool = 'password', onActivity }: {
  initialTool?: ToolId;
  onActivity: (message: string) => void;
}) {
  const [activeTool, setActiveTool] = useState<ToolId>(initialTool);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordResult = useMemo(() => evaluatePassword(password), [password]);
  const [passwordChecked, setPasswordChecked] = useState(false);
  const [length, setLength] = useState(20);
  const [characters, setCharacters] = useState({ uppercase: true, lowercase: true, numbers: true, symbols: true });
  const [generated, setGenerated] = useState('');
  const [generatorError, setGeneratorError] = useState('');
  const [hashText, setHashText] = useState('');
  const [hashResult, setHashResult] = useState('');
  const [hashError, setHashError] = useState('');
  const [hashing, setHashing] = useState(false);
  const hashRequest = useRef(0);
  const [url, setUrl] = useState('');
  const [urlResult, setUrlResult] = useState<ReturnType<typeof inspectUrl> | null>(null);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => { setActiveTool(initialTool); }, [initialTool]);
  useEffect(() => { setCopyStatus(''); }, [activeTool]);
  useEffect(() => () => { hashRequest.current += 1; }, []);

  async function copy(value: string) {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setCopyStatus('Copied to clipboard.');
    } catch {
      setCopyStatus('Copy is unavailable here. Select the result and copy it manually.');
    }
  }

  function createPassword() {
    try {
      setGenerated(generatePassword(length, characters));
      setGeneratorError('');
      setCopyStatus('');
      onActivity('Generated a random password');
    } catch (error) {
      setGenerated('');
      setGeneratorError(error instanceof Error ? error.message : 'Unable to generate a password.');
    }
  }

  async function createHash() {
    const request = ++hashRequest.current;
    setHashing(true);
    setHashError('');
    setCopyStatus('');
    try {
      const result = await sha256(hashText);
      if (request !== hashRequest.current) return;
      setHashResult(result);
      onActivity('Created a SHA-256 fingerprint');
    } catch (error) {
      if (request !== hashRequest.current) return;
      setHashError(error instanceof Error ? error.message : 'Unable to create a hash.');
    } finally {
      if (request === hashRequest.current) setHashing(false);
    }
  }

  return (
    <section className="tools-page" aria-labelledby="tools-heading">
      <div className="tools-heading-row">
        <div>
          <span className="tools-eyebrow">SMALL TOOLS. STRONGER HABITS.</span>
          <h1 id="tools-heading">Your everyday security toolkit.</h1>
          <p>Explore, check, and create. Everything runs right in your browser.</p>
        </div>
        <span className="tools-private-badge"><ShieldCheck size={16} /> Browser only</span>
      </div>

      <div className="tools-selectors" role="group" aria-label="Choose a security tool">
        {tools.map(({ id, title, description, icon: Icon }) => (
          <button className={`tools-selector ${activeTool === id ? 'tools-selector-active' : ''}`}
            key={id} type="button" aria-pressed={activeTool === id} onClick={() => setActiveTool(id)}>
            <span className="tools-selector-icon"><Icon size={21} strokeWidth={1.7} /></span>
            <span className="tools-selector-copy"><strong>{title}</strong><span>{description}</span></span>
            <ArrowRight className="tools-selector-arrow" size={16} />
          </button>
        ))}
      </div>

      {activeTool === 'password' && (
        <div className="tool-workspace">
          <div className="tool-main-card">
            <div className="tool-card-heading"><span className="tool-icon"><KeyRound size={22} /></span><div><h2>Password strength check</h2><p>A small check before a better security habit.</p></div></div>
            <form onSubmit={(event) => { event.preventDefault(); if (password) { setPasswordChecked(true); onActivity('Checked password strength'); } }}>
              <label className="tool-label" htmlFor="password-input">Password to check</label>
              <div className="tool-password-field">
                <input id="password-input" type={showPassword ? 'text' : 'password'} value={password}
                  autoComplete="off" spellCheck={false} placeholder="Try an example password"
                  onChange={(event) => { setPassword(event.target.value); setPasswordChecked(false); }} />
                <button className="tool-icon-button" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              <p className="tool-input-hint"><LockKeyhole size={13} /> Never sent or saved. Use an example rather than a real account password.</p>
              <div className="tool-strength-bars" aria-hidden="true">{[0, 1, 2, 3].map((index) => <span key={index}
                className={password && index < passwordResult.score ? `tool-strength-filled tool-strength-${passwordResult.score}` : ''} />)}</div>
              <div className="tool-strength-label" aria-live="polite"><strong>{password ? passwordResult.label : 'Let’s see how it holds up'}</strong><span>{password ? `${passwordResult.score} / 4` : 'Enter a password to begin'}</span></div>
              <button className="tool-primary-button" type="submit" disabled={!password}><ShieldCheck size={17} /> Check password <ArrowRight size={16} /></button>
            </form>
            {passwordChecked && <p className="tool-status" role="status"><Check size={16} /> Check complete. Review the suggestions below.</p>}
            {password && <div className="tool-password-feedback"><h3>Ways to strengthen it</h3>{passwordResult.feedback.map((feedback) => <p key={feedback}><Sparkles size={15} />{feedback}</p>)}</div>}
          </div>
          <aside className="tool-side-card">
            <span className="tools-eyebrow">THE GOOD-PASSWORD CHECKLIST</span><h3>Length is your friend.</h3>
            <p>A unique password of at least 16 characters is a great place to start. A password manager can remember it for you.</p>
            <ul className="tool-checks">{passwordResult.checks.map((check) => <li key={check.label} className={password && check.passed ? 'tool-check-passed' : ''}><span>{password && check.passed ? <Check size={13} /> : <span className="tool-check-dot" />}</span>{check.label}</li>)}</ul>
            <div className="tool-note"><Info size={16} /><p>This is a basic heuristic, not a guarantee of security. Unique passwords and MFA matter too.</p></div>
          </aside>
        </div>
      )}

      {activeTool === 'generator' && (
        <div className="tool-workspace">
          <div className="tool-main-card">
            <div className="tool-card-heading"><span className="tool-icon"><WandSparkles size={22} /></span><div><h2>Make something hard to guess.</h2><p>A fresh password. Random by design.</p></div></div>
            <div className="tool-range-heading"><label className="tool-label" htmlFor="password-length">Password length</label><output htmlFor="password-length">{length}<span> characters</span></output></div>
            <input className="tool-range" id="password-length" type="range" min="8" max="64" value={length} onChange={(event) => setLength(Number(event.target.value))} />
            <div className="tool-range-labels"><span>8 characters</span><span>64 characters</span></div>
            <fieldset className="tool-character-options"><legend>Include characters</legend>{(Object.keys(characterLabels) as (keyof typeof characterLabels)[]).map((key) => <label className="tool-option" key={key}><input type="checkbox" checked={characters[key]} onChange={(event) => setCharacters((current) => ({ ...current, [key]: event.target.checked }))} /><span>{characterLabels[key].title}</span><code>{characterLabels[key].example}</code></label>)}</fieldset>
            <button className="tool-primary-button" type="button" onClick={createPassword}><RefreshCw size={17} /> {generated ? 'Generate another password' : 'Generate password'} <ArrowRight size={16} /></button>
            {generatorError && <p className="tool-error" role="alert">{generatorError}</p>}
            {generated && <div className="tool-generated-output"><span className="tool-label">Your generated password</span><div className="tool-copy-output"><code>{generated}</code><button className="tool-icon-button" type="button" aria-label="Copy generated password" onClick={() => void copy(generated)}><Clipboard size={18} /></button></div><p className="tool-input-hint">Save it in your password manager before leaving this page.</p></div>}
          </div>
          <aside className="tool-side-card"><span className="tool-side-illustration"><KeyRound size={44} strokeWidth={1.2} /></span><span className="tools-eyebrow">BUILT ON RANDOMNESS</span><h3>One account. One password.</h3><p>This generator uses your browser’s cryptographic random number generator. Each selected character type is included at least once.</p><div className="tool-note"><ShieldCheck size={16} /><p>Generated passwords stay in this page’s memory. We never save them to your activity history.</p></div></aside>
        </div>
      )}

      {activeTool === 'hash' && (
        <div className="tool-workspace">
          <div className="tool-main-card">
            <div className="tool-card-heading"><span className="tool-icon"><Fingerprint size={22} /></span><div><h2>A fingerprint for your text.</h2><p>Generate a SHA-256 hash in your browser.</p></div></div>
            <form onSubmit={(event) => { event.preventDefault(); void createHash(); }}>
              <label className="tool-label" htmlFor="hash-input">Text to hash</label>
              <textarea id="hash-input" rows={5} value={hashText} placeholder="Type or paste any text here…"
                spellCheck={false} onChange={(event) => { hashRequest.current += 1; setHashText(event.target.value); setHashResult(''); setHashError(''); setHashing(false); setCopyStatus(''); }} />
              <p className="tool-input-hint">Every character counts, including spaces and line breaks. Empty text is supported.</p>
              <button className="tool-primary-button" type="submit" disabled={hashing}><Fingerprint size={17} /> {hashing ? 'Creating fingerprint…' : 'Generate SHA-256 hash'} <ArrowRight size={16} /></button>
            </form>
            {hashError && <p className="tool-error" role="alert">{hashError}</p>}
            {hashResult && <div className="tool-generated-output" aria-live="polite"><span className="tool-label">SHA-256 · 256 bits · 64 hex characters</span><div className="tool-copy-output tool-hash-output"><code>{hashResult}</code><button className="tool-icon-button" type="button" aria-label="Copy SHA-256 hash" onClick={() => void copy(hashResult)}><Clipboard size={18} /></button></div></div>}
          </div>
          <aside className="tool-side-card"><span className="tool-side-illustration"><Fingerprint size={44} strokeWidth={1.2} /></span><span className="tools-eyebrow">A LITTLE CRYPTOGRAPHY</span><h3>A tiny change. A different hash.</h3><p>SHA-256 creates a fixed-size fingerprint. Change a single character and the output changes, making hashes useful for checking integrity.</p><div className="tool-note"><Info size={16} /><p>Hashing isn’t encryption. SHA-256 alone is also unsuitable for storing passwords; that needs a dedicated password-hashing algorithm.</p></div></aside>
        </div>
      )}

      {activeTool === 'url' && (
        <div className="tool-workspace">
          <div className="tool-main-card">
            <div className="tool-card-heading"><span className="tool-icon"><Globe size={22} /></span><div><h2>Look a little closer.</h2><p>Inspect a link’s structure before you trust it.</p></div></div>
            <form onSubmit={(event) => { event.preventDefault(); setUrlResult(inspectUrl(url)); onActivity('Inspected a link for warning signs'); }}>
              <label className="tool-label" htmlFor="url-input">Link to inspect</label>
              <input id="url-input" className="tool-text-input" type="text" value={url} spellCheck={false} autoComplete="off" placeholder="https://example.com/account" onChange={(event) => { setUrl(event.target.value); setUrlResult(null); }} />
              <p className="tool-input-hint"><LockKeyhole size={13} /> We inspect the text only. The website is never opened or contacted.</p>
              <button className="tool-primary-button" type="submit" disabled={!url.trim()}><Globe size={17} /> Inspect link <ArrowRight size={16} /></button>
            </form>
            {urlResult && <div className="tool-url-result" aria-live="polite">
              <div className={`tool-risk-banner tool-risk-${urlResult.valid ? urlResult.risk : 'high'}`}>{urlResult.valid && urlResult.risk === 'low' ? <ShieldCheck size={21} /> : <CircleAlert size={21} />}<div><strong>{!urlResult.valid ? 'This link could not be inspected' : urlResult.risk === 'low' ? 'No obvious structural warning signs' : urlResult.risk === 'medium' ? 'Take a closer look before continuing' : 'Several reasons to be cautious'}</strong>{urlResult.hostname && <span>{urlResult.hostname}</span>}</div></div>
              <div className="tool-findings">{urlResult.findings.map((finding, index) => <div className={`tool-finding tool-finding-${finding.severity}`} key={`${finding.title}-${index}`}>{finding.severity === 'info' ? <Info size={16} /> : <CircleAlert size={16} />}<div><strong>{finding.title}</strong><p>{finding.detail}</p></div></div>)}</div>
            </div>}
          </div>
          <aside className="tool-side-card"><span className="tool-side-illustration"><Globe size={44} strokeWidth={1.2} /></span><span className="tools-eyebrow">PAUSE BEFORE YOU CLICK</span><h3>A lock isn’t a promise.</h3><p>HTTPS protects the connection, but even a phishing website can use it. Verify the actual domain with a trusted source.</p><div className="tool-note"><Info size={16} /><p>This is a structural check, not a malware or reputation scan. A low-risk result does not establish that a website is safe.</p></div></aside>
        </div>
      )}
      {copyStatus && <p className="tool-copy-status" role="status"><CheckCheck size={16} />{copyStatus}</p>}
      <div className="tools-footer-note"><LockKeyhole size={14} /><span>Private by default. Tool inputs stay on this page and are never included in your saved progress.</span></div>
    </section>
  );
}

import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, ClipboardCheck, Database, FileCheck2, FileText, Fingerprint, Flag, Layers3, LoaderCircle, Radar, RotateCcw, Shield, ShieldCheck, Siren, Target, Trophy, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NistFunction, PageProps } from '../types';
import { api, errorMessage } from '../lib/api';
import { quizQuestions } from '../../shared/quiz';
import Modal from './Modal';
import './Governance.css';

const functions: { name: NistFunction; code: string; icon: LucideIcon; description: string; evidence: string }[] = [
  { name: 'Govern', code: 'GV', icon: Flag, description: 'Set context, ownership, and direction for cybersecurity risk.', evidence: 'Review workspace scope, asset ownership, and the response decision ledger. Organization-wide policies and accountable roles require evidence outside this demo.' },
  { name: 'Identify', code: 'ID', icon: Fingerprint, description: 'Understand the assets and risks that need your attention.', evidence: 'Use the asset inventory and alert evidence to review the workspace’s known assets and observed risks. Sample records are training context, not discovered infrastructure.' },
  { name: 'Protect', code: 'PR', icon: Shield, description: 'Reduce exposure with appropriate safeguards and access controls.', evidence: 'Review simulated firewall rules and asset service details. These records do not configure an operating-system firewall, identity provider, encryption, or access controls.' },
  { name: 'Detect', code: 'DE', icon: Radar, description: 'Find and analyze events that may signal an incident.', evidence: 'Review alerts, their supporting evidence, and imported event logs. Rule matches are investigation leads and need validation; they are not proof of compromise.' },
  { name: 'Respond', code: 'RS', icon: Siren, description: 'Coordinate decisions and contain the effects of an incident.', evidence: 'Review the incident response ledger and associated alert states. Workspace containment and isolation are simulations and do not change a remote system.' },
  { name: 'Recover', code: 'RC', icon: RotateCcw, description: 'Restore operations and communicate the recovery outcome.', evidence: 'Use exported case reports and the action ledger to document a recovery plan and handoff. Actual restoration, backup testing, and stakeholder communications happen outside this app.' },
];

export function NistPage({ state, refresh, notify, navigate }: PageProps) {
  const [selected, setSelected] = useState<NistFunction>('Govern');
  const [saving, setSaving] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const active = functions.find(entry => entry.name === selected)!;
  const controls = state.nistControls.filter(control => control.function === selected);
  const completed = state.nistControls.filter(control => control.done).length;
  const percentage = state.nistControls.length ? Math.round(completed / state.nistControls.length * 100) : 0;
  const completedActive = controls.filter(control => control.done).length;
  const Icon = active.icon;

  async function toggleControl(id: string, done: boolean) {
    setSaving(id);
    try {
      await api(`/nist/${encodeURIComponent(id)}`, { done });
      await refresh();
      notify(done ? `${id} marked as reviewed.` : `${id} returned to review.`);
    } catch (error) {
      notify(errorMessage(error), 'error');
    } finally {
      setSaving(null);
    }
  }

  const artifacts: { title: string; value: number; detail: string; icon: LucideIcon; page: Parameters<PageProps['navigate']>[0] }[] = [
    { title: 'Asset register', value: state.assets.length, detail: 'Inventory records', icon: Database, page: 'assets' },
    { title: 'Threat evidence', value: state.alerts.length, detail: 'Alerts to investigate', icon: Radar, page: 'intelligence' },
    { title: 'Event logs', value: state.logs.length, detail: 'Sample + imported events', icon: FileText, page: 'logs' },
    { title: 'Policy rules', value: state.rules.length, detail: 'Simulated firewall rules', icon: Shield, page: 'network' },
    { title: 'Response ledger', value: state.actions.length, detail: 'Recorded actions', icon: ClipboardCheck, page: 'response' },
  ];

  return <div className="gov-page">
    <div className="gov-page-head"><div><span className="gov-eyebrow">FRAMEWORK ALIGNMENT / NIST CSF 2.0</span><h1 className="page-title">Readiness, with a framework.</h1><p>A structured view of the controls you’ve reviewed, across all six NIST functions.</p></div><button className="btn secondary" onClick={() => setAboutOpen(true)}><CircleHelp size={16} />About this mapping</button></div>

    <section className="panel gov-readiness" aria-label="Control review progress"><span className="gov-readiness-icon"><ShieldCheck size={29} strokeWidth={1.5} /></span><div className="gov-readiness-copy"><span className="gov-eyebrow">YOUR READINESS REVIEW</span><h2>{completed}<span> / {state.nistControls.length} controls reviewed</span></h2><p>Self-attested progress. Mark a control only after checking its evidence.</p></div><div className="gov-readiness-progress"><div><strong>{percentage}%</strong><span>reviewed</span></div><div className="gov-progress-track" role="progressbar" aria-label="Controls reviewed" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={state.nistControls.length || 1}><span style={{ width: `${percentage}%` }} /></div></div><span className="gov-self-badge"><span />SELF-ATTESTED</span></section>

    <div className="gov-function-tabs" role="tablist" aria-label="NIST CSF functions">{functions.map(entry => {
      const FunctionIcon = entry.icon;
      const count = state.nistControls.filter(control => control.function === entry.name);
      const reviewed = count.filter(control => control.done).length;
      return <button key={entry.name} role="tab" id={`gov-tab-${entry.code}`} aria-selected={selected === entry.name} tabIndex={selected === entry.name ? 0 : -1} aria-controls={`gov-panel-${entry.code}`} className={selected === entry.name ? 'gov-function-tab is-active' : 'gov-function-tab'} onClick={() => setSelected(entry.name)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = functions.findIndex(item => item.name === selected);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? functions.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + functions.length) % functions.length;
        setSelected(functions[next].name);
        document.getElementById(`gov-tab-${functions[next].code}`)?.focus();
      }}><span className="gov-function-symbol"><FunctionIcon size={21} strokeWidth={1.6} /></span><span className="gov-function-label">{entry.name}<small>{entry.code} · {reviewed}/{count.length} reviewed</small></span><span className={`gov-function-indicator ${count.length > 0 && reviewed === count.length ? 'is-complete' : ''}`}>{count.length > 0 && reviewed === count.length ? <Check size={11} /> : <ChevronRight size={13} />}</span></button>;
    })}</div>

    <section className="panel gov-controls-panel" id={`gov-panel-${active.code}`} role="tabpanel" aria-labelledby={`gov-tab-${active.code}`}>
      <div className="gov-controls-head"><div className="gov-controls-name"><span className="gov-controls-icon"><Icon size={23} strokeWidth={1.5} /></span><div><span className="gov-eyebrow">{active.code} / {selected.toUpperCase()}</span><h2>{active.description}</h2></div></div><span className="gov-section-count">{completedActive}<span> / {controls.length} reviewed</span></span></div>
      <div className="gov-controls-list">{controls.length ? controls.map(control => <div className={`gov-control ${control.done ? 'is-done' : ''}`} key={control.id}>
        <label className="gov-control-checkbox"><input type="checkbox" aria-label={`Mark ${control.id} ${control.title} as reviewed`} checked={control.done} disabled={saving !== null} onChange={event => void toggleControl(control.id, event.target.checked)} /><span aria-hidden="true">{saving === control.id ? <LoaderCircle className="gov-spin" size={14} /> : control.done ? <Check size={14} /> : null}</span></label>
        <div className="gov-control-copy"><div className="gov-control-meta"><code>{control.id}</code><span>{control.category}</span></div><h3>{control.title}</h3><p>{control.description}</p></div>
        <span className={`gov-review-status ${control.done ? 'is-reviewed' : ''}`}>{saving === control.id ? 'Saving…' : control.done ? <><CheckCircle2 size={13} />Reviewed</> : 'Not reviewed'}</span>
      </div>) : <div className="gov-empty"><Layers3 size={28} /><p>No controls have been configured for this function.</p></div>}</div>
      <div className="gov-evidence-note"><FileCheck2 size={19} /><div><strong>What to review</strong><p>{active.evidence}</p></div></div>
    </section>

    <section className="gov-artifacts-section"><div className="gov-section-heading"><div><span className="gov-eyebrow">CONTEXT FOR YOUR REVIEW</span><h2>Workspace artifacts</h2></div><button className="gov-text-button" onClick={() => navigate('reports')}>Open case reports<ArrowUpRight size={15} /></button></div><div className="gov-artifacts">{artifacts.map(artifact => {
      const ArtifactIcon = artifact.icon;
      return <button className="panel gov-artifact" key={artifact.title} onClick={() => navigate(artifact.page)}><div><span className="gov-artifact-icon"><ArtifactIcon size={18} /></span><ArrowUpRight size={15} /></div><strong>{artifact.value}</strong><h3>{artifact.title}</h3><p>{artifact.detail}</p></button>;
    })}</div></section>

    <div className="gov-disclaimer"><CircleHelp size={16} /><p>This is a selected mapping to NIST CSF 2.0 outcomes. Review ticks are your declarations, not certification or proof that an organization has implemented the framework. Sample evidence and simulation actions retain their labels.</p></div>
    <div className="gov-creator">Made by <strong>Vaibhav Thakur</strong><span>AEGIS / Governance</span></div>

    {aboutOpen && <Modal title="How this NIST mapping works" onClose={() => setAboutOpen(false)}><div className="gov-about"><span className="gov-about-icon"><Layers3 size={29} strokeWidth={1.5} /></span><h3>A common language for security outcomes.</h3><p>NIST Cybersecurity Framework 2.0 organizes cybersecurity risk management into Govern, Identify, Protect, Detect, Respond, and Recover. AEGIS groups a small set of review controls under these six functions.</p><div className="gov-about-facts"><p><CheckCircle2 size={18} /><span><strong>Review is manual.</strong> A tick records your assessment in this local workspace. It does not verify an external control.</span></p><p><FileText size={18} /><span><strong>Evidence needs context.</strong> Alerts, asset records, event logs, and reports can inform a review. Sample data and simulation actions are not evidence of a deployed organization-wide control.</span></p><p><Shield size={18} /><span><strong>Scope stays clear.</strong> This app does not implement the entire CSF, perform a compliance audit, or issue a certification. See <code>docs/nist-mapping.md</code> for scope and limitations.</span></p></div><button className="btn primary" onClick={() => setAboutOpen(false)}>Back to readiness<ArrowRight size={15} /></button></div></Modal>}
  </div>;
}

interface QuizFeedback { score: number; total: number; correctAnswers: number[]; explanations: string[]; resultId: string; }

export function QuizPage({ state, refresh, notify, navigate }: PageProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => quizQuestions.map(() => null));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizFeedback | null>(null);
  const [error, setError] = useState('');
  const question = quizQuestions[questionIndex];
  const answeredCount = answers.filter(answer => answer !== null).length;
  const best = state.quizResults.reduce<number | null>((current, attempt) => attempt.total > 0 ? Math.max(current ?? 0, Math.round(attempt.score / attempt.total * 100)) : current, null);
  const complete = answeredCount === quizQuestions.length;

  function chooseAnswer(index: number) {
    setAnswers(previous => previous.map((answer, at) => at === questionIndex ? index : answer));
    setError('');
  }

  async function submit() {
    if (!complete || submitting) return;
    setSubmitting(true); setError('');
    try {
      const feedback = await api<QuizFeedback>('/quiz', { answers: answers as number[] });
      setResult(feedback);
      notify('Your knowledge check has been scored and saved.');
      try { await refresh(); }
      catch { notify('Your result was saved, but workspace refresh failed. Reload to update the attempt history.', 'error'); }
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message); notify(message, 'error');
    } finally { setSubmitting(false); }
  }

  function retry() {
    setQuestionIndex(0); setAnswers(quizQuestions.map(() => null)); setResult(null); setError('');
  }

  return <div className="quiz-page">
    <div className="gov-page-head"><div><span className="gov-eyebrow">KNOWLEDGE CHECK / SECURITY FUNDAMENTALS</span><h1 className="page-title">Sharpen your security instincts.</h1><p>Five focused questions. Practical knowledge you can put to work.</p></div><span className="quiz-local-badge"><BookOpen size={15} />SCORED BY YOUR LOCAL API</span></div>

    <div className="quiz-stats"><div className="panel quiz-stat"><span className="quiz-stat-icon"><Target size={19} /></span><div><span>Your best score</span><strong>{best === null ? '—' : `${best}%`}<small>{best === null ? 'No attempts yet' : 'Across saved attempts'}</small></strong></div></div><div className="panel quiz-stat"><span className="quiz-stat-icon quiz-stat-blue"><ClipboardCheck size={19} /></span><div><span>Saved attempts</span><strong>{state.quizResults.length}<small>In this workspace</small></strong></div></div><div className="panel quiz-stat"><span className="quiz-stat-icon quiz-stat-amber"><Layers3 size={19} /></span><div><span>Questions per check</span><strong>{quizQuestions.length}<small>One answer per question</small></strong></div></div></div>

    {!result ? <div className="quiz-layout"><section className="panel quiz-question-panel" aria-labelledby="quiz-question-heading"><div className="quiz-question-top"><span className="gov-eyebrow">QUESTION {String(questionIndex + 1).padStart(2, '0')} / {String(quizQuestions.length).padStart(2, '0')}</span><span className="quiz-topic-badge">{question.topic}</span></div><div className="quiz-progress-track" aria-label={`${answeredCount} of ${quizQuestions.length} answered`}>{quizQuestions.map((entry, index) => <span key={entry.id} className={`${answers[index] !== null ? 'is-answered' : ''} ${questionIndex === index ? 'is-current' : ''}`} />)}</div><h2 id="quiz-question-heading">{question.question}</h2><p className="quiz-select-hint">Choose the answer that best fits.</p>
      <fieldset className="quiz-options"><legend className="quiz-sr-only">Answer choices</legend>{question.options.map((option, index) => <label className={`quiz-option ${answers[questionIndex] === index ? 'is-selected' : ''}`} key={`${question.id}-${index}`}><input type="radio" name={question.id} value={index} checked={answers[questionIndex] === index} disabled={submitting} onChange={() => chooseAnswer(index)} /><span className="quiz-option-letter">{String.fromCharCode(65 + index)}</span><span className="quiz-option-copy">{option}</span><span className="quiz-option-indicator">{answers[questionIndex] === index ? <Check size={13} /> : null}</span></label>)}</fieldset>
      {error && <p className="quiz-error" role="alert">{error}</p>}
      <div className="quiz-question-bottom"><button className="btn secondary" disabled={questionIndex === 0 || submitting} onClick={() => setQuestionIndex(index => index - 1)}><ArrowLeft size={15} />Previous</button><span>{answeredCount} of {quizQuestions.length} answered</span>{questionIndex < quizQuestions.length - 1 ? <button className="btn primary" disabled={answers[questionIndex] === null || submitting} onClick={() => setQuestionIndex(index => index + 1)}>Next question<ArrowRight size={15} /></button> : <button className="btn primary" disabled={!complete || submitting} onClick={() => void submit()}>{submitting ? <LoaderCircle className="gov-spin" size={15} /> : <FileCheck2 size={15} />}{submitting ? 'Scoring…' : 'Submit answers'}</button>}</div>
    </section><aside className="quiz-sidebar"><div className="panel quiz-topics-card"><span className="gov-eyebrow">YOUR CHECKPOINTS</span><h2>Five topics.<br />A stronger foundation.</h2><div className="quiz-topic-list">{quizQuestions.map((entry, index) => <button key={entry.id} className={questionIndex === index ? 'is-current' : ''} aria-current={questionIndex === index ? 'step' : undefined} disabled={submitting} onClick={() => setQuestionIndex(index)}><span className={`quiz-topic-number ${answers[index] !== null ? 'is-answered' : ''}`}>{answers[index] !== null ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span><span>{entry.topic}</span><ChevronRight size={13} /></button>)}</div></div><div className="quiz-note"><span><CircleHelp size={20} /></span><div><strong>Practice with purpose.</strong><p>Review your reasoning, then submit all five answers. Your local API returns the score and an explanation for every question.</p></div></div></aside></div>
      : <section className="quiz-result-area" aria-labelledby="quiz-result-heading"><div className="panel quiz-result-summary"><div className="quiz-result-symbol"><Trophy size={34} strokeWidth={1.5} /></div><div className="quiz-result-copy"><span className="gov-eyebrow">KNOWLEDGE CHECK COMPLETE</span><h2 id="quiz-result-heading">{result.score === result.total ? 'Sharp instincts. Solid foundations.' : 'Every question builds awareness.'}</h2><p>Your answers were scored by the local AEGIS API and this attempt has been saved.</p><span className="quiz-result-id mono">ATTEMPT / {result.resultId}</span></div><div className="quiz-result-score"><strong>{result.score}<span>/{result.total}</span></strong><span>answers correct</span></div></div><div className="gov-section-heading quiz-review-heading"><div><span className="gov-eyebrow">UNDERSTAND THE WHY</span><h2>Your answer review</h2></div><button className="btn secondary" onClick={retry}><RotateCcw size={15} />Try again</button></div><div className="quiz-result-list">{quizQuestions.map((entry, index) => {
        const correct = answers[index] === result.correctAnswers[index];
        return <article className="panel quiz-review-card" key={entry.id}><div className="quiz-review-heading-row"><span className={`quiz-review-indicator ${correct ? 'is-correct' : ''}`}>{correct ? <Check size={15} /> : <X size={15} />}</span><span className="gov-eyebrow">QUESTION {String(index + 1).padStart(2, '0')} / {entry.topic}</span><span className={correct ? 'quiz-verdict is-correct' : 'quiz-verdict'}>{correct ? 'Correct' : 'Review this one'}</span></div><h3>{entry.question}</h3><div className="quiz-answer-review"><p><span>Your answer</span>{entry.options[answers[index] ?? -1] ?? 'No answer recorded'}</p>{!correct && <p className="quiz-correct-answer"><span>Correct answer</span>{entry.options[result.correctAnswers[index]] ?? 'See explanation below'}</p>}</div><div className="quiz-explanation"><BookOpen size={16} /><p>{result.explanations[index]}</p></div></article>;
      })}</div><div className="quiz-result-actions"><button className="btn secondary" onClick={retry}><RotateCcw size={15} />Take another attempt</button><button className="btn primary" onClick={() => navigate('nist')}>Review NIST readiness<ArrowRight size={15} /></button></div></section>}
    <div className="gov-creator">Made by <strong>Vaibhav Thakur</strong><span>AEGIS / Knowledge</span></div>
  </div>;
}

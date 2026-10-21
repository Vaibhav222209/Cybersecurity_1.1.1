import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, Fingerprint, Globe, GraduationCap, Hash, KeyRound, LayoutDashboard, ListChecks, LockKeyhole, Mail, Menu, Network, Search, Settings2, ShieldCheck, Sparkles, Target, Trash2, TriangleAlert, Wrench, X } from 'lucide-react';
import Tools from './components/Tools';
import type { ToolId } from './components/Tools';
import LessonDialog from './components/LessonDialog';
import Modal from './components/Modal';
import { checklistItems, modules } from './data/learning';
import type { LearningModule } from './data/learning';
import { addActivity, emptyProgress, parseProgress, STORAGE_KEY } from './lib/progress';
import type { Progress } from './lib/progress';

type Page = 'overview' | 'tools' | 'learn' | 'checklist';
const pages: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'tools', label: 'Security tools', icon: Wrench },
  { id: 'learn', label: 'Learning path', icon: BookOpen },
  { id: 'checklist', label: 'Security checklist', icon: ListChecks },
];
const moduleIcons: Record<LearningModule['icon'], LucideIcon> = { key: KeyRound, mail: Mail, network: Network, shield: ShieldCheck, globe: Globe, alert: TriangleAlert };
const toolItems: { id: ToolId; title: string; description: string; icon: LucideIcon; color: string }[] = [
  { id: 'password', title: 'Password checker', description: 'Understand what makes a password stronger.', icon: LockKeyhole, color: '#edf2e1' },
  { id: 'generator', title: 'Password generator', description: 'Create a strong, unique password.', icon: KeyRound, color: '#eeeafa' },
  { id: 'hash', title: 'SHA-256 calculator', description: 'Turn text into a digital fingerprint.', icon: Hash, color: '#e5eef8' },
  { id: 'url', title: 'URL inspector', description: 'Look for warning signs in a link.', icon: Globe, color: '#faeedd' },
];
const getPage = (): Page => {
  const page = window.location.hash.replace(/^#\/?/, '');
  return pages.some(entry => entry.id === page) ? page as Page : 'overview';
};

export default function App() {
  const [page, setPage] = useState<Page>(getPage);
  const [navOpen, setNavOpen] = useState(false);
  const [mobileLayout, setMobileLayout] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [progress, setProgress] = useState<Progress>(() => {
    try { return parseProgress(localStorage.getItem(STORAGE_KEY), modules.map(entry => entry.id), checklistItems.map(entry => entry.id)); }
    catch { return emptyProgress(); }
  });
  const [storageError, setStorageError] = useState(false);
  const [activeModule, setActiveModule] = useState<LearningModule | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolId>('password');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('All modules');
  const [checklistFilter, setChecklistFilter] = useState('All tasks');

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const handler = () => setMobileLayout(media.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);
  useEffect(() => {
    const handler = () => { setPage(getPage()); setNavOpen(false); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [progress]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable && !document.querySelector('dialog[open]')) {
        event.preventDefault(); setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const navigate = (nextPage: Page) => { setPage(nextPage); window.location.hash = `/${nextPage}`; setNavOpen(false); window.scrollTo({ top: 0 }); };
  const openTool = (tool: ToolId) => { setSelectedTool(tool); navigate('tools'); };
  const logActivity = (text: string) => setProgress(previous => addActivity(previous, text));
  const nextModule = modules.find(module => !progress.completedModules.includes(module.id)) ?? modules[0];
  const checked = progress.checkedItems.length;
  const checklistPercentage = Math.round(checked / checklistItems.length * 100);
  const modulePercentage = Math.round(progress.completedModules.length / modules.length * 100);
  const scores = Object.values(progress.quizScores);
  const bestScore = scores.length ? `${Math.round(Math.max(...scores) / 3 * 100)}%` : '—';

  const toggleChecklist = (id: string) => {
    setProgress(previous => {
      const exists = previous.checkedItems.includes(id);
      const updated = { ...previous, checkedItems: exists ? previous.checkedItems.filter(item => item !== id) : [...previous.checkedItems, id] };
      return exists ? updated : addActivity(updated, `Completed: ${checklistItems.find(item => item.id === id)?.title ?? 'Security task'}`);
    });
  };
  const recordResult = (module: LearningModule, score: number) => {
    setProgress(previous => addActivity({
      ...previous,
      quizScores: { ...previous.quizScores, [module.id]: Math.max(previous.quizScores[module.id] ?? 0, score) },
      completedModules: score >= 2 ? [...new Set([...previous.completedModules, module.id])] : previous.completedModules,
    }, `${score >= 2 ? 'Completed' : 'Practiced'} ${module.title} · ${score}/3 correct`));
  };
  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'cipher-progress.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setToast('Your progress has been exported.');
  };
  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return [
      ...modules.map(module => ({ key: module.id, title: module.title, type: 'Learning module', icon: moduleIcons[module.icon], action: () => { setActiveModule(module); setSearchOpen(false); } })),
      ...toolItems.map(tool => ({ key: tool.id, title: tool.title, type: 'Security tool', icon: tool.icon, action: () => { openTool(tool.id); setSearchOpen(false); } })),
      { key: 'checklist', title: 'Personal security checklist', type: 'Your workspace', icon: ListChecks, action: () => { navigate('checklist'); setSearchOpen(false); } },
    ].filter(entry => `${entry.title} ${entry.type}`.toLowerCase().includes(needle));
    // These actions use only stable state setters and the selected result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); document.getElementById('main-content')?.scrollIntoView(); }}>Skip to content</a>
    {navOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
    <aside className={`sidebar ${navOpen ? 'is-open' : ''}`} inert={mobileLayout && !navOpen}>
      <a className="brand" href="#/overview" onClick={() => setNavOpen(false)} aria-label="Cipher home"><span className="brand-icon"><ShieldCheck size={27} strokeWidth={1.7} /></span><span>cipher<span className="brand-dot">.</span></span></a>
      <div className="workspace-label"><span className="workspace-square"><Fingerprint size={17} /></span><div>Personal workspace<small>Learn. Practice. Protect.</small></div><span className="workspace-status" /></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Main navigation">{pages.map(({ id, label, icon: Icon }) => <a href={`#/${id}`} key={id} className={`nav-item ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => setNavOpen(false)}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{page === id && <span className="active-dot" />}{id === 'tools' && page !== id && <span className="nav-count">4</span>}</a>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Sparkles size={20} /></span><h3>Security is a habit.</h3><p>A few minutes today.<br />A safer digital life tomorrow.</p><button onClick={() => setActiveModule(nextModule)}>Learn something new<ArrowUpRight size={16} /></button></div>
        <button className="nav-item settings-nav" onClick={() => { setConfirmReset(false); setSettingsOpen(true); }}><Settings2 size={19} strokeWidth={1.7} />Workspace settings</button>
        <div className="sidebar-footer"><span className="local-dot" />Private by design<span>v1.0</span></div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Menu size={21} /></button><span className="breadcrumb">Workspace<ChevronRight size={13} /><strong>{pages.find(entry => entry.id === page)?.label}</strong></span></div>
        <div className="topbar-actions"><button className="search-trigger" onClick={() => { setSearch(''); setSearchOpen(true); }}><Search size={16} /><span>Search workspace</span><kbd>/</kbd></button><span className="local-badge"><span className="local-dot" />Local workspace</span><button className="icon-button help-button" aria-label="About Cipher" onClick={() => setHelpOpen(true)}><CircleHelp size={19} /></button><span className="avatar" title="Your personal workspace">Y</span></div>
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>
        {storageError && <div className="storage-warning" role="alert">Browser storage is unavailable. You can use all tools, but progress will last only for this session.</div>}
        {page === 'overview' && <>
          <div className="page-heading"><div><span className="eyebrow">STAY CURIOUS. STAY SECURE.</span><h1>Your security starts here<span className="title-dot">.</span></h1><p>A little knowledge goes a long way. Let’s build safer habits, together.</p></div><span className="heading-tag"><span className="local-dot" />Your personal learning space</span></div>
          <section className="hero-card" aria-labelledby="hero-title"><div className="hero-copy"><span className="hero-eyebrow"><span />A STRONGER DIGITAL YOU</span><h2 id="hero-title">Build your instincts.<br />Strengthen your security.</h2><p>Understand the risks. Learn the essentials.<br className="desktop-break" /> Take control of your everyday digital life.</p><div className="hero-actions"><button className="button button-dark" onClick={() => setActiveModule(nextModule)}>{progress.completedModules.length ? 'Continue learning' : 'Start your learning path'}<ArrowUpRight size={17} /></button><button className="button button-ghost" onClick={() => navigate('tools')}>Explore tools<ArrowRight size={16} /></button></div><span className="hero-caption"><ShieldCheck size={13} />Practical skills. No experience needed.</span></div>
            <div className="hero-visual" aria-hidden="true"><div className="orbit orbit-outer" /><div className="orbit orbit-inner" /><div className="orbit-dot dot-one" /><div className="orbit-dot dot-two" /><div className="shield-glow" /><div className="hero-shield"><ShieldCheck size={91} strokeWidth={1.1} /></div><div className="floating-tag tag-one"><span className="floating-icon"><LockKeyhole size={17} /></span>Better habits<Check size={13} /></div><div className="floating-tag tag-two"><span className="floating-icon"><BookOpen size={16} /></span>Practical knowledge</div><span className="visual-cross cross-one">+</span><span className="visual-cross cross-two">+</span></div>
          </section>

          <section className="stats-grid" aria-label="Your progress at a glance">
            <Stat icon={GraduationCap} label="Modules completed" value={`${progress.completedModules.length}`} total={` / ${modules.length}`} note={progress.completedModules.length ? `${modulePercentage}% of your learning path` : 'Your next skill is waiting'} color="green" />
            <Stat icon={ShieldCheck} label="Security checklist" value={`${checked}`} total={` / ${checklistItems.length}`} note={checked ? `${checklistPercentage}% of tasks checked off` : 'Small steps, lasting protection'} color="purple" />
            <Stat icon={Target} label="Best quiz score" value={bestScore} note={scores.length ? 'Practice makes progress' : 'Take your first knowledge check'} color="orange" />
            <Stat icon={Wrench} label="Tools at your fingertips" value="4" note="Private. Practical. Ready to use." color="blue" />
          </section>

          <div className="dashboard-grid"><section className="learning-section"><SectionHeading eyebrow="ONE SKILL AT A TIME" title={progress.completedModules.length === modules.length ? 'Keep your knowledge fresh' : 'Your next steps'} action="View learning path" onAction={() => navigate('learn')} /><div className="featured-modules">{[...modules.filter(module => !progress.completedModules.includes(module.id)), ...modules.filter(module => progress.completedModules.includes(module.id))].slice(0, 2).map((module, index) => <ModuleCard key={module.id} module={module} completed={progress.completedModules.includes(module.id)} onOpen={() => setActiveModule(module)} index={index} />)}</div></section>
            <section className="habits-card"><div className="habits-title"><span className="eyebrow">MAKE IT A HABIT</span><span className="small-tag">Your checklist</span></div><div className="habits-overview"><div><h2>Little steps.<br />Stronger security.</h2><p>{checked === checklistItems.length ? 'You’ve checked off every task.' : 'Good habits start with one action.'}</p></div><ProgressRing value={checklistPercentage} /></div><div className="mini-checklist">{checklistItems.slice(0, 3).map(item => <label key={item.id}><input type="checkbox" checked={progress.checkedItems.includes(item.id)} onChange={() => toggleChecklist(item.id)} /><span>{item.title}</span></label>)}</div><button className="text-link habits-link" onClick={() => navigate('checklist')}>Open your checklist<ArrowRight size={16} /></button></section></div>

          <section className="toolkit-section"><SectionHeading eyebrow="BUILT FOR EVERYDAY USE" title="A few tools. A little peace of mind." action="Explore all tools" onAction={() => navigate('tools')} /><div className="quick-tools">{toolItems.map(tool => <button className="quick-tool" key={tool.id} onClick={() => openTool(tool.id)}><span className="tile-icon" style={{ background: tool.color }}><tool.icon size={21} strokeWidth={1.7} /></span><ArrowUpRight className="tool-arrow" size={17} /><h3>{tool.title}</h3><p>{tool.description}</p></button>)}</div></section>

          <section className="activity-section"><div className="activity-heading"><span className="activity-heading-icon"><Activity size={17} /></span><h2>Recent activity</h2><span className="small-tag">Stored on this device</span></div>{progress.activities.length ? <ul className="activity-list">{progress.activities.slice(0, 4).map(activity => <li key={activity.id}><span className="activity-dot" /><span>{activity.text}</span><time dateTime={new Date(activity.time).toISOString()}>{relativeTime(activity.time)}</time></li>)}</ul> : <div className="empty-activity"><span className="empty-icon"><Fingerprint size={24} strokeWidth={1.3} /></span><div><strong>A fresh start, full of possibilities.</strong><p>Finish a quiz, check off a task, or try a tool. Your progress will appear here.</p></div><ArrowUpRight size={19} /></div>}</section>
        </>}

        {page === 'tools' && <Tools key={selectedTool} initialTool={selectedTool} onActivity={logActivity} />}

        {page === 'learn' && <><div className="page-heading"><div><span className="eyebrow">KNOWLEDGE IS YOUR FIRST DEFENSE</span><h1>Learn the habits that matter<span className="title-dot">.</span></h1><p>Bite-sized lessons. Real-world knowledge. A safer digital life.</p></div><span className="heading-tag"><GraduationCap size={16} />6 focused modules</span></div><section className="learning-progress"><div className="learning-progress-icon"><BookOpen size={25} /></div><div><h2>Your learning journey</h2><p>{progress.completedModules.length === modules.length ? 'All modules completed. Come back anytime for a refresh.' : 'Read each module and pass its 3-question quiz to track your progress.'}</p></div><div className="learning-progress-end"><strong>{progress.completedModules.length}<span> / {modules.length} complete</span></strong><div className="progress-bar"><span style={{ width: `${modulePercentage}%` }} /></div></div></section><div className="filter-row"><div className="filter-tabs" aria-label="Filter modules">{['All modules', 'Beginner', 'Intermediate', 'Completed'].map(value => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div><span className="muted small">Learn at your own pace</span></div><div className="all-modules">{modules.filter(module => filter === 'All modules' || (filter === 'Completed' ? progress.completedModules.includes(module.id) : module.level === filter)).map((module, index) => <ModuleCard key={module.id} module={module} completed={progress.completedModules.includes(module.id)} onOpen={() => setActiveModule(module)} index={index} />)}</div>{filter === 'Completed' && !progress.completedModules.length && <div className="large-empty"><GraduationCap size={36} strokeWidth={1.3} /><h2>Your first milestone is ahead.</h2><p>Complete a module and it will appear here.</p><button className="button button-dark" onClick={() => { setFilter('All modules'); setActiveModule(nextModule); }}>Start a module<ArrowRight size={16} /></button></div>}</>}

        {page === 'checklist' && <><div className="page-heading"><div><span className="eyebrow">TURN KNOWLEDGE INTO ACTION</span><h1>Small steps. Stronger security<span className="title-dot">.</span></h1><p>A practical checklist for your accounts, devices, and everyday digital life.</p></div><span className="heading-tag"><ListChecks size={16} />10 everyday actions</span></div><section className="checklist-summary"><ProgressRing value={checklistPercentage} /><div><h2>{checked === checklistItems.length ? 'You’ve built a solid foundation.' : 'A safer digital life, one task at a time.'}</h2><p><strong>{checked} of {checklistItems.length} tasks complete.</strong> Check off each action after you’ve done it.</p><span className="muted small">Your progress reflects the tasks you mark complete.</span></div><span className="summary-spark"><Sparkles size={30} strokeWidth={1.2} /></span></section><div className="filter-row"><div className="filter-tabs" aria-label="Filter checklist">{['All tasks', 'Accounts', 'Devices', 'Network', 'Recovery'].map(value => <button key={value} aria-pressed={checklistFilter === value} className={checklistFilter === value ? 'selected' : ''} onClick={() => setChecklistFilter(value)}>{value}</button>)}</div></div><div className="checklist-items">{checklistItems.filter(item => checklistFilter === 'All tasks' || item.category === checklistFilter).map(item => <label className={`checklist-item ${progress.checkedItems.includes(item.id) ? 'is-checked' : ''}`} key={item.id}><input type="checkbox" checked={progress.checkedItems.includes(item.id)} onChange={() => toggleChecklist(item.id)} /><div><h3>{item.title}</h3><p>{item.description}</p></div><span className="category-tag">{item.category}</span></label>)}</div><div className="privacy-note"><ShieldCheck size={17} /><span>Your checklist stays in this browser. Review it regularly as your digital life changes.</span></div></>}
        <footer className="main-footer"><span><ShieldCheck size={14} />A little more aware. A lot more secure.</span><span>Made for your everyday digital life<span className="footer-dot">·</span>Cipher © {new Date().getFullYear()}</span></footer>
      </main>
    </div>

    {activeModule && <LessonDialog key={activeModule.id} module={activeModule} onClose={() => setActiveModule(null)} onResult={recordResult} />}
    {searchOpen && <Modal title="Find your next step" onClose={() => setSearchOpen(false)}><div className="search-box"><Search size={19} /><input aria-label="Search modules and tools" placeholder="Search modules, tools, and more…" autoFocus value={search} onChange={event => setSearch(event.target.value)} />{search && <button className="icon-button" aria-label="Clear search" onClick={() => setSearch('')}><X size={15} /></button>}</div><div className="search-results">{results.length ? results.map(({ key, title, type, icon: Icon, action }) => <button key={key} onClick={action}><span className="search-result-icon"><Icon size={19} /></span><span><strong>{title}</strong><small>{type}</small></span><ArrowUpRight size={17} /></button>) : <div className="search-empty"><Search size={25} /><p>No matches for “{search}”.</p><span>Try “password”, “phishing”, or “checklist”.</span></div>}</div></Modal>}
    {settingsOpen && <Modal title="Workspace settings" onClose={() => setSettingsOpen(false)}><div className="settings-body"><div className="settings-intro"><Fingerprint size={27} /><div><h3>Your workspace. Your data.</h3><p>Learning progress and checklist actions are stored only in this browser. Passwords, text, and URLs entered into tools are never saved.</p></div></div><div className="setting-row"><div><h3>Export your progress</h3><p>Download a JSON copy of your learning history and checklist.</p></div><button className="button button-light" onClick={exportProgress}><ArrowDownToLine size={16} />Export</button></div><div className="setting-row"><div><h3>Start fresh</h3><p>Clear saved learning progress, quiz scores, and activity on this device.</p></div><button className="button button-danger" onClick={() => setConfirmReset(true)}><Trash2 size={16} />Reset</button></div>{confirmReset && <div className="reset-confirm" role="alert"><strong>Clear all of your saved progress?</strong><p>This action cannot be undone. Export a copy first if you want to keep a record.</p><div><button className="button button-light" onClick={() => setConfirmReset(false)}>Keep my progress</button><button className="button button-danger" onClick={() => { setProgress(emptyProgress()); setConfirmReset(false); setToast('Your workspace has a fresh start.'); }}>Yes, clear progress</button></div></div>}</div></Modal>}
    {helpOpen && <Modal title="A little about Cipher" onClose={() => setHelpOpen(false)}><div className="about-body"><span className="about-logo"><ShieldCheck size={40} strokeWidth={1.4} /></span><h3>Confidence starts with understanding.</h3><p>Cipher is your personal cybersecurity learning workspace. Learn everyday security skills, practice with local tools, and build healthier digital habits.</p><div className="about-facts"><p><CheckCircle2 size={18} /><span><strong>Browser-based tools.</strong> Passwords, hashes, and URL analysis are processed on your device without external requests.</span></p><p><CheckCircle2 size={18} /><span><strong>Progress that stays with you.</strong> Lessons, quiz results, and checklist progress are saved in this browser.</span></p><p><CheckCircle2 size={18} /><span><strong>Honest learning.</strong> Password scores and link findings are educational signals. They do not guarantee a password or website is safe.</span></p></div><button className="button button-dark" onClick={() => setHelpOpen(false)}>Got it<Check size={16} /></button></div></Modal>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}</div>}
  </div>;
}

function Stat({ icon: Icon, label, value, total, note, color }: { icon: LucideIcon; label: string; value: string; total?: string; note: string; color: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${color}`}><Icon size={18} strokeWidth={1.6} /></span></div><div className="stat-value">{value}<span>{total}</span></div><p>{note}</p></article>;
}

function SectionHeading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action: string; onAction: () => void }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="text-link" onClick={onAction}>{action}<ArrowUpRight size={16} /></button></div>;
}

function ModuleCard({ module, completed, onOpen, index }: { module: LearningModule; completed: boolean; onOpen: () => void; index: number }) {
  const Icon = moduleIcons[module.icon];
  return <button className={`module-card ${completed ? 'module-complete' : ''}`} onClick={onOpen}><div className="module-card-top"><span className="module-tile" style={{ background: module.color }}><Icon size={25} strokeWidth={1.6} /></span><span className={`module-level ${completed ? 'level-complete' : ''}`}>{completed ? <><CheckCircle2 size={12} />Completed</> : module.level}</span></div><span className="module-category">{module.category}</span><h3>{module.title}</h3><p>{module.description}</p><div className="module-card-bottom"><span><Clock3 size={13} />{module.duration} min<span className="module-separator">·</span>3 lessons</span><span className="module-start">{completed ? 'Review' : 'Start learning'}<ArrowRight size={15} /></span></div><span className="module-watermark" aria-hidden="true">0{index + 1}</span></button>;
}

function ProgressRing({ value }: { value: number }) {
  const radius = 32; const circumference = 2 * Math.PI * radius;
  return <div className="progress-ring" aria-label={`${value}% complete`}><svg viewBox="0 0 76 76" aria-hidden="true"><circle className="ring-track" cx="38" cy="38" r={radius} /><circle className="ring-value" cx="38" cy="38" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} /></svg><span>{value}<small>%</small></span></div>;
}

function relativeTime(time: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(time);
}

import { StrictMode, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { api, type Project, type User } from './api.js';
import './styles.css';

interface LoginProps { onLogin: (user: User) => void }
interface ShellProps { user: User; onLogout: () => void }

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try { onLogin((await api.login(username, password)).user); }
    catch (reason) { setError(errorMessage(reason, 'Unable to sign in.')); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><section className="login-card"><div className="mark">F<span>³</span></div><p className="eyebrow">CONTROL PLANE</p><h1>Welcome back.</h1><p className="muted">Sign in to manage your feature flags.</p><form onSubmit={submit}><label>Username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>Password<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="error" role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <span>→</span></button></form></section></main>;
}

export function Shell({ user, onLogout }: ShellProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  async function loadProjects() {
    setLoading(true); setLoadError('');
    try { setProjects((await api.projects()).data); }
    catch (reason) { setLoadError(errorMessage(reason, 'Unable to load projects.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadProjects(); }, []);
  async function createProject(event: FormEvent) {
    event.preventDefault(); setCreateError(''); setCreating(true);
    try { const project = await api.createProject(name.trim()); setProjects((current) => [...current, project].sort((a, b) => a.name.localeCompare(b.name))); setSelected(project); setName(''); }
    catch (reason) { setCreateError(errorMessage(reason, 'Unable to create project.')); }
    finally { setCreating(false); }
  }
  function selectProject(id: string) {
    setSelected(projects.find((project) => project.id === id) ?? null);
  }

  return <div className="app"><aside className={mobileNav ? 'sidebar open' : 'sidebar'}><div className="brand"><div className="mark small">F<span>³</span></div><strong>flagflagflag</strong></div><nav><p className="nav-label">WORKSPACE</p><button className="nav-item active" onClick={() => { setSelected(null); setMobileNav(false); }}>▦ <span>Projects</span></button></nav><div className="sidebar-bottom"><div className="user"><div className="avatar">{(user.name || user.username)[0].toUpperCase()}</div><div><strong>{user.name || user.username}</strong><small>{user.email}</small></div></div><button className="logout" onClick={() => void api.logout().finally(onLogout)}>Sign out</button></div></aside><button className="mobile-toggle" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}>☰</button><main className="content"><header><div><p className="breadcrumbs">Workspace <span>/</span> {selected ? selected.name : 'Projects'}</p><h2>{selected ? selected.name : 'Projects'}</h2></div><div className="header-actions">{selected && <label className="switcher-label">Switch project<select aria-label="Switch project" value={selected.id} onChange={(event) => selectProject(event.target.value)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>}{selected && <button className="back" onClick={() => setSelected(null)}>← All projects</button>}</div></header>{selected ? <ProjectOverview project={selected} /> : <><div className="intro"><div><p className="eyebrow">WORKSPACE</p><h1>Your projects</h1><p className="muted">Create and manage the places where your flags live.</p></div><form className="create-form" onSubmit={createProject}><label className="sr-only" htmlFor="project-name">Project name</label><input id="project-name" placeholder="New project name" value={name} onChange={(event) => setName(event.target.value)} required minLength={1} /><button disabled={creating}>{creating ? 'Creating…' : 'Create project'} <span>＋</span></button></form></div>{createError && <p className="error banner" role="alert">{createError}</p>}{loading ? <div className="state"><div className="spinner" />Loading projects…</div> : loadError ? <div className="state"><p className="error">{loadError}</p><button className="secondary" onClick={() => void loadProjects()}>Try again</button></div> : projects.length === 0 ? <div className="empty"><div className="empty-icon">＋</div><h3>No projects yet</h3><p className="muted">Create your first project above to get started.</p></div> : <div className="project-grid">{projects.map((project) => <button className="project-card" key={project.id} onClick={() => setSelected(project)}><div className="project-icon">{project.name[0].toUpperCase()}</div><div><h3>{project.name}</h3><p className="muted">Open project <span>↗</span></p></div><span className="chevron">›</span></button>)}</div>}</>}</main></div>;
}
function ProjectOverview({ project }: { project: Project }) { return <section className="project-overview"><div className="hero-icon">{project.name[0].toUpperCase()}</div><p className="eyebrow">PROJECT</p><h1>{project.name}</h1><p className="muted">Project configuration and feature flags will appear here.</p><div className="coming"><span>✦</span><div><strong>Project overview</strong><p className="muted">Use the navigation to configure environments and flags.</p></div></div></section>; }
export function App() { const [user, setUser] = useState<User | null>(null); const [checking, setChecking] = useState(true); useEffect(() => { void api.me().then(setUser).catch(() => setUser(null)).finally(() => setChecking(false)); }, []); if (checking) return <div className="state full"><div className="spinner" />Loading…</div>; return user ? <Shell user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />; }

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);

import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  api,
  operators,
  type AuditEntry,
  type Environment,
  type FeatureFlag,
  type Project,
  type Rollout,
  type SdkKeyMetadata,
  type TargetingCondition,
  type TargetingOperator,
  type TargetingRule,
  type User,
} from './api.js';
import './styles.css';

type Tab = 'environments' | 'flags' | 'sdk' | 'audit';
type FlagSection = 'configuration' | 'targeting' | 'history';

type LocationState = {
  projectId?: string;
  tab?: Tab;
  environmentId?: string;
  flagKey?: string;
  flagSection?: FlagSection;
  search?: string;
  auditEnvironmentId?: string;
  auditResourceType?: string;
  auditAction?: string;
  expandedAuditId?: string;
};

type LocationPatch = Partial<{
  [key in keyof LocationState]: string | null;
}>;

const locationKeys: Record<keyof LocationState, string> = {
  projectId: 'project',
  tab: 'tab',
  environmentId: 'environment',
  flagKey: 'flag',
  flagSection: 'section',
  search: 'search',
  auditEnvironmentId: 'auditEnvironment',
  auditResourceType: 'auditResource',
  auditAction: 'auditAction',
  expandedAuditId: 'auditEntry',
};
const actionLabels: Record<string, string> = {
  'post.create': 'Created',
  'patch.update': 'Updated',
  'delete.delete': 'Deleted',
  'delete.revoke': 'Revoked',
};
const resourceLabels: Record<string, string> = {
  project: 'project',
  environment: 'environment',
  'feature-flag': 'feature flag',
  'sdk-key': 'SDK key',
};
const validAuditResourceTypes = Object.keys(resourceLabels);
const validAuditActions = Object.keys(actionLabels);
function allowedQueryValue(value: string | null, allowed: readonly string[]) { return value && allowed.includes(value) ? value : undefined; }

function readLocationState(): LocationState {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const tab = params.get(locationKeys.tab);
  const flagSection = params.get(locationKeys.flagSection);
  return {
    projectId: params.get(locationKeys.projectId) ?? undefined,
    tab: tab === 'environments' || tab === 'flags' || tab === 'sdk' || tab === 'audit' ? tab : undefined,
    environmentId: params.get(locationKeys.environmentId) ?? undefined,
    flagKey: params.get(locationKeys.flagKey) ?? undefined,
    flagSection: flagSection === 'configuration' || flagSection === 'targeting' || flagSection === 'history' ? flagSection : undefined,
    search: params.get(locationKeys.search) ?? undefined,
    auditEnvironmentId: params.get(locationKeys.auditEnvironmentId) || undefined,
    auditResourceType: allowedQueryValue(params.get(locationKeys.auditResourceType), validAuditResourceTypes),
    auditAction: allowedQueryValue(params.get(locationKeys.auditAction), validAuditActions),
    expandedAuditId: params.get(locationKeys.expandedAuditId) ?? undefined,
  };
}

function updateLocation(patch: LocationPatch) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch) as [keyof LocationState, string | null | undefined][]) {
    const parameter = locationKeys[key];
    if (value === null) url.searchParams.delete(parameter);
    else if (value !== undefined) url.searchParams.set(parameter, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

const message = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback;
const confirmDelete = (text: string) => typeof window === 'undefined' || window.confirm(text);
const confirmDiscard = () => confirmDelete('You have unsaved changes. Leave without saving?');
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

function formatDate(value: string | Date) { return dateFormatter.format(new Date(value)); }
function formatAction(action: string) { return actionLabels[action] ?? action.replace(/^[a-z]+\./, '').replace(/([A-Z])/g, ' $1'); }
function formatResourceType(resourceType: string) { return resourceLabels[resourceType] ?? resourceType; }
function formatAuditSummary(entry: AuditEntry) {
  const fallback = `${formatAction(entry.action)} ${formatResourceType(entry.resourceType)}`;
  return entry.summary && entry.summary !== `${entry.action} ${entry.resourceType}` ? entry.summary : fallback;
}
function Status({ children, error = false, focus = false }: { children: ReactNode; error?: boolean; focus?: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error && focus) ref.current?.focus(); }, [children, error, focus]);
  return <p ref={ref} className={error ? 'error' : 'success'} role={error ? 'alert' : 'status'} aria-live="polite" tabIndex={error && focus ? -1 : undefined}>{children}</p>;
}
function LoadingState({ children }: { children: ReactNode }) { return <div className="state" role="status" aria-live="polite"><Spinner />{children}</div>; }
function Spinner() { return <span className="spinner" aria-hidden="true" />; }
function initial(value: string) { return value.trim().slice(0, 1).toUpperCase() || 'F'; }
function navIcon(glyph: string) { return <span className="nav-icon" aria-hidden="true">{glyph}</span>; }

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin((await api.login(username.trim(), password)).user);
    } catch (reason) {
      setError(message(reason, 'Unable to sign in.'));
    } finally {
      setBusy(false);
    }
  }

  return <main id="login-content" className="login-page"><a className="skip-link" href="#login-form">Skip to main content</a><section className="login-card"><div className="mark" aria-hidden="true">F<span>³</span></div><p className="eyebrow">CONTROL PLANE / PRIVATE</p><h1>Welcome back.</h1><p className="muted">Ship safer changes by managing flags, environments, and release history from one calm place.</p><form id="login-form" onSubmit={submit}><label htmlFor="username">Username<input id="username" name="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} /></label><label htmlFor="password">Password<input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <Status error focus>{error}</Status>}<button type="submit" className="primary" disabled={busy} aria-busy={busy}>{busy ? <><Spinner />Signing in…</> : 'Sign in →'}</button></form></section></main>;
}

function ProjectList({ projects, onSelect }: { projects: Project[]; onSelect: (project: Project) => void }) {
  if (!projects.length) return <div className="empty"><h3>No projects yet</h3><p>Create a project to give your first release a home.</p></div>;
  return <div className="project-grid">{projects.map(project => <button type="button" className="project-card" key={project.id} onClick={() => onSelect(project)}><span className="project-icon" aria-hidden="true">{initial(project.name)}</span><span className="project-copy"><strong>{project.name}</strong><small>Project workspace</small></span><span className="chevron" aria-hidden="true">↗</span></button>)}</div>;
}

export function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>(() => readLocationState().tab ?? 'environments');
  const [flagCrumb, setFlagCrumb] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const page = await api.projects();
      const state = readLocationState();
      const restored = state.projectId ? page.data.find(project => project.id === state.projectId) ?? null : null;
      setProjects(page.data);
      setSelected(restored);
      if (state.projectId && !restored) updateLocation({ projectId: null, environmentId: null, flagKey: null });
    } catch (reason) {
      setError(message(reason, 'Unable to load projects.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const canLeave = useCallback(() => !hasUnsavedChanges || confirmDiscard(), [hasUnsavedChanges]);
  const reportUnsavedChanges = useCallback((dirty: boolean) => setHasUnsavedChanges(dirty), []);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges]);

  function changeTab(next: Tab) {
    if (!canLeave()) return false;
    setTab(next);
    setMobile(false);
    updateLocation({ tab: next, expandedAuditId: null });
    return true;
  }

  function selectProject(project: Project) {
    if (!canLeave()) return;
    setSelected(project);
    setFlagCrumb('');
    setTab('environments');
    setMobile(false);
    setHasUnsavedChanges(false);
    updateLocation({ projectId: project.id, tab: 'environments', environmentId: null, flagKey: null, flagSection: null, search: null, auditEnvironmentId: null, auditResourceType: null, auditAction: null, expandedAuditId: null });
  }

  function openProjects(skipGuard = false) {
    if (!skipGuard && !canLeave()) return;
    setSelected(null);
    setFlagCrumb('');
    setMobile(false);
    setHasUnsavedChanges(false);
    updateLocation({ projectId: null, tab: null, environmentId: null, flagKey: null, flagSection: null, search: null, auditEnvironmentId: null, auditResourceType: null, auditAction: null, expandedAuditId: null });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError('Project name is required.'); return; }
    setBusy(true);
    setError('');
    try {
      const project = await api.createProject(name.trim());
      setProjects(items => [...items, project]);
      selectProject(project);
      setName('');
    } catch (reason) {
      setError(message(reason, 'Unable to create project.'));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!canLeave()) return;
    try {
      await api.logout();
      onLogout();
    } catch (reason) {
      setError(message(reason, 'Unable to sign out.'));
    }
  }

  function selectFlag(nameValue: string, key: string) {
    setFlagCrumb(key ? nameValue : '');
    updateLocation({ flagKey: key || null });
  }

  const section = tab === 'flags' ? 'Flags' : tab === 'sdk' ? 'SDK Keys' : tab === 'audit' ? 'Audit Log' : 'Environments';
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <div className="brand"><div className="mark small" aria-hidden="true">F<span>³</span></div><strong>flagflagflag</strong></div>
        <nav className="breadcrumbs" aria-label="Breadcrumb">{selected ? <>{selected.name}<span aria-hidden="true">›</span>{section}{tab === 'flags' && flagCrumb ? <><span aria-hidden="true">›</span>{flagCrumb}</> : null}</> : 'Projects'}</nav>
        <div className="topbar-user"><div className="avatar" aria-hidden="true">{initial(user.name || user.username)}</div><strong>{user.name || user.username}</strong></div>
      </header>
      <div className="app-body">
        <aside id="workspace-sidebar" className={`sidebar ${mobile ? 'open' : ''}`}>
          <p className="nav-label">PROJECT</p>
          <button type="button" className="project-switch" onClick={() => openProjects()} aria-label={selected ? `Back to all projects from ${selected.name}` : 'All projects'}>{selected ? selected.name : 'All projects'}<span className="chevron" aria-hidden="true">←</span></button>
          <nav aria-label="Workspace">
            {selected ? <>
              <button type="button" className={`nav-item ${tab === 'flags' ? 'active' : ''}`} aria-current={tab === 'flags' ? 'page' : undefined} onClick={() => changeTab('flags')}>{navIcon('⚑')}<span>Feature flags</span></button>
              <button type="button" className={`nav-item ${tab === 'environments' ? 'active' : ''}`} aria-current={tab === 'environments' ? 'page' : undefined} onClick={() => changeTab('environments')}>{navIcon('⬡')}<span>Environments</span></button>
              <button type="button" className={`nav-item ${tab === 'sdk' ? 'active' : ''}`} aria-current={tab === 'sdk' ? 'page' : undefined} onClick={() => changeTab('sdk')}>{navIcon('⚷')}<span>SDK keys</span></button>
              <button type="button" className={`nav-item ${tab === 'audit' ? 'active' : ''}`} aria-current={tab === 'audit' ? 'page' : undefined} onClick={() => changeTab('audit')}>{navIcon('☷')}<span>Audit &amp; retention</span></button>
              <button type="button" className="nav-item" onClick={() => openProjects()}>{navIcon('▦')}<span>Projects</span></button>
            </> : <button type="button" className="nav-item active" aria-current="page" onClick={() => openProjects()}>{navIcon('▦')}<span>Projects</span></button>}
          </nav>
          <div className="sidebar-bottom"><div className="user"><div className="avatar" aria-hidden="true">{initial(user.name || user.username)}</div><div><strong>{user.name || user.username}</strong><small>{user.email}</small></div></div><button type="button" className="logout" onClick={() => void logout()}>Sign out</button><p className="version">flagflagflag v1.0.0</p></div>
        </aside>
        <button type="button" className={`mobile-scrim ${mobile ? 'visible' : ''}`} aria-label="Close navigation" onClick={() => setMobile(false)} />
        <button type="button" className="mobile-toggle" aria-label="Toggle navigation" aria-expanded={mobile} aria-controls="workspace-sidebar" onClick={() => setMobile(open => !open)}>{mobile ? '×' : '☰'}</button>
        <main id="main-content" className="content" inert={mobile || undefined}>{error && <Status error focus>{error}</Status>}{selected ? <Workspace project={selected} tab={tab} onTabChange={changeTab} onFlagSelect={selectFlag} onUnsavedChange={reportUnsavedChanges} onChange={next => { setProjects(items => items.map(item => item.id === next.id ? next : item)); setSelected(next); }} onDelete={() => { setProjects(items => items.filter(item => item.id !== selected.id)); setSelected(null); openProjects(true); }} canLeave={canLeave} /> : <><section className="intro"><div><p className="eyebrow">SHIP WITH INTENT</p><h1>Make every release reversible.</h1><p className="muted">Projects are the boundary for environments, targeting rules, and audit history.</p></div><form className="create-form" onSubmit={create}><label className="sr-only" htmlFor="new-project">New project name</label><input id="new-project" name="projectName" autoComplete="off" placeholder="New project name…" value={name} onChange={e => setName(e.target.value)} /><button type="submit" className="primary" disabled={busy} aria-busy={busy}>{busy ? <><Spinner />Creating…</> : 'Create project'}</button></form></section><h2 className="page-title">Your projects</h2>{loading ? <LoadingState>Loading projects…</LoadingState> : <ProjectList projects={projects} onSelect={selectProject} />}</>}</main>
      </div>
    </div>
  );
}

function Workspace({ project, tab, onTabChange, onFlagSelect, onUnsavedChange, canLeave, onChange, onDelete }: { project: Project; tab: Tab; onTabChange: (tab: Tab) => boolean; onFlagSelect: (name: string, key: string) => void; onUnsavedChange: (dirty: boolean) => void; canLeave: () => boolean; onChange: (project: Project) => void; onDelete: () => void }) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState(project.name);
  const [settingsError, setSettingsError] = useState('');
  const [unsaved, setUnsaved] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const page = await api.environments(project.id);
      const state = readLocationState();
      setEnvironments(page.data);
      setEnvironment(current => {
        const next = page.data.find(item => item.id === current?.id) ?? page.data.find(item => item.id === state.environmentId) ?? page.data[0] ?? null;
        updateLocation({ environmentId: next?.id ?? null });
        return next;
      });
    } catch (reason) {
      setError(message(reason, 'Unable to load environments.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [project.id]);
  useEffect(() => { onUnsavedChange(unsaved); return () => onUnsavedChange(false); }, [onUnsavedChange, unsaved]);

  function chooseEnvironment(next: Environment | null) {
    if (next?.id === environment?.id) return;
    if (unsaved && !confirmDiscard()) return;
    setUnsaved(false);
    setEnvironment(next);
    updateLocation({ environmentId: next?.id ?? null, flagKey: null, flagSection: null });
  }

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setSettingsError('Project name is required.'); return; }
    setSettingsError('');
    try {
      onChange(await api.updateProject(project.id, name.trim()));
    } catch (reason) {
      setSettingsError(message(reason, 'Unable to update project.'));
    }
  }

  async function remove() {
    if (!confirmDelete(`Delete “${project.name}” and all its data?`)) return;
    try {
      await api.deleteProject(project.id);
      onDelete();
    } catch (reason) {
      setSettingsError(message(reason, 'Unable to delete project.'));
    }
  }

  return <section className="workspace"><>{tab === 'flags' && <h1 className="page-title">Feature flags</h1>}{tab === 'sdk' && !environment && <h1 className="page-title">SDK keys</h1>}</>{tab !== 'environments' && environments.length > 0 && <div className="workspace-toolbar"><label className="env-picker" htmlFor="workspace-environment"><span>Current environment</span><select id="workspace-environment" name="currentEnvironment" value={environment?.id ?? ''} onChange={e => chooseEnvironment(environments.find(item => item.id === e.target.value) ?? null)}>{environments.map(item => <option key={item.id} value={item.id}>{item.name}{item.name.toLowerCase() === 'production' ? ' · production' : ''}</option>)}</select></label></div>}<div className="workspace-panel">{tab === 'environments' && <Environments project={project} environments={environments} selected={environment} onSelect={chooseEnvironment} loading={loading} error={error} reload={load} />}{tab === 'flags' && (environment ? <Flags project={project} environment={environment} onViewAudit={() => { if (onTabChange('audit')) updateLocation({ auditEnvironmentId: environment.id, auditResourceType: 'feature-flag' }); }} onFlagSelect={onFlagSelect} onDirtyChange={setUnsaved} canLeave={canLeave} /> : <ChooseEnvironment environments={environments} onChoose={chooseEnvironment} onCreate={() => { onTabChange('environments'); }} />)}{tab === 'sdk' && (environment ? <SdkKeys project={project} environment={environment} /> : <ChooseEnvironment environments={environments} onChoose={chooseEnvironment} onCreate={() => { onTabChange('environments'); }} />)}{tab === 'audit' && <Audit project={project} environments={environments} />}</div><details className="project-settings"><summary>Project settings</summary><form className="inline-form" onSubmit={rename}><label htmlFor="project-name">Project name<input id="project-name" name="projectName" autoComplete="off" value={name} onChange={e => setName(e.target.value)} /></label><button type="submit" className="secondary">Save name</button><button type="button" className="danger" onClick={() => void remove()}>Delete project</button></form>{settingsError && <Status error focus>{settingsError}</Status>}</details></section>;
}

function ChooseEnvironment({ environments, onChoose, onCreate }: { environments: Environment[]; onChoose: (environment: Environment | null) => void; onCreate: () => void }) {
  if (!environments.length) return <div className="empty"><h3>No environments yet</h3><p>Add an environment before configuring flags or SDK keys.</p><button type="button" className="primary" onClick={onCreate}>Add environment</button></div>;
  return <div className="empty"><h3>Choose an environment first</h3><p>Select an environment before configuring flags or SDK keys.</p>{environments.map(item => <button type="button" className="secondary" key={item.id} onClick={() => onChoose(item)}>{item.name}</button>)}</div>;
}

function Environments({ project, environments, selected, onSelect, loading, error, reload }: { project: Project; environments: Environment[]; selected: Environment | null; onSelect: (item: Environment | null) => void; loading: boolean; error: string; reload: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [busyAction, setBusyAction] = useState<'create' | 'save' | 'delete' | null>(null);
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const busy = busyAction !== null;

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setFormError('Environment name is required.'); return; }
    setBusyAction('create');
    setFormError('');
    try {
      const item = await api.createEnvironment(project.id, name.trim());
      setName('');
      onSelect(item);
      await reload();
    } catch (reason) {
      setFormError(message(reason, 'Unable to create environment.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function save(item: Environment) {
    if (!editName.trim()) { setFormError('Environment name is required.'); return; }
    setBusyAction('save');
    setFormError('');
    try {
      await api.updateEnvironment(project.id, item.id, editName.trim());
      setEditing(null);
      await reload();
    } catch (reason) {
      setFormError(message(reason, 'Unable to rename environment.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function remove(item: Environment) {
    if (!confirmDelete(`Delete ${item.name} and all its flags?`)) return;
    setBusyAction('delete');
    setFormError('');
    try {
      await api.deleteEnvironment(project.id, item.id);
      if (selected?.id === item.id) onSelect(null);
      await reload();
    } catch (reason) {
      setFormError(message(reason, 'Unable to delete environment.'));
    } finally {
      setBusyAction(null);
    }
  }

  return <><div className="section-heading"><div><p className="eyebrow">RELEASE CHANNELS</p><h1>Environments</h1></div><span className="count-badge" aria-label={`${environments.length} environments`}>{environments.length}</span></div><form className="create-form wide" onSubmit={create}><label className="sr-only" htmlFor="environment-name">Environment name</label><input id="environment-name" name="environmentName" autoComplete="off" placeholder="e.g. production…" value={name} onChange={e => setName(e.target.value)} /><button type="submit" className="primary" disabled={busy} aria-busy={busy}>{busyAction === 'create' ? <><Spinner />Creating…</> : 'Add environment'}</button></form>{formError && <Status error focus>{formError}</Status>}{loading ? <LoadingState>Loading environments…</LoadingState> : error ? <div className="empty"><Status error focus>{error}</Status><button type="button" className="secondary" onClick={() => void reload()}>Try again</button></div> : !environments.length ? <div className="empty"><h3>No environments</h3><p>Start with development, staging, or production.</p></div> : <div className="resource-list">{environments.map(item => <article className={`resource-card ${selected?.id === item.id ? 'selected' : ''}`} key={item.id}><button type="button" className="resource-main" onClick={() => onSelect(item)} disabled={busy} aria-current={selected?.id === item.id ? 'true' : undefined}><span className="env-dot" aria-hidden="true" /><span className="resource-copy"><strong>{item.name}</strong><small>{item.name.toLowerCase() === 'production' ? 'Production · review changes carefully' : 'Ready for configuration'}</small></span></button>{editing === item.id ? <form className="rename-form" onSubmit={e => { e.preventDefault(); void save(item); }}><label className="sr-only" htmlFor={`rename-${item.id}`}>New name</label><input id={`rename-${item.id}`} name="environmentName" autoComplete="off" value={editName} onChange={e => setEditName(e.target.value)} /><button type="submit" className="secondary" disabled={busy}>{busyAction === 'save' ? 'Saving…' : 'Save'}</button><button type="button" className="ghost" onClick={() => setEditing(null)}>Cancel</button></form> : <div className="card-actions"><button type="button" className="ghost" disabled={busy} onClick={() => { setEditing(item.id); setEditName(item.name); }}>Rename</button><button type="button" className="ghost danger-text" disabled={busy} onClick={() => void remove(item)}>{busyAction === 'delete' ? 'Deleting…' : 'Delete'}</button></div>}</article>)}</div>}</>;
}

const emptyFlag = { key: '', name: '', enabled: true, defaultValue: false, rollout: null as Rollout | null, rules: [] as TargetingRule[] };

function Flags({ project, environment, onViewAudit, onFlagSelect, onDirtyChange, canLeave }: { project: Project; environment: Environment; onViewAudit: () => void; onFlagSelect: (name: string, key: string) => void; onDirtyChange: (dirty: boolean) => void; canLeave: () => boolean }) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [selected, setSelected] = useState<FeatureFlag | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [changes, setChanges] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState(() => readLocationState().search ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyFlag);
  const [busyAction, setBusyAction] = useState<'create' | 'update' | 'delete' | null>(null);
  const busy = busyAction !== null;
  const [notice, setNotice] = useState('');
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (notice && notice !== 'Saved.') noticeRef.current?.focus(); }, [notice]);

  const loadedRef = useRef(false);
  function generateKey() {
    const base = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 90) || 'feature';
    setForm(current => ({ ...current, key: `${base}_${Math.random().toString(36).slice(2, 8)}` }));
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const envPage = await api.environments(project.id);
      setEnvironments(envPage.data);
      const pages = await Promise.all(envPage.data.map(item => api.flags(project.id, item.id)));
      const all = pages.flatMap(page => page.data);
      const requestedKey = readLocationState().flagKey;
      setFlags(all);
      const next = all.find(item => item.key === selected?.key && item.environmentId === environment.id) ?? all.find(item => item.key === requestedKey && item.environmentId === environment.id) ?? all.find(item => item.environmentId === environment.id) ?? null;
      loadedRef.current = true;
      setSelected(next);
    } catch (reason) {
      setError(message(reason, 'Unable to load feature flags.'));
    } finally {
      setLoading(false);
    }
  }
  function selectFlag(next: FeatureFlag) {
    if (next.key === selected?.key && next.environmentId === selected?.environmentId) return;
    if (!canLeave()) return;
    setSelected(next);
  }

  useEffect(() => { void load(); }, [project.id, environment.id]);
  useEffect(() => { if (loadedRef.current) onFlagSelect(selected?.name ?? '', selected?.key ?? ''); }, [onFlagSelect, selected?.key, selected?.name]);
  useEffect(() => { updateLocation({ search: search || null }); }, [search]);
  useEffect(() => { if (!selected) { setChanges([]); return; } let live = true; const key = selected.key; api.auditLogs(project.id, { resourceType: 'feature-flag' }).then(page => { if (live) setChanges(page.data.filter(entry => entry.resourceId === key).slice(0, 6)); }).catch(() => { if (live) setChanges([]); }); return () => { live = false; }; }, [project.id, selected?.key, selected?.version]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(form.key)) { setNotice('Use a lowercase key starting with a letter or number.'); return; }
    if (!form.name.trim()) { setNotice('Flag name is required.'); return; }
    setBusyAction('create');
    setNotice('');
    try {
      const flag = await api.createFlag(project.id, environment.id, { ...form, name: form.name.trim() });
      setFlags(items => [...items, flag]);
      setSelected(flag);
      setForm(emptyFlag);
      setCreateOpen(false);
      updateLocation({ flagKey: flag.key });
    } catch (reason) {
      setNotice(message(reason, 'Unable to create flag.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function remove(flag: FeatureFlag) {
    if (!confirmDelete(`Delete “${flag.name}” from ${environments.find(item => item.id === flag.environmentId)?.name ?? 'this environment'}?`)) return;
    setBusyAction('delete');
    setNotice('');
    try {
      await api.deleteFlag(project.id, flag.environmentId, flag.key);
      setFlags(items => items.filter(item => !(item.key === flag.key && item.environmentId === flag.environmentId)));
      setSelected(null);
      updateLocation({ flagKey: null });
    } catch (reason) {
      setNotice(message(reason, 'Unable to delete flag.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function update(flag: FeatureFlag, payload: Partial<Omit<FeatureFlag, 'key' | 'environmentId' | 'version'>>) {
    if (payload.rules?.some(rule => rule.conditions.some(condition => (condition.operator === 'in' || condition.operator === 'notIn') && ((Array.isArray(condition.value) && condition.value.length === 0) || (!Array.isArray(condition.value) && !String(condition.value).split(',').some(value => value.trim())))))) { setNotice('In and not-in conditions require at least one value.'); return; }
    setBusyAction('update');
    setNotice('');
    try {
      const rules = payload.rules?.map((rule, priority) => ({ ...rule, priority, conditions: rule.conditions.map(condition => ({ ...condition, value: condition.operator === 'in' || condition.operator === 'notIn' ? (Array.isArray(condition.value) ? condition.value : String(condition.value).split(',').map(value => value.trim()).filter(Boolean)) : condition.operator.includes('Than') ? Number(condition.value) : condition.value })) }));
      const next = await api.updateFlag(project.id, flag.environmentId, flag.key, rules ? { ...payload, rules } : payload, flag.version);
      setFlags(items => items.map(item => item.key === flag.key && item.environmentId === flag.environmentId ? next : item));
      setSelected(next);
      setNotice('Saved.');
    } catch (reason) {
      setNotice(message(reason, 'Update rejected. Refresh to resolve a version conflict.'));
      throw reason;
    } finally {
      setBusyAction(null);
    }
  }

  const filtered = useMemo(() => flags.filter(flag => flag.name.toLowerCase().includes(search.toLowerCase()) || flag.key.includes(search.toLowerCase())), [flags, search]);
  const rows = useMemo(() => {
    const grouped: { key: string; name: string; variants: FeatureFlag[] }[] = [];
    for (const flag of filtered) {
      const row = grouped.find(item => item.key === flag.key);
      if (row) row.variants.push(flag);
      else grouped.push({ key: flag.key, name: flag.name, variants: [flag] });
    }
    return grouped;
  }, [filtered]);
  const noMatches = Boolean(search.trim()) && filtered.length === 0;

  return <>{notice && <p ref={noticeRef} className={notice === 'Saved.' ? 'success' : 'error'} role={notice === 'Saved.' ? 'status' : 'alert'} aria-live="polite" tabIndex={notice === 'Saved.' ? undefined : -1}>{notice}</p>}{loading ? <LoadingState>Loading flags…</LoadingState> : error ? <div className="empty"><Status error focus>{error}</Status><button type="button" className="secondary" onClick={() => void load()}>Try again</button></div> : !flags.length && !search.trim() ? <div className="empty"><h3>No flags in {environment.name}</h3><p>Put a reversible decision in front of a release.</p><button type="button" className="primary" onClick={() => setCreateOpen(true)}>＋ Create Flag</button></div> : <>{selected && <Editor flag={selected} environment={environment} changes={changes} busy={busy} onSave={update} onDelete={remove} onViewAudit={onViewAudit} onDirtyChange={onDirtyChange} busyAction={busyAction} />}<section className="all-flags"><div className="section-heading"><h2>All Flags</h2><div className="card-actions"><label className="sr-only" htmlFor="flag-search">Search flags</label><input id="flag-search" name="flagSearch" autoComplete="off" placeholder="Search flags…" value={search} onChange={e => setSearch(e.target.value)} /><button type="button" className="primary" onClick={() => setCreateOpen(open => !open)}>{createOpen ? 'Close form' : '＋ Create Flag'}</button></div></div>{createOpen && <form className="form-card" onSubmit={create} aria-busy={busy}><div className="form-grid"><label htmlFor="flag-key">Key<input id="flag-key" name="flagKey" autoComplete="off" required value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} placeholder="checkout_redesign…" /><button type="button" className="ghost" onClick={generateKey}>Generate key</button></label><label htmlFor="flag-name">Name<input id="flag-name" name="flagName" autoComplete="off" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Checkout redesign…" /></label></div><Toggle label="Enabled for evaluations" checked={form.enabled} onChange={enabled => setForm({ ...form, enabled })} /><Toggle label="Default value" checked={form.defaultValue} onChange={defaultValue => setForm({ ...form, defaultValue })} /><button type="submit" className="primary" disabled={busy} aria-busy={busy}>{busy ? <><Spinner />Creating…</> : 'Create flag'}</button></form>}{noMatches ? <div className="empty"><h3>No flags match “{search}”</h3><p>Try a different flag name or key.</p><button type="button" className="secondary" onClick={() => setSearch('')}>Clear search</button></div> : <div className="table-wrap"><table><caption className="sr-only">All flags across environments</caption><thead><tr><th scope="col">Name</th><th scope="col">Key</th>{environments.map(item => <th scope="col" key={item.id}>{item.name}</th>)}</tr></thead><tbody>{rows.map(row => { const representative = row.variants.find(item => item.environmentId === environment.id) ?? row.variants[0]; return <tr key={row.key} className={selected?.key === row.key ? 'selected' : undefined}><td><button type="button" className="flag-link" onClick={() => selectFlag(representative)}><strong>{row.name}</strong><code translate="no">{row.key}</code></button></td><td><code translate="no">{row.key}</code></td>{environments.map(item => { const variant = row.variants.find(flag => flag.environmentId === item.id); return <td key={item.id}>{variant ? <button type="button" className="env-status" aria-current={selected?.key === variant.key && selected.environmentId === variant.environmentId ? 'true' : undefined} aria-label={`${row.name} in ${item.name}: ${variant.enabled ? 'ON' : 'OFF'}`} onClick={() => selectFlag(variant)}><span className={`dot ${variant.enabled ? 'on' : 'off'}`} aria-hidden="true" />{variant.enabled ? 'ON' : 'OFF'}{variant.rollout ? ` ⌄ ${variant.rollout.percentage}%` : ''}</button> : <span className="muted">—</span>}</td>; })}</tr>; })}</tbody></table></div>}</section></>}</>;
}

function Toggle({ label, checked, onChange, srLabel = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; srLabel?: boolean }) { return <label className="toggle"><input type="checkbox" name={label.toLowerCase().replace(/\s+/g, '-')} checked={checked} onChange={e => onChange(e.target.checked)} /><span className="toggle-track" aria-hidden="true" /><span className={srLabel ? 'sr-only' : 'toggle-label'}>{label}</span></label>; }

function Editor({ flag, environment, changes, busy, busyAction, onSave, onDelete, onViewAudit, onDirtyChange }: { flag: FeatureFlag; environment: Environment; changes: AuditEntry[]; busy: boolean; busyAction: 'create' | 'update' | 'delete' | null; onSave: (flag: FeatureFlag, payload: Partial<Omit<FeatureFlag, 'key' | 'environmentId' | 'version'>>) => Promise<void>; onDelete: (flag: FeatureFlag) => Promise<void>; onViewAudit: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const [name, setName] = useState(flag.name);
  const [enabled, setEnabled] = useState(flag.enabled);
  const [defaultValue, setDefault] = useState(flag.defaultValue);
  const [rollout, setRollout] = useState<Rollout | null>(flag.rollout);
  const [rules, setRules] = useState<TargetingRule[]>(flag.rules);
  const [draft, setDraft] = useState(flag.rules);
  const [editing, setEditing] = useState(false);
  const [section, setSection] = useState<FlagSection>(() => readLocationState().flagSection ?? 'configuration');
  const rolloutEnabled = rollout !== null;
  const percentage = rollout?.percentage ?? 0;
  const dirty = name !== flag.name || enabled !== flag.enabled || defaultValue !== flag.defaultValue || JSON.stringify(rollout) !== JSON.stringify(flag.rollout) || (editing && JSON.stringify(draft) !== JSON.stringify(rules));

  useEffect(() => { setName(flag.name); setEnabled(flag.enabled); setDefault(flag.defaultValue); setRollout(flag.rollout); setRules(flag.rules); setDraft(flag.rules); setEditing(false); }, [flag.key, flag.version]);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);

  async function save(event: FormEvent) { event.preventDefault(); await onSave(flag, { name: name.trim(), enabled, defaultValue, rollout }); }
  function addRule() { setDraft(items => [...items, { id: crypto.randomUUID(), priority: items.length, result: true, conditions: [{ attribute: 'plan', operator: 'equals', value: 'pro' }] }]); }
  function updateRule(index: number, next: TargetingRule) { setDraft(items => items.map((item, i) => i === index ? next : item)); }
  function moveRule(index: number, direction: number) { setDraft(items => { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next.map((rule, priority) => ({ ...rule, priority })); }); }
  function updateCondition(ruleIndex: number, conditionIndex: number, next: TargetingCondition) { const rule = draft[ruleIndex]; updateRule(ruleIndex, { ...rule, conditions: rule.conditions.map((item, i) => i === conditionIndex ? next : item) }); }
  function addCondition(ruleIndex: number) { updateRule(ruleIndex, { ...draft[ruleIndex], conditions: [...draft[ruleIndex].conditions, { attribute: 'attribute', operator: 'equals', value: '' }] }); }
  function removeCondition(ruleIndex: number, conditionIndex: number) { const rule = draft[ruleIndex]; if (rule.conditions.length <= 1) return; updateRule(ruleIndex, { ...rule, conditions: rule.conditions.filter((_, i) => i !== conditionIndex) }); }
  async function saveRules() { await onSave(flag, { rules: draft }); setRules(draft); setEditing(false); }
  function scrollTo(id: string, nextSection: FlagSection) { setSection(nextSection); updateLocation({ flagSection: nextSection }); document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }

  return <article className="flag-editor"><div className="flag-head"><div className="flag-title"><h2 className="sr-only">{name || 'Untitled feature flag'}</h2><label className="sr-only" htmlFor="flag-display-name">Display name</label><input id="flag-display-name" name="flagName" autoComplete="off" className="title-input" value={name} onChange={e => setName(e.target.value)} /><span className={`pill ${flag.enabled ? 'good' : 'quiet'}`}>{flag.enabled ? 'Active' : 'Paused'}</span></div><button type="button" className="secondary" onClick={onViewAudit}><span aria-hidden="true">☷</span> View Audit Log</button></div><dl className="flag-meta"><div><dt>KEY</dt><dd><code translate="no">{flag.key}</code></dd></div><div><dt>ENVIRONMENT</dt><dd>{environment.name}</dd></div><div><dt>VERSION</dt><dd>{flag.version}</dd></div></dl><nav className="sub-nav" aria-label="Flag sections"><button type="button" className={section === 'configuration' ? 'active' : ''} aria-current={section === 'configuration' ? 'page' : undefined} onClick={() => scrollTo('flag-config', 'configuration')}>Configuration</button><button type="button" className={section === 'targeting' ? 'active' : ''} aria-current={section === 'targeting' ? 'page' : undefined} onClick={() => scrollTo('targeting-rules', 'targeting')}>Targeting Rules</button><button type="button" className={section === 'history' ? 'active' : ''} aria-current={section === 'history' ? 'page' : undefined} onClick={() => scrollTo('flag-history', 'history')}>History</button></nav><div className="detail-grid" id="flag-config"><div className="detail-main"><form className="config-form" onSubmit={save} aria-busy={busy}><div className="stat-cards"><div className="stat-card"><h4>Flag State</h4><div className="toggle-row"><Toggle label="Enabled" srLabel checked={enabled} onChange={setEnabled} /><strong className="state-text">{enabled ? 'ON' : 'OFF'}</strong></div><p className="muted">{enabled ? 'Flag is currently enabled' : 'Flag is currently disabled'}</p></div><div className="stat-card"><h4>Default Value</h4><div className="toggle-row"><Toggle label="Default on" srLabel checked={defaultValue} onChange={setDefault} /><strong className="state-text">{defaultValue ? 'ON' : 'OFF'}</strong></div><p className="muted">Used when no rules match</p></div><div className="stat-card"><h4>Rollout</h4><strong className="stat-value">{rolloutEnabled ? `${percentage}%` : 'Off'}</strong><div className={`progress ${rolloutEnabled ? '' : 'disabled'}`} aria-hidden="true"><span style={{ width: `${percentage}%` }} /></div><p className="muted">{rolloutEnabled ? `${percentage}% of users` : 'Rollout disabled'}</p></div><div className="stat-card"><h4>Config Version</h4><strong className="stat-value">{flag.version}</strong><p className="muted">Current version</p></div></div><section className="panel rollout-panel"><div className="rollout-row"><div><Toggle label="Enable rollout" checked={rolloutEnabled} onChange={enabledValue => setRollout(enabledValue ? { percentage, attribute: rollout?.attribute || 'userId' } : null)} /><p className="muted">Gradually roll out this flag to a percentage of your users.</p></div><div className="rollout-input"><label className="sr-only" htmlFor="rollout-percent">Percentage</label><input id="rollout-percent" name="rolloutPercentage" autoComplete="off" type="number" min="0" max="100" disabled={!rolloutEnabled} value={percentage} onChange={e => setRollout({ percentage: Number(e.target.value), attribute: rollout?.attribute || 'userId' })} /><span>%</span></div></div><input className="range" name="rolloutPercentageSlider" type="range" min="0" max="100" aria-label="Rollout percentage slider" disabled={!rolloutEnabled} value={percentage} onChange={e => setRollout({ percentage: Number(e.target.value), attribute: rollout?.attribute || 'userId' })} /><div className="range-marks"><span>0%</span><span>100%</span></div><div className="rollout-extra"><label htmlFor="rollout-attribute">Stable attribute<input id="rollout-attribute" name="rolloutAttribute" autoComplete="off" value={rollout?.attribute ?? ''} placeholder="userId…" disabled={!rolloutEnabled} onChange={e => setRollout(current => current ? { ...current, attribute: e.target.value } : current)} /></label><button type="button" className="ghost" disabled={!rolloutEnabled || busy} onClick={() => setRollout(null)}>Disable rollout</button></div><div className="form-actions"><button type="submit" className="primary" disabled={busy} aria-busy={busy}>{busyAction === 'update' ? <><Spinner />Saving…</> : 'Save configuration'}</button></div></section></form><section className="panel rules" id="targeting-rules"><div className="panel-head"><div><h3>Targeting Rules</h3><p className="muted">Rules are evaluated top to bottom. The first matching rule wins.</p></div>{!editing ? <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit targeting</button> : <button type="button" className="primary" onClick={addRule} disabled={draft.length >= 20}>{draft.length >= 20 ? 'Rule limit reached' : '＋ Add rule'}</button>}</div>{!editing ? rules.length ? rules.map((rule, index) => <RuleCard key={rule.id} rule={rule} index={index} />) : <p className="muted">No targeting rules. The flag uses its default value.</p> : <><div className="draft-note">Draft mode · changes stay local until saved. <button type="button" className="ghost" onClick={() => { setDraft(rules); setEditing(false); }}>Cancel</button></div>{draft.map((rule, index) => <div className="rule-card" key={rule.id}><div><strong>Rule {index + 1}</strong><button type="button" className="ghost" onClick={() => moveRule(index, -1)} disabled={index === 0}>↑</button><button type="button" className="ghost" onClick={() => moveRule(index, 1)} disabled={index === draft.length - 1}>↓</button><button type="button" className="ghost danger-text" onClick={() => setDraft(items => items.filter((_, i) => i !== index))}>Remove rule</button></div><div className="two-col"><label>Priority<input name={`rule-${index}-priority`} type="number" min="0" value={rule.priority} readOnly /></label><Toggle label="Return true" checked={rule.result} onChange={result => updateRule(index, { ...rule, result })} /></div>{rule.conditions.map((condition, conditionIndex) => <div className="condition" key={conditionIndex}><label>Attribute<input name={`rule-${index}-condition-${conditionIndex}-attribute`} value={condition.attribute} onChange={e => updateCondition(index, conditionIndex, { ...condition, attribute: e.target.value })} /></label><label>Operator<select name={`rule-${index}-condition-${conditionIndex}-operator`} value={condition.operator} onChange={e => updateCondition(index, conditionIndex, { ...condition, operator: e.target.value as TargetingOperator, value: e.target.value === 'in' || e.target.value === 'notIn' ? [] : e.target.value.includes('Than') ? 0 : '' })}>{operators.map(operator => <option key={operator} value={operator}>{operator.replace(/([A-Z])/g, ' $1')}</option>)}</select></label><label>Value<input name={`rule-${index}-condition-${conditionIndex}-value`} value={Array.isArray(condition.value) ? condition.value.join(', ') : String(condition.value)} onChange={e => updateCondition(index, conditionIndex, { ...condition, value: e.target.value })} /></label><button type="button" className="ghost danger-text" onClick={() => removeCondition(index, conditionIndex)} disabled={rule.conditions.length <= 1}>Remove condition</button></div>)}<button type="button" className="ghost" onClick={() => addCondition(index)}>＋ Add condition</button></div>)}<div className="form-actions"><button type="button" className="primary" onClick={() => void saveRules()} disabled={busy} aria-busy={busy}>{busyAction === 'update' ? <><Spinner />Saving…</> : 'Save targeting'}</button></div></>}</section><button type="button" className="danger full-button" onClick={() => void onDelete(flag)} disabled={busy}>{busyAction === 'delete' ? 'Deleting…' : 'Delete flag'}</button></div><aside className="detail-side"><section className="panel env-info"><h3>Environment Info</h3><dl><div><dt>Name</dt><dd>{environment.name}</dd></div><div><dt>Identifier</dt><dd><code translate="no">{environment.id}</code></dd></div><div><dt>Config Version</dt><dd>{flag.version}</dd></div><div><dt>Last Updated</dt><dd>{changes[0] ? formatDate(changes[0].createdAt) : '—'}</dd></div></dl></section><section className="panel recent-changes" id="flag-history"><h3>Recent Changes</h3>{changes.length ? <ol className="timeline">{changes.map(entry => <li key={entry.id}><time dateTime={new Date(entry.createdAt).toISOString()}>{formatDate(entry.createdAt)}</time><p>{formatAction(entry.action)} {formatResourceType(entry.resourceType)}</p><span className="chip" translate="no">{entry.resourceId}</span><span className="actor">Actor {entry.actorId}</span></li>)}</ol> : <p className="muted">No recorded changes for this flag.</p>}<button type="button" className="secondary wide" onClick={onViewAudit}>View full audit log <span aria-hidden="true">→</span></button></section></aside></div></article>;
}

function RuleCard({ rule, index }: { rule: TargetingRule; index: number }) { return <div className="rule-card readonly"><span className="drag-handle" aria-hidden="true">⠿</span><span className="rule-index">{index + 1}</span><span className="rule-return">Return: <span className={`pill ${rule.result ? 'good' : 'bad'}`}>{rule.result ? 'ON' : 'OFF'}</span></span><div className="rule-conditions">{rule.conditions.map((condition, conditionIndex) => <p key={conditionIndex}><span className="cond-kw">{conditionIndex === 0 ? 'IF' : 'AND'}</span><code className="chip" translate="no">{condition.attribute}</code><code className="chip" translate="no">{condition.operator.replace(/([A-Z])/g, ' $1')}</code><code className="chip" translate="no">{Array.isArray(condition.value) ? condition.value.join(', ') : String(condition.value)}</code></p>)}</div></div>; }

function SdkKeys({ project, environment }: { project: Project; environment: Environment }) {
  const [keys, setKeys] = useState<SdkKeyMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [busyAction, setBusyAction] = useState<'issue' | string | null>(null);
  const secretRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      setKeys(await api.sdkKeys(project.id, environment.id));
    } catch (reason) {
      setError(message(reason, 'Unable to load SDK keys.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [project.id, environment.id]);
  useEffect(() => { if (secret) secretRef.current?.focus(); }, [secret]);

  async function create() {
    setBusyAction('issue');
    setError('');
    try {
      const issued = await api.createSdkKey(project.id, environment.id);
      setKeys(items => [{ id: issued.id, prefix: issued.prefix, environmentId: issued.environmentId, createdAt: issued.createdAt, revokedAt: null }, ...items]);
      setSecret(issued.key);
      setCopyStatus('');
    } catch (reason) {
      setError(message(reason, 'Unable to issue SDK key.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function revoke(key: SdkKeyMetadata) {
    if (!confirmDelete(`Revoke ${key.prefix}…?`)) return;
    setBusyAction(key.id);
    setError('');
    try {
      await api.revokeSdkKey(project.id, environment.id, key.id);
      setKeys(items => items.map(item => item.id === key.id ? { ...item, revokedAt: new Date().toISOString() } : item));
    } catch (reason) {
      setError(message(reason, 'Unable to revoke SDK key.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopyStatus('Secret copied.');
    } catch {
      setError('Copy failed — select the secret manually.');
    }
  }

  const busy = busyAction !== null;
  return <><div className="section-heading"><div><p className="eyebrow">CLIENT ACCESS</p><h1>SDK keys</h1></div><button type="button" className="primary" onClick={() => void create()} disabled={busy} aria-busy={busyAction === 'issue'}>{busyAction === 'issue' ? <><Spinner />Issuing…</> : 'Issue key'}</button></div><div className="security-note"><strong>Secrets are shown once.</strong><span>Store this key in a secret manager before dismissing it.</span></div>{secret && <div ref={secretRef} className="secret-reveal" role="region" aria-live="polite" aria-atomic="true" aria-labelledby="new-sdk-secret" tabIndex={-1}><strong id="new-sdk-secret">New SDK secret</strong><code translate="no">{secret}</code><div><button type="button" className="secondary" onClick={() => void copySecret()}>Copy secret</button><button type="button" className="ghost" onClick={() => { setSecret(''); setCopyStatus(''); }}>I stored it</button></div>{copyStatus && <Status>{copyStatus}</Status>}</div>}{error && <Status error focus>{error}</Status>}{loading ? <LoadingState>Loading keys…</LoadingState> : !keys.length ? <div className="empty"><h3>No SDK keys</h3><p>Issue a key when an application is ready.</p></div> : <div className="table-wrap"><table><caption className="sr-only">SDK keys</caption><thead><tr><th scope="col">Key</th><th scope="col">Created</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{keys.map(key => <tr key={key.id}><td><code translate="no">{key.prefix}…</code></td><td>{formatDate(key.createdAt)}</td><td>{key.revokedAt ? 'Revoked' : 'Active'}</td><td>{!key.revokedAt && <button type="button" className="ghost danger-text" disabled={busy} onClick={() => void revoke(key)}>{busyAction === key.id ? 'Revoking…' : 'Revoke'}</button>}</td></tr>)}</tbody></table></div>}</>;
}

function Audit({ project, environments }: { project: Project; environments: Environment[] }) {
  const location = readLocationState();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [environmentId, setEnvironmentId] = useState(environments.some(item => item.id === location.auditEnvironmentId) ? location.auditEnvironmentId ?? '' : '');
  const [resourceType, setResourceType] = useState(location.auditResourceType ?? '');
  const [action, setAction] = useState(location.auditAction ?? '');
  const [retention, setRetention] = useState(90);
  const [retentionError, setRetentionError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(location.expandedAuditId ?? null);
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  async function load(append = false) {
    if (append) {
      if (!nextCursor) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError('');
    }
    try {
      const [page, info] = append ? [await api.auditLogs(project.id, { environmentId, resourceType, action, limit: 50, cursor: nextCursor ?? undefined }), null] : await Promise.all([api.auditLogs(project.id, { environmentId, resourceType, action }), api.auditRetention(project.id)]);
      if (append) {
        setLogs(items => [...items, ...page.data]);
      } else {
        setLogs(page.data);
        if (info) setRetention(info.retentionDays);
      }
      setNextCursor(page.pagination?.nextCursor ?? null);
    } catch (reason) {
      setError(message(reason, 'Unable to load audit history.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => { void load(); }, [project.id, environmentId, resourceType, action]);
  useEffect(() => { updateLocation({ auditEnvironmentId: environmentId || null, auditResourceType: resourceType || null, auditAction: action || null }); }, [environmentId, resourceType, action]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setRetentionError('');
    if (!Number.isInteger(retention) || retention < 1 || retention > 3650) { setRetentionError('Enter a whole number from 1 to 3650.'); return; }
    setRetentionBusy(true);
    try {
      setRetention((await api.setAuditRetention(project.id, retention)).retentionDays);
    } catch (reason) {
      setRetentionError(message(reason, 'Unable to update retention.'));
    } finally {
      setRetentionBusy(false);
    }
  }

  async function exportLogs() {
    setError('');
    setExporting(true);
    try {
      const csv = await api.exportAudit(project.id, { environmentId, resourceType, action });
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name}-audit.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      const status = typeof reason === 'object' && reason !== null && 'status' in reason ? reason.status : undefined;
      setError(status === 404 ? 'Audit export is not available on this server.' : message(reason, 'Unable to export audit history.'));
    } finally {
      setExporting(false);
    }
  }

  return <><div className="section-heading"><div><p className="eyebrow">TRACEABILITY</p><h1>Audit &amp; retention</h1></div><button type="button" className="secondary" onClick={() => void exportLogs()} disabled={exporting} aria-busy={exporting}>{exporting ? <><Spinner />Exporting…</> : 'Export CSV'}</button></div><div className="filter-bar"><label htmlFor="audit-env">Filter environment<select id="audit-env" name="auditEnvironment" autoComplete="off" value={environmentId} onChange={e => setEnvironmentId(e.target.value)}><option value="">All environments</option>{environments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label htmlFor="audit-resource">Resource<select id="audit-resource" name="auditResource" autoComplete="off" value={resourceType} onChange={e => setResourceType(e.target.value)}><option value="">All resources</option><option value="project">Project</option><option value="environment">Environment</option><option value="feature-flag">Feature flag</option><option value="sdk-key">SDK key</option></select></label><label htmlFor="audit-action">Action<select id="audit-action" name="auditAction" autoComplete="off" value={action} onChange={e => setAction(e.target.value)}><option value="">All actions</option><option value="post.create">Create</option><option value="patch.update">Update</option><option value="delete.delete">Delete</option><option value="delete.revoke">Revoke</option></select></label></div><form className="retention-card" onSubmit={save} aria-busy={retentionBusy}><div><p className="eyebrow">DATA LIFECYCLE</p><strong>Keep audit entries for</strong></div><label htmlFor="retention-days"><span className="sr-only">Retention period</span><input id="retention-days" name="retentionDays" autoComplete="off" type="number" min="1" max="3650" value={retention} onChange={e => setRetention(Number(e.target.value))} /> days</label><button type="submit" className="secondary" disabled={retentionBusy} aria-busy={retentionBusy}>{retentionBusy ? <><Spinner />Saving…</> : 'Save retention'}</button></form>{retentionError && <Status error focus>{retentionError}</Status>}{error && <Status error focus>{error}</Status>}{loading ? <LoadingState>Loading audit history…</LoadingState> : !logs.length ? <div className="empty"><h3>No matching entries</h3><p>Changes to this project will appear here.</p></div> : <><div className="audit-list">{logs.map(entry => <article className="audit-row" key={entry.id}><button type="button" className="audit-summary" aria-expanded={expanded === entry.id} aria-controls={`audit-detail-${entry.id}`} onClick={() => { const next = expanded === entry.id ? null : entry.id; setExpanded(next); updateLocation({ expandedAuditId: next }); }}><span>{formatDate(entry.createdAt)}</span><span><strong>{formatAuditSummary(entry)}</strong><small>Resource: <code translate="no">{entry.resourceId}</code> · Actor {entry.actorId} · {entry.environmentId ? environments.find(item => item.id === entry.environmentId)?.name ?? 'Unknown environment' : 'All environments'}</small></span><span aria-hidden="true">{expanded === entry.id ? '−' : '+'}</span></button>{expanded === entry.id && <div className="audit-detail" id={`audit-detail-${entry.id}`}><pre>{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre></div>}</article>)}</div>{nextCursor && <button type="button" className="secondary load-more" onClick={() => void load(true)} disabled={loadingMore} aria-busy={loadingMore}>{loadingMore ? <><Spinner />Loading…</> : 'Load more entries'}</button>}</>}</>;
}

export function App() { const [user, setUser] = useState<User | null>(null); const [checking, setChecking] = useState(true); useEffect(() => { void api.me().then(setUser).catch(() => setUser(null)).finally(() => setChecking(false)); }, []); if (checking) return <LoadingState>Loading session…</LoadingState>; return user ? <Shell user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />; }

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);

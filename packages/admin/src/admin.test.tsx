import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, Login, Shell } from './main.js';
import { api } from './api.js';
import type { User } from './api.js';

const user: User = { id: 'u1', username: 'flag3', name: 'Flag Three', email: 'flag3@example.test' };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

describe('admin control plane', () => {
  it('restores an existing session through /auth/me', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(user), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    expect(await screen.findByText('Your projects')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/me', expect.objectContaining({ credentials: 'include' }));
  });

  it('shows login when session restoration is unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    render(<App />);
    expect(await screen.findByText('Welcome back.')).toBeInTheDocument();
  });

  it('submits credentials and hands the authenticated user to the shell', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ user }), { status: 200 })));
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'flag3' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'flag3' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(user));
  });

  it('lists projects, creates one, and preserves the session when logout fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'p1', name: 'Core API' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'p2', name: 'Web app' }), { status: 200 }))
      .mockRejectedValueOnce(new Error('network unavailable'));
    vi.stubGlobal('fetch', fetchMock);
    render(<Shell user={user} onLogout={vi.fn()} />);
    expect(await screen.findByText('Core API')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('New project name'), { target: { value: 'Web app' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => expect(screen.getAllByText('Web app').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('network unavailable');
    expect(screen.getAllByText('Web app').length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/auth/logout', expect.objectContaining({ method: 'POST' }));
  });

  it('sends complete flag payloads and protects updates with If-Match', async () => {
    const flag = { key: 'checkout', name: 'Checkout', environmentId: 'e1', enabled: true, defaultValue: false, rollout: null, rules: [], version: 4 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(flag), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...flag, name: 'Checkout v2', version: 5 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const payload = { key: flag.key, name: flag.name, enabled: flag.enabled, defaultValue: flag.defaultValue, rollout: flag.rollout, rules: flag.rules };
    await api.createFlag('project one', 'e1', payload);
    await api.updateFlag('project one', 'e1', flag.key, { name: 'Checkout v2' }, flag.version);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/projects/project%20one/environments/e1/flags');
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ 'If-Match': '"4"' }) }));
  });

  it('creates SDK keys with an empty body and retains only metadata after issuance', async () => {
    const issued = { id: 'key-1', key: 'secret-once', prefix: 'secret-o', environmentId: 'e1', createdAt: '2026-01-01T00:00:00.000Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(issued), { status: 200 })));
    const result = await api.createSdkKey('p1', 'e1');
    expect(result.key).toBe('secret-once');
    expect(vi.mocked(fetch).mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty('body');
  });
  it('rejects malformed flag targeting responses instead of rendering unsafe data', async () => {
    const malformed = { key: 'checkout', name: 'Checkout', environmentId: 'e1', enabled: true, defaultValue: false, rollout: null, rules: [{ id: 'r1', priority: 0, result: true, conditions: [{ attribute: 'plan', operator: 'in', value: [] }] }], version: 1 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [malformed] }), { status: 200 })));
    await expect(api.flags('p1', 'e1')).rejects.toMatchObject({ status: 502 });
  });
  it('exports audit logs with active filters as CSV', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('id,action\n1,post.create\n', { status: 200, headers: { 'content-type': 'text/csv' } })));
    await expect(api.exportAudit('p one', { environmentId: 'e 1', action: 'post.create' })).resolves.toContain('id,action');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/projects/p%20one/audit-logs/export?environmentId=e+1&action=post.create');
  });
  it('creates, renames, selects, and deletes environments from the rendered workspace', async () => {
    const first = { id: 'e1', name: 'development', projectId: 'p1' };
    const second = { id: 'e2', name: 'staging', projectId: 'p1' };
    const renamed = { ...first, name: 'preview' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'p1', name: 'Core API' }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [first] }))
      .mockResolvedValueOnce(jsonResponse(second))
      .mockResolvedValueOnce(jsonResponse({ data: [first, second] }))
      .mockResolvedValueOnce(jsonResponse(renamed))
      .mockResolvedValueOnce(jsonResponse({ data: [renamed, second] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ data: [second] }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<Shell user={user} onLogout={vi.fn()} />);

    expect(await screen.findByText('Core API')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Core API/ }));
    expect(await screen.findByText('development')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Environment name'), { target: { value: 'staging' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add environment' }));
    expect(await screen.findByText('staging')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0]);
    fireEvent.change(screen.getByLabelText('New name'), { target: { value: 'preview' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('preview')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await waitFor(() => expect(screen.queryByText('preview')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/projects/p1/environments/e1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('filters flags and saves configuration plus targeting rules through accessible controls', async () => {
    const environment = { id: 'e1', name: 'development', projectId: 'p1' };
    const flag = {
      key: 'checkout',
      name: 'Checkout',
      environmentId: 'e1',
      enabled: true,
      defaultValue: false,
      rollout: null,
      rules: [{ id: 'rule-1', priority: 0, result: true, conditions: [{ attribute: 'plan', operator: 'equals', value: 'pro' }] }],
      version: 1,
    };
    const updated = { ...flag, name: 'Checkout v2', enabled: false, version: 2 };
    const rulesUpdated = { ...updated, rules: [...flag.rules, { id: 'rule-2', priority: 1, result: true, conditions: [{ attribute: 'country', operator: 'equals', value: 'US' }]}], version: 3 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'p1', name: 'Core API' }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [environment] }))
      .mockResolvedValueOnce(jsonResponse({ data: [environment] }))
      .mockResolvedValueOnce(jsonResponse({ data: [flag] }))
      .mockResolvedValueOnce(jsonResponse(updated))
      .mockResolvedValueOnce(jsonResponse(rulesUpdated));
    vi.stubGlobal('fetch', fetchMock);
    render(<Shell user={user} onLogout={vi.fn()} />);

    expect(await screen.findByText('Core API')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Core API/ }));
    expect(await screen.findByText('development')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Feature flags' }));
    expect(await screen.findByRole('button', { name: /Checkout checkout/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search flags'), { target: { value: 'missing' } });
    expect(screen.queryByRole('button', { name: /Checkout checkout/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search flags'), { target: { value: 'checkout' } });
    fireEvent.click(screen.getByRole('button', { name: /Checkout checkout/ }));
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Checkout v2' } });
    fireEvent.click(screen.getByLabelText('Enabled'));
    fireEvent.click(screen.getByRole('button', { name: 'Save configuration' }));
    await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument());
    expect(fetchMock.mock.calls[4][1]).toEqual(expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"enabled":false') }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit targeting' }));
    expect(screen.getByText(/Draft mode/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '＋ Add rule' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save targeting' }));
    await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument());
    expect(fetchMock.mock.calls[5][1]).toEqual(expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"priority":1') }));
  });

  it('reveals an SDK secret once, then tracks revocation without retaining the secret', async () => {
    const environment = { id: 'e1', name: 'development', projectId: 'p1' };
    const issued = { id: 'key-1', key: 'secret-once', prefix: 'secret-o', environmentId: 'e1', createdAt: '2026-01-01T00:00:00.000Z' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'p1', name: 'Core API' }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [environment] }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(issued))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<Shell user={user} onLogout={vi.fn()} />);

    expect(await screen.findByText('Core API')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Core API/ }));
    expect(await screen.findByText('development')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'SDK keys' }));
    expect(await screen.findByText('No SDK keys')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Issue key' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('secret-once');
    fireEvent.click(screen.getByRole('button', { name: 'I stored it' }));
    expect(screen.queryByText('secret-once')).not.toBeInTheDocument();
    expect(screen.getByText('secret-o…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText('Revoked')).toBeInTheDocument();
  });

  it('filters audit history, validates retention, and reports export failures', async () => {
    const environment = { id: 'e1', name: 'production', projectId: 'p1' };
    const entry = {
      id: 'audit-1',
      projectId: 'p1',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdAtEpoch: 1767225600000,
      actorId: 'u1',
      action: 'patch.update',
      resourceType: 'feature-flag',
      resourceId: 'checkout',
      environmentId: 'e1',
      summary: 'Updated Checkout',
      before: { enabled: true },
      after: { enabled: false },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/audit-logs/export')) return Promise.resolve(jsonResponse({ detail: 'not found' }, 404));
      if (url.includes('/audit-logs')) return Promise.resolve(jsonResponse({ data: [entry] }));
      if (url.includes('/audit-retention') && init?.method === 'PATCH') return Promise.resolve(jsonResponse({ retentionDays: 30 }));
      if (url.includes('/audit-retention')) return Promise.resolve(jsonResponse({ retentionDays: 90 }));
      if (url.endsWith('/environments')) return Promise.resolve(jsonResponse({ data: [environment] }));
      return Promise.resolve(jsonResponse({ data: [{ id: 'p1', name: 'Core API' }] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<Shell user={user} onLogout={vi.fn()} />);

    expect(await screen.findByText('Core API')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Core API/ }));
    expect(await screen.findByText('production')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Audit & retention' }));
    expect(await screen.findByText('Updated Checkout')).toBeInTheDocument();
    fireEvent.change(document.getElementById('audit-env')!, { target: { value: 'e1' } });
    fireEvent.change(screen.getByLabelText('Resource'), { target: { value: 'feature-flag' } });
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'patch.update' } });
    fireEvent.change(document.getElementById('retention-days')!, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save retention' }));
    fireEvent.change(document.getElementById('retention-days')!, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save retention' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/projects/p1/audit-logs?environmentId=e1&resourceType=feature-flag&action=patch.update', expect.anything()));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/projects/p1/audit-retention', expect.objectContaining({ method: 'PATCH' })));
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Audit export is not available on this server.');
    fireEvent.click(screen.getByRole('button', { name: /Updated Checkout/ }));
    expect(screen.getByRole('button', { name: /Updated Checkout/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/"enabled": true/)).toBeInTheDocument();
  });

  it('keeps navigation operable at reduced width with named controls', async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ data: [] })));
    render(<Shell user={user} onLogout={vi.fn()} />);
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle).toHaveAccessibleName('Toggle navigation');
    fireEvent.click(toggle);
    expect(screen.getByRole('navigation', { name: 'Workspace' }).closest('aside')).toHaveClass('open');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  });
});

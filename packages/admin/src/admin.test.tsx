import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, Login, Shell } from './main.js';
import { api } from './api.js';
import type { User } from './api.js';

const user: User = { id: 'u1', username: 'flag3', name: 'Flag Three', email: 'flag3@example.test' };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('id,action\n1,create\n', { status: 200, headers: { 'content-type': 'text/csv' } })));
    await expect(api.exportAudit('p one', { environmentId: 'e 1', action: 'create' })).resolves.toContain('id,action');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/projects/p%20one/audit-logs/export?environmentId=e+1&action=create');
  });
});

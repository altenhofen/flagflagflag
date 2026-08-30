import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Login, Shell } from './main';
import type { User } from './api';

const user: User = { id: 'u1', username: 'flag3', name: 'Flag Three', email: 'flag3@example.test' };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('admin control plane', () => {
  it('submits credentials and hands the authenticated user to the shell', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ user }), { status: 200 })));
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'flag3' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'flag3' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(user));
    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({ credentials: 'include' }));
  });

  it('lists projects and creates one from the project form', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'p1', name: 'Core API' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'p2', name: 'Web app' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<Shell user={user} onLogout={vi.fn()} />);
    expect(await screen.findByText('Core API')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('New project name'), { target: { value: 'Web app' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => expect(screen.getAllByText('Web app').length).toBeGreaterThan(0));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/projects', expect.objectContaining({ method: 'POST' }));
  });
});

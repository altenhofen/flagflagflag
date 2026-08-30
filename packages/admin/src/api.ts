export interface Project { id: string; name: string }
export interface User { id: string; username: string; name: string; email: string }

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function messageFrom(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'detail' in body && typeof body.detail === 'string') return body.detail;
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = body.message;
    if (Array.isArray(message)) return message.map((item) => typeof item === 'object' && item !== null && 'message' in item ? String(item.message) : String(item)).join(', ');
    if (typeof message === 'string') return message;
  }
  return 'Something went wrong. Please try again.';
}

function isProject(value: unknown): value is Project {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'name' in value && typeof value.name === 'string';
}
function isUser(value: unknown): value is User {
  return isProject(value) && 'username' in value && typeof value.username === 'string' && 'email' in value && typeof value.email === 'string';
}
function validate<T>(body: unknown, guard: (value: unknown) => value is T): T {
  if (!guard(body)) throw new ApiError(502, 'The server returned an invalid response.');
  return body;
}

export async function request<T>(path: string, init: RequestInit = {}, guard?: (value: unknown) => value is T): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init.headers } });
  const text = await response.text();
  let body: unknown;
  if (text) { try { body = JSON.parse(text) as unknown; } catch { body = undefined; } }
  if (!response.ok) throw new ApiError(response.status, messageFrom(body));
  return guard ? validate(body, guard) : body as T;
}

const isUserResponse = (value: unknown): value is { user: User } => typeof value === 'object' && value !== null && 'user' in value && isUser(value.user);
const isProjectList = (value: unknown): value is { data: Project[] } => typeof value === 'object' && value !== null && 'data' in value && Array.isArray(value.data) && value.data.every(isProject);
const isStatus = (value: unknown): value is { status: boolean } => typeof value === 'object' && value !== null && 'status' in value && typeof value.status === 'boolean';

export const api = {
  me: () => request<User>('/auth/me', {}, isUser),
  login: (username: string, password: string) => request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }, isUserResponse),
  logout: () => request<{ status: boolean }>('/auth/logout', { method: 'POST' }, isStatus),
  projects: () => request<{ data: Project[] }>('/projects', {}, isProjectList),
  createProject: (name: string) => request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name }) }, isProject),
};

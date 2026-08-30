export interface Project { id: string; name: string }
export interface User { id: string; username: string; name: string; email: string }
export interface Environment { id: string; name: string; projectId: string }
export type TargetingOperator = 'equals' | 'notEquals' | 'in' | 'notIn' | 'contains' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual';
export type RuleValue = string | number | boolean | string[];
export interface TargetingCondition { attribute: string; operator: TargetingOperator; value: RuleValue }
export interface TargetingRule { id: string; priority: number; result: boolean; conditions: TargetingCondition[] }
export interface Rollout { percentage: number; attribute: string }
export interface FeatureFlag { key: string; name: string; environmentId: string; enabled: boolean; defaultValue: boolean; rollout: Rollout | null; rules: TargetingRule[]; version: number }
export interface SdkKeyMetadata { id: string; prefix: string; environmentId: string; createdAt: string; revokedAt: string | null }
export interface IssuedSdkKey extends Omit<SdkKeyMetadata, 'revokedAt'> { key: string }
export interface AuditEntry { id: string; projectId: string; createdAt: string | Date; createdAtEpoch: number; actorId: string; action: string; resourceType: string; resourceId: string; environmentId: string | null; summary: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }
export interface Page<T> { data: T[]; pagination?: { nextCursor: string | null } }
export interface AuditFilters { environmentId?: string; resourceType?: string; action?: string; limit?: number; cursor?: string }

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
export class ApiError extends Error { constructor(public readonly status: number, message: string) { super(message); this.name = 'ApiError'; } }
function messageFrom(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'detail' in body && typeof body.detail === 'string') return body.detail;
  if (typeof body === 'object' && body !== null && 'message' in body) { const message = body.message; if (Array.isArray(message)) return message.map((item) => typeof item === 'object' && item !== null && 'message' in item ? String(item.message) : String(item)).join(', '); if (typeof message === 'string') return message; }
  return 'Something went wrong. Please try again.';
}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isProject = (value: unknown): value is Project => object(value) && typeof value.id === 'string' && typeof value.name === 'string';
const isUser = (value: unknown): value is User => object(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.username === 'string' && typeof value.email === 'string';
const isEnvironment = (value: unknown): value is Environment => object(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.projectId === 'string';
const operators: TargetingOperator[] = ['equals','notEquals','in','notIn','contains','greaterThan','greaterThanOrEqual','lessThan','lessThanOrEqual'];
const isCondition = (value: unknown): value is TargetingCondition => object(value) && typeof value.attribute === 'string' && operators.includes(value.operator as TargetingOperator) && (typeof value.value === 'string' || typeof value.value === 'number' || typeof value.value === 'boolean' || (Array.isArray(value.value) && value.value.length > 0 && value.value.every(item => typeof item === 'string')));
const isRule = (value: unknown): value is TargetingRule => object(value) && typeof value.id === 'string' && Number.isInteger(value.priority) && typeof value.result === 'boolean' && Array.isArray(value.conditions) && value.conditions.every(isCondition);
const isFlag = (value: unknown): value is FeatureFlag => object(value) && typeof value.key === 'string' && typeof value.name === 'string' && typeof value.environmentId === 'string' && typeof value.enabled === 'boolean' && typeof value.defaultValue === 'boolean' && typeof value.version === 'number' && Array.isArray(value.rules) && value.rules.every(isRule) && (value.rollout === null || (object(value.rollout) && typeof value.rollout.percentage === 'number' && Number.isInteger(value.rollout.percentage) && value.rollout.percentage >= 0 && value.rollout.percentage <= 100 && typeof value.rollout.attribute === 'string'));
const isPage = <T>(guard: (value: unknown) => value is T) => (value: unknown): value is Page<T> => object(value) && Array.isArray(value.data) && value.data.every(guard);
const isStatus = (value: unknown): value is { status: boolean } => object(value) && typeof value.status === 'boolean';
const isRetention = (value: unknown): value is { retentionDays: number } => object(value) && typeof value.retentionDays === 'number';
const isSdkMetadata = (value: unknown): value is SdkKeyMetadata => object(value) && typeof value.id === 'string' && typeof value.prefix === 'string' && typeof value.environmentId === 'string' && typeof value.createdAt === 'string' && (value.revokedAt === null || typeof value.revokedAt === 'string');
const isIssuedKey = (value: unknown): value is IssuedSdkKey => object(value) && typeof value.id === 'string' && typeof value.prefix === 'string' && typeof value.environmentId === 'string' && typeof value.createdAt === 'string' && typeof value.key === 'string';
const isAudit = (value: unknown): value is AuditEntry => object(value) && typeof value.id === 'string' && typeof value.projectId === 'string' && (typeof value.createdAt === 'string' || value.createdAt instanceof Date) && typeof value.createdAtEpoch === 'number' && typeof value.actorId === 'string' && typeof value.action === 'string' && typeof value.resourceType === 'string' && typeof value.resourceId === 'string' && (value.environmentId === null || typeof value.environmentId === 'string') && typeof value.summary === 'string' && (value.before === null || object(value.before)) && (value.after === null || object(value.after));
function validate<T>(body: unknown, guard: (value: unknown) => value is T): T { if (!guard(body)) throw new ApiError(502, 'The server returned an invalid response.'); return body; }
export async function request<T>(path: string, init: RequestInit = {}, guard?: (value: unknown) => value is T): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init.headers } });
  const text = await response.text(); let body: unknown; if (response.headers.get('content-type')?.includes('text/csv')) body = text; else if (text) { try { body = JSON.parse(text) as unknown; } catch { body = undefined; } }
  if (!response.ok) throw new ApiError(response.status, messageFrom(body));
  return guard ? validate(body, guard) : body as T;
}
const path = (...parts: string[]) => parts.map((part) => encodeURIComponent(part)).join('/');
const pageOrArray = <T>(guard: (value: unknown) => value is T) => (value: unknown): value is Page<T> => Array.isArray(value) ? value.every(guard) : isPage(guard)(value);
const normalizePage = <T>(value: Page<T> | T[]): Page<T> => Array.isArray(value) ? { data: value } : value;
export const api = {
  me: () => request<User>('/auth/me', {}, isUser),
  login: (username: string, password: string) => request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }, (value): value is { user: User } => object(value) && isUser(value.user)),
  logout: () => request<{ status: boolean }>('/auth/logout', { method: 'POST' }, isStatus),
  projects: () => request<Page<Project>>('/projects', {}, isPage(isProject)),
  createProject: (name: string) => request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name }) }, isProject),
  updateProject: (id: string, name: string) => request<Project>(`/${path('projects', id)}`, { method: 'PATCH', body: JSON.stringify({ name }) }, isProject),
  deleteProject: (id: string) => request<void>(`/${path('projects', id)}`, { method: 'DELETE' }),
  environments: async (projectId: string) => normalizePage(await request<Page<Environment> | Environment[]>(`/${path('projects', projectId, 'environments')}`, {}, pageOrArray(isEnvironment))),
  createEnvironment: (projectId: string, name: string) => request<Environment>(`/${path('projects', projectId, 'environments')}`, { method: 'POST', body: JSON.stringify({ name }) }, isEnvironment),
  updateEnvironment: (projectId: string, id: string, name: string) => request<Environment>(`/${path('projects', projectId, 'environments', id)}`, { method: 'PATCH', body: JSON.stringify({ name }) }, isEnvironment),
  deleteEnvironment: (projectId: string, id: string) => request<void>(`/${path('projects', projectId, 'environments', id)}`, { method: 'DELETE' }),
  flags: async (projectId: string, environmentId: string) => normalizePage(await request<Page<FeatureFlag> | FeatureFlag[]>(`/${path('projects', projectId, 'environments', environmentId, 'flags')}`, {}, pageOrArray(isFlag))),
  getFlag: (projectId: string, environmentId: string, key: string) => request<FeatureFlag>(`/${path('projects', projectId, 'environments', environmentId, 'flags', key)}`, {}, isFlag),
  createFlag: (projectId: string, environmentId: string, payload: Omit<FeatureFlag, 'environmentId' | 'version'>) => request<FeatureFlag>(`/${path('projects', projectId, 'environments', environmentId, 'flags')}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(payload) }, isFlag),
  updateFlag: (projectId: string, environmentId: string, key: string, payload: Partial<Omit<FeatureFlag, 'key' | 'environmentId' | 'version'>>, version: number) => request<FeatureFlag>(`/${path('projects', projectId, 'environments', environmentId, 'flags', key)}`, { method: 'PATCH', headers: { 'If-Match': `"${version}"` }, body: JSON.stringify(payload) }, isFlag),
  deleteFlag: (projectId: string, environmentId: string, key: string) => request<void>(`/${path('projects', projectId, 'environments', environmentId, 'flags', key)}`, { method: 'DELETE' }),
  sdkKeys: (projectId: string, environmentId: string) => request<SdkKeyMetadata[]>(`/${path('projects', projectId, 'environments', environmentId, 'sdk-keys')}`, {}, (value): value is SdkKeyMetadata[] => Array.isArray(value) && value.every(isSdkMetadata)),
  createSdkKey: (projectId: string, environmentId: string) => request<IssuedSdkKey>(`/${path('projects', projectId, 'environments', environmentId, 'sdk-keys')}`, { method: 'POST' }, isIssuedKey),
  revokeSdkKey: (projectId: string, environmentId: string, id: string) => request<void>(`/${path('projects', projectId, 'environments', environmentId, 'sdk-keys', id)}`, { method: 'DELETE' }),
  auditLogs: (projectId: string, filters: AuditFilters = {}) => { const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '').map(([key, value]) => [key, String(value)])); return request<Page<AuditEntry>>(`/${path('projects', projectId, 'audit-logs')}${query.size ? `?${query}` : ''}`, {}, isPage(isAudit)); },
  auditRetention: (projectId: string) => request<{ retentionDays: number }>(`/${path('projects', projectId, 'audit-retention')}`, {}, isRetention),
  setAuditRetention: (projectId: string, retentionDays: number) => request<{ retentionDays: number }>(`/${path('projects', projectId, 'audit-retention')}`, { method: 'PATCH', body: JSON.stringify({ retentionDays }) }, isRetention),
  exportAudit: (projectId: string, filters: { environmentId?: string; resourceType?: string; action?: string } = {}) => { const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1]))); return request<string>(`/${path('projects', projectId, 'audit-logs')}/export${query.size ? `?${query}` : ''}`, { headers: { Accept: 'text/csv' } }); },
};
export { operators };

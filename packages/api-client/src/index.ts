import type { LearningGoal, Note, Project, Settings } from '@compass/shared';
import type { CaptureRequest } from '@compass/shared/zod';

export interface CompassClientOptions {
  baseUrl: string;
  token?: string;
  fetch?: typeof fetch;
}

export interface CaptureResponse {
  note: Note;
  duplicate: boolean;
}

export interface DashboardCounts {
  projects_by_stage: Record<string, number>;
  learning_by_status: Record<string, number>;
  reading_by_status: Record<string, number>;
  inbox_count: number;
}

export class CompassClient {
  private readonly base: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: CompassClientOptions) {
    this.base = opts.baseUrl.replace(/\/$/, '');
    this.token = opts.token;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  // ---------- low-level ----------
  private async req<T>(
    path: string,
    init?: RequestInit & { auth?: boolean; raw?: boolean },
  ): Promise<T> {
    const url = `${this.base}${path}`;
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    if ((init?.auth ?? true) && this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    const res = await this.fetchImpl(url, { ...init, headers });
    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // ignore
      }
      throw new CompassApiError(res.status, body);
    }
    if (init?.raw) return (await res.text()) as unknown as T;
    return (await res.json()) as T;
  }

  // ---------- capture ----------
  capture(input: CaptureRequest): Promise<CaptureResponse> {
    return this.req('/api/v1/captures', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // ---------- inbox ----------
  inbox(): Promise<{ notes: Note[] }> {
    return this.req('/api/v1/inbox');
  }

  fileFromInbox(
    noteId: string,
    payload:
      | { target: 'existing'; target_type: 'project' | 'learning_goal'; target_id: string }
      | { target: 'new_project'; title: string }
      | { target: 'new_learning_goal'; title: string }
      | { target: 'keep_unfiled_note' },
  ) {
    return this.req(`/api/v1/inbox/${noteId}/file`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ---------- projects ----------
  listProjects(query?: { stage?: string; status?: string; limit?: number }): Promise<{
    projects: Project[];
  }> {
    const q = query
      ? `?${new URLSearchParams(query as Record<string, string>).toString()}`
      : '';
    return this.req(`/api/v1/projects${q}`);
  }
  getProject(id: string): Promise<{ project: Project }> {
    return this.req(`/api/v1/projects/${id}`);
  }
  createProject(body: Partial<Project>): Promise<{ project: Project }> {
    return this.req('/api/v1/projects', { method: 'POST', body: JSON.stringify(body) });
  }
  patchProject(id: string, body: Partial<Project>) {
    return this.req(`/api/v1/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  snoozeProject(id: string, body: { until: string; reason: string }) {
    return this.req(`/api/v1/projects/${id}/snooze`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  unsnoozeProject(id: string) {
    return this.req(`/api/v1/projects/${id}/unsnooze`, { method: 'POST' });
  }

  // ---------- learning ----------
  listLearningGoals(): Promise<{ learning_goals: LearningGoal[] }> {
    return this.req('/api/v1/learning-goals');
  }
  getLearningGoal(id: string): Promise<{ learning_goal: LearningGoal }> {
    return this.req(`/api/v1/learning-goals/${id}`);
  }

  // ---------- dashboard ----------
  momentum(days = 7) {
    return this.req<{ items: unknown[] }>(`/api/v1/dashboard/momentum?days=${days}`);
  }
  needsAttention() {
    return this.req<{ items: unknown[] }>(`/api/v1/dashboard/needs-attention`);
  }
  thisWeek(days = 7) {
    return this.req<{ projects: unknown[]; learning_goals: unknown[] }>(
      `/api/v1/dashboard/this-week?days=${days}`,
    );
  }
  counts(): Promise<DashboardCounts> {
    return this.req(`/api/v1/dashboard/counts`);
  }
  digest(): Promise<{ markdown: string }> {
    return this.req(`/api/v1/dashboard/digest/daily`);
  }

  // ---------- settings ----------
  getSettings(): Promise<{ settings: Settings }> {
    return this.req('/api/v1/settings');
  }
  patchSettings(patch: Partial<Settings>) {
    return this.req('/api/v1/settings', { method: 'PATCH', body: JSON.stringify(patch) });
  }

  // ---------- search ----------
  search(q: string, opts?: { types?: string[]; limit?: number }) {
    const params = new URLSearchParams({ q, ...(opts?.limit ? { limit: String(opts.limit) } : {}) });
    if (opts?.types) params.set('types', opts.types.join(','));
    return this.req<{ hits: unknown[] }>(`/api/v1/search?${params}`);
  }

  // ---------- device-code auth ----------
  async startDeviceCode(scope: 'cli' | 'helper') {
    return this.req<{
      device_code: string;
      user_code: string;
      verification_url: string;
      expires_in: number;
      interval: number;
    }>(`/api/v1/auth/device`, {
      method: 'POST',
      body: JSON.stringify({ scope }),
      auth: false,
    });
  }

  async pollDeviceCode(device_code: string) {
    return this.req<{ status: 'pending' | 'approved' | 'denied'; token?: string }>(
      `/api/v1/auth/poll`,
      { method: 'POST', body: JSON.stringify({ device_code }), auth: false },
    );
  }
}

export class CompassApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`Compass API ${status}`);
  }
}

// Node-side client for the standalone Nexus Social app (Express/Atlas/Telegram).
// Logs in with configured credentials, caches the JWT, and exposes the draft/publish
// flow the cockpit needs. Runs server-side so Nexus credentials never reach the browser.

export interface NexusClientOptions {
  baseUrl?: string;
  email?: string;
  password?: string;
  fetchImpl?: typeof fetch;
}

export interface NexusAccount {
  id: string;
  platform: string;
  username: string;
  displayName?: string;
}

export interface NexusHealth {
  available: boolean;
  accounts: NexusAccount[];
  detail: string;
}

export interface NexusClient {
  health: () => Promise<NexusHealth>;
  draftPost: (content: string, accountId: string) => Promise<{ postId: string }>;
  publishPost: (postId: string) => Promise<unknown>;
  requestApproval: (postId: string) => Promise<boolean>;
}

export function createNexusClient(options: NexusClientOptions = {}): NexusClient {
  const baseUrl = (options.baseUrl ?? "http://127.0.0.1:5000").replace(/\/$/, "");
  const email = options.email ?? "";
  const password = options.password ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  let token: string | null = null;

  async function login(): Promise<string> {
    const response = await fetchImpl(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await response.json()) as { token?: string; message?: string };
    if (!response.ok || !payload.token) {
      throw new Error(payload.message || `Nexus login failed (HTTP ${response.status}).`);
    }
    token = payload.token;
    return token;
  }

  async function authed(path: string, init: RequestInit): Promise<Response> {
    if (!token) await login();
    const withAuth = (): RequestInit => ({
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    let response = await fetchImpl(`${baseUrl}${path}`, withAuth());
    if (response.status === 401) {
      await login();
      response = await fetchImpl(`${baseUrl}${path}`, withAuth());
    }
    return response;
  }

  async function listAccounts(): Promise<NexusAccount[]> {
    const response = await authed("/api/accounts", { method: "GET" });
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };
    return (payload.data ?? []).map((account) => ({
      id: String(account._id),
      platform: String(account.platform),
      username: String(account.username),
      displayName: account.displayName ? String(account.displayName) : undefined,
    }));
  }

  return {
    async health(): Promise<NexusHealth> {
      try {
        const ping = await fetchImpl(`${baseUrl}/health`);
        if (!ping.ok) return { available: false, accounts: [], detail: `Nexus returned HTTP ${ping.status}.` };
        const accounts = await listAccounts();
        return { available: true, accounts, detail: `Nexus reachable with ${accounts.length} connected account(s).` };
      } catch {
        return { available: false, accounts: [], detail: `Nexus not reachable at ${baseUrl}.` };
      }
    },

    async draftPost(content: string, accountId: string): Promise<{ postId: string }> {
      const response = await authed("/api/posts", {
        method: "POST",
        body: JSON.stringify({ content, platforms: [{ platform: "telegram", accountId }] }),
      });
      const payload = (await response.json()) as { data?: { _id?: string }; message?: string };
      if (!response.ok || !payload.data?._id) {
        throw new Error(payload.message || `Nexus draft failed (HTTP ${response.status}).`);
      }
      return { postId: payload.data._id };
    },

    async publishPost(postId: string): Promise<unknown> {
      const response = await authed(`/api/posts/${postId}/publish`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error((payload as { message?: string }).message || `Nexus publish failed (HTTP ${response.status}).`);
      }
      return payload;
    },

    async requestApproval(postId: string): Promise<boolean> {
      const response = await authed(`/api/posts/${postId}/request-approval`, { method: "POST" });
      return response.ok;
    },
  };
}

export type Profile = {
  id: string;
  name: string;
  email: string;
  password: string;
  about: string;
  accent: [string, string];
};

export type FriendRequest = { id: string; fromEmail: string; toEmail: string; status: 'pending' | 'accepted' };
export type Message = { id: string; senderEmail: string; text: string; time: string };
export type Thread = { id: string; participants: [string, string]; messages: Message[]; unreadCounts?: Record<string, number> };
export type Store = { profiles: Profile[]; requests: FriendRequest[]; threads: Thread[]; currentUserEmail: string | null };

export const INITIAL_STORE: Store = { profiles: [], requests: [], threads: [], currentUserEmail: null };

const DEFAULT_WEB_API_URL = 'http://localhost:3100';
const DEFAULT_NATIVE_API_URL = 'http://10.0.2.2:3100';
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (typeof window !== 'undefined' ? DEFAULT_WEB_API_URL : DEFAULT_NATIVE_API_URL);

function normalizeStore(store: Store): Store {
  return {
    ...store,
    profiles: store.profiles.map((profile) => ({
      ...profile,
      password: profile.password ?? '',
    })),
    threads: store.threads.map((thread) => ({
      ...thread,
      unreadCounts: thread.unreadCounts ?? {},
    })),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function loadStore() {
  const data = await request<{ store: Store }>('/store');
  return normalizeStore(data.store);
}

export async function saveStore(store: Store) {
  await request<{ ok: true }>('/store', {
    method: 'PUT',
    body: JSON.stringify({ store }),
  });
}

export function getBackendUrl() {
  return API_URL;
}

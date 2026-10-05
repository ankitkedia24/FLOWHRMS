import { supabase } from "./supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    let url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    if (options.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        url += `${url.includes("?") ? "&" : "?"}${qs}`;
      }
    }

    console.log(`\n📱 [Mobile App] Fetching: ${url}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log(`📱 [Mobile App] Status: ${response.status} from ${url}`);

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      console.warn(`📱 [Mobile App] Error from ${url}:`, json || response.statusText);
      return {
        data: null,
        error: json?.error || `Request failed with status ${response.status} from ${url}`,
      };
    }

    return { data: json as T, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error(`📱 [Mobile App] Connection failed to ${API_BASE_URL}:`, message);
    return { data: null, error: `Connection failed to ${API_BASE_URL} (${message})` };
  }
}

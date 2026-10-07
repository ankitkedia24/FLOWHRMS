import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { supabase } from "./supabase";

function getApiBaseUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // When testing in browser on developer PC, localhost avoids CORS & loopback IP failures
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:3000/api/v1";
    }
  }
  return process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<{ data: T | null; error: string | null }> {
  const apiBase = getApiBaseUrl();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    let url = `${apiBase}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

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

    // Attach stored user profile context if available
    try {
      const profileStr =
        Platform.OS === "web"
          ? typeof localStorage !== "undefined"
            ? localStorage.getItem("flowhrms_user_profile")
            : null
          : await SecureStore.getItemAsync("flowhrms_user_profile").catch(() => null);

      if (profileStr) {
        const profile = JSON.parse(profileStr);
        if (profile.email) headers["x-user-email"] = profile.email;
        if (profile.id) headers["x-user-id"] = profile.id;
        if (profile.tenant?.id) headers["x-tenant-id"] = profile.tenant.id;
      }
    } catch {}

    const response = await fetch(url, {
      ...options,
      cache: "no-store",
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
    console.error(`📱 [Mobile App] Connection failed to ${apiBase}:`, message);
    return { data: null, error: `Connection failed to ${apiBase} (${message})` };
  }
}

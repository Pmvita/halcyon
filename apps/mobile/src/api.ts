import Constants from "expo-constants";
import { token } from "./session";

function base() {
  return process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3000";
}

export async function login(email: string, password: string): Promise<{ token?: string; error?: string }> {
  const response = await fetch(`${base()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-halcyon-request": "1" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!response.ok) return { error: body.error?.message };
  return { token: body.token as string | undefined };
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${base()}${path}`, { headers: { "x-halcyon-request": "1", cookie: `halcyon_session=${await token()}` } });
  return response.json() as Promise<T>;
}

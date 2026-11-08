import * as SecureStore from "expo-secure-store";

const KEY = "halcyon.session";

export async function saveToken(value: string) {
  await SecureStore.setItemAsync(KEY, value);
}

export async function token() {
  return (await SecureStore.getItemAsync(KEY)) ?? "";
}

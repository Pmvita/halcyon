import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { palette } from "@halcyon/domain";
import { login } from "../src/api";
import { saveToken } from "../src/session";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("maya@halcyon.demo");
  const [password, setPassword] = useState("meridian-desk");
  const [error, setError] = useState("");
  return (
    <View style={{ flex: 1, backgroundColor: palette.paper, padding: 24, justifyContent: "center" }}>
      <Text style={{ letterSpacing: 3, marginBottom: 12 }}>HALCYON</Text>
      <Text style={{ fontSize: 32, marginBottom: 12 }}>One desk.</Text>
      <Text accessibilityRole="text" style={{ marginBottom: 16 }}>Halcyon Demo · Simulated balances · Real market data.</Text>
      <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ borderBottomWidth: 1, minHeight: 48, marginBottom: 12 }} />
      <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ borderBottomWidth: 1, minHeight: 48, marginBottom: 12 }} />
      {error ? <Text>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enter the desk"
        onPress={() => {
          void login(email, password).then(async (result) => {
            if (!result.token) { setError(result.error ?? "Sign-in failed."); return; }
            await saveToken(result.token);
            router.replace("/home");
          });
        }}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text>Enter the desk</Text>
      </Pressable>
      <Text style={{ marginTop: 16 }}>Do not reuse the demo password anywhere.</Text>
    </View>
  );
}

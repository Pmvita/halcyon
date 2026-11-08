import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { getJson } from "../src/api";

export default function Trade() {
  const [qty, setQty] = useState("10");
  const [message, setMessage] = useState("Review a market buy of AAPL. It fills on HALCYON-SIM.");
  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 32 }}>Trade</Text>
      <TextInput accessibilityLabel="Quantity" value={qty} onChangeText={setQty} style={{ borderBottomWidth: 1, minHeight: 48 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Confirm buy AAPL" style={{ minHeight: 48, justifyContent: "center" }} onPress={() => {
        void getJson<{ accounts: { id: string; type: string }[] }>("/api/v1/banking").then(async (bank) => {
          const account = bank.accounts.find((item) => item.type === "brokerage");
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"}/api/v1/orders`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-halcyon-request": "1" },
            body: JSON.stringify({ accountId: account?.id, symbol: "AAPL", side: "buy", type: "market", qty: Number(qty), tif: "day", confirmed: true, idempotencyKey: `m_${Date.now()}` }),
          });
          const body = await response.json();
          setMessage(body.error?.message ?? `Status ${body.order?.status}. Filled ${body.order?.filledQty}.`);
        });
      }}>
        <Text>Confirm buy {qty} AAPL</Text>
      </Pressable>
      <Text>{message}</Text>
    </View>
  );
}

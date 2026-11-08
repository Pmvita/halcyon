import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { getJson } from "../src/api";

export default function CryptoScreen() {
  const [digest, setDigest] = useState("");
  const [rows, setRows] = useState<{ symbol: string; last: number; status: string; source: string }[]>([]);
  useEffect(() => {
    void getJson<{ digest: string; quotes: { symbol: string; last: number; status: string; source: string }[] }>("/api/v1/crypto").then((body) => {
      setDigest(body.digest ?? "");
      setRows(body.quotes ?? []);
    });
  }, []);
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 32 }}>Crypto</Text>
      <Text>{digest}</Text>
      {rows.map((row) => <Text key={row.symbol} style={{ paddingVertical: 8 }}>{row.symbol} {row.last} · {row.status} · {row.source}</Text>)}
      <Text>Watch-only. Halcyon cannot move these coins.</Text>
    </ScrollView>
  );
}

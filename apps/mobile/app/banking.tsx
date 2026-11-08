import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { formatMoney } from "@halcyon/domain";
import { getJson } from "../src/api";

export default function Banking() {
  const [rows, setRows] = useState<{ id: string; name: string; balanceMinor: number }[]>([]);
  useEffect(() => { void getJson<{ accounts: { id: string; name: string; balanceMinor: number }[] }>("/api/v1/banking").then((body) => setRows(body.accounts ?? [])); }, []);
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 32, marginBottom: 12 }}>Banking</Text>
      {rows.map((row) => <Text key={row.id} style={{ paddingVertical: 10 }}>{row.name} {formatMoney(row.balanceMinor)}</Text>)}
    </ScrollView>
  );
}

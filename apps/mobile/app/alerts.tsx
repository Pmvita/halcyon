import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { getJson } from "../src/api";

export default function Alerts() {
  const [items, setItems] = useState<{ id: string; title: string; body: string }[]>([]);
  useEffect(() => { void getJson<{ id: string; title: string; body: string }[]>("/api/v1/inbox").then(setItems); }, []);
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 32 }}>Alerts</Text>
      {items.map((item) => <Text key={item.id} style={{ paddingVertical: 10 }}>{item.title}. {item.body}</Text>)}
    </ScrollView>
  );
}

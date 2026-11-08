import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import { formatMoney } from "@halcyon/domain";
import { getJson } from "../src/api";

type Home = { netWorthMinor: number; cashMinor: number; investmentsMinor: number; cryptoMinor: number; quotes: { symbol: string; last: number; status: string; source: string }[] };

export default function HomeScreen() {
  const [home, setHome] = useState<Home | null>(null);
  useEffect(() => { void getJson<Home>("/api/v1/home").then(setHome); }, []);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text>Halcyon Demo · Simulated balances · Real market data.</Text>
      <Text style={{ fontSize: 40, marginVertical: 12 }}>{home ? formatMoney(home.netWorthMinor) : "…"}</Text>
      <Text>Cash {home ? formatMoney(home.cashMinor) : ""}</Text>
      <Text>Investments {home ? formatMoney(home.investmentsMinor) : ""}</Text>
      <Text>Crypto {home ? formatMoney(home.cryptoMinor) : ""}</Text>
      {home?.quotes.map((quote) => (
        <View key={quote.symbol} style={{ paddingVertical: 12, borderTopWidth: 1 }}>
          <Text>{quote.symbol} {quote.last} · {quote.status} · {quote.source}</Text>
        </View>
      ))}
      <Link href="/banking" asChild><Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }}><Text>Banking</Text></Pressable></Link>
      <Link href="/trade" asChild><Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }}><Text>Trade</Text></Pressable></Link>
      <Link href="/crypto" asChild><Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }}><Text>Crypto</Text></Pressable></Link>
      <Link href="/alerts" asChild><Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }}><Text>Alerts</Text></Pressable></Link>
    </ScrollView>
  );
}

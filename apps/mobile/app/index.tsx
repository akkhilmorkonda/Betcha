import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useSession, signOut } from "../lib/auth-client";
import { apiFetch, ApiError } from "../lib/api";
import { money } from "@betcha/core";

const BG = "#0B0D12";
const MUTED = "#8A8F98";

type Member = { userId: string; name: string; balance: number };
type CircleResponse = {
  circle: { name: string; members: Member[]; resolvedCount: number; open: unknown[] };
};

export default function Index() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [circle, setCircle] = useState<CircleResponse["circle"] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/signin");
      return;
    }
    // The first real proof the native session reaches the API: this endpoint
    // requires membership, so a missing cookie comes back 401, not empty data.
    apiFetch<CircleResponse>("/api/circle/HACKMIT")
      .then((r) => setCircle(r.circle))
      .catch((e) => setErr(e instanceof ApiError ? e.message : String(e)));
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 72, gap: 20 }}>
        <View>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "700" }}>
            {circle?.name ?? "Betcha"}
          </Text>
          <Text style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>
            Signed in as {session.user.name}
          </Text>
        </View>

        {err && <Text style={{ color: "#FF5C5C", fontSize: 14 }}>{err}</Text>}

        {circle && (
          <View style={{ gap: 10 }}>
            {circle.members.map((m) => (
              <View key={m.userId} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: MUTED, fontSize: 15 }}>{m.name}</Text>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                  {money(m.balance)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={async () => { await signOut(); router.replace("/signin"); }}
          style={{ borderWidth: 1, borderColor: "#222834", borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
        >
          <Text style={{ color: MUTED, fontSize: 15 }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

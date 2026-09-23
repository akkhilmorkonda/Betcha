import { ScrollView, Text, View } from "react-native";
import {
  lineFor,
  oddsFrom,
  payoutFor,
  money,
  mult,
  CENTS,
  MIN_STAKE,
  generateInviteCode,
  isWellFormedInviteCode,
  isTemplateOnly,
  placePositionBody,
} from "@betcha/core";

/**
 * The scaffold's real job: prove the shared core actually runs inside a React
 * Native bundle, on device, not just in a test.
 *
 * Everything below is computed by the same modules the API prices bets with.
 * If Metro ever stops resolving the workspace package, this screen is where it
 * shows up first — which is why it renders values rather than a placeholder.
 */
export default function Index() {
  const odds = oddsFrom(lineFor(1300, 1200));
  const stake = 5 * CENTS;
  const code = generateInviteCode();
  const fractional = placePositionBody.safeParse({ side: "A", amount: 100.5 });

  const rows: [string, string][] = [
    ["Line (1300 vs 1200)", `${(odds.probA * 100).toFixed(1)}%`],
    ["Multiplier A", mult(odds.multiplierA)],
    ["Stake", money(stake)],
    ["Returns at A", money(payoutFor(stake, odds.multiplierA))],
    ["Minimum stake", money(MIN_STAKE)],
    ["Invite code", `${code} (valid: ${isWellFormedInviteCode(code)})`],
    ["Dares template-only", String(isTemplateOnly("dares"))],
    ["Fractional stake refused", String(!fractional.success)],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0D12" }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 72, gap: 20 }}>
        <View>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>Betcha</Text>
          <Text style={{ color: "#8A8F98", fontSize: 14, marginTop: 4 }}>
            Shared engine, running on device
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {rows.map(([label, value]) => (
            <View
              key={label}
              style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}
            >
              <Text style={{ color: "#8A8F98", fontSize: 14, flexShrink: 1 }}>{label}</Text>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={{ color: "#8A8F98", fontSize: 12, lineHeight: 18 }}>
          Every figure above comes from @betcha/core — the same pricing, money
          formatting and validation the API uses. Nothing is duplicated here.
        </Text>
      </ScrollView>
    </View>
  );
}

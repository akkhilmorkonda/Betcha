import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { signIn, signUp } from "../lib/auth-client";

const BG = "#0B0D12";
const EDGE = "#222834";
const MUTED = "#8A8F98";
const NO = "#FF5C5C";

export default function SignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    if (!email.trim()) return setErr("Enter your email");
    if (!password) return setErr("Enter your password");
    if (mode === "signup" && !name.trim()) return setErr("Enter your name");

    setBusy(true);
    const res =
      mode === "signin"
        ? await signIn.email({ email: email.trim(), password })
        : await signUp.email({ email: email.trim(), password, name: name.trim() });
    setBusy(false);

    if (res.error) return setErr(res.error.message ?? "That did not work");
    router.replace("/");
  }

  const field = {
    backgroundColor: "#11151D",
    borderWidth: 1,
    borderColor: EDGE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: BG, justifyContent: "center", padding: 24, gap: 18 }}>
      <View>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "700" }}>
          {mode === "signin" ? "Sign in" : "Create an account"}
        </Text>
        <Text style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>
          Your circles are tied to your account.
        </Text>
      </View>

      {mode === "signup" && (
        <TextInput
          style={field}
          placeholder="Name"
          placeholderTextColor={MUTED}
          value={name}
          onChangeText={(v) => { setName(v); setErr(null); }}
        />
      )}

      <TextInput
        style={field}
        placeholder="Email"
        placeholderTextColor={MUTED}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={(v) => { setEmail(v); setErr(null); }}
      />

      <TextInput
        style={field}
        placeholder="Password"
        placeholderTextColor={MUTED}
        secureTextEntry
        value={password}
        onChangeText={(v) => { setPassword(v); setErr(null); }}
      />

      {err && <Text style={{ color: NO, fontSize: 14 }}>{err}</Text>}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={{ backgroundColor: "#fff", borderRadius: 10, paddingVertical: 13, alignItems: "center", opacity: busy ? 0.5 : 1 }}
      >
        {busy ? (
          <ActivityIndicator color={BG} />
        ) : (
          <Text style={{ color: BG, fontWeight: "700", fontSize: 15 }}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); }}>
        <Text style={{ color: MUTED, fontSize: 14, textAlign: "center" }}>
          {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}

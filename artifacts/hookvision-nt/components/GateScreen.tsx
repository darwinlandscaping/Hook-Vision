import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const GATE_KEY = "hv_gate_auth";
const CORRECT  = "Pepper73";

function isUnlocked(): boolean {
  try {
    return typeof window !== "undefined" &&
      window.localStorage.getItem(GATE_KEY) === "1";
  } catch {
    return false;
  }
}

function unlock() {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(GATE_KEY, "1");
  } catch {}
}

interface Props { onUnlock: () => void }

export default function GateScreen({ onUnlock }: Props) {
  const [pw, setPw]       = useState("");
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  function attempt() {
    if (pw === CORRECT) {
      unlock();
      onUnlock();
    } else {
      setError(true);
      setShaking(true);
      setPw("");
      setTimeout(() => setShaking(false), 500);
    }
  }

  return (
    <KeyboardAvoidingView
      style={S.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={S.card}>
        <Text style={S.logo}>H<Text style={S.hook}>◎</Text>OKVISION</Text>
        <Text style={S.sub}>PRIVATE ACCESS</Text>

        <TextInput
          style={[S.input, shaking && S.inputError]}
          placeholder="Enter password"
          placeholderTextColor="#ffffff44"
          secureTextEntry
          value={pw}
          onChangeText={v => { setPw(v); setError(false); }}
          onSubmitEditing={attempt}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {error && (
          <Text style={S.errorText}>Incorrect password</Text>
        )}

        <Pressable
          style={({ pressed }) => [S.btn, pressed && S.btnPressed]}
          onPress={attempt}
        >
          <Text style={S.btnText}>UNLOCK →</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export { isUnlocked };

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a1628",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "85%",
    maxWidth: 360,
    alignItems: "center",
    gap: 16,
  },
  logo: {
    fontSize: 36,
    fontFamily: "Oswald_700Bold",
    color: "#ffd700",
    letterSpacing: 4,
  },
  hook: {
    color: "#00d4aa",
  },
  sub: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff55",
    letterSpacing: 4,
    marginTop: -8,
    marginBottom: 8,
  },
  input: {
    width: "100%",
    height: 52,
    backgroundColor: "#0d1f3a",
    borderWidth: 1,
    borderColor: "#1a2f4a",
    borderRadius: 12,
    paddingHorizontal: 18,
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  inputError: {
    borderColor: "#ff4400",
  },
  errorText: {
    color: "#ff4400",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: -8,
  },
  btn: {
    width: "100%",
    height: 52,
    backgroundColor: "#00d4aa",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Oswald_700Bold",
    color: "#000000",
    letterSpacing: 2.5,
  },
});

import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

import { API_URL } from "./config";

/**
 * The native auth client.
 *
 * The expo plugin keeps the session cookie in SecureStore (the iOS Keychain)
 * and replays it as an ordinary Cookie header, which is why the server side
 * needed no change: auth.api.getSession reads headers either way.
 *
 * `scheme` must match expo.scheme in app.json AND trustedOrigins in
 * apps/api/src/lib/auth.ts. If the three disagree the session never returns.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "betcha",
      storagePrefix: "betcha",
      storage: SecureStore,
    }),
  ],
});

export const { signIn, signUp, signOut, useSession, deleteUser } = authClient;

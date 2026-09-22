import { createAuthClient } from "better-auth/react";

/**
 * Web client. The Expo client in Phase 4 gets its own client built on
 * @better-auth/expo, which stores the session in expo-secure-store rather than
 * a browser cookie jar.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, deleteUser } = authClient;

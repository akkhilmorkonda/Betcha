# Running on a real device

No Android Studio or Mac needed. Every dependency in apps/mobile is a standard
Expo SDK module or pure JS, so the app runs in **Expo Go** — no custom native
code, no development build required yet.

## 1. Point the client at your machine

`localhost` on a phone means the phone. Create `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL="http://<YOUR-LAN-IP>:3000"
```

`EXPO_PUBLIC_*` is inlined at BUILD time, so restart Expo after changing it.

## 2. Start the API so the phone can reach it

```bash
npm run dev:lan
```

This binds 0.0.0.0 rather than localhost. It also runs with
`NODE_ENV=development`, which is what makes the `exp://` entries in
`trustedOrigins` active — they are gated off in production on purpose.

## 3. Start Expo

```bash
npm run mobile
```

Install **Expo Go** from the Play Store and scan the QR code. The phone must
be on the same network as your machine.

## What to check

Sign in as a seeded member — `bob@seed.invalid` / `betcha-dev-password`.

A successful sign-in followed by the circle list rendering proves the three
things that could not be verified from Windows:

- the cookie survives a round trip through **SecureStore**
- `apiFetch` attaches it (a missing `await` would send `[object Promise]`)
- the **scheme handshake** matches across app.json, expoClient and trustedOrigins

A 401 on the circle screen means the cookie did not arrive. That endpoint
requires membership, so it fails loudly rather than rendering empty.

## If the phone cannot reach the API

Windows Firewall usually blocks inbound 3000 on first run — allow Node when
prompted. Some networks (guest wifi, client isolation) block device-to-device
traffic entirely; a phone hotspot with the laptop joined to it is the quickest
way around that.

## Android emulator instead

Android Studio needs roughly 12-16 GB free and this machine currently has
about 6. Expo Go on a real phone costs nothing and exercises the same code.

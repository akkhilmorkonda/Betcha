# Running on a real device

Every dependency here is a standard Expo SDK module or pure JS, so the app runs
in **Expo Go** — no custom native code, no development build required yet.

**Android: free.** Install Expo Go from the Play Store and scan a QR code.

**iPhone: needs the Apple Developer Program ($99/yr).** Expo's docs are explicit
that installing Expo Go on an iOS device requires an active subscription — you
build your own copy with `npx eas-cli@latest go` and install it through
TestFlight. A development build has the same gate, because provisioning a
physical device requires a team. There is no free path to an iPhone.

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

## Seeing the app without any device at all

The web app in `apps/api` is the whole product and runs today:

```bash
npm run db:seed
npm run dev          # http://localhost:3000
```

Sign in as `bob@seed.invalid` / `betcha-dev-password`. The circle feed, bet
detail, standings, new bet and account pages all work against the real Postgres
database. The mobile client is a second front end over the same API, not a
replacement — so this is the fastest way to see a change.

## Android emulator instead

Android Studio needs roughly 12-16 GB free. If that is available it is a fine
option, but Expo Go on any Android phone costs nothing and exercises the same
code.

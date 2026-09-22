/** @type {import('next').NextConfig} */
const nextConfig = {
  // @betcha/core ships TypeScript source rather than a build output, so Next
  // has to compile it like first-party code. Without this the app imports a
  // .ts file it will not transpile and the build fails at the first symbol.
  transpilePackages: ["@betcha/core"],

  // Deliberately empty.
  //
  // This used to carry ngrok and trycloudflare wildcards in
  // experimental.serverActions.allowedOrigins and allowedDevOrigins, so the
  // hackathon demo worked through a tunnel. A wildcard origin allowlist is not
  // something to ship: it tells the framework to trust any host under those
  // domains, which anyone can register a subdomain on.
  //
  // The whole serverActions block went with them. The app has no Server Actions
  // — there is no "use server" anywhere in src/ — so allowedOrigins governed
  // nothing, and bodySizeLimit applied to nothing either: it bounds Server
  // Action payloads, never route handlers. Evidence photos are posted to
  // /api/bets/[id]/evidence with fetch, and their 6MB bound is enforced by
  // submitEvidenceBody in src/lib/schemas.ts.
  //
  // If a tunnel is ever needed again, add the one exact host for as long as it
  // is needed, not a wildcard.
};
export default nextConfig;

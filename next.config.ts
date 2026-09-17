import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `@google/genai` ships separate Node.js and web builds and relies on
  // Node-specific resolution at runtime; opt it out of server bundling so the
  // route handler can `require` it natively. `pngjs` is pure JS but is kept
  // external for the same predictability.
  serverExternalPackages: ["@google/genai", "pngjs"],
};

export default nextConfig;

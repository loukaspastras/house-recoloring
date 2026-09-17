import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `@google/genai` ships separate Node.js and web builds and relies on
  // Node-specific resolution at runtime; opt it out of server bundling so the
  // route handler can `require` it natively. `sharp` is a native addon and must
  // always be loaded externally.
  serverExternalPackages: ["@google/genai", "sharp"],
};

export default nextConfig;

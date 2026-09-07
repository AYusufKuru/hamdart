import type { NextConfig } from "next";
import {
  HSTS_HEADER,
  STATIC_SECURITY_HEADERS,
} from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    const headers = [...STATIC_SECURITY_HEADERS];
    if (process.env.NODE_ENV === "production") {
      headers.push(HSTS_HEADER);
    }
    return [
      {
        source: "/:path*",
        headers,
      },
    ];
  },
};

export default nextConfig;

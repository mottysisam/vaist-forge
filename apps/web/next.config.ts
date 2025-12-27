import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Headers configuration for WASM audio processing
   *
   * SharedArrayBuffer is required for high-performance audio worklets.
   * It needs Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP) headers.
   *
   * Note: These headers can break some third-party iframes/resources that aren't CORS-enabled.
   * We apply them only to the /forge path where WASM preview is used.
   */
  async headers() {
    return [
      {
        // Apply COOP/COEP headers to forge pages for SharedArrayBuffer support
        source: "/forge/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
      {
        // CORS headers for WASM files
        source: "/wam/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

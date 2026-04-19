import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@meshsdk/core", "@meshsdk/react"],
  turbopack: {},
  webpack: (config, { isServer, webpack }) => {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        http2: false,
        child_process: false,
        os: false,
        async_hooks: false,
        diagnostics_channel: false,
      };
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: any) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
    }
    return config;
  },
};

export default nextConfig;

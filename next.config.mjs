/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@node-rs/argon2"],
  },

  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "www.ci-las.org",
        port: "",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;

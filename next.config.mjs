/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEON_DATABASE_URL:
      "postgresql://cilasdb_owner:ziVPTqLk3J4S@ep-restless-term-a21daafp.eu-central-1.aws.neon.tech/cilasdb?sslmode=require",
    CLOUDINARY_CLOUD_NAME: "dhsi4qsuh",
    CLOUDINARY_API_KEY: "868232231539949",
    CLOUDINARY_API_SECRET:
      "328258208807-s8s9k5lon34i2j8l2meqdgrs9e0sgsai.apps.googleusercontent.com",
    GOOGLE_CLIENT_ID:
      "328258208807-s8s9k5lon34i2j8l2meqdgrs9e0sgsai.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "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",
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

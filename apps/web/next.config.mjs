/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@pragati/shared"],
  // Prisma's generated client lives outside apps/web (packages/db/generated),
  // so Vercel's file tracer needs an explicit hint to bundle its query
  // engine binaries into the serverless functions.
  outputFileTracingIncludes: {
    "/**": ["../../packages/db/generated/client/**/*"],
  },
};

export default nextConfig;

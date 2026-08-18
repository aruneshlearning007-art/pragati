/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@pragati/shared"],
  // Prisma's query-engine binaries live deep in pnpm's content-addressed
  // store (node_modules/.pnpm/...), and Next's automatic file tracer can't
  // see through the dynamic require() Prisma's runtime uses to load them —
  // it silently drops the binary from the deployed function, which then
  // fails at runtime with "Query Engine ... not found" even though the
  // build itself succeeds. Force-include it explicitly.
  outputFileTracingIncludes: {
    "/**/*": ["../../node_modules/.pnpm/**/node_modules/.prisma/client/*.node"],
  },
};

export default nextConfig;

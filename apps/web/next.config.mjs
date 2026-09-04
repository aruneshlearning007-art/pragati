/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@pragati/shared"],
  // Prisma's query-engine binaries live deep in pnpm's content-addressed
  // store (node_modules/.pnpm/...), and Next's automatic file tracer can't
  // see through the dynamic require() Prisma's runtime uses to load them —
  // it silently drops the binary from the deployed function, which then
  // fails at runtime with "Query Engine ... not found" even though the
  // build itself succeeds. Force-include it explicitly.
  // pdfkit (used via @react-pdf/renderer for exam-paper PDFs) loads its
  // standard-font data files (Helvetica.cjs etc.) at runtime via a dynamic
  // require() the same way Prisma's query engine does above — Next's
  // tracer can't see through it and silently drops them, failing at
  // runtime with "Cannot find module .../standard-fonts/Helvetica.cjs"
  // even though the build succeeds.
  outputFileTracingIncludes: {
    "/**/*": [
      "../../node_modules/.pnpm/**/node_modules/.prisma/client/*.node",
      "../../node_modules/.pnpm/**/node_modules/pdfkit/js/standard-fonts/**/*",
    ],
  },
};

export default nextConfig;

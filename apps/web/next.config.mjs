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
  // even though the build succeeds. A first attempt globbed
  // "**/node_modules/pdfkit/..." broadly, which also matched the SAME
  // files through @react-pdf/font's own node_modules/pdfkit — a pnpm
  // symlink pointing back at this exact package — and Vercel's deploy
  // step failed with "ENOTDIR: not a directory, mkdir .../pdfkit" trying
  // to materialize both. Scoped to only pdfkit's own real (non-symlinked)
  // package folder instead; Node follows the symlink fine at runtime
  // regardless of which physical path the files were bundled from.
  outputFileTracingIncludes: {
    "/**/*": [
      "../../node_modules/.pnpm/**/node_modules/.prisma/client/*.node",
      "../../node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/standard-fonts/**/*",
    ],
  },
};

export default nextConfig;

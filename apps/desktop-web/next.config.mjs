/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep production builds from overwriting the active development module graph.
  // This allows `next build` verification to run while `next dev` is open without
  // causing missing chunk errors in the browser.
  distDir: process.env.NODE_ENV === 'production' ? '.next-production' : '.next',
};

export default nextConfig;

const path = require("path");
module.exports = {
  // Skip CRA's ESLint webpack plugin during builds.
  // Why: CRA's `eslintConfig.extends: ["react-app"]` needs `eslint-config-react-app`,
  // a peer of `react-scripts@5` that Yarn on cloud builders (Railway, Vercel) often
  // fails to hoist — producing `Failed to load config "react-app" to extend from`.
  // ESLint still runs in the developer's editor/CLI; skipping it in production is
  // the standard cloud-build practice.
  eslint: { enable: false },
  webpack: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@compass/db',
    '@compass/shared',
    '@compass/api-client',
    '@compass/search',
    '@compass/notifications',
    '@compass/scheduler',
  ],
  // Node-native packages must be `require()`d at runtime, not bundled by webpack.
  serverExternalPackages: ['better-sqlite3', 'postgres', 'pg', 'node-cron'],
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
  webpack: (config, { isServer }) => {
    // Workspace packages use ESM-style `.js` re-exports that point at TS sources.
    // Tell webpack to resolve `./foo.js` against `./foo.ts` / `.tsx` as well.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };

    config.externals = config.externals || [];
    if (isServer) {
      // Keep native deps as external commonjs so node `require` finds the prebuilt binaries.
      // node-cron uses `child_process` and `path` which webpack can't bundle for the server.
      config.externals.push({
        'better-sqlite3': 'commonjs better-sqlite3',
        postgres: 'commonjs postgres',
        pg: 'commonjs pg',
        'node-cron': 'commonjs node-cron',
        uuid: 'commonjs uuid',
      });
    } else {
      // Don't try to bundle node built-ins or db drivers into client bundles.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        'better-sqlite3': false,
        postgres: false,
        pg: false,
      };
    }
    return config;
  },
};

export default nextConfig;

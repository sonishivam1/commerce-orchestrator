/** @type {import('next').NextConfig} */
const path = require('path');
const fs = require('fs');

/**
 * Load the workspace-root .env file so that:
 *  - Root env vars are available to next.config.js at build/dev time
 *  - We can expose them as NEXT_PUBLIC_* vars without duplicating the file
 *
 * Next.js only auto-loads .env files from its own app directory (apps/web/).
 * This manual parse makes the root .env the single source of truth.
 */
function loadRootEnv() {
    const rootEnvPath = path.resolve(__dirname, '../../.env');
    if (!fs.existsSync(rootEnvPath)) return {};

    try {
        const lines = fs.readFileSync(rootEnvPath, 'utf8').split('\n');
        const vars = {};
        for (const raw of lines) {
            const line = raw.trim();
            if (!line || line.startsWith('#')) continue;
            const eqIdx = line.indexOf('=');
            if (eqIdx < 1) continue;
            const key = line.slice(0, eqIdx).trim();
            let val = line.slice(eqIdx + 1).trim();
            // Strip surrounding quotes if any
            if ((val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            // Don't override vars already set in the environment (e.g. CI)
            if (!process.env[key]) {
                process.env[key] = val;
            }
            vars[key] = process.env[key];
        }
        return vars;
    } catch {
        return {};
    }
}

const rootVars = loadRootEnv();

// Derive the GraphQL endpoint:
//   - GRAPHQL_SCHEMA_URL  — explicit override in root .env
//   - API_PORT            — used to build the default URL
const apiPort = rootVars['API_PORT'] ?? process.env['API_PORT'] ?? '4000';
const defaultApiUrl = `http://localhost:${apiPort}/graphql`;
const apiUrl = rootVars['GRAPHQL_SCHEMA_URL'] ?? process.env['GRAPHQL_SCHEMA_URL'] ?? defaultApiUrl;

const nextConfig = {
    transpilePackages: ['@cdo/ui', '@cdo/gql'],

    /**
     * NEXT_PUBLIC_* vars are inlined at build time by Next.js.
     * We map root-env vars to NEXT_PUBLIC_API_URL so the Apollo client
     * and any future client-side code don't need hardcoded URLs.
     */
    env: {
        NEXT_PUBLIC_API_URL: apiUrl,
    },

    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
        ],
    },
};

module.exports = nextConfig;

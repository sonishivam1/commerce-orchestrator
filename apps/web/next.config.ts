import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    transpilePackages: ['@cdo/ui', '@cdo/gql'],
    experimental: {
        typedRoutes: true,
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
        ],
    },
};

export default nextConfig;

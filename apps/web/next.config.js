/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@cdo/ui', '@cdo/gql'],
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
        ],
    },
};

module.exports = nextConfig;

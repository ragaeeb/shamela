import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    experimental: {
        externalDir: true,
    },
    reactStrictMode: true,
};

export default nextConfig;

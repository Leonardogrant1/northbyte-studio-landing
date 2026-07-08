/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@repo/backend"],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.convex.cloud',
                pathname: '/api/storage/**',
            }
        ],
    },
};

export default nextConfig;

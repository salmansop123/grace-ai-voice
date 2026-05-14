/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: false },
      { source: "/Home", destination: "/", permanent: false },
      { source: "/dashboard/contacts", destination: "/dashboard/customers", permanent: true },
      { source: "/dashboard/contacts/:path*", destination: "/dashboard/customers/:path*", permanent: true },
      { source: "/dashboard/knowledge-base", destination: "/dashboard/agent", permanent: true },
      { source: "/dashboard/knowledge-base/:path*", destination: "/dashboard/agent", permanent: true },
      { source: "/dashboard/phone-numbers", destination: "/dashboard/agent", permanent: true },
      { source: "/dashboard/operations", destination: "/dashboard/jobs", permanent: true },
      { source: "/dashboard/analytics", destination: "/dashboard/jobs", permanent: true },
      { source: "/dashboard/calls/live", destination: "/dashboard/jobs", permanent: true }
    ];
  },
};

export default nextConfig;

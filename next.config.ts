import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    // The dev server prints every requested address. Auth pages are left out,
    // so a query string that ever carried a form field is not written to the
    // terminal. (Production builds do not log requests.)
    incomingRequests: {
      ignore: [/^\/(sign-in|sign-up|reset-password|profile-setup)/],
    },
  },
};

export default nextConfig;

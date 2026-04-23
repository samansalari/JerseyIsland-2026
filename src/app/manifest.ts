import type { MetadataRoute } from "next";

/** PWA manifest — Jersey VotePulse palette (surface + brand red). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VotePulse — Jersey 2026 Election Intelligence",
    short_name: "VotePulse",
    description:
      "Non-partisan election intelligence for Jersey’s 2026 general election.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#F5F5F0",
    theme_color: "#A31621",
    categories: ["news", "politics", "government"],
    lang: "en-GB",
    icons: [
      {
        src: "/Logo__2_.png",
        sizes: "1024x1024",
        type: "image/png",
      },
      {
        src: "/favicons/votepulse_icon_navy.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

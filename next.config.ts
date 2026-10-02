import type { NextConfig } from "next";

// Rig instant() (voir instant-nav.rig.md) : ces deux variables ne sont
// posées que par la commande de build du rig local, jamais sur Vercel.
// E2E_SUPABASE_URL pointe vers le faux Supabase de e2e/mock-supabase.mjs
// (le sandbox cloud bloque l'accès sortant à Supabase) ; EXPOSE_TESTING_API
// compile l'API de test utilisée par instant() de @next/playwright.
const e2eSupabaseUrl = process.env.E2E_SUPABASE_URL;
const exposeTestingApi = process.env.EXPOSE_TESTING_API === "1";

const supabaseUrl = e2eSupabaseUrl ?? "https://vsmtkopkqasrdnjceegp.supabase.co";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Images des exercices (module Sport) servies sous /sport-img/… : même
  // origine que l'app, donc mises en cache par le service worker (public/sw.js)
  // et disponibles hors ligne en salle de sport.
  async rewrites() {
    return [
      {
        source: "/sport-img/:path*",
        destination: `${supabaseUrl}/storage/v1/object/public/sport-exercices/:path*`,
      },
    ];
  },
  // Chaque <Link> précharge la coquille partagée de sa route (App Shell) ;
  // <Link prefetch={true}> résout en plus le contenu propre à son URL.
  // Voir reports/2026-09-24-partial-prefetching-coquilles-journal-budget.md.
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vsmtkopkqasrdnjceegp.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    exposeTestingApiInProductionBuild: exposeTestingApi,
    serverActions: {
      // Défaut Next.js : 1 Mo, largement dépassé par une photo prise
      // directement avec l'appareil d'un téléphone (souvent 2-5 Mo), ce qui
      // rejette la requête HTTP (413) avant même l'exécution de
      // createTache/uploadTacheImages. 4 Mo laisse de la marge sous la
      // limite dure de Vercel pour les Serverless Functions (4.5 Mo, non
      // configurable) une fois l'overhead multipart pris en compte.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;

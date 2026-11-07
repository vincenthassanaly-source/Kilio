import type { MetadataRoute } from "next";

// App personnelle : aucun moteur de recherche ne doit l'indexer.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}

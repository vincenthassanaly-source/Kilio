import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AppResumeRefresh } from "@/components/AppResumeRefresh";
import { THEME_COLOR_CLAIR, THEME_COLOR_SOMBRE, themeInitScript } from "@/lib/theme";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kilio",
  description: "Liste de courses, recettes, suivi calorique et placard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kilio",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    // Fond réel de l'app (T16) ; themeInitScript et basculerTheme alignent
    // ensuite ces balises sur le thème choisi dans l'app.
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR_CLAIR },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR_SOMBRE },
  ],
};

// Aucune lecture de requête ici (layout racine = coquille statique de toute
// l'app) : la classe `dark` est posée par themeInitScript avant le premier
// paint, à partir du cookie de thème (voir lib/theme.ts).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${sora.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full flex flex-col overflow-hidden bg-background text-ink font-sans">
        {children}
        <ServiceWorkerRegister />
        <AppResumeRefresh />
        <SpeedInsights />
      </body>
    </html>
  );
}

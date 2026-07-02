import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const APP_DESCRIPTION =
  "Simulation de peloton et planification logistique pour l'organisation de vos courses de trail."

export const metadata: Metadata = {
  title: "TrailSim",
  description: APP_DESCRIPTION,
  openGraph: {
    title: "TrailSim",
    description: APP_DESCRIPTION,
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "TrailSim",
    description: APP_DESCRIPTION,
  },
}

// Applied before paint to avoid a theme flash
const themeScript = `(function(){try{var t=localStorage.getItem('trailsim:theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" data-theme="light" className={`${inter.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Favicons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icon-16.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />

        {/* App identity */}
        <meta name="application-name" content="HeatWise" />
        <meta name="theme-color" content="#1a3828" />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="HeatWise" />

        {/* Open Graph */}
        <meta property="og:type"        content="website" />
        <meta property="og:site_name"   content="HeatWise" />
        <meta property="og:title"       content="HeatWise — AI-Powered Urban Cooling" />
        <meta property="og:description" content="AI-matched plants, climate-aware layouts, real cooling measured in degrees. Transform any rooftop or balcony in minutes." />
        <meta property="og:image"       content="/icon-512.png" />
        <meta property="og:url"         content="https://heatwise.in" />

        {/* Twitter / X */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:site"        content="@heatwise_in" />
        <meta name="twitter:title"       content="HeatWise — AI-Powered Urban Cooling" />
        <meta name="twitter:description" content="AI-matched plants, climate-aware layouts, real cooling measured in degrees." />
        <meta name="twitter:image"       content="/icon-512.png" />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="HeatWise" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

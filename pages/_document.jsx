import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icon-16.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <meta name="application-name" content="HeatWise" />
        <meta name="theme-color" content="#0f1a12" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

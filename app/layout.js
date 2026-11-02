import "./globals.css";

export const metadata = {
  title: "Heme ARM",
  description: "Sistema de ventas y agentes de Heme Studios",
  icons: { icon: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#080808"/><path d="M18 84 V50 a16 16 0 0 1 32 0 V84 M50 50 a16 16 0 0 1 32 0 V84" fill="none" stroke="#EDEBE6" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><circle cx="88" cy="20" r="8" fill="#FF5A26"/></svg>') },
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#080808" };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}

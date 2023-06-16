import { h } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";

export default function Layout({ children }: { children: any }) {
  return (
    <html>
      <body>
        This is a test layout
        {children}
      </body>
    </html>
  );
}

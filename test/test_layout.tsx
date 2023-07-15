import { h } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { LayoutProps } from "../Components.tsx";

export default function TestLayout({ html }: LayoutProps) {
  return (
    <html>
      <body>
        <heading>
          <h1>
            This is a test layout
          </h1>
        </heading>
        <div innerHTML={{ __dangerousHtml: html }} />
      </body>
    </html>
  );
}

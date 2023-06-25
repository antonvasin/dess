import { h } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { LayoutProps } from "../mod.ts";

export default function TestLayout({ html }: LayoutProps) {
  return (
    <html>
      <body>
        This is a test layout
        <div innerHTML={{ __dangerousHtml: html }} />
      </body>
    </html>
  );
}

import { h } from "https://deno.land/x/nano_jsx/mod.ts";

interface Props {
  children: any;
}

export default ({ children }: Props) => (
  <html>
    <body>{children}</body>
  </html>
);

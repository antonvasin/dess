// deno-lint-ignore-file no-explicit-any
import { h } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { addExt, ContentHeading, PostFrontmatter } from "./mod.ts";

// deno-lint-ignore no-explicit-any
export type LayoutComponent = (p: LayoutProps) => any;

export interface LayoutProps {
  html: string;
  title?: string;
  page: string;
  routes?: string[];
  headings?: ContentHeading[];
  frontmatter?: PostFrontmatter;
  devScript?: string;
  children?: any;
}

export interface LinkProps {
  page: string;
  children?: any;
  active?: boolean;
}

export function DefaultLayout(
  { html, title = "Title", routes = [], children }: LayoutProps,
) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        {title && <title>{title}</title>}
      </head>
      <body>
        <header>
          {title && <h1>{title}</h1>}
          <nav>
            <ul>
              {routes.map((route) => (
                <li>
                  <PageLink page={route}>{route}</PageLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main innerHTML={{ __dangerousHtml: html }} />
        {children}
      </body>
    </html>
  );
}

export function PageLink({ page, children, active = false }: LinkProps) {
  return (
    // FIXME: empty class attr
    <a className={active ? "active" : ""} href={addExt(page, ".html")}>
      {children}
    </a>
  );
}

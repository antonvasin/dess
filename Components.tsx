// deno-lint-ignore-file no-explicit-any
import { Fragment, h, Helmet } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
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
    <>
      <Helmet>
        {title && <title>{title}</title>}
      </Helmet>
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
    </>
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

interface ErrorProps {
  err: Error;
}

export function RedBox({ err }: ErrorProps) {
  return (
    <html>
      <Helmet>
        <style>
          {`body {
          font-family: sans-serif;
        }
        .error {
          padding: 24px;
        }
        .error pre {
          margin-left: -12px;
          padding: 24px;
          border: 2px solid orangered;
          border-radius: 8px;
        }`}
        </style>
      </Helmet>
      <body>
        <div className="error">
          <h1>{err.name}</h1>
          <pre>{`${err.message}\n\n${err.stack}`}</pre>
        </div>
      </body>
    </html>
  );
}

export function NotFound({ url }: { url?: string }) {
  return (
    <html>
      <head>
        <Helmet>
          <style>
            {`body {
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                font-size: 24px;
                font-family: sans-serif;
              }
              .h1 { font-family: monospace; }`}
          </style>
        </Helmet>
      </head>
      <body>
        <h1>404</h1>
        {url &&
          <p>File {(new URL(url)).pathname} not found</p>}
      </body>
    </html>
  );
}

export function DebugFooter({ page, headings = [], routes = [] }: LayoutProps) {
  return (
    <footer>
      <dl>
        <dt>Page name</dt>
        <dd>
          <pre>{page}</pre>
        </dd>

        <dt>Current page headings</dt>
        <dd>
          <dl>
            {headings.map((heading) => (
              <div>
                <dt>{heading.text}</dt>
                <dd>
                  <pre>{heading.slug}</pre>
                </dd>
              </div>
            ))}
          </dl>
        </dd>

        <dt>Page count</dt>
        <dd>{routes.length}</dd>
      </dl>
    </footer>
  );
}

export function wrapWithHmr(layout: LayoutComponent): LayoutComponent {
  const Layout = layout;
  return (props) => {
    return (
      <Layout {...props}>
        <Helmet>
          <script src="/hmr.js" type="module" async />
        </Helmet>
      </Layout>
    );
  };
}

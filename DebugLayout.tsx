import { h, Helmet } from "https://deno.land/x/nano_jsx@v0.0.37/mod.ts";
import { DefaultLayout, LayoutProps } from "./Components.tsx";

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

export default function DebugLayout(
  { devScript, ...props }: LayoutProps,
) {
  return (
    <DefaultLayout {...props}>
      <Helmet>
        {devScript && <script src={devScript} type="module" async />}
      </Helmet>
      <hr />
      <DebugFooter {...props} />
    </DefaultLayout>
  );
}

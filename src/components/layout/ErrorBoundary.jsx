import { Component } from 'react';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { Button } from '../ui/primitives.jsx';
import { Panel, PanelBody } from '../ui/panel.jsx';

/**
 * Catches a render error in one screen so the rest of the application keeps
 * working. Without this a single bad value blanks the whole page, which tells
 * the user nothing and loses whatever they were doing.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In Phase 2 this reports to the server. For now it stays in the console so
    // the stack is still reachable while developing.
    // eslint-disable-next-line no-console
    console.error('Screen failed to render', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Panel className="mx-auto max-w-2xl">
        <PanelBody className="space-y-5 p-8">
          <div className="flex items-start gap-3.5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-bad/40 bg-bad-soft/60 text-bad">
              <CircleAlert size={18} aria-hidden />
            </span>
            <div className="space-y-1.5">
              <h1 className="text-xl text-ink">This screen failed to render</h1>
              <p className="text-sm leading-relaxed text-ink-dim">
                Something in this view threw an error. The rest of the application is unaffected,
                and nothing you had saved is lost.
              </p>
            </div>
          </div>

          <pre className="overflow-x-auto rounded-md border border-line bg-void px-3 py-2.5 font-code text-2xs leading-relaxed text-ink-faint">
            {String(error?.message ?? error)}
          </pre>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              icon={RefreshCw}
              onClick={() => this.setState({ error: null })}
            >
              Try rendering again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
              Reload the application
            </Button>
          </div>
        </PanelBody>
      </Panel>
    );
  }
}

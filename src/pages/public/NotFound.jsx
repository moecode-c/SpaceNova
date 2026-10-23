import { Link } from 'react-router-dom';
import { Compass, Home, Satellite } from 'lucide-react';
import { Button } from '../../components/ui/primitives.jsx';
import { Panel, PanelBody } from '../../components/ui/panel.jsx';

export default function NotFound() {
  return (
    <Panel className="relative mx-auto max-w-2xl overflow-hidden">
      <div className="starfield absolute inset-0 bg-radial-fade" aria-hidden />
      <PanelBody className="relative flex flex-col items-center gap-5 px-6 py-16 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-base text-primary">
          <Compass size={22} aria-hidden />
        </span>
        <div className="space-y-2">
          <p className="tnum font-mono text-2xs uppercase tracking-[0.2em] text-ink-faint">
            Error 404
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
            Nothing at this heading
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-dim">
            The page you asked for does not exist. It may have been renamed, or the link may have
            carried an identifier that is no longer in the catalogue.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link to="/">
            <Button variant="primary" icon={Home}>
              Back to the landing page
            </Button>
          </Link>
          <Link to="/catalog">
            <Button variant="outline" icon={Satellite}>
              Browse the catalogue
            </Button>
          </Link>
        </div>
      </PanelBody>
    </Panel>
  );
}

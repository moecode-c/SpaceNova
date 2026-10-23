import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '../../components/ui/primitives.jsx';

export default function NotFound() {
  return (
    <section className="relative mx-auto flex max-w-3xl flex-col items-center gap-8 py-20 text-center sm:py-28">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line-strong text-ink">
        <Compass size={22} aria-hidden />
      </span>
      <div className="space-y-5">
        <p className="label-caps">Error 404</p>
        <h1 className="text-[2.5rem] leading-[0.95] sm:text-display-xl">Nothing at this heading</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-dim">
          The page you asked for does not exist. It may have been renamed, or the link may have
          carried an identifier that is no longer in the catalogue.
        </p>
      </div>
      <div className="flex flex-col items-center gap-5">
        <Link to="/">
          <Button variant="outline" size="lg" icon={Home}>
            Back to the landing page
          </Button>
        </Link>
        <Link to="/catalog" className="link text-[0.8125rem] font-bold uppercase tracking-cap">
          Browse the catalogue
        </Link>
      </div>
    </section>
  );
}

import { AboutPage } from './components/brand/AboutPage';
import { BRAND } from './components/brand/brand';
import { CreatorLink, Wordmark } from './components/brand/Logo';
import { ExportPanel } from './components/export/ExportPanel';
import { JourneyPanel } from './components/journey/JourneyPanel';
import { VideoPanel } from './components/journey/VideoPanel';
import { PreviewStage } from './components/map/PreviewStage';
import { PlayerBar } from './components/player/PlayerBar';
import { ProjectMenu } from './components/projects/ProjectMenu';
import { useHashRoute } from './hooks/useHashRoute';
import { usePreparedJourney } from './hooks/usePreparedJourney';

const ABOUT = 've-san-pham';

export function App() {
  const journey = usePreparedJourney();
  const hasRoute = journey.segments.length > 0;
  const [route, navigate] = useHashRoute();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-panel px-5">
        <div className="flex items-center gap-4">
          <Wordmark className="text-[19px]" />
          <span className="font-display hidden text-[12.5px] italic text-faint md:inline">{BRAND.tagline}</span>
        </div>
        <div className="flex items-center gap-3">
          <ProjectMenu />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="scroll-quiet flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-line bg-panel">
          <JourneyPanel />
          <VideoPanel />
          <ExportPanel disabled={!hasRoute} />
          <footer className="mt-auto px-5 py-4 text-[11px] text-faint">
            Tạo bởi: <CreatorLink className="text-[12px]" />
            <span className="mx-1.5">·</span>
            <a href={`#${ABOUT}`} className="hover:text-fg">
              Về sản phẩm
            </a>
          </footer>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 bg-stage p-6">
            <PreviewStage journey={journey} />
          </div>
          <PlayerBar disabled={!hasRoute} />
        </main>
      </div>

      {route === ABOUT && <AboutPage onClose={() => navigate('')} />}
    </div>
  );
}

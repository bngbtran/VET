import { ExportPanel } from './components/export/ExportPanel';
import { JourneyPanel } from './components/journey/JourneyPanel';
import { VideoPanel } from './components/journey/VideoPanel';
import { PreviewStage } from './components/map/PreviewStage';
import { PlayerBar } from './components/player/PlayerBar';
import { ProjectMenu } from './components/projects/ProjectMenu';
import { usePreparedJourney } from './hooks/usePreparedJourney';

export function App() {
  const journey = usePreparedJourney();
  const hasRoute = journey.segments.length > 0;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-panel px-5">
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-semibold tracking-[0.42em]">VỆT</span>
          <span className="hidden text-[11px] text-faint md:inline">Mỗi hành trình để lại một Vệt.</span>
        </div>
        <ProjectMenu />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="scroll-quiet flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-line bg-panel">
          <JourneyPanel />
          <VideoPanel />
          <ExportPanel disabled={!hasRoute} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 bg-[#08090a] p-6">
            <PreviewStage journey={journey} />
          </div>
          <PlayerBar disabled={!hasRoute} />
        </main>
      </div>
    </div>
  );
}

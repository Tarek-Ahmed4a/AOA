import React from 'react';
import { AnatomyViewport } from './components/canvas/AnatomyViewport';
import { LiveScientificExplorer } from './components/canvas/LiveScientificExplorer';
import { AnatomicalInspectorSidebar } from './components/ui/AnatomicalInspectorSidebar';
import { MinimalHud } from './components/ui/MinimalHud';
import { PdfReferenceBooksView } from './components/ui/PdfReferenceBooksView';
import { SketchfabBrowserModal } from './components/ui/SketchfabBrowserModal';
import { SystemLayerManager } from './components/ui/SystemLayerManager';
import { useAnatomyStore } from './store/useAnatomyStore';

export const App: React.FC = () => {
  const activeTab = useAnatomyStore((s) => s.activeTab);

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-black">
      <AnatomyViewport />
      {activeTab === 'cloud-explorer' && <LiveScientificExplorer />}
      {activeTab === 'pdf-books' && <PdfReferenceBooksView />}
      <MinimalHud />
      {activeTab === 'master-atlas' && <SystemLayerManager />}
      <AnatomicalInspectorSidebar />
      <SketchfabBrowserModal />
    </main>
  );
};

export default App;

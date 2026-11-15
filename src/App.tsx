import React, { useEffect, useMemo, useState } from 'react';
import { AnatomyViewport } from './components/canvas/AnatomyViewport';
import { LiveScientificExplorer } from './components/canvas/LiveScientificExplorer';
import { AnatomicalInspectorSidebar } from './components/ui/AnatomicalInspectorSidebar';
import { MinimalHud } from './components/ui/MinimalHud';
import { PdfReferenceBooksView } from './components/ui/PdfReferenceBooksView';
import { SketchfabBrowserModal } from './components/ui/SketchfabBrowserModal';
import { SystemLayerManager } from './components/ui/SystemLayerManager';
import {
  AnatomyStoreProvider,
  explorerAnatomyStore,
  masterAnatomyStore,
  useAppNavigationStore,
} from './store/useAnatomyStore';
import {
  createSceneMeshRegistry,
  defaultSceneMeshRegistry,
  SceneMeshRegistryProvider,
} from './utils/bvhSetup';
import {
  ACTIVE_CLIPPING_PLANE,
  ClippingPlaneProvider,
  createClippingPlane,
} from './utils/slicingPlane';

export const App: React.FC = () => {
  const activeTab = useAppNavigationStore((s) => s.activeTab);
  const explorerOpenedModel = useAppNavigationStore(
    (s) => s.explorerOpenedModel
  );
  const [hasOpenedBooks, setHasOpenedBooks] = useState(
    activeTab === 'pdf-books'
  );
  useEffect(() => {
    if (activeTab === 'pdf-books') {
      setHasOpenedBooks(true);
    }
  }, [activeTab]);

  const explorerRegistry = useMemo(() => createSceneMeshRegistry(), []);
  const explorerClippingPlane = useMemo(() => createClippingPlane(), []);

  const isExplorerNativeActive =
    activeTab === 'cloud-explorer' && explorerOpenedModel?.kind === 'native';

  const activeNativeStore = isExplorerNativeActive
    ? explorerAnatomyStore
    : masterAnatomyStore;
  const activeNativeRegistry = isExplorerNativeActive
    ? explorerRegistry
    : defaultSceneMeshRegistry;
  const activeNativePlane = isExplorerNativeActive
    ? explorerClippingPlane
    : ACTIVE_CLIPPING_PLANE;

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-black">
      {/* Persistent Tab 1: 3D Master Atlas Canvas */}
      <AnatomyStoreProvider store={masterAnatomyStore}>
        <SceneMeshRegistryProvider registry={defaultSceneMeshRegistry}>
          <ClippingPlaneProvider plane={ACTIVE_CLIPPING_PLANE}>
            <AnatomyViewport active={activeTab === 'master-atlas'} />
          </ClippingPlaneProvider>
        </SceneMeshRegistryProvider>
      </AnatomyStoreProvider>

      {/* Persistent Tab 2: Live 3D Explorer (Catalog, Native 3D Stage, or Clean Cloud Viewer) */}
      <AnatomyStoreProvider store={explorerAnatomyStore}>
        <SceneMeshRegistryProvider registry={explorerRegistry}>
          <ClippingPlaneProvider plane={explorerClippingPlane}>
            <LiveScientificExplorer />
          </ClippingPlaneProvider>
        </SceneMeshRegistryProvider>
      </AnatomyStoreProvider>

      {hasOpenedBooks && (
        <PdfReferenceBooksView isActive={activeTab === 'pdf-books'} />
      )}

      {/* Unified Cockpit HUD & Inspector bound cleanly to the active visible 3D stage */}
      <AnatomyStoreProvider store={activeNativeStore}>
        <SceneMeshRegistryProvider registry={activeNativeRegistry}>
          <ClippingPlaneProvider plane={activeNativePlane}>
            <MinimalHud />
            {(activeTab === 'master-atlas' || isExplorerNativeActive) && (
              <>
                <SystemLayerManager />
                <AnatomicalInspectorSidebar />
              </>
            )}
            <SketchfabBrowserModal />
          </ClippingPlaneProvider>
        </SceneMeshRegistryProvider>
      </AnatomyStoreProvider>
    </main>
  );
};

export default App;

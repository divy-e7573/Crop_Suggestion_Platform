import { Route, Routes } from 'react-router-dom';

import { AppShell } from './components/layout/AppShell';
import { CropSuggestionsPage } from './pages/CropSuggestionsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataSourcesPage } from './pages/DataSourcesPage';
import { MandiPricesPage } from './pages/MandiPricesPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Route table for the farmer UI. The shell renders once and each page renders
 * inside it.
 */
export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/mandi-prices" element={<MandiPricesPage />} />
        <Route path="/crop-suggestions" element={<CropSuggestionsPage />} />
        <Route path="/data-sources" element={<DataSourcesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;

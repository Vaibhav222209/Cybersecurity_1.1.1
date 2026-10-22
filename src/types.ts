export * from '../shared/types';
import type { AppState, Asset, Page, ThreatAlert } from '../shared/types';
export interface PageProps {
  state: AppState;
  refresh: () => Promise<void>;
  notify: (message: string, tone?: 'success' | 'error') => void;
  navigate: (page: Page) => void;
  openAsset: (asset: Asset) => void;
  openAlert: (alert: ThreatAlert) => void;
}

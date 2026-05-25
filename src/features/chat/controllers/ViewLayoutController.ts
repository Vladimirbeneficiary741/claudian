import { ProviderRegistry } from '../../../core/providers/ProviderRegistry';
import { DEFAULT_CHAT_PROVIDER_ID, type ProviderId } from '../../../core/providers/types';
import type ClaudianPlugin from '../../../main';
import { getTabProviderId } from '../tabs/Tab';
import type { TabData } from '../tabs/types';

interface ViewLayoutControllerDeps {
  plugin: ClaudianPlugin;
  getViewContainerEl: () => HTMLElement | null;
  getTitleSlotEl: () => HTMLElement | null;
  getHeaderActionsEl: () => HTMLElement | null;
  getHeaderActionsContent: () => HTMLElement | null;
  getTabBarContainerEl: () => HTMLElement | null;
  getLogoEl: () => HTMLElement | null;
  getTitleTextEl: () => HTMLElement | null;
  getNavRowContent: () => HTMLElement | null;
  getActiveTab: () => TabData | null;
  getTabCount: () => number;
}

export class ViewLayoutController {
  private readonly deps: ViewLayoutControllerDeps;

  constructor(deps: ViewLayoutControllerDeps) {
    this.deps = deps;
  }

  updateNavRowLocation(): void {
    const tabBarContainerEl = this.deps.getTabBarContainerEl();
    const headerActionsContent = this.deps.getHeaderActionsContent();
    if (!tabBarContainerEl || !headerActionsContent) return;

    const isHeaderMode = this.deps.plugin.settings.tabBarPosition === 'header';

    if (isHeaderMode) {
      const titleSlotEl = this.deps.getTitleSlotEl();
      const headerActionsEl = this.deps.getHeaderActionsEl();
      titleSlotEl?.appendChild(tabBarContainerEl);
      if (headerActionsEl) {
        headerActionsEl.appendChild(headerActionsContent);
        headerActionsEl.style.display = 'flex';
      }
      return;
    }

    const activeTab = this.deps.getActiveTab();
    const navRowContent = this.deps.getNavRowContent();
    if (activeTab && navRowContent) {
      navRowContent.appendChild(tabBarContainerEl);
      navRowContent.appendChild(headerActionsContent);
      activeTab.dom.navRowEl.appendChild(navRowContent);
    }

    const headerActionsEl = this.deps.getHeaderActionsEl();
    if (headerActionsEl) {
      headerActionsEl.style.display = 'none';
    }
  }

  updateLayoutForPosition(): void {
    const viewContainerEl = this.deps.getViewContainerEl();
    if (!viewContainerEl) return;

    const isHeaderMode = this.deps.plugin.settings.tabBarPosition === 'header';
    viewContainerEl.toggleClass('claudian-container--header-mode', isHeaderMode);
    this.updateNavRowLocation();
    this.updateTabBarVisibility(this.deps.getTabCount());
  }

  updateTabBarVisibility(tabCount: number): void {
    const tabBarContainerEl = this.deps.getTabBarContainerEl();
    if (!tabBarContainerEl) return;

    const showTabBar = tabCount >= 2;
    const isHeaderMode = this.deps.plugin.settings.tabBarPosition === 'header';
    tabBarContainerEl.style.display = showTabBar ? 'flex' : 'none';

    const hideBranding = showTabBar && isHeaderMode;
    const logoEl = this.deps.getLogoEl();
    const titleTextEl = this.deps.getTitleTextEl();
    if (logoEl) {
      logoEl.style.display = hideBranding ? 'none' : '';
    }
    if (titleTextEl) {
      titleTextEl.style.display = hideBranding ? 'none' : '';
    }
  }

  syncProviderBrandColor(): void {
    const viewContainerEl = this.deps.getViewContainerEl();
    if (!viewContainerEl) return;

    const activeTab = this.deps.getActiveTab();
    const providerId = activeTab ? getTabProviderId(activeTab, this.deps.plugin) : DEFAULT_CHAT_PROVIDER_ID;
    viewContainerEl.dataset.provider = providerId;
    this.syncHeaderLogo(providerId);
  }

  syncHeaderLogo(providerId: ProviderId): void {
    const logoEl = this.deps.getLogoEl();
    if (!logoEl) return;

    const icon = ProviderRegistry.getChatUIConfig(providerId).getProviderIcon?.();
    if (!icon) return;

    const existing = logoEl.querySelector('svg');
    if (existing?.getAttribute('data-provider') === providerId) return;

    logoEl.empty();
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', icon.viewBox);
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('data-provider', providerId);

    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('d', icon.path);
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    logoEl.appendChild(svg);
  }
}

import { create } from 'zustand';

interface TabBarState {
  isVisible: boolean;
  setVisible: (visible: boolean) => void;
  triggerVisible: () => void;
  hideTimeout: any;
}

export const useTabBarStore = create<TabBarState>((set, get) => ({
  isVisible: true,
  hideTimeout: null,
  setVisible: (visible: boolean) => set({ isVisible: visible }),
  triggerVisible: () => {
    const state = get();
    set({ isVisible: true });
    if (state.hideTimeout) {
      clearTimeout(state.hideTimeout);
    }
    const timeout = setTimeout(() => {
      set({ isVisible: false });
    }, 2500);
    set({ hideTimeout: timeout });
  },
}));

import { create } from "zustand";

interface UndoAction {
  id: string;
  message: string;
  onCommit: () => Promise<void>;
  onUndo?: () => void;
  duration?: number;
}

interface UndoStore {
  currentAction: UndoAction | null;
  isVisible: boolean;

  /**
   * Triggers a new undoable action. Alias for queueAction.
   */
  show: (action: Omit<UndoAction, "id">) => void;

  /**
   * Triggers a new undoable action.
   */
  queueAction: (action: Omit<UndoAction, "id">) => void;

  /**
   * Finalizes the action (commits it to the database/state).
   */
  commit: () => Promise<void>;

  /**
   * Reverts the action and hides the notification.
   */
  undo: () => void;

  /**
   * Force hides the notification without committing (use carefully).
   */
  hide: () => void;
}

export const useUndoStore = create<UndoStore>((set, get) => ({
  currentAction: null,
  isVisible: false,

  queueAction: (action) => {
    const { currentAction, commit } = get();

    // If there's already an action, commit it first (no await, fires in background)
    if (currentAction) {
      commit();
    }

    const id = Math.random().toString(36).substring(7);
    set({
      currentAction: { ...action, id },
      isVisible: true,
    });
  },

  show: (action) => get().queueAction(action),

  commit: async () => {
    const state = get();
    if (!state.currentAction) return;

    const actionToCommit = state.currentAction;
    // Atomic hide to prevent flicker
    if (state.isVisible) {
      set({ isVisible: false });
    }

    try {
      await actionToCommit.onCommit();
    } catch (error) {
      console.error("[UndoStore] Failed to commit:", error);
    } finally {
      // Only clear if no NEW action has been queued
      if (get().currentAction?.id === actionToCommit.id) {
        set({ currentAction: null });
      }
    }
  },

  undo: async () => {
    const state = get();
    if (!state.currentAction || !state.currentAction.onUndo) return;

    const actionToUndo = state.currentAction;
    const onUndoFn = actionToUndo.onUndo; // Local ref for TS narrowing

    if (state.isVisible) {
      set({ isVisible: false });
    }

    try {
      if (onUndoFn) {
        await onUndoFn();
      }
    } catch (error) {
      console.error("[UndoStore] Failed to undo:", error);
    } finally {
      if (get().currentAction?.id === actionToUndo.id) {
        set({ currentAction: null });
      }
    }
  },

  hide: () => {
    const state = get();
    if (!state.isVisible && !state.currentAction) return;
    set({ isVisible: false, currentAction: null });
  },
}));

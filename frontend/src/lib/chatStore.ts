/**
 * Tiny store for the chat WebSocket's connection status. The socket itself
 * and its reconnect timers live as module-level state in useChatSocket — this
 * store only exists so components can reactively render the status.
 */
import { create } from 'zustand';

export type ChatSocketStatus = 'idle' | 'connecting' | 'open' | 'closed';

interface ChatStoreState {
  status: ChatSocketStatus;
  setStatus: (status: ChatSocketStatus) => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../api/supabase';

const SYNC_QUEUE_KEY = 'biblio_sync_queue';

export interface SyncAction {
  id: string;
  type: 'borrow' | 'return' | 'review' | 'like';
  payload: any;
  timestamp: number;
}

class SyncService {
  private queue: SyncAction[] = [];
  private isSyncing = false;

  constructor() {
    this.loadQueue();
    this.setupNetworkListener();
  }

  private async loadQueue() {
    const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (stored) {
      this.queue = JSON.parse(stored);
    }
  }

  private async saveQueue() {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
  }

  private setupNetworkListener() {
    NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        this.processQueue();
      }
    });
  }

  async addToQueue(action: Omit<SyncAction, 'id' | 'timestamp'>) {
    const newAction: SyncAction = {
      ...action,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    };
    this.queue.push(newAction);
    await this.saveQueue();
    
    // Try to process immediately if online
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isSyncing || this.queue.length === 0) return;
    
    this.isSyncing = true;
    console.log(`[SyncService] Processing ${this.queue.length} actions...`);

    const remainingActions: SyncAction[] = [];

    for (const action of this.queue) {
      try {
        let success = false;
        switch (action.type) {
          case 'borrow':
            const { error: bErr } = await supabase.rpc('fn_borrow_book', action.payload);
            success = !bErr;
            break;
          case 'review':
            const { error: rErr } = await supabase.from('reviews').insert(action.payload);
            success = !rErr;
            break;
          case 'like':
            // Logic for likes
            success = true; 
            break;
          default:
            success = true;
        }

        if (!success) remainingActions.push(action);
      } catch (err) {
        console.error(`[SyncService] Failed action ${action.id}:`, err);
        remainingActions.push(action);
      }
    }

    this.queue = remainingActions;
    await this.saveQueue();
    this.isSyncing = false;
  }

  getQueue() {
    return this.queue;
  }
}

export const sync = new SyncService();

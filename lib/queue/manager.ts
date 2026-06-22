export interface QueuedCaller {
  id: string;
  phoneNumber?: string;
  joinedAt: number;
}

export class CallQueueManager {
  private queue: QueuedCaller[] = [];
  private activeCalls: number = 0;
  
  // Assumption for wait time calculation (3 minutes per call)
  private readonly AVERAGE_CALL_DURATION_MS = 3 * 60 * 1000;
  
  // The maximum number of concurrent calls we can handle right now (NFR-3)
  private readonly MAX_CONCURRENT_CALLS = 10;

  public enqueueCaller(callerId: string, phoneNumber?: string): QueuedCaller {
    const caller: QueuedCaller = {
      id: callerId,
      phoneNumber,
      joinedAt: Date.now(),
    };
    this.queue.push(caller);
    return caller;
  }

  public dequeueCaller(callerId: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(c => c.id !== callerId);
    return this.queue.length < initialLength;
  }

  public getQueuePosition(callerId: string): number {
    const index = this.queue.findIndex(c => c.id === callerId);
    return index >= 0 ? index + 1 : -1;
  }

  public getEstimatedWaitTimeMs(callerId: string): number {
    const position = this.getQueuePosition(callerId);
    if (position === -1) return 0;

    // Simple estimation: 
    // If active calls are fewer than max, wait time is 0 (can be picked up immediately).
    // Otherwise, calculate based on how many people are ahead of them divided by the throughput.
    if (this.activeCalls < this.MAX_CONCURRENT_CALLS && position === 1) {
      return 0; // Next in line and there is a free agent
    }

    // Number of active "agent slots". If activeCalls is less than MAX, 
    // throughput is still bounded by MAX capacity when full.
    const capacity = Math.max(1, this.MAX_CONCURRENT_CALLS);
    
    // Total groups of people that need to be served before this person.
    // e.g., if capacity is 10 and you are 12th, 1 full group of 10 must finish.
    const groupsAhead = Math.ceil(position / capacity);
    
    return groupsAhead * this.AVERAGE_CALL_DURATION_MS;
  }

  // --- Methods to manage active call count for accurate queue wait times ---

  public markCallStarted() {
    this.activeCalls++;
  }

  public markCallEnded() {
    if (this.activeCalls > 0) {
      this.activeCalls--;
    }
  }

  public getActiveCallCount(): number {
    return this.activeCalls;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Returns a snapshot of live telephony metrics for the analytics dashboard.
   */
  public getMetrics(): { activeCallCount: number; queueLength: number } {
    return {
      activeCallCount: this.activeCalls,
      queueLength: this.queue.length,
    };
  }
}

// Global singleton for use across the application
export const callQueue = new CallQueueManager();

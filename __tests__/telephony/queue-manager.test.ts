/**
 * Tests: Call Queue Manager (lib/queue/manager.ts)
 * Sprint 1 — FR-19 Call Queue Management
 *
 * Run: npm run test:run
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CallQueueManager } from "../../lib/queue/manager";

// Use a fresh instance per test — never use the singleton here
function freshQueue() {
  return new CallQueueManager();
}

describe("CallQueueManager — enqueue / dequeue", () => {
  it("enqueues a caller and returns their record", () => {
    const q = freshQueue();
    const caller = q.enqueueCaller("C-001", "+919999999999");

    expect(caller.id).toBe("C-001");
    expect(caller.phoneNumber).toBe("+919999999999");
    expect(caller.joinedAt).toBeGreaterThan(0);
  });

  it("queue length increases on enqueue, decreases on dequeue", () => {
    const q = freshQueue();
    q.enqueueCaller("C-001");
    q.enqueueCaller("C-002");
    expect(q.getQueueLength()).toBe(2);

    q.dequeueCaller("C-001");
    expect(q.getQueueLength()).toBe(1);
  });

  it("dequeueCaller returns true when removed, false if not found", () => {
    const q = freshQueue();
    q.enqueueCaller("C-001");

    expect(q.dequeueCaller("C-001")).toBe(true);
    expect(q.dequeueCaller("C-999")).toBe(false); // never existed
  });

  it("getQueuePosition returns 1-indexed position, -1 if not in queue", () => {
    const q = freshQueue();
    q.enqueueCaller("C-001");
    q.enqueueCaller("C-002");
    q.enqueueCaller("C-003");

    expect(q.getQueuePosition("C-001")).toBe(1);
    expect(q.getQueuePosition("C-002")).toBe(2);
    expect(q.getQueuePosition("C-003")).toBe(3);
    expect(q.getQueuePosition("C-999")).toBe(-1);
  });
});

describe("CallQueueManager — active call tracking", () => {
  it("markCallStarted increments active count", () => {
    const q = freshQueue();
    expect(q.getActiveCallCount()).toBe(0);
    q.markCallStarted();
    q.markCallStarted();
    expect(q.getActiveCallCount()).toBe(2);
  });

  it("markCallEnded decrements active count, never below 0", () => {
    const q = freshQueue();
    q.markCallStarted();
    q.markCallEnded();
    expect(q.getActiveCallCount()).toBe(0);

    // Should not go negative
    q.markCallEnded();
    expect(q.getActiveCallCount()).toBe(0);
  });

  it("getMetrics returns both activeCallCount and queueLength", () => {
    const q = freshQueue();
    q.markCallStarted();
    q.markCallStarted();
    q.enqueueCaller("C-001");

    const m = q.getMetrics();
    expect(m.activeCallCount).toBe(2);
    expect(m.queueLength).toBe(1);
  });
});

describe("CallQueueManager — wait time estimation", () => {
  it("returns 0 wait if slots are free and caller is first in queue", () => {
    const q = freshQueue();
    // 0 active calls → free capacity
    q.enqueueCaller("C-001");
    expect(q.getEstimatedWaitTimeMs("C-001")).toBe(0);
  });

  it("returns 0 if caller not in queue", () => {
    const q = freshQueue();
    expect(q.getEstimatedWaitTimeMs("ghost")).toBe(0);
  });

  it("returns 3 minutes wait when all 10 slots are full and caller is first", () => {
    const q = freshQueue();
    for (let i = 0; i < 10; i++) q.markCallStarted();
    q.enqueueCaller("C-001");

    const wait = q.getEstimatedWaitTimeMs("C-001");
    expect(wait).toBe(3 * 60 * 1000); // 180_000 ms
  });

  it("caller in 2nd group waits 2x average duration", () => {
    const q = freshQueue();
    for (let i = 0; i < 10; i++) q.markCallStarted(); // fill all slots
    for (let i = 1; i <= 11; i++) q.enqueueCaller(`C-${i.toString().padStart(3, "0")}`);

    // C-011 is the 11th person in queue → 2nd group
    const wait = q.getEstimatedWaitTimeMs("C-011");
    expect(wait).toBe(2 * 3 * 60 * 1000); // 360_000 ms
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOutgoingQueue } from '../src/conversation/outgoingQueue.js';

describe('outgoingQueue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves queued content when the countdown expires', async () => {
    vi.useFakeTimers();
    const events = [];
    const queue = createOutgoingQueue({ onChange: (action, message) => events.push({ action, message }) });

    const result = queue.enqueue({
      conversationId: 'conv-1',
      messageId: 1,
      content: 'Ready to send',
      delayMs: 1000,
      source: 'ai',
    });

    expect(queue.list()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe('Ready to send');
    expect(queue.list()).toHaveLength(0);
    expect(events.some(event => event.action === 'remove')).toBe(true);
  });

  it('pauses while editing and resumes with edited content', async () => {
    vi.useFakeTimers();
    const queue = createOutgoingQueue();
    const result = queue.enqueue({
      conversationId: 'conv-2',
      messageId: 2,
      content: 'Bad draft',
      delayMs: 3000,
      source: 'ai',
    });

    await vi.advanceTimersByTimeAsync(1000);
    const edited = queue.edit(queue.list()[0].id, 'Better draft');
    expect(edited.status).toBe('paused');
    expect(edited.remainingSeconds).toBe(2);

    queue.resume(edited.id);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toBe('Better draft');
  });

  it('resolves null when operator deletes an outgoing message', async () => {
    vi.useFakeTimers();
    const queue = createOutgoingQueue();
    const result = queue.enqueue({
      conversationId: 'conv-3',
      messageId: 3,
      content: 'Delete me',
      delayMs: 5000,
      source: 'ai',
    });
    const id = queue.list()[0].id;

    expect(queue.delete(id)).toBe(true);
    await expect(result).resolves.toBeNull();
    expect(queue.list()).toHaveLength(0);
  });
});

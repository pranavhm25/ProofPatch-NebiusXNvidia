import '@testing-library/jest-dom/vitest';
import 'vitest-axe/extend-expect';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';
import { File as NodeFile } from 'node:buffer';

// Ensure undici-compatible File in jsdom for MSW FormData interception
if (typeof NodeFile !== 'undefined') {
  globalThis.File = NodeFile as unknown as typeof File;
  if (typeof window !== 'undefined') {
    window.File = NodeFile as unknown as typeof File;
  }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { testQueryClient, resetTestState } from './setup';

// Default providers wrapper for tests
interface TestRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialPath?: string;
  routerProps?: Omit<MemoryRouterProps, 'children' | 'initialEntries'>;
  queryClient?: QueryClient;
}

const DEFAULT_INITIAL_PATH = '/';

export function renderWithProviders(
  ui: React.ReactElement,
  options: TestRenderOptions = {}
): RenderResult {
  const {
    initialPath = DEFAULT_INITIAL_PATH,
    routerProps = {},
    queryClient = testQueryClient,
    ...renderOptions
  } = options;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]} {...routerProps}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(ui, { wrapper, ...renderOptions });
}

// Re-export commonly used testing utilities
export * from '@testing-library/react';
export { vi, beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
export { testQueryClient, resetTestState, createTestQueryClient } from './setup';
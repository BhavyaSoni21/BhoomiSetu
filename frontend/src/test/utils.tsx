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
  withRouter?: boolean;
}

const DEFAULT_INITIAL_PATH = '/';

function containsRouter(element: React.ReactNode, depth = 0): boolean {
  if (!React.isValidElement(element) || depth > 10) return false;
  const type: any = element.type;
  if (!type) return false;
  if (type === MemoryRouter) return true;
  const name = typeof type === 'string' ? type : (type.displayName || type.name || '');
  if (name === 'Router' || name === 'MemoryRouter' || name === 'BrowserRouter' || name === 'App') {
    return true;
  }
  if (element.props && (element.props as any).children) {
    const children = React.Children.toArray((element.props as any).children);
    return children.some((child) => containsRouter(child, depth + 1));
  }
  return false;
}

function containsQueryClientProvider(element: React.ReactNode, depth = 0): boolean {
  if (!React.isValidElement(element) || depth > 10) return false;
  const type: any = element.type;
  if (!type) return false;
  if (type === QueryClientProvider) return true;
  const name = typeof type === 'string' ? type : (type.displayName || type.name || '');
  if (name === 'QueryClientProvider') return true;
  if (element.props && (element.props as any).children) {
    const children = React.Children.toArray((element.props as any).children);
    return children.some((child) => containsQueryClientProvider(child, depth + 1));
  }
  return false;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: TestRenderOptions = {}
): RenderResult {
  const {
    initialPath = DEFAULT_INITIAL_PATH,
    routerProps = {},
    queryClient = testQueryClient,
    withRouter,
    ...renderOptions
  } = options;

  const needsRouter = withRouter !== undefined ? withRouter : !containsRouter(ui);
  const needsQueryClient = !containsQueryClientProvider(ui);

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    let tree = children;
    if (needsRouter) {
      tree = (
        <MemoryRouter initialEntries={[initialPath]} {...routerProps}>
          {tree}
        </MemoryRouter>
      );
    }
    if (needsQueryClient) {
      tree = (
        <QueryClientProvider client={queryClient}>
          {tree}
        </QueryClientProvider>
      );
    }
    return <>{tree}</>;
  };

  return render(ui, { wrapper, ...renderOptions });
}

// Re-export commonly used testing utilities
export * from '@testing-library/react';
export { vi, beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
export { testQueryClient, resetTestState, createTestQueryClient } from './setup';
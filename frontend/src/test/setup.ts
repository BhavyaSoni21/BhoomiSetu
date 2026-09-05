import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver (it does no real layout), but recharts'
// ResponsiveContainer requires one to exist at all just to mount - without
// this stub every chart-based component throws on render in tests.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

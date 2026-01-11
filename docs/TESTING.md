# NeuroLogg Pro - Testing Guide

## Overview

NeuroLogg Pro uses **Vitest** with **happy-dom** for testing. The test suite covers utilities, state management, components, and AI services.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Environment](#test-environment)
3. [Writing Tests](#writing-tests)
4. [Testing Patterns](#testing-patterns)
5. [Mocking Strategies](#mocking-strategies)
6. [Coverage](#coverage)
7. [Best Practices](#best-practices)

---

## Quick Start

```bash
# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run single test file
npm run test:run -- src/utils/predictions.test.ts

# Run tests with coverage
npm run test -- --coverage

# Run tests matching pattern
npm run test:run -- --grep "calculateRiskForecast"
```

---

## Test Environment

### Configuration

**`vitest.config.ts`:**
```typescript
{
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  }
}
```

### Setup File (`src/test/setup.ts`)

The setup file configures global mocks:

```typescript
// Mocked globals:
- localStorage (with spy functions)
- matchMedia (for responsive tests)
- crypto.randomUUID (for consistent IDs)
- react-i18next (returns translation keys)
- framer-motion (reduces motion in tests)
```

---

## Writing Tests

### File Naming

Place tests next to source files:

```
src/utils/predictions.ts
src/utils/predictions.test.ts

src/components/Analysis.tsx
src/components/Analysis.test.tsx
```

### Basic Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateRiskForecast } from './predictions';

describe('calculateRiskForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns low risk for empty logs', () => {
    const result = calculateRiskForecast([]);
    expect(result.level).toBe('low');
    expect(result.score).toBe(0);
  });

  it('calculates risk from historical patterns', () => {
    const logs = createMockLogs({ count: 20, highArousal: true });
    const result = calculateRiskForecast(logs);
    expect(result.level).toBe('high');
    expect(result.score).toBeGreaterThan(60);
  });
});
```

---

## Testing Patterns

### Testing Utility Functions

```typescript
// src/utils/predictions.test.ts
import { describe, it, expect } from 'vitest';
import { calculateRiskForecast } from './predictions';
import type { LogEntry } from '../types';

// Helper to create mock logs
const createMockLog = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  context: 'home',
  arousal: 5,
  valence: 5,
  energy: 5,
  sensoryTriggers: [],
  contextTriggers: [],
  strategies: [],
  duration: 30,
  note: '',
  ...overrides,
});

describe('calculateRiskForecast', () => {
  it('returns low risk with insufficient data', () => {
    const logs = [createMockLog()];
    const result = calculateRiskForecast(logs);

    expect(result.level).toBe('low');
    expect(result.contributingFactors).toContainEqual({
      key: 'risk.factors.notEnoughData'
    });
  });

  it('identifies high stress time periods', () => {
    // Create logs with high arousal at 2 PM
    const logs = Array.from({ length: 10 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (i * 7)); // Same day of week
      date.setHours(14, 0, 0, 0);
      return createMockLog({
        timestamp: date.toISOString(),
        arousal: 8,
      });
    });

    const result = calculateRiskForecast(logs);

    expect(result.predictedHighArousalTime).toContain('14:00');
  });
});
```

### Testing React Context

```typescript
// src/store.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { DataProvider, useLogs } from './store';

describe('LogsContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DataProvider>{children}</DataProvider>
  );

  it('adds a log entry', async () => {
    const { result } = renderHook(() => useLogs(), { wrapper });

    act(() => {
      result.current.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        context: 'home',
        arousal: 5,
        valence: 5,
        energy: 5,
        sensoryTriggers: [],
        contextTriggers: [],
        strategies: [],
        duration: 30,
        note: 'Test log',
      });
    });

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(1);
      expect(result.current.logs[0].note).toBe('Test log');
    });
  });

  it('persists logs to localStorage', async () => {
    const { result } = renderHook(() => useLogs(), { wrapper });

    act(() => {
      result.current.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        context: 'home',
        arousal: 5,
        valence: 5,
        energy: 5,
        sensoryTriggers: [],
        contextTriggers: [],
        strategies: [],
        duration: 30,
        note: '',
      });
    });

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'kreativium_logs',
        expect.any(String)
      );
    });
  });
});
```

### Testing Components

```typescript
// src/components/Analysis.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Analysis } from './Analysis';
import { DataProvider } from '../store';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <DataProvider>{ui}</DataProvider>
    </BrowserRouter>
  );
};

describe('Analysis', () => {
  it('renders log explorer title', () => {
    renderWithProviders(<Analysis />);
    expect(screen.getByText('logExplorer.title')).toBeInTheDocument();
  });

  it('shows empty state when no logs', () => {
    renderWithProviders(<Analysis />);
    expect(screen.getByText(/no.*logs/i)).toBeInTheDocument();
  });

  it('filters logs by context', async () => {
    // Setup logs in localStorage
    localStorage.setItem('kreativium_logs', JSON.stringify([
      { id: '1', context: 'home', /* ... */ },
      { id: '2', context: 'school', /* ... */ },
    ]));

    renderWithProviders(<Analysis />);

    // Click home filter
    fireEvent.click(screen.getByText('logExplorer.filters.home'));

    // Check only home logs shown
    expect(screen.queryByText(/school/i)).not.toBeInTheDocument();
  });
});
```

### Testing AI Services

```typescript
// src/services/ai.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeLogs, analyzeLogsDeep } from './ai';

describe('AI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mock analysis when no API key', async () => {
    const logs = [createMockLog()];
    const result = await analyzeLogs(logs);

    expect(result.summary).toBeTruthy();
    expect(result.triggerAnalysis).toBeTruthy();
  });

  it('caches results', async () => {
    const logs = [createMockLog()];

    const result1 = await analyzeLogs(logs);
    const result2 = await analyzeLogs(logs);

    // Same result from cache
    expect(result1.generatedAt).toBe(result2.generatedAt);
  });

  it('bypasses cache with forceRefresh', async () => {
    const logs = [createMockLog()];

    const result1 = await analyzeLogs(logs);
    const result2 = await analyzeLogs(logs, [], { forceRefresh: true });

    // Different result (new analysis)
    expect(result1.generatedAt).not.toBe(result2.generatedAt);
  });
});
```

---

## Mocking Strategies

### Mocking localStorage

```typescript
// Already mocked in setup.ts, but you can spy on calls:
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.mocked(localStorage.setItem).mockClear();
});

it('saves to localStorage', () => {
  // ... do something
  expect(localStorage.setItem).toHaveBeenCalledWith(
    'kreativium_logs',
    expect.stringContaining('test')
  );
});
```

### Mocking Dates

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

describe('date-dependent tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-11T14:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses mocked time', () => {
    expect(new Date().toISOString()).toBe('2025-01-11T14:00:00.000Z');
  });
});
```

### Mocking Fetch

```typescript
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: 'test' }),
  });
});

it('calls API', async () => {
  await someApiFunction();
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/'),
    expect.any(Object)
  );
});
```

### Mocking Modules

```typescript
// Mock entire module
vi.mock('./someModule', () => ({
  someFunction: vi.fn().mockReturnValue('mocked'),
}));

// Mock with implementation
vi.mock('./predictions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./predictions')>();
  return {
    ...actual,
    calculateRiskForecast: vi.fn().mockReturnValue({
      level: 'low',
      score: 0,
      contributingFactors: [],
    }),
  };
});
```

---

## Coverage

### Running Coverage

```bash
npm run test -- --coverage
```

### Coverage Thresholds

The project aims for:

| Type | Target |
|------|--------|
| Statements | 30% |
| Branches | 25% |
| Functions | 30% |
| Lines | 30% |

### Viewing Coverage Report

```bash
# HTML report
open coverage/index.html

# Terminal summary
npm run test -- --coverage
```

---

## Best Practices

### 1. Test Behavior, Not Implementation

```typescript
// Good: Tests observable behavior
it('displays error when form is invalid', async () => {
  render(<Form />);
  fireEvent.click(screen.getByText('Submit'));
  expect(await screen.findByText('Required')).toBeInTheDocument();
});

// Avoid: Tests implementation details
it('calls setError with "Required"', () => {
  const setError = vi.fn();
  // ... tests internal function calls
});
```

### 2. Use Descriptive Test Names

```typescript
// Good
it('calculates high risk when 3+ high arousal events in upcoming window', () => {});

// Avoid
it('works correctly', () => {});
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('filters logs by date range', () => {
  // Arrange
  const logs = [
    createMockLog({ timestamp: '2025-01-01' }),
    createMockLog({ timestamp: '2025-01-15' }),
    createMockLog({ timestamp: '2025-01-30' }),
  ];

  // Act
  const result = filterByDateRange(
    logs,
    new Date('2025-01-10'),
    new Date('2025-01-20')
  );

  // Assert
  expect(result).toHaveLength(1);
  expect(result[0].timestamp).toBe('2025-01-15');
});
```

### 4. Test Edge Cases

```typescript
describe('calculateRiskForecast', () => {
  it('handles empty array', () => {});
  it('handles single entry', () => {});
  it('handles entries spanning midnight', () => {});
  it('handles maximum valid values', () => {});
  it('handles timezone differences', () => {});
});
```

### 5. Keep Tests Fast

```typescript
// Use beforeAll for expensive setup
beforeAll(async () => {
  largeMockDataset = await generateLargeDataset();
});

// Use beforeEach only for resetting state
beforeEach(() => {
  localStorage.clear();
});
```

### 6. Clean Up After Tests

```typescript
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});
```

---

## Debugging Tests

### Run Single Test

```bash
npm run test:run -- --grep "specific test name"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "program": "${workspaceRoot}/node_modules/vitest/vitest.mjs",
  "args": ["run", "--no-coverage", "${relativeFile}"],
  "console": "integratedTerminal"
}
```

### Console Output in Tests

```typescript
it('debugs something', () => {
  const result = someFunction();
  console.log('Result:', JSON.stringify(result, null, 2));
  expect(result).toBeDefined();
});
```

---

## Test File Examples

### Utility Test

See: `src/utils/predictions.test.ts`

### Store Test

See: `src/store.test.tsx`

### Component Test

See: `src/components/Toast.test.tsx`

### Service Test

See: `src/services/ai.test.ts`

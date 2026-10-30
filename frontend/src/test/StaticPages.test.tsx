import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SecurityPage } from '../pages/SecurityPage';
import { ModelsPage } from '../pages/ModelsPage';
import { AboutPage } from '../pages/AboutPage';

describe('Static Informational Pages', () => {
  describe('SecurityPage', () => {
    it('asserts presence of honest limits and isolation boundaries', () => {
      render(<SecurityPage />);

      expect(screen.getByText('Security & Sandbox Boundaries')).toBeInTheDocument();
      expect(screen.getByText(/Evidence Over Assertion/i)).toBeInTheDocument();

      // Control 1: Environment scrubbing
      expect(screen.getByText('Environment Variable Scrubbing')).toBeInTheDocument();

      // Control 2: Disposable copies
      expect(screen.getByText('Disposable Atomic Working Copies')).toBeInTheDocument();

      // Control 3: Timeouts
      expect(screen.getByText('Hard Wall-Clock Execution Limits')).toBeInTheDocument();

      // Control 4: 60-min expiry
      expect(screen.getByText('60-Minute Automatic Retention Expiry')).toBeInTheDocument();

      // Transparent limits
      expect(screen.getByText(/Transparent Disclosure: Current MVP Isolation Limits/i)).toBeInTheDocument();
      expect(screen.getByText(/Network Isolation:/i)).toBeInTheDocument();
      expect(screen.getByText(/Platform Parity \(Windows vs Linux\):/i)).toBeInTheDocument();
      expect(screen.getByText(/Arbitrary Code Bounds:/i)).toBeInTheDocument();
    });
  });

  describe('ModelsPage', () => {
    it('asserts 3 configured model roles and Nebius Token Factory architecture', () => {
      render(<ModelsPage />);

      expect(screen.getByText('Models & Role Architecture')).toBeInTheDocument();
      expect(screen.getByText('Nebius Token Factory')).toBeInTheDocument();

      // 3 configured roles
      expect(screen.getByText('Role: FAST')).toBeInTheDocument();
      expect(screen.getByText('Planning & Source Inspection')).toBeInTheDocument();

      expect(screen.getByText('Role: REASONING')).toBeInTheDocument();
      expect(screen.getByText('Unified Diff Patch Generation')).toBeInTheDocument();

      expect(screen.getByText('Role: ADVANCED')).toBeInTheDocument();
      expect(screen.getByText('Bounded Retry & Failure Revision')).toBeInTheDocument();

      expect(screen.getByText(/nvidia\/Nemotron-3_5-Lightning/i)).toBeInTheDocument();
      expect(screen.getByText(/DeepSeek-V4-Pro/i)).toBeInTheDocument();
    });
  });

  describe('AboutPage', () => {
    it('asserts FAQ accordion, architecture breakdown, and New Repair action', () => {
      render(
        <MemoryRouter initialEntries={['/about']}>
          <AboutPage />
        </MemoryRouter>
      );

      expect(screen.getByText('About ProofPatch')).toBeInTheDocument();
      expect(screen.getAllByText('Evidence Over Assertion').length).toBeGreaterThanOrEqual(1);

      expect(
        screen.getByRole('button', { name: /How does ProofPatch eliminate hallucinated code fixes\?/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Which model architectures power each pipeline role\?/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /How are enterprise codebases kept safe during test execution\?/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /How does the bounded retry feedback loop operate\?/i })
      ).toBeInTheDocument();

      expect(screen.getByRole('link', { name: /Start New Repair/i })).toBeInTheDocument();
    });
  });
});

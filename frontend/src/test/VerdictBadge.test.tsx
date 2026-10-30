import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { VerdictBadge } from '../components/VerdictBadge';

describe('VerdictBadge', () => {
  it('renders VERIFIED status with check icon and accessible label', () => {
    const { container } = render(<VerdictBadge verdict="VERIFIED" />);
    const badge = screen.getByText('Verified');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-[#1E6B3C]');
    expect(container.querySelector('.lucide-circle-check')).toBeInTheDocument();
  });

  it('renders FAILED status with X icon and accessible label', () => {
    const { container } = render(<VerdictBadge verdict="FAILED" />);
    const badge = screen.getByText('Failed');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-[#9C2A2A]');
    expect(container.querySelector('.lucide-circle-x')).toBeInTheDocument();
  });

  it('renders NOT_VERIFIED status with alert icon and accessible label', () => {
    const { container } = render(<VerdictBadge verdict="NOT_VERIFIED" />);
    const badge = screen.getByText('Not Verified');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-[#9A6218]');
    expect(container.querySelector('.lucide-circle-alert')).toBeInTheDocument();
  });

  it('renders BLOCKED status with shield icon and accessible label', () => {
    const { container } = render(<VerdictBadge verdict="BLOCKED" />);
    const badge = screen.getByText('Blocked');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-[#5A534D]');
    expect(container.querySelector('.lucide-shield-alert')).toBeInTheDocument();
  });

  it('renders RUNNING state for non-terminal JobStatus with spinner', () => {
    const { container } = render(<VerdictBadge verdict="ANALYZING" />);
    const badge = screen.getByText('Running');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-[#27618D]');
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders large and small variants with appropriate sizing classes', () => {
    const { rerender } = render(<VerdictBadge verdict="VERIFIED" size="lg" />);
    expect(screen.getByText('Verified').parentElement).toHaveClass('text-sm font-semibold');

    rerender(<VerdictBadge verdict="VERIFIED" size="sm" />);
    expect(screen.getByText('Verified').parentElement).toHaveClass('text-[11px]');
  });
});

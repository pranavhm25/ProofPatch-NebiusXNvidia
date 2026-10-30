import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { VerdictBadge } from '../components/VerdictBadge';

describe('VerdictBadge', () => {
  it('renders VERIFIED status with check icon and green styling', () => {
    render(<VerdictBadge verdict="VERIFIED" />);
    const badge = screen.getByText('Verified');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-[#1E6B3C]');
  });

  it('renders FAILED status with red styling', () => {
    render(<VerdictBadge verdict="FAILED" />);
    const badge = screen.getByText('Failed');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-[#9C2A2A]');
  });

  it('renders NOT_VERIFIED status with amber styling', () => {
    render(<VerdictBadge verdict="NOT_VERIFIED" />);
    const badge = screen.getByText('Not Verified');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-[#9A6218]');
  });

  it('renders BLOCKED status with gray styling', () => {
    render(<VerdictBadge verdict="BLOCKED" />);
    const badge = screen.getByText('Blocked');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-[#5A534D]');
  });

  it('renders large variant with correct classes', () => {
    render(<VerdictBadge verdict="VERIFIED" size="lg" />);
    const badge = screen.getByText('Verified');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-sm');
    expect(badge.parentElement).toHaveClass('font-semibold');
  });
});

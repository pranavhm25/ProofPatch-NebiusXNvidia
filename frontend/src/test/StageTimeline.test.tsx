import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StageTimeline } from '../components/StageTimeline';

describe('StageTimeline', () => {
  it('renders all 7 pipeline stages with labels and descriptions', () => {
    render(<StageTimeline currentStatus="VALIDATING" />);

    expect(screen.getByText(/1\. Validating Repository/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Inspecting Source/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Planning Repair/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. Generating Patch/i)).toBeInTheDocument();
    expect(screen.getByText(/5\. Running Tests/i)).toBeInTheDocument();
    expect(screen.getByText(/6\. Bounded Retry/i)).toBeInTheDocument();
    expect(screen.getByText(/7\. Preparing Report/i)).toBeInTheDocument();

    expect(screen.getByText(/Checking archive integrity/i)).toBeInTheDocument();
  });

  it('renders active stage message, model id, attempt number, and elapsed seconds', () => {
    render(
      <StageTimeline
        currentStatus="PLANNING"
        stageMessage="Formulating hypothesis"
        modelId="nvidia/Nemotron-3-Ultra-550b-a55b"
        attemptNumber={1}
        elapsedSeconds={14}
      />
    );

    expect(screen.getByText('Formulating hypothesis')).toBeInTheDocument();
    expect(screen.getByText('nvidia/Nemotron-3-Ultra-550b-a55b')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByText('14s')).toBeInTheDocument();
  });

  it('marks prior stages completed and future stages pending when in middle stage', () => {
    const { container } = render(<StageTimeline currentStatus="TESTING" />);

    // Stage 1 to 4 should have completed checkmarks (lucide-circle-check)
    const checkmarks = container.querySelectorAll('.lucide-circle-check');
    expect(checkmarks.length).toBeGreaterThanOrEqual(4);

    // Stage 5 should have active spinner (lucide-loader-circle or lucide-loader-2)
    const activeSpinner = container.querySelectorAll('.animate-spin');
    expect(activeSpinner.length).toBe(1);
  });

  it('renders retry stage with attempt 2 correctly', () => {
    render(
      <StageTimeline
        currentStatus="RETRYING"
        stageMessage="Sending test stderr back to model"
        attemptNumber={2}
        elapsedSeconds={28}
      />
    );

    expect(screen.getByText('Sending test stderr back to model')).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByText('28s')).toBeInTheDocument();
  });

  it('marks all stages completed when currentStatus is COMPLETED', () => {
    const { container } = render(<StageTimeline currentStatus="COMPLETED" />);
    const checkmarks = container.querySelectorAll('.lucide-circle-check');
    expect(checkmarks.length).toBe(7);
  });
});

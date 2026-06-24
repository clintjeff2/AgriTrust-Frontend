import { render, screen, fireEvent, act } from '@testing-library/react';
import { expect, it, describe, vi } from 'vitest';
import TrustBadge from '../TrustBadge';
import { verificationEvents } from '../../../hooks/useCertificateVerification';

describe('TrustBadge Concurrency', () => {
  it('should skip intermediate scores and only render the final score when updates are rapid', async () => {
    vi.useFakeTimers();

    const certificateId = 'cert-123';
    render(<TrustBadge certificateId={certificateId} initialScore={70} />);

    const badgeText = screen.getByTestId('trust-score-text');
    expect(badgeText).toHaveTextContent('70%');

    act(() => {
      verificationEvents.emit('trustScoreUpdated', { certificateId, score: 72 });
    });
    act(() => { vi.advanceTimersByTime(100); });

    act(() => {
      verificationEvents.emit('trustScoreUpdated', { certificateId, score: 74 });
    });
    act(() => { vi.advanceTimersByTime(100); });

    act(() => {
      verificationEvents.emit('trustScoreUpdated', { certificateId, score: 76 });
    });
    act(() => { vi.advanceTimersByTime(100); });

    act(() => {
      verificationEvents.emit('trustScoreUpdated', { certificateId, score: 78 });
    });
    act(() => { vi.advanceTimersByTime(100); });

    act(() => {
      verificationEvents.emit('trustScoreUpdated', { certificateId, score: 80 });
    });

    expect(badgeText).toHaveTextContent('70%');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(badgeText).toHaveTextContent('80%');

    vi.useRealTimers();
  });

  it('should wait for the score to settle before opening the detail panel with the final score', async () => {
    vi.useFakeTimers();

    const certificateId = 'cert-123';
    render(<TrustBadge certificateId={certificateId} initialScore={70} />);

    const badge = screen.getByTestId('trust-badge');

    act(() => {
      verificationEvents.emit('trustScoreUpdated', { certificateId, score: 80 });
    });
    act(() => { vi.advanceTimersByTime(100); });

    fireEvent.click(badge);

    expect(screen.queryByTestId('panel-score')).not.toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.queryByTestId('panel-score')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId('panel-score')).toHaveTextContent('80%');

    vi.useRealTimers();
  });
});

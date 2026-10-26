import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, vi, describe, it, expect } from 'vitest';
import RecruiterDashboard from './RecruiterDashboard';
import RecruiterJobPostings from './RecruiterJobPostings';
import { useGlowHighlight } from '../utils/useGlowHighlight';

// Component to test useGlowHighlight hook directly
function GlowTestComponent() {
  const { triggerGlow } = useGlowHighlight();
  return (
    <div>
      <button onClick={() => triggerGlow('test-dest-1')} data-testid="btn-1">
        Trigger 1
      </button>
      <button onClick={() => triggerGlow('test-dest-2')} data-testid="btn-2">
        Trigger 2
      </button>
      <div id="test-dest-1" data-testid="dest-1">Destination 1</div>
      <div id="test-dest-2" data-testid="dest-2">Destination 2</div>
    </div>
  );
}

describe('Recruiter Features & Navigation Tests', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'fake-recruiter-token');
    localStorage.setItem('role', 'recruiter');
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.includes('/api/dashboard/recruiter')) {
        return {
          ok: true,
          json: async () => ({
            jobs: [
              {
                id: 101,
                title: 'Full Stack Engineer',
                company_name: 'Tech Corp',
                status: 'Published',
                graduation_year: 2026,
                graduation_year_mode: 'NA',
                min_cgpa: 7.5,
                openings: 2,
                application_count: 1
              }
            ],
            statistics: { published_jobs: 1, applications: 1 }
          })
        };
      }
      if (url.includes('/api/applications')) {
        return {
          ok: true,
          json: async () => ({
            applications: [
              {
                id: 501,
                student_name: 'John Doe',
                student_email: 'john@example.com',
                job_title: 'Full Stack Engineer',
                department: 'Computer Science and Engineering',
                graduation_year: 2026,
                cgpa: 8.8,
                status: 'Applied',
                skills: ['React', 'Python'],
                feedbacks: []
              }
            ]
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('renders all 4 recruiter capability cards with unique and correct destinations', async () => {
    render(
      <MemoryRouter initialEntries={['/recruiter']}>
        <RecruiterDashboard />
      </MemoryRouter>
    );

    // Card 1: Manage requisitions -> /recruiter/jobs#requisitions
    const manageCard = screen.getByText('Manage requisitions').closest('a');
    expect(manageCard).toBeInTheDocument();
    expect(manageCard.getAttribute('href')).toContain('/recruiter/jobs#requisitions');

    // Card 2: Review applicants -> #applicant-review
    const reviewCard = screen.getByText('Review applicants').closest('a');
    expect(reviewCard).toBeInTheDocument();
    expect(reviewCard.getAttribute('href')).toBe('#applicant-review');

    // Card 3: Move candidates forward -> #candidate-pipeline
    const moveCard = screen.getByText('Move candidates forward').closest('a');
    expect(moveCard).toBeInTheDocument();
    expect(moveCard.getAttribute('href')).toBe('#candidate-pipeline');

    // Card 4: Share useful feedback -> #candidate-feedback
    const feedbackCard = screen.getByText('Share useful feedback').closest('a');
    expect(feedbackCard).toBeInTheDocument();
    expect(feedbackCard.getAttribute('href')).toBe('#candidate-feedback');

    // Distinct target sections exist in the DOM
    expect(document.getElementById('applicant-review')).toBeInTheDocument();
    expect(document.getElementById('candidate-pipeline')).toBeInTheDocument();
    expect(document.getElementById('candidate-feedback')).toBeInTheDocument();
  });

  it('contains Graduation Year Eligibility Mode field with Only and NA options in RecruiterJobPostings', async () => {
    render(
      <MemoryRouter initialEntries={['/recruiter/jobs']}>
        <RecruiterJobPostings />
      </MemoryRouter>
    );

    const modeSelect = screen.getByLabelText(/graduation year eligibility mode/i);
    expect(modeSelect).toBeInTheDocument();

    const options = Array.from(modeSelect.querySelectorAll('option')).map(o => o.value);
    expect(options).toEqual(['Only', 'NA']);
  });

  it('applies glow-highlight for 1.5 seconds and automatically removes it', () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter initialEntries={['/']}>
        <GlowTestComponent />
      </MemoryRouter>
    );

    const dest1 = screen.getByTestId('dest-1');
    const dest2 = screen.getByTestId('dest-2');
    const btn1 = screen.getByTestId('btn-1');
    const btn2 = screen.getByTestId('btn-2');

    expect(dest1.classList.contains('glow-highlight')).toBe(false);

    // Click button 1 -> destination 1 glows
    act(() => {
      fireEvent.click(btn1);
    });
    expect(dest1.classList.contains('glow-highlight')).toBe(true);

    // Fast-forward 1.5s (1500ms)
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(dest1.classList.contains('glow-highlight')).toBe(false);

    // Test rapid consecutive clicks: click btn1 then immediately btn2
    act(() => {
      fireEvent.click(btn1);
    });
    expect(dest1.classList.contains('glow-highlight')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500); // 500ms elapsed
      fireEvent.click(btn2);       // rapid click
    });

    // dest1 should have lost glow immediately, dest2 should now glow
    expect(dest1.classList.contains('glow-highlight')).toBe(false);
    expect(dest2.classList.contains('glow-highlight')).toBe(true);

    // Advance remaining 1000ms from btn1 timer -> dest2 should still glow because its timer is 1500ms from its click
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(dest2.classList.contains('glow-highlight')).toBe(true);

    // Advance remaining 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(dest2.classList.contains('glow-highlight')).toBe(false);
  });
});

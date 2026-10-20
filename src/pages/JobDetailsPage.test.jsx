import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthPage from './AuthPage';
import JobDetailsPage from './JobDetailsPage';

const job = {
  id: 42,
  title: 'Frontend Developer',
  company_name: 'Example Co',
  location: 'Remote',
  description: 'Build web applications.',
  min_cgpa: 7,
  required_skills: ['React']
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url === '/api/auth/login') {
      return {
        ok: true,
        json: async () => ({ token: 'student-token', user: { role: 'student' } })
      };
    }
    if (url === '/api/applications') {
      return { ok: true, json: async () => ({ message: 'Application submitted.' }) };
    }
    if (url === '/api/jobs/42/eligibility') {
      return {
        ok: true,
        json: async () => ({
          eligibility: {
            eligible: true,
            status: 'eligible',
            student_cgpa: 9.35,
            required_cgpa: 7,
            cgpa_status: 'met',
            skill_match_percentage: 0,
            matched_skills: [],
            missing_skills: ['React'],
            reasons: ['All mandatory criteria satisfied.'],
            mandatory_breakdown: {
              cgpa: { actual: 9.35, required: 7, status: 'met' },
              department: { status: 'not_required' },
              graduation_year: { status: 'not_required' }
            }
          }
        })
      };
    }
    if (url === '/api/jobs/42') {
      return { ok: true, json: async () => ({ job }) };
    }
    throw new Error(`Unexpected request: ${url} ${options.method || 'GET'}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('signs in and returns to the job before submitting the application', async () => {
  render(
    <MemoryRouter initialEntries={['/jobs/42']}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
        <Route path="/student" element={<p>Student dashboard</p>} />
      </Routes>
    </MemoryRouter>
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Apply now' }));
  fireEvent.change(await screen.findByPlaceholderText('Email address'), { target: { value: 'student@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  const applyButton = await screen.findByRole('button', { name: 'Apply now' });
  expect(applyButton).toBeEnabled();
  expect(screen.getByText(/0% match/)).toBeInTheDocument();
  expect(screen.getByText(/skill gaps do not prevent you from applying/i)).toBeInTheDocument();
  fireEvent.click(applyButton);

  expect(await screen.findByRole('status')).toHaveTextContent('Application submitted.');
  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith('/api/applications', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer student-token' }),
      body: JSON.stringify({ job_id: 42 })
    }));
  });
});

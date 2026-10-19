import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ResumePage from './ResumePage';

beforeEach(() => {
  localStorage.setItem('token', 'student-token');
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url === '/api/resume/analysis') {
      return { ok: true, json: async () => ({ analysis: { skills: [], notes: 'No resume available.' } }) };
    }
    if (url === '/api/resume/analysis?job_id=99') {
      return { ok: true, json: async () => ({ analysis: { skills: ['Python'], missing_skills: ['AWS'], skill_gap_guidance: ['Build a project using AWS.'] } }) };
    }
    if (url === '/api/jobs') {
      return { ok: true, json: async () => ({ jobs: [{ id: 99, title: 'Cloud Engineer', company_name: 'Example Co' }] }) };
    }
    if (url === '/api/resume/upload') {
      return {
        ok: true,
        json: async () => ({
          resume: { analysis: { skills: ['Python', 'SQL'], notes: 'Rules-based extraction.' } }
        })
      };
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('uploads the selected PDF and displays the returned analysis', async () => {
  render(
    <MemoryRouter>
      <ResumePage />
    </MemoryRouter>
  );

  const file = new File(['resume content'], 'resume.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Resume PDF'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze resume' }));

  expect(await screen.findByText('Python')).toBeInTheDocument();
  expect(screen.getByText('SQL')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Compare with job'), { target: { value: '99' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show skill gaps' }));
  expect(await screen.findByText('AWS')).toBeInTheDocument();
  expect(screen.getByText('Build a project using AWS.')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith('/api/resume/upload', expect.objectContaining({
    method: 'POST',
    headers: { Authorization: 'Bearer student-token' },
    body: expect.any(FormData)
  }));
});

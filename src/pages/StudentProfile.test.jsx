import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StudentProfile from './StudentProfile';

const storedProfile = {
  first_name: 'Aditi',
  last_name: 'Sharma',
  student_id: 'STU-1001',
  phone: '9876543210',
  university: 'ABC Institute',
  degree: 'B.Tech',
  department: 'CSE',
  graduation_year: 2026,
  cgpa: 8.7,
  skills: ['Python', 'SQL'],
  projects: ['Placement app']
};

beforeEach(() => {
  localStorage.setItem('token', 'student-token');
  vi.stubGlobal('fetch', vi.fn(async (_url, options = {}) => {
    if (options.method === 'PUT') {
      return { ok: true, json: async () => ({ profile: { ...storedProfile, ...JSON.parse(options.body) } }) };
    }
    return { ok: true, json: async () => ({ profile: storedProfile }) };
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('loads, edits, and saves academic details and skills', async () => {
  render(
    <MemoryRouter>
      <StudentProfile />
    </MemoryRouter>
  );

  const cgpa = await screen.findByLabelText('CGPA');
  expect(cgpa).toHaveValue(8.7);
  fireEvent.change(cgpa, { target: { value: '9.1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

  expect(await screen.findByRole('status')).toHaveTextContent('Profile saved successfully.');
  expect(fetch).toHaveBeenCalledWith('/api/student/profile', expect.objectContaining({
    method: 'PUT',
    body: expect.stringContaining('"cgpa":9.1')
  }));
  expect(screen.getByText(/\d+% complete/)).toBeInTheDocument();
});

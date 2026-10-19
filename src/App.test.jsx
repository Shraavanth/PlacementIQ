import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('renders landing page', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );

  expect(screen.getByText(/connect students, recruiters, and placement teams/i)).toBeInTheDocument();
});

test('navigates to the student dashboard after a successful login', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url === '/api/auth/login') {
      return {
        ok: true,
        json: async () => ({ token: 'student-token', user: { role: 'student' } })
      };
    }
    return {
      ok: true,
      json: async () => ({
        profile: {},
        jobs: [],
        recommendations: [],
        notifications: [],
        applications: [],
        overview: {},
        deadlines: [],
        twin: null
      })
    };
  }));

  render(
    <MemoryRouter initialEntries={['/auth']}>
      <App />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'student@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('heading', { name: 'Student Placement Journey' })).toBeInTheDocument();
  await waitFor(() => expect(localStorage.getItem('role')).toBe('student'));
});

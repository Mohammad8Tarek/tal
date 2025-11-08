import React from 'react';
// FIX: Import jest globals to resolve TypeScript errors.
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import LoginPage from './LoginPage';
import { authApi, resetDatabase } from '../services/apiService';
import '@testing-library/jest-dom';
import type { User } from '../types';

// Mock the API module
// FIX: Moved `jest.requireActual` inside the mock factory to avoid hoisting issues and correctly typed the original module to prevent spread operator and property access errors.
jest.mock('../services/apiService', () => {
  const originalModule = jest.requireActual<typeof import('../services/apiService')>('../services/apiService');
  return {
    ...originalModule,
    authApi: {
      ...originalModule.authApi,
      login: jest.fn(),
    },
    // FIX: Call mockResolvedValue with `undefined` to resolve with 'undefined'. This correctly matches the Promise<void> type and avoids TypeScript inference errors.
    resetDatabase: jest.fn().mockResolvedValue(undefined), // Add mock for resetDatabase
  };
});


// FIX: The original type assertion for `jest.Mock` was incorrect, as it expects a function signature, not a Promise type.
// A type alias for the login function signature is defined here to provide strong typing for the mock.
type LoginApiFunction = (credentials: { username: string; password: string; }) => Promise<{ user: User; token: string }>;
const mockedLogin = authApi.login as jest.Mock<LoginApiFunction>;
const mockedResetDatabase = resetDatabase as jest.Mock;

describe('LoginPage', () => {
  beforeEach(async () => {
    // Reset mocks and storage before each test
    mockedLogin.mockClear();
    mockedResetDatabase.mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders login form correctly', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows an error if fields are not filled', async () => {
    render(<LoginPage />);
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.click(loginButton);

    expect(await screen.findByText(/please fill in all fields/i)).toBeInTheDocument();
  });

  it('calls the login api and displays loading state on submit', async () => {
    mockedLogin.mockResolvedValue({ user: { id: 1, username: 'admin', roles: ['admin'], status: 'active' }, token: 'fake-token' });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    // Check for loading state
    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({ username: 'admin', password: 'admin' });
    });
  });

  it('shows an error message on failed login', async () => {
    const errorMessage = 'Invalid username or password';
    mockedLogin.mockRejectedValue(new Error(errorMessage));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // Wait for the error message to appear
    const errorElement = await screen.findByText(errorMessage);
    expect(errorElement).toBeInTheDocument();
  });

  // Note: Testing the actual navigation/redirect is complex as it involves
  // the state of the AuthProvider. The most important part is that the `login` function
  // from the context is called, which we can infer from the successful API call.
  // A more advanced test would involve a mock provider.
});
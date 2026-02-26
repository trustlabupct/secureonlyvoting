import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from '../page';
import type { Election } from '@/lib/types';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/api-client.server', () => ({
  fetchApi: jest.fn(),
}));

jest.mock('@/app/actions/auth-actions', () => ({
  logout: jest.fn(),
}));

const { requireAuth } = require('@/lib/auth') as {
  requireAuth: jest.Mock;
};
const { fetchApi } = require('@/lib/api-client.server') as {
  fetchApi: jest.Mock;
};

describe('DashboardPage', () => {
  it('renders empty-state for regular users', async () => {
    requireAuth.mockResolvedValue({
      id: 'user1',
      name: 'Test User',
      role: 'user',
    });
    fetchApi.mockResolvedValue([]);

    const page = await DashboardPage();
    render(<>{page}</>);

    expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument();
    expect(screen.getByText('No Polls Available')).toBeInTheDocument();
    expect(screen.queryByText('Create Poll')).not.toBeInTheDocument();
  });

  it('renders admin controls and poll cards for admins', async () => {
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000);

    requireAuth.mockResolvedValue({
      id: 'admin1',
      name: 'Admin User',
      role: 'admin',
    });

    const elections: Election[] = [
      {
        id: 'poll-1',
        name: 'Test Poll 1',
        description: 'A poll',
        startTime: now.toISOString(),
        endTime: later.toISOString(),
        votingMechanism: 'multiple-choice',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        options: [],
      },
    ];
    fetchApi.mockResolvedValue(elections);

    const page = await DashboardPage();
    render(<>{page}</>);

    expect(screen.getByText('Welcome, Admin User!')).toBeInTheDocument();
    expect(screen.getByText('Create Poll')).toBeInTheDocument();
    expect(screen.getByText('Test Poll 1')).toBeInTheDocument();
  });
});

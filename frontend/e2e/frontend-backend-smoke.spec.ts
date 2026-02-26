import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';

type ApiResult<T = any> = {
  status: number;
  body: T;
};

async function apiCall<T = any>(
  path: string,
  options: { method?: string; token?: string; payload?: unknown } = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', token, payload } = options;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const text = await response.text();
  let body: T;
  try {
    body = (text ? JSON.parse(text) : null) as T;
  } catch {
    body = { raw: text } as T;
  }

  return { status: response.status, body };
}

test.describe('Frontend <-> Backend click smoke', () => {
  let yesNoPollId = '';
  let adminOnlyPollId = '';
  let anonymousPollId = '';

  test.beforeAll(async () => {
    const login = await apiCall<{ access_token: string }>('/auth/login', {
      method: 'POST',
      payload: {
        username: 'admin@certificates.local',
        password: 'admin123',
      },
    });
    expect(login.status).toBe(200);
    const adminToken = login.body.access_token;
    expect(adminToken).toBeTruthy();

    const now = Date.now();
    const startTime = new Date(now - 60_000).toISOString();
    const endTime = new Date(now + 30 * 60_000).toISOString();

    const yesNoCreate = await apiCall<{ id: string }>('/admin/polls', {
      method: 'POST',
      token: adminToken,
      payload: {
        name: `UI YesNo ${now}`,
        description: 'UI click smoke yes-no',
        startTime,
        endTime,
        votingMechanism: 'yes-no',
        visibility: 'everyone',
        anonymous: false,
        options: [],
      },
    });
    expect(yesNoCreate.status).toBe(201);
    yesNoPollId = yesNoCreate.body.id;

    const adminOnlyCreate = await apiCall<{ id: string }>('/admin/polls', {
      method: 'POST',
      token: adminToken,
      payload: {
        name: `UI AdminOnly ${now}`,
        description: 'UI click smoke admin-only',
        startTime,
        endTime,
        votingMechanism: 'yes-no',
        visibility: 'admin-only',
        anonymous: false,
        options: [],
      },
    });
    expect(adminOnlyCreate.status).toBe(201);
    adminOnlyPollId = adminOnlyCreate.body.id;

    const anonymousCreate = await apiCall<{ id: string }>('/admin/polls', {
      method: 'POST',
      token: adminToken,
      payload: {
        name: `UI Anonymous ${now}`,
        description: 'UI click smoke anonymous',
        startTime,
        endTime,
        votingMechanism: 'yes-no',
        visibility: 'everyone',
        anonymous: true,
        options: [],
      },
    });
    expect(anonymousCreate.status).toBe(201);
    anonymousPollId = anonymousCreate.body.id;
  });

  test('handles login, poll click-through vote, visibility denial, and anonymous vote submission', async ({
    page,
  }) => {
    const trackedResponses: Array<{ url: string; status: number }> = [];
    page.on('response', (response) => {
      const url = response.url();
      if (
        url.includes('/api/auth/login') ||
        url.includes('/api/auth/set-cookie') ||
        url.includes('/api/votes') ||
        url.includes('/api/blind-tokens')
      ) {
        trackedResponses.push({ url, status: response.status() });
      }
    });

    await page.goto(`${FRONTEND_URL}/login`);
    await page.locator('input#email').first().fill('user@example.com');
    await page.locator('input#password').first().fill('user123');
    await page.getByRole('button', { name: 'Sign in with Email' }).click();
    await expect(page).toHaveURL(`${FRONTEND_URL}/dashboard`);

    await page.locator(`a[href="/polls/${yesNoPollId}"]`).first().click();
    await expect(page).toHaveURL(`${FRONTEND_URL}/polls/${yesNoPollId}`);
    await page.getByLabel('Yes').click();
    await page.getByRole('button', { name: 'Submit Vote' }).click();
    await expect(page.getByText('Vote submitted successfully')).toBeVisible();

    await page.goto(`${FRONTEND_URL}/polls/${adminOnlyPollId}`);
    await expect(page.getByText('Access Denied')).toBeVisible();

    await page.goto(`${FRONTEND_URL}/anonymous-vote`);
    await page.locator('input#email').first().fill('user@example.com');
    await page.locator('input#password').first().fill('user123');
    await page.getByRole('button', { name: 'Login for Anonymous Voting' }).click();
    await page.getByLabel('Yes').check();
    await page.getByRole('button', { name: 'Submit Anonymous Vote' }).click();

    await expect(
      page
        .locator('[role="alert"]')
        .filter({ hasText: /successfully/i })
        .first(),
    ).toBeVisible();

    expect(
      trackedResponses.some((item) => item.url.includes('/api/auth/login') && item.status === 200),
    ).toBeTruthy();
    expect(
      trackedResponses.some((item) => item.url.includes('/api/auth/set-cookie') && item.status === 200),
    ).toBeTruthy();
    expect(
      trackedResponses.some((item) => item.url.includes('/api/votes') && item.status === 201),
    ).toBeTruthy();
    expect(
      trackedResponses.some(
        (item) => item.url.includes('/api/blind-tokens/generate') && item.status === 201,
      ),
    ).toBeTruthy();
  });
});

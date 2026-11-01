import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { UserSearch } from '../src/UserSearch';

const PEOPLE = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Alan Kay'];
const requests: string[] = [];

const server = setupServer(
  http.get('https://api.kata.test/users', ({ request }) => {
    const query = new URL(request.url).searchParams.get('q') ?? '';
    requests.push(query);
    const matches = PEOPLE.map((name, index) => ({ id: index + 1, name })).filter((user) =>
      user.name.toLowerCase().includes(query.toLowerCase()),
    );
    return HttpResponse.json(matches);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
});
afterAll(() => server.close());

async function searchFor(text: string) {
  const user = userEvent.setup();
  render(<UserSearch />);
  await user.type(screen.getByLabelText('Search users'), text);
  await user.click(screen.getByRole('button', { name: 'Search' }));
}

it('lists the matching users after searching', async () => {
  await searchFor('alan');
  const items = await screen.findAllByRole('listitem');
  expect(items.map((item) => item.textContent)).toEqual(['Alan Turing', 'Alan Kay']);
  expect(requests).toEqual(['alan']);
});

it('searches when Enter is pressed in the input', async () => {
  const user = userEvent.setup();
  render(<UserSearch />);
  await user.type(screen.getByLabelText('Search users'), 'grace{Enter}');
  expect(await screen.findByRole('listitem')).toHaveTextContent('Grace Hopper');
});

it('says when nobody matches', async () => {
  await searchFor('zzz');
  expect(await screen.findByText('No users found')).toBeInTheDocument();
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
});

it('shows an alert when the request fails', async () => {
  server.use(http.get('https://api.kata.test/users', () => new HttpResponse(null, { status: 500 })));
  await searchFor('ada');
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
});

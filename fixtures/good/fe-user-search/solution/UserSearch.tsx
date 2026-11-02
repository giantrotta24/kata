import { useState, type FormEvent } from 'react';

export interface User {
  id: number;
  name: string;
}

export function UserSearch() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    setFailed(false);
    try {
      const response = await fetch(`https://api.kata.test/users?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setUsers(await response.json());
    } catch {
      setUsers(null);
      setFailed(true);
    }
  }

  return (
    <form onSubmit={search}>
      <label htmlFor="user-search">Search users</label>
      <input id="user-search" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button type="submit">Search</button>
      {failed && <p role="alert">Something went wrong</p>}
      {users && users.length === 0 && <p>No users found</p>}
      {users && users.length > 0 && (
        <ul>
          {users.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      )}
    </form>
  );
}

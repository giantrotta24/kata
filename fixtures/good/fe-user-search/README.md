# User search box

Build `UserSearch` in `starter/UserSearch.tsx`: a small form for finding users by name.

- A text input labelled **Search users** and a **Search** button.
- Submitting the form requests `GET https://api.kata.test/users?q=<what was typed>`. The response is a JSON array of `{ id: number, name: string }`.
- Show the matching names as a list, one list item per user, in the order the API returned them.
- If the API returns an empty array, show the text **No users found**.
- If the request fails (any non-2xx status), show **Something went wrong** in an element with the `alert` role.

Export the component as a named export: `export function UserSearch()`.

Grading uses React Testing Library: it finds elements by their role and label, types into the input and clicks the button. Styling is not graded.

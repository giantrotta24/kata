## Hint 1

Wrap the input and button in a `<form>` and handle its submit event, so both clicking and pressing Enter work. Connect the label to the input with `htmlFor` and `id`.

## Hint 2

Keep three pieces of state: the query text, the result list (null until the first search), and whether the last request failed. `fetch` does not throw on a 500, so check `response.ok` yourself.

## Hint 3

In the submit handler: `event.preventDefault()`, then `fetch(`https://api.kata.test/users?q=${encodeURIComponent(query)}`)`. If `!res.ok`, set the error flag; otherwise `setUsers(await res.json())`. Render `<p role="alert">` for the error, the empty message when the list has length 0, and a `<ul>` of `<li>` otherwise.

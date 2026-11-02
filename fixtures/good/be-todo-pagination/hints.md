## Hint 1

The reporter only has 4 todos, which is fewer than one page. What happens with more todos than fit on a page? Try `GET /todos?limit=10` against a list of 25.

## Hint 2

Count the items in a page and compare it with `limit`. The bug is in how the page is cut out of the full list.

## Hint 3

`Array.prototype.slice(start, end)` excludes `end`. The page is `todos.slice(offset, offset + limit)`; anything subtracting 1 from the end drops the last item of every full page.

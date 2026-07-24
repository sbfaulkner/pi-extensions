# Move Statements into Function

**Tag:** moving-features · **Inverse:** [Move Statements to Callers](move-statements-to-callers.md)

## Motivation

Removing duplication is one of the best rules of thumb for healthy code. If you find the
same statements executed every time a function is called, fold them into the function
itself, so the behavior lives in one place. (If the statements don't *always* belong with
the function, do the reverse: [Move Statements to Callers](move-statements-to-callers.md).)

## Mechanics

1. If the statements to move aren't adjacent to the target function's call, use
   [Slide Statements](slide-statements.md) to bring them together.
2. If the target function is only called from this one place, cut the statements from the
   caller, paste them into the target, run tests, and you're done.
3. Otherwise, use [Extract Function](extract-function.md) on both the statements *and* the
   target-function call together, giving a temporary name; find every caller and adjust so
   the repeated statements move in; then [Inline Function](inline-function.md) the original
   target into the new function and rename back.

## Example

Before — every caller emits the same photo line before rendering:

```ruby
def render_person(person)
  result = []
  result << "<p>#{person[:name]}</p>"
  result << "<div>title: #{person[:photo][:title]}</div>"
  result << emit_photo_data(person[:photo])
  result.join("\n")
end

def emit_photo_data(photo)
  ["<p>location: #{photo[:location]}</p>", "<p>date: #{photo[:date]}</p>"].join("\n")
end
```

After moving the shared title line into `emit_photo_data`:

```ruby
def render_person(person)
  result = []
  result << "<p>#{person[:name]}</p>"
  result << emit_photo_data(person[:photo])
  result.join("\n")
end

def emit_photo_data(photo)
  [
    "<div>title: #{photo[:title]}</div>",
    "<p>location: #{photo[:location]}</p>",
    "<p>date: #{photo[:date]}</p>",
  ].join("\n")
end
```

## Related

- Inverse: [Move Statements to Callers](move-statements-to-callers.md)
- Uses [Slide Statements](slide-statements.md), [Extract Function](extract-function.md), [Inline Function](inline-function.md)

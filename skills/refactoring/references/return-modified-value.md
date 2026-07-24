# Return Modified Value

**Tag:** refactoring-apis

## Motivation

When a function computes a new value for some data, it's clearer to **return** that value than
to mutate a variable in the caller's scope as a side effect. An explicit return signals "this
function's job is to produce this value," making data flow visible and the function easier to
reason about (and often pure). This is especially valuable when a variable is updated across a
stretch of code — wrap that update in a function that returns the new value.

## Mechanics

1. Identify the variable being modified and the code that modifies it.
2. If that code isn't already its own function, extract it with [Extract Function](extract-function.md).
3. Change the extracted function so it returns the modified value rather than mutating the
   outer variable; have the caller assign the return value.
4. Run the tests.
5. Give the returned value / function a name that reflects what it produces.

## Example

Before — the function mutates a variable owned by the caller:

```ruby
def calculate_ascent(points)
  result = 0
  (1...points.length).each do |i|
    vertical = points[i][:elevation] - points[i - 1][:elevation]
    result += vertical if vertical.positive?
  end
  # ... result used below ...
end
```

After returning the computed value:

```ruby
def total_ascent(points)
  (1...points.length).sum do |i|
    vertical = points[i][:elevation] - points[i - 1][:elevation]
    vertical.positive? ? vertical : 0
  end
end

ascent = total_ascent(points)
```

## Related

- Uses [Extract Function](extract-function.md)
- Related: [Separate Query from Modifier](separate-query-from-modifier.md), [Split Loop](split-loop.md)

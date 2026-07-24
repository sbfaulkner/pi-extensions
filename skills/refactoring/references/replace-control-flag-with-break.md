# Replace Control Flag with Break

**Tag:** simplify-conditional-logic · **Alias:** Remove Control Flag

## Motivation

A control flag is a variable whose only job is to determine control flow — typically set in
a loop to signal "stop looking" or "we found it," then checked in the loop condition. Such
flags are harder to follow than they need to be. Modern languages give you `break`, `next`,
and `return`, which express the intent directly. Remove the flag in favor of these.

## Mechanics

1. Consider [Extract Function](extract-function.md) on the logic containing the control flag,
   so `return` becomes available for the exit.
2. Replace each assignment that sets the flag to its "done" value with a `break` (or `next`,
   or `return`) as appropriate.
3. Run the tests after each replacement.
4. When the flag is fully removed, delete its declaration and any check of it.
5. Run the tests.

## Example

Before — a `found` flag controls the loop:

```ruby
def contains_miscreant?(people)
  found = false
  people.each do |p|
    unless found
      if p == "Don" || p == "John"
        send_alert
        found = true
      end
    end
  end
  found
end
```

After replacing the flag with `break`/direct returns:

```ruby
def contains_miscreant?(people)
  people.each do |p|
    if p == "Don" || p == "John"
      send_alert
      return true
    end
  end
  false
end
```

## Related

- Uses [Extract Function](extract-function.md)
- Flatten related nesting: [Replace Nested Conditional with Guard Clauses](replace-nested-conditional-with-guard-clauses.md)

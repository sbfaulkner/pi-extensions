# Remove Double Negative

**Tag:** simplify-conditional-logic · **Source:** refactoring.com catalog (guest entry, Ashley Frieze & Martin Fowler)

## Motivation

Double negatives may have their uses in natural language, but in code they are just plain
confusing — `!item.not_found?` forces the reader to compute a parity check. Kill them on
sight: make the test a single positive.

## Mechanics

1. If no method with the opposite (positive) sense exists, create one. Its body can simply
   negate the original — you can clean that up later.
2. Replace each double negative with a call to the positive method, running the tests
   after each replacement.
3. If the negative form is no longer used, remove it with [Inline Function](inline-function.md).
   If both forms are needed, move the real logic into the positive method and have the
   negative one call it.
4. If the positive form's body is hard to express, consider
   [Substitute Algorithm](substitute-algorithm.md).

## Example

Before:

```ruby
class Item
  def not_found?
    @matches.empty?
  end
end

process(item) if !item.not_found?
```

After:

```ruby
class Item
  def found?
    @matches.any?
  end

  def not_found?
    !found?
  end
end

process(item) if item.found?
```

## Related

- Single negation with an else clause: [Reverse Conditional](reverse-conditional.md)
- Clean up the leftover negative form: [Inline Function](inline-function.md)
- Prefer idiomatic conditional forms: [Recompose Conditional](recompose-conditional.md)

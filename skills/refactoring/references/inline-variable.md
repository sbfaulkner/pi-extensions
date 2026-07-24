# Inline Variable

**Tag:** basic · **Alias:** Inline Temp · **Inverse:** [Extract Variable](extract-variable.md)

## Motivation

Sometimes a variable's name says no more than the expression it holds, or it gets in the
way of other refactorings (such as [Replace Temp with Query](replace-temp-with-query.md)
or [Extract Function](extract-function.md)). In those cases, inline it.

## Mechanics

1. Check that the right-hand side of the assignment has no side effects.
2. If the variable isn't already read-only, make it so, and run the tests (this confirms
   it's assigned only once).
3. Find the first reference to the variable and replace it with the right-hand side.
4. Run the tests.
5. Repeat for each reference, then remove the declaration.

## Example

```ruby
# before
base_price = an_order.base_price
an_order.base_price > 1000

# after
an_order.base_price > 1000
```

## Related

- Inverse: [Extract Variable](extract-variable.md)
- Frequently the last step of [Replace Temp with Query](replace-temp-with-query.md)
- Inline a function instead: [Inline Function](inline-function.md)

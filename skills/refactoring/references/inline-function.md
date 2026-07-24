# Inline Function

**Tag:** basic · **Alias:** Inline Method · **Inverse:** [Extract Function](extract-function.md)

## Motivation

Sometimes a function's body is as clear as its name — the indirection is just noise.
Inline it back into its callers. Also use this when you have a group of badly factored
functions: inline them all into one big function, then re-extract with
[Extract Function](extract-function.md) along better boundaries. Inlining is also useful
when a function merely delegates to another (a [Middle Man](remove-middle-man.md)).

## Mechanics

1. Check the function is not polymorphic — **do not inline a method overridden by
   subclasses**, since you can't inline into the subclasses.
2. Find all callers of the function.
3. Replace each call with the function's body.
4. Run the tests after each replacement (do them one at a time, not all at once).
5. Remove the original function definition.

If inlining turns out to be hard (e.g., the body uses recursion, multiple return points,
or assigns to a member that the caller can't easily reproduce), stop and reconsider.

## Example

Before — `rating` delegates through a trivial predicate:

```ruby
def rating(driver)
  more_than_five_late_deliveries?(driver) ? 2 : 1
end

def more_than_five_late_deliveries?(driver)
  driver.number_of_late_deliveries > 5
end
```

After inlining the predicate:

```ruby
def rating(driver)
  driver.number_of_late_deliveries > 5 ? 2 : 1
end
```

## Related

- Inverse: [Extract Function](extract-function.md)
- Inline a whole class: [Inline Class](inline-class.md)
- Remove pass-through delegation: [Remove Middle Man](remove-middle-man.md)
- Inline a temp instead: [Inline Variable](inline-variable.md)

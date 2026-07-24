# Replace Exception with Precheck

**Tag:** refactoring-apis · **Alias:** Replace Exception with Test · **Inverse:** [Replace Error Code with Exception](replace-error-code-with-exception.md)

## Motivation

Exceptions should be reserved for genuinely exceptional, unexpected behavior — not for
conditions the caller could reasonably check first. When you're using an exception to handle a
condition that's a normal part of operation (e.g., "the list might be empty"), replace it with
an up-front test (a precheck), so the code says clearly "check this, and if so, do that."

## Mechanics

1. Add an up-front check that tests for the condition the exception was catching, handling it
   directly.
2. Run the tests.
3. Remove the `rescue`/`begin` handling that the precheck now makes unnecessary.
4. Run the tests.

## Example

Before — using rescue to handle an ordinary "no resource available" case:

```ruby
def resource_for(name)
  begin
    @available.pop
  rescue NoMethodError
    ResourcePool.create(name)
  end
end
```

After replacing with a precheck:

```ruby
def resource_for(name)
  return ResourcePool.create(name) if @available.empty?

  @available.pop
end
```

## Related

- Inverse: [Replace Error Code with Exception](replace-error-code-with-exception.md)
- Flatten with guards: [Replace Nested Conditional with Guard Clauses](replace-nested-conditional-with-guard-clauses.md)

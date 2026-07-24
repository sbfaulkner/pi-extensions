# Replace Query with Parameter

**Tag:** refactoring-apis · **Inverse:** [Replace Parameter with Query](replace-parameter-with-query.md)

## Motivation

The opposite of [Replace Parameter with Query](replace-parameter-with-query.md). Sometimes a
function reaches out to global data, a mutable field, or some other awkward reference to
answer a query internally. That reference makes the function harder to reason about and test.
Passing the value in as a parameter moves the responsibility of resolving it to the caller,
making the function pure and its dependencies explicit — often worth it even at the cost of a
longer parameter list.

## Mechanics

1. Use [Extract Variable](extract-variable.md) on the query inside the function to separate
   it from the rest of the body.
2. Apply [Extract Function](extract-function.md) to the body that now uses that variable,
   giving it a temporary name.
3. Use [Inline Variable](inline-variable.md) to remove the variable you created.
4. Apply [Inline Function](inline-function.md) to the original function.
5. Rename the new function to the original name with
   [Change Function Declaration](change-function-declaration.md).
6. Run the tests.

## Example

Before — the method depends on a global thermostat:

```ruby
def target_temperature(plan)
  current = $thermostat.current_temperature
  [[current, plan.min].max, plan.max].min
end
```

After passing the current temperature in:

```ruby
def target_temperature(plan, current_temperature)
  [[current_temperature, plan.min].max, plan.max].min
end

target_temperature(plan, $thermostat.current_temperature)
```

## Related

- Inverse: [Replace Parameter with Query](replace-parameter-with-query.md)
- Uses [Extract Variable](extract-variable.md), [Extract Function](extract-function.md), [Inline Function](inline-function.md), [Change Function Declaration](change-function-declaration.md)

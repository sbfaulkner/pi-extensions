# Consolidate Conditional Expression

**Tag:** simplify-conditional-logic

## Motivation

Sometimes several separate conditional checks all lead to the *same* result. When that
happens, combine them into a single check with `&&`/`||`. This makes it clear you're
really testing one thing (even if it's a compound thing), and — once consolidated — the
combined condition is a prime candidate for [Extract Function](extract-function.md), which
replaces the mechanics of the test with a statement of its intent. Don't consolidate if
the checks are genuinely independent decisions that happen to share a result by
coincidence.

## Mechanics

1. Ensure none of the conditionals has a side effect. (If one does, use
   [Separate Query from Modifier](separate-query-from-modifier.md) first.)
2. Take two of the conditionals and combine them into a single expression using a logical
   operator (`||` for sequential guards, `&&` for nested ones).
3. Run the tests.
4. Repeat, combining conditionals one at a time until they're all merged.
5. Consider [Extract Function](extract-function.md) on the resulting condition to name it.

## Example

Before — three separate guards returning the same value:

```ruby
def disability_amount(employee)
  return 0 if employee.seniority < 2
  return 0 if employee.months_disabled > 12
  return 0 if employee.part_time?

  # ... compute amount ...
end
```

After consolidating and extracting a named predicate:

```ruby
def disability_amount(employee)
  return 0 if ineligible_for_disability?(employee)

  # ... compute amount ...
end

def ineligible_for_disability?(employee)
  employee.seniority < 2 ||
    employee.months_disabled > 12 ||
    employee.part_time?
end
```

The intent — "is this employee ineligible?" — is now stated directly.

## Related

- Uses [Extract Function](extract-function.md)
- Often follows [Replace Nested Conditional with Guard Clauses](replace-nested-conditional-with-guard-clauses.md)
- If a side effect blocks it: [Separate Query from Modifier](separate-query-from-modifier.md)

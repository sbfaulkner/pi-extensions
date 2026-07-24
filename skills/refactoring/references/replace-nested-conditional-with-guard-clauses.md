# Replace Nested Conditional with Guard Clauses

**Tag:** simplify-conditional-logic

## Motivation

Conditionals come in two flavors. Some check both legs as equally likely, normal parts of
the behavior — these deserve a symmetric `if/else`. Others check for an *unusual* condition
and bail out. When a check is really "if this odd thing is true, do something and get out
of here," it should be a **guard clause**: an early return that handles the special case up
front. Guard clauses say "this isn't the core of the function; if it happens, deal with it
and leave." Deeply nested conditionals hide the normal path in a thicket of `else`
branches; guard clauses flatten them so the main flow is obvious.

## Mechanics

1. Select the outermost condition that should become a guard, and replace it with a guard
   clause (an early return / raise).
2. Run the tests.
3. Repeat for the other conditions, one at a time, running tests after each.
4. If all guard clauses produce the same result, use
   [Consolidate Conditional Expression](consolidate-conditional-expression.md) to combine
   them.

Tip: you can reverse a condition (`unless`/negation) to turn an `if/else` into a guard.

## Example

Before — nested conditions bury the real calculation:

```ruby
def pay_amount(employee)
  if employee.separated?
    result = { amount: 0, reason_code: "SEP" }
  else
    if employee.retired?
      result = { amount: 0, reason_code: "RET" }
    else
      # ... logic to compute amount ...
      result = { amount: compute_amount(employee), reason_code: "NORMAL" }
    end
  end
  result
end
```

After replacing with guard clauses:

```ruby
def pay_amount(employee)
  return { amount: 0, reason_code: "SEP" } if employee.separated?
  return { amount: 0, reason_code: "RET" } if employee.retired?

  # ... logic to compute amount ...
  { amount: compute_amount(employee), reason_code: "NORMAL" }
end
```

The special cases are handled and dismissed at the top; the normal path stands alone,
unindented.

## Related

- Combine identical guards: [Consolidate Conditional Expression](consolidate-conditional-expression.md)
- Name complex conditions: [Decompose Conditional](decompose-conditional.md)
- Replace type-driven branching: [Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md)

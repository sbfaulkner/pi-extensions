# Decompose Conditional

**Tag:** simplify-conditional-logic

## Motivation

Complex conditional logic is one of the biggest sources of complexity. A long `if/else`
where the *condition* and each *branch* are themselves tangled expressions forces the
reader to decode what's being tested and what happens. Decompose it: extract the condition
and each leg into intention-revealing functions. The overall structure then states the
decision-making at a glance, and the detail is tucked into named functions.

## Mechanics

Apply [Extract Function](extract-function.md) to each piece:

1. Extract the **condition** into its own function named for what it tests.
2. Run the tests.
3. Extract the **then** branch into a function named for what it does.
4. Run the tests.
5. Extract the **else** branch (and any `elsif` legs) similarly.
6. Run the tests.

## Example

Before — a seasonal pricing conditional:

```ruby
def charge(plan, quantity, date)
  if date < plan.summer_start || date > plan.summer_end
    quantity * plan.regular_rate + plan.regular_service_charge
  else
    quantity * plan.summer_rate
  end
end
```

After decomposing:

```ruby
def charge(plan, quantity, date)
  if not_summer?(date, plan)
    regular_charge(plan, quantity)
  else
    summer_charge(plan, quantity)
  end
end

def not_summer?(date, plan)
  date < plan.summer_start || date > plan.summer_end
end

def regular_charge(plan, quantity)
  quantity * plan.regular_rate + plan.regular_service_charge
end

def summer_charge(plan, quantity)
  quantity * plan.summer_rate
end
```

The `charge` method now reads like the business rule it encodes.

## Related

- Built entirely on [Extract Function](extract-function.md)
- Flatten nesting instead: [Replace Nested Conditional with Guard Clauses](replace-nested-conditional-with-guard-clauses.md)
- Merge conditions with the same result: [Consolidate Conditional Expression](consolidate-conditional-expression.md)
- Replace type-based switches: [Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md)

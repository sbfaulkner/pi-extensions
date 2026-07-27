# Reverse Conditional

**Tag:** simplify-conditional-logic · **Source:** refactoring.com catalog (guest entry, Bill Murphy & Martin Fowler)

## Motivation

A conditional with a negated test and both a then and an else clause is harder to read
than it needs to be: the reader must mentally un-negate the condition to follow the flow.
If both clauses exist, reverse the sense of the condition and swap the clauses so the test
reads positively. (A negated test with *only* a then clause is fine — that's often a guard;
see [Replace Nested Conditional with Guard Clauses](replace-nested-conditional-with-guard-clauses.md).)

In Ruby, also prefer `if` with a positive condition over `unless`/`else`, which is widely
considered unreadable.

## Mechanics

1. Remove the negation from the condition (or replace the predicate with its positive
   counterpart).
2. Swap the then and else clauses.
3. Run the tests.

## Example

Before:

```ruby
if !summer?(date)
  charge = winter_charge(quantity)
else
  charge = summer_charge(quantity)
end
```

After:

```ruby
if summer?(date)
  charge = summer_charge(quantity)
else
  charge = winter_charge(quantity)
end
```

## Related

- Two negations stacked: [Remove Double Negative](remove-double-negative.md)
- Prefer idiomatic conditional forms: [Recompose Conditional](recompose-conditional.md)
- Negated guard with no else: [Replace Nested Conditional with Guard Clauses](replace-nested-conditional-with-guard-clauses.md)

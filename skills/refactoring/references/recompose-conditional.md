# Recompose Conditional

**Tag:** simplify-conditional-logic · **Source:** *Refactoring: Ruby Edition*

## Motivation

Conditional logic often stays in a verbose form when Ruby offers a construct that says the
same thing more directly: an `if/else` assigning one variable is a ternary or an `||`
default; an `if !` is an `unless`; a guarded call is a one-line modifier or `&.`. Recompose
the conditional into the most readable idiomatic form. The goal is *readability, not
compression* — when a golfed form makes the reader decode it (nested ternaries, clever
`&&`/`||` chains driving side effects), the verbose form was better.

## Mechanics

1. Identify the conditional and what it produces (a value, a guard, an action).
2. Replace it with the matching idiom: ternary or `||`/`||=` for value selection, `unless`
   for negative tests, statement modifiers for one-line guards, `&.` for nil-guarded calls.
3. Run the tests.

## Example

Before:

```ruby
parameters = params ? params : []

if !user.nil?
  name = user.name
end
```

After:

```ruby
parameters = params || []

name = user&.name
```

## Related

- Extract and name complex conditions instead: [Decompose Conditional](decompose-conditional.md)
- Flatten nested conditionals: [Replace Nested Conditional with Guard Clauses](replace-nested-conditional-with-guard-clauses.md)
- Flip a condition's sense for readability: [Consolidate Conditional Expression](consolidate-conditional-expression.md)

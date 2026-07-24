# Introduce Assertion

**Tag:** simplify-conditional-logic

## Motivation

Sections of code often work only if certain conditions are true — a square root only on a
non-negative number, a discount only when there is one. Such assumptions are frequently
implicit. An assertion makes an assumption **explicit**: a conditional statement that should
always be true, serving as communication to the reader and as a check that fails fast if the
assumption is violated. Assertions should never affect program behavior; removing them must
not change anything.

## Mechanics

1. When you spot an assumed condition, add an assertion that states it.
2. Run the tests (a good assertion shouldn't change behavior; if a test breaks, the
   assumption was wrong or the assertion is misplaced).

Because assertions are checks that never affect running behavior, add them freely to
document constraints — but don't use them for error handling of things that can legitimately
happen at runtime; those need real validation.

## Example

Before — an implicit assumption that discount rate is positive:

```ruby
def apply_discount(number)
  @discount_rate ? number - (@discount_rate * number) : number
end
```

After making the assumption explicit:

```ruby
def apply_discount(number)
  return number unless @discount_rate

  raise "discount rate must be positive" unless @discount_rate.positive?

  number - (@discount_rate * number)
end
```

## Related

- Often paired with [Replace Nested Conditional with Guard Clauses](replace-nested-conditional-with-guard-clauses.md)
- For error paths that can happen at runtime: [Replace Error Code with Exception](replace-error-code-with-exception.md), [Replace Exception with Precheck](replace-exception-with-precheck.md)

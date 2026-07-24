# Introduce Special Case

**Tag:** simplify-conditional-logic · **Alias:** Introduce Null Object

## Motivation

When many places in the code check for the same special value — most commonly `nil` — and
react the same way, that duplicated conditional logic is a smell. Capture the common
behavior in a **special-case object** that responds to the same interface as a normal one
but with the special-case answers. A **Null Object** is the classic example: instead of
`customer.nil? ? "occupant" : customer.name`, an "unknown customer" object simply returns
`"occupant"`.

## Mechanics

1. Add a method to the subject (or its type) that says whether it's the special case
   (e.g., `unknown?`), returning `false` for normal instances.
2. Create the special-case object with only that check returning `true`.
3. Apply [Extract Function](extract-function.md) to the special-case checks scattered around
   the code, ensuring they all use the same check.
4. Introduce the special-case object into the code (returned from lookups, etc.) so those
   checks find it.
5. For each element of common special-case behavior, add a method to the special-case object
   that returns the canned value, and replace the caller's conditional with a plain call.
6. Run tests after each replacement, then remove now-dead conditionals.

## Example

Before — every site guards for an unknown customer:

```ruby
name = customer == "unknown" ? "occupant" : customer.name
plan = customer == "unknown" ? Registry.billing_plans[:basic] : customer.billing_plan
```

After introducing an unknown-customer special case:

```ruby
class UnknownCustomer
  def unknown?
    true
  end

  def name
    "occupant"
  end

  def billing_plan
    Registry.billing_plans[:basic]
  end
end

# lookups return UnknownCustomer.new instead of "unknown"
name = customer.name
plan = customer.billing_plan
```

## Related

- Uses [Extract Function](extract-function.md)
- An alternative to sprinkling [Replace Nested Conditional with Guard Clauses](replace-nested-conditional-with-guard-clauses.md)
- Related: [Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md)

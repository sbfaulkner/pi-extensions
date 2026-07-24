# Replace Inline Code with Function Call

**Tag:** moving-features

## Motivation

When inline code does the same thing as an existing function, replace it with a call to
that function. This removes duplication, names the behavior, and means future changes to
that behavior happen in one place. Watch out for code that merely looks similar but means
something different — only replace when it's genuinely the same operation.

## Mechanics

1. Replace the inline code with a call to the existing function.
2. Run the tests.

## Example

Before — inline membership check duplicates an existing helper:

```ruby
applied_promotions = []
applied_promotions << "spring_fling" if a_customer[:jobs].include?("legal")
```

After using the function that expresses the same intent:

```ruby
applied_promotions << "spring_fling" if legal_customer?(a_customer)
```

where `legal_customer?` already encapsulates `customer[:jobs].include?("legal")`.

## Related

- The inverse in spirit is [Inline Function](inline-function.md)
- Relies on a function created via [Extract Function](extract-function.md)

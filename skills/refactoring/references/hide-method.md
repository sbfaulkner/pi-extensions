# Hide Method

**Tag:** refactoring-apis · **Source:** *Refactoring* (1st edition)

## Motivation

A method that no other class uses should not be public. Every public method is a promise —
callers may appear, and then you can't change it freely. As you refactor, method usage
shifts; periodically sweep for methods whose last outside caller has gone and make them
`private` (or `protected` when same-class peers need them). The narrower a class's public
surface, the easier it is to understand and change.

## Mechanics

1. Check for callers outside the class (search; with Sorbet, tightening visibility and
   running `srb tc` performs the check for you).
2. Make the method `private`.
3. Run the tests.

Do this in batches during cleanup sweeps — it's cheap and compounding.

## Example

```ruby
class Invoice
  def total
    line_items.sum { |item| discounted_price(item) }
  end

  private # discounted_price's last external caller was refactored away

  def discounted_price(item)
    item.price * (1 - item.discount)
  end
end
```

## Related

- The data equivalent: [Encapsulate Variable](encapsulate-variable.md)
- Methods nobody calls at all: [Remove Dead Code](remove-dead-code.md)
- Interface-narrowing at class scale: [Extract Interface](extract-interface.md)

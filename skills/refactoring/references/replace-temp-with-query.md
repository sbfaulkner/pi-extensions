# Replace Temp with Query

**Tag:** encapsulation

## Motivation

A temporary variable that holds the result of an expression can be replaced by a query
function that computes it. This removes the temp (reducing local state), lets the
computed value be reused elsewhere without duplicating the expression, and — crucially —
is often a necessary prerequisite for [Extract Function](extract-function.md), because
turning temps into queries removes the local variables that would otherwise have to become
parameters or return values. It works best inside a class where the query can become a
method; it applies to temporaries that are calculated once and not subsequently modified.

## Mechanics

1. Check the variable is assigned **once** and only once (if not, apply
   [Split Variable](split-variable.md) first). Also verify the expression yields the same
   result whenever it's evaluated (no dependence on mutable state that changes between the
   assignment and the uses).
2. If the variable isn't already read-only, make it read-only and run the tests.
3. Extract the assignment's right-hand side into a function (using
   [Extract Function](extract-function.md)). Initially you can keep the variable and set it
   to a call of the new function.
4. Run the tests.
5. Use [Inline Variable](inline-variable.md) to remove the temp entirely, replacing each
   use with a call to the new query.

## Example

Before — two temps (`base_price`, `discount_factor`) muddy a class method:

```ruby
class Order
  def initialize(quantity, item)
    @quantity = quantity
    @item = item
  end

  def price
    base_price = @quantity * @item.price
    discount_factor = 0.98
    discount_factor -= 0.03 if base_price > 1000
    base_price * discount_factor
  end
end
```

After replacing both temps with query methods:

```ruby
class Order
  def initialize(quantity, item)
    @quantity = quantity
    @item = item
  end

  def price
    base_price * discount_factor
  end

  private

  def base_price
    @quantity * @item.price
  end

  def discount_factor
    base_price > 1000 ? 0.95 : 0.98
  end
end
```

Now `price` reads as a clear formula, and `base_price` is reusable by `discount_factor`.

## Related

- Prerequisite when a temp is assigned more than once: [Split Variable](split-variable.md)
- Uses [Extract Function](extract-function.md) and [Inline Variable](inline-variable.md)
- Often done to enable [Extract Function](extract-function.md) of a larger block
- Related: [Replace Derived Variable with Query](replace-derived-variable-with-query.md)

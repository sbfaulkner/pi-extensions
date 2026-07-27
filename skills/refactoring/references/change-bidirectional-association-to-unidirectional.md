# Change Bidirectional Association to Unidirectional

**Tag:** organizing-data · **Source:** *Refactoring* (1st edition) · **Inverse:** [Change Unidirectional Association to Bidirectional](change-unidirectional-association-to-bidirectional.md)

## Motivation

Bidirectional links are a standing tax: two classes that can't be understood, tested, or
retired separately, plus sync discipline forever. When one direction is no longer earning
its keep — the feature that needed it changed, or a lookup can answer the question — drop
it. The freed design is simpler, and often becomes immutable-friendly
(no post-construction back-pointer wiring).

## Mechanics

1. Find all readers of the pointer you want to remove.
2. For each, provide the object another way: pass it as a parameter, or look it up
   (repository/query) at the point of need. Run tests after each.
3. When no reader remains, remove the pointer field and the sync code in the controlling
   modifier.
4. Run the tests.

## Example

Before — customer reachable from the order's field; after — callers who have the customer
pass it in:

```ruby
class Order
  # before: def discounted_price = gross_price * (1 - customer.discount)
  def discounted_price(customer)
    gross_price * (1 - customer.discount)
  end
end

class Customer
  def price_for(order)
    order.discounted_price(self)
  end
end
```

The `Order#customer` field, and the two-way bookkeeping that maintained it, can now go.

## Related

- Inverse: [Change Unidirectional Association to Bidirectional](change-unidirectional-association-to-bidirectional.md)
- The parameter-passing move it leans on: [Replace Query with Parameter](replace-query-with-parameter.md)

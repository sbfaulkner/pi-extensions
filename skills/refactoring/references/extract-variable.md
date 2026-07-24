# Extract Variable

**Tag:** basic · **Alias:** Introduce Explaining Variable · **Inverse:** [Inline Variable](inline-variable.md)

## Motivation

Expressions can get complex and hard to read. A local variable named after the *meaning*
of a sub-expression breaks the expression into digestible, self-documenting pieces and
gives you a handle to inspect while debugging. If the meaning is useful beyond the current
function's scope, prefer [Extract Function](extract-function.md) so the name is reusable.

## Mechanics

1. Ensure the expression you're extracting has **no side effects**.
2. Declare an immutable variable, and set it to a copy of the expression you want to name.
3. Replace the original expression with the new variable.
4. Run the tests.
5. Repeat for other occurrences of the same expression, replacing each with the variable.

## Example

Before — a dense pricing expression:

```ruby
def price(order)
  # price is base price - quantity discount + shipping
  order[:quantity] * order[:item_price] -
    [0, order[:quantity] - 500].max * order[:item_price] * 0.05 +
    [order[:quantity] * order[:item_price] * 0.1, 100].min
end
```

After extracting explaining variables:

```ruby
def price(order)
  base_price = order[:quantity] * order[:item_price]
  quantity_discount = [0, order[:quantity] - 500].max * order[:item_price] * 0.05
  shipping = [base_price * 0.1, 100].min
  base_price - quantity_discount + shipping
end
```

The comment is now redundant and the arithmetic reads for itself. If this logic belongs to
an `Order` object, consider making these methods on the class instead of local variables.

## Related

- Inverse: [Inline Variable](inline-variable.md)
- When the name should be reusable: [Extract Function](extract-function.md)
- When a temp is set once and derived from other data: [Replace Temp with Query](replace-temp-with-query.md)

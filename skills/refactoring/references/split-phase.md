# Split Phase

**Tag:** basic

## Motivation

When a single chunk of code does two different things — for example, parsing input and then
calculating from it — split it into separate phases with a clear data structure passed
between them. Each phase becomes independently understandable and modifiable, and you can
reason about (and test) one without the other.

## Mechanics

1. Extract the second phase's code into its own function with [Extract Function](extract-function.md).
2. Run the tests.
3. Introduce an intermediate data structure and pass it as an argument to the extracted
   second-phase function.
4. Run the tests.
5. Examine each parameter of the second phase. If it's used by the first phase to compute
   something, move it into the intermediate structure. Run tests after each move.
6. Apply [Extract Function](extract-function.md) to the first phase, returning the
   intermediate data structure.

## Example

Before — parsing and calculation tangled together:

```ruby
def price_order(product, quantity, shipping_method)
  base_price = product[:base_price] * quantity
  discount = [quantity - product[:discount_threshold], 0].max *
    product[:base_price] * product[:discount_rate]
  shipping_per_case = base_price > shipping_method[:discount_threshold] ?
    shipping_method[:discounted_fee] : shipping_method[:fee_per_case]
  shipping_cost = quantity * shipping_per_case
  base_price - discount + shipping_cost
end
```

After splitting into a pricing phase and a shipping phase with an intermediate record:

```ruby
def price_order(product, quantity, shipping_method)
  price_data = calculate_pricing_data(product, quantity)
  apply_shipping(price_data, shipping_method)
end

def calculate_pricing_data(product, quantity)
  base_price = product[:base_price] * quantity
  discount = [quantity - product[:discount_threshold], 0].max *
    product[:base_price] * product[:discount_rate]
  { base_price: base_price, quantity: quantity, discount: discount }
end

def apply_shipping(price_data, shipping_method)
  shipping_per_case = price_data[:base_price] > shipping_method[:discount_threshold] ?
    shipping_method[:discounted_fee] : shipping_method[:fee_per_case]
  shipping_cost = price_data[:quantity] * shipping_per_case
  price_data[:base_price] - price_data[:discount] + shipping_cost
end
```

## Related

- Uses [Extract Function](extract-function.md)
- Related grouping: [Combine Functions into Transform](combine-functions-into-transform.md)

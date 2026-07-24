def price_order(product, quantity, shipping_method)
  base_price = product[:base_price] * quantity
  discount = [quantity - product[:discount_threshold], 0].max *
    product[:base_price] * product[:discount_rate]
  shipping_per_case = base_price > shipping_method[:discount_threshold] ?
    shipping_method[:discounted_fee] : shipping_method[:fee_per_case]
  shipping_cost = quantity * shipping_per_case
  base_price - discount + shipping_cost
end

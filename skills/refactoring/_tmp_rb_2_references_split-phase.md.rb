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

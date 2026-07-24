def discounted_price(order)
  order.base_price > 100 ? order.base_price * 0.9 : order.base_price
end

discounted_price(order)

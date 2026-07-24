def discounted_price(order, base_price)
  base_price > 100 ? base_price * 0.9 : base_price
end

discounted_price(order, order.base_price)

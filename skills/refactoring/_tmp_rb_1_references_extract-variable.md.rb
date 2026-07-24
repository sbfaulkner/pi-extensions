def price(order)
  # price is base price - quantity discount + shipping
  order[:quantity] * order[:item_price] -
    [0, order[:quantity] - 500].max * order[:item_price] * 0.05 +
    [order[:quantity] * order[:item_price] * 0.1, 100].min
end

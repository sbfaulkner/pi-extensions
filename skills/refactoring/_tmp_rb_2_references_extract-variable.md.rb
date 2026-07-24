def price(order)
  base_price = order[:quantity] * order[:item_price]
  quantity_discount = [0, order[:quantity] - 500].max * order[:item_price] * 0.05
  shipping = [base_price * 0.1, 100].min
  base_price - quantity_discount + shipping
end

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

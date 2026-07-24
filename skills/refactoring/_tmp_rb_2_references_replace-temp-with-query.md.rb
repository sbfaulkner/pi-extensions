class Order
  def initialize(quantity, item)
    @quantity = quantity
    @item = item
  end

  def price
    base_price * discount_factor
  end

  private

  def base_price
    @quantity * @item.price
  end

  def discount_factor
    base_price > 1000 ? 0.95 : 0.98
  end
end

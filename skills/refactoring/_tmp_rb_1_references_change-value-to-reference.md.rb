class Order
  def initialize(data)
    @customer = Customer.new(data[:customer_id])
  end
end

class Customer
  attr_accessor :discount_rate

  def initialize(name)
    @name = name
    @contract = CustomerContract.new
  end
end

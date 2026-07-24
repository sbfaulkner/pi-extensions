class Customer
  def initialize(name)
    @name = name
    @contract = CustomerContract.new
  end

  def discount_rate
    @contract.discount_rate
  end

  def discount_rate=(arg)
    @contract.discount_rate = arg
  end
end

class CustomerContract
  attr_accessor :discount_rate
end

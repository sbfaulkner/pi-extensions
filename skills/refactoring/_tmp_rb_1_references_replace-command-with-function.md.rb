class ChargeCalculator
  def initialize(customer, usage)
    @customer = customer
    @usage = usage
  end

  def execute
    @customer.rate * @usage
  end
end

ChargeCalculator.new(customer, usage).execute

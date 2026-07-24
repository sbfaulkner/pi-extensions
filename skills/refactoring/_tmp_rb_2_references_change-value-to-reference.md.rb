module CustomerRepository
  @customers = {}

  def self.find_or_create(id)
    @customers[id] ||= Customer.new(id)
  end
end

class Order
  def initialize(data)
    @customer = CustomerRepository.find_or_create(data[:customer_id])
  end
end

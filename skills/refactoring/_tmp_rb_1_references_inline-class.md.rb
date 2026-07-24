class ShippingRules
  attr_reader :charge

  def initialize(charge)
    @charge = charge
  end
end

class Order
  def initialize(shipping_rules)
    @shipping_rules = shipping_rules
  end

  def shipping_charge
    @shipping_rules.charge
  end
end

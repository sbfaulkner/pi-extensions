class UnknownCustomer
  def unknown?
    true
  end

  def name
    "occupant"
  end

  def billing_plan
    Registry.billing_plans[:basic]
  end
end

# lookups return UnknownCustomer.new instead of "unknown"
name = customer.name
plan = customer.billing_plan

def book(customer, is_premium)
  if is_premium
    add_to_priority_plan(customer)
  else
    add_to_normal_plan(customer)
  end
end

book(customer, true)
book(customer, false)

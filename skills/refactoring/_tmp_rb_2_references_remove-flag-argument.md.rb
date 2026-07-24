def premium_book(customer)
  add_to_priority_plan(customer)
end

def book(customer)
  add_to_normal_plan(customer)
end

premium_book(customer)
book(customer)

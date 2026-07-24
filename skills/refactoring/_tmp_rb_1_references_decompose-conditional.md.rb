def charge(plan, quantity, date)
  if date < plan.summer_start || date > plan.summer_end
    quantity * plan.regular_rate + plan.regular_service_charge
  else
    quantity * plan.summer_rate
  end
end

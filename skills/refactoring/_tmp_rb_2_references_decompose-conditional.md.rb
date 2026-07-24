def charge(plan, quantity, date)
  if not_summer?(date, plan)
    regular_charge(plan, quantity)
  else
    summer_charge(plan, quantity)
  end
end

def not_summer?(date, plan)
  date < plan.summer_start || date > plan.summer_end
end

def regular_charge(plan, quantity)
  quantity * plan.regular_rate + plan.regular_service_charge
end

def summer_charge(plan, quantity)
  quantity * plan.summer_rate
end

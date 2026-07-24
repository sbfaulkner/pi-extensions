def disability_amount(employee)
  return 0 if ineligible_for_disability?(employee)

  # ... compute amount ...
end

def ineligible_for_disability?(employee)
  employee.seniority < 2 ||
    employee.months_disabled > 12 ||
    employee.part_time?
end

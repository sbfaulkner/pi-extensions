def disability_amount(employee)
  return 0 if employee.seniority < 2
  return 0 if employee.months_disabled > 12
  return 0 if employee.part_time?

  # ... compute amount ...
end

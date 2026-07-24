def pay_amount(employee)
  return { amount: 0, reason_code: "SEP" } if employee.separated?
  return { amount: 0, reason_code: "RET" } if employee.retired?

  # ... logic to compute amount ...
  { amount: compute_amount(employee), reason_code: "NORMAL" }
end

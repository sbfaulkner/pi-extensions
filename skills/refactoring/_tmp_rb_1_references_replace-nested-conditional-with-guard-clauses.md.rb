def pay_amount(employee)
  if employee.separated?
    result = { amount: 0, reason_code: "SEP" }
  else
    if employee.retired?
      result = { amount: 0, reason_code: "RET" }
    else
      # ... logic to compute amount ...
      result = { amount: compute_amount(employee), reason_code: "NORMAL" }
    end
  end
  result
end

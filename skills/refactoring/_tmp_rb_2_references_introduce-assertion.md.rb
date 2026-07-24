def apply_discount(number)
  return number unless @discount_rate

  raise "discount rate must be positive" unless @discount_rate.positive?

  number - (@discount_rate * number)
end

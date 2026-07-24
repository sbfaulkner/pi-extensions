def apply_discount(number)
  @discount_rate ? number - (@discount_rate * number) : number
end

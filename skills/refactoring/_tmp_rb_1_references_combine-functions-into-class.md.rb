def base_charge(reading)
  base_rate(reading[:month], reading[:year]) * reading[:quantity]
end

def taxable_charge(reading)
  [0, base_charge(reading) - tax_threshold(reading[:year])].max
end

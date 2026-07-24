def enrich_reading(original)
  result = original.dup
  result[:base_charge] = base_rate(result[:month], result[:year]) * result[:quantity]
  result[:taxable_charge] = [0, result[:base_charge] - tax_threshold(result[:year])].max
  result
end

# callers read enriched fields
reading = enrich_reading(raw_reading)
reading[:taxable_charge]

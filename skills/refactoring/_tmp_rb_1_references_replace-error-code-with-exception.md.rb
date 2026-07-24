def local_ship_rate(country)
  data = ShippingRates.for(country)
  return -23 if data.nil? # error code

  data[:rate]
end

rate = local_ship_rate(country)
handle_unknown_country if rate == -23

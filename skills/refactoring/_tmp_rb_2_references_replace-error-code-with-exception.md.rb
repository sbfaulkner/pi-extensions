class UnknownCountryError < StandardError; end

def local_ship_rate(country)
  data = ShippingRates.for(country)
  raise UnknownCountryError, country if data.nil?

  data[:rate]
end

begin
  rate = local_ship_rate(country)
rescue UnknownCountryError
  handle_unknown_country
end

class Person
  def initialize
    @telephone_number = TelephoneNumber.new
  end

  def office_area_code=(code)
    @telephone_number.area_code = code
  end
end

class TelephoneNumber
  attr_reader :area_code, :number

  def initialize(area_code, number)
    @area_code = area_code
    @number = number
  end

  def ==(other)
    other.is_a?(TelephoneNumber) &&
      area_code == other.area_code && number == other.number
  end
  alias eql? ==

  def hash
    [area_code, number].hash
  end
end

class Person
  def office_area_code=(code)
    @telephone_number = TelephoneNumber.new(code, @telephone_number.number)
  end
end

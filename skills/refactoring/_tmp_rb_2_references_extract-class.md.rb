class TelephoneNumber
  attr_accessor :area_code, :number

  def to_s
    "(#{area_code}) #{number}"
  end
end

class Person
  attr_accessor :name

  def initialize
    @telephone_number = TelephoneNumber.new
  end

  def telephone_number
    @telephone_number.to_s
  end

  def office_area_code
    @telephone_number.area_code
  end

  def office_area_code=(arg)
    @telephone_number.area_code = arg
  end
end

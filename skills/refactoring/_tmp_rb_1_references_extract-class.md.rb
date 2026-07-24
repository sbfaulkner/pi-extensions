class Person
  attr_accessor :name, :office_area_code, :office_number

  def telephone_number
    "(#{office_area_code}) #{office_number}"
  end
end

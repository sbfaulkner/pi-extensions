class Person
  def initialize(name, gender_code)
    @name = name
    @gender_code = gender_code
  end

  attr_reader :gender_code

  def self.create_male(name)
    new(name, "M")
  end
end

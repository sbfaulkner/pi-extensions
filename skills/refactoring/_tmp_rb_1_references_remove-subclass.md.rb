class Person
  def initialize(name)
    @name = name
  end
end

class Male < Person
  def male?
    true
  end

  def gender_code
    "M"
  end
end

class Employee
  def initialize(name, type)
    @name = name
    @type = type
  end

  attr_reader :type
end

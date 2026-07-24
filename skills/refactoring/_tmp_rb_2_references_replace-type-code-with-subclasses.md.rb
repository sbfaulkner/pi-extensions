class Employee
  def self.create(name, type)
    klass = { "engineer" => Engineer, "manager" => Manager, "salesperson" => Salesperson }
    klass.fetch(type).new(name)
  end

  def initialize(name)
    @name = name
  end
end

class Engineer < Employee
  def type
    "engineer"
  end
end

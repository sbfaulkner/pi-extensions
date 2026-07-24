class Party
  def initialize(name)
    @name = name
  end
end

class Employee < Party
  def initialize(name, id, monthly_cost)
    super(name)
    @id = id
    @monthly_cost = monthly_cost
  end
end

class Party
end

class Employee < Party
  def initialize(name, id, monthly_cost)
    @name = name
    @id = id
    @monthly_cost = monthly_cost
  end
end
